# 04 业务场景: 建图打点模式

## 目录

- [1. 场景描述](#1-场景描述)
- [2. 完整数据流（图 13）](#2-完整数据流图-13)
- [3. Odom 拦截机制（图 14）](#3-odom-拦截机制图-14)
- [4. useWaypointStore 状态机（图 15）](#4-usewaypointstore-状态机图-15)
- [5. Z 轴调整逻辑流程（图 16）](#5-z-轴调整逻辑流程图-16)
- [6. WaypointPanel 生命周期](#6-waypointpanel-生命周期)
- [7. MarkerArray 可视化](#7-markerarray-可视化)
- [8. lastDroneIdRef 持久化机制](#8-lastdroneidref-持久化机制)
- [9. 航点项目管理（图 19）](#9-航点项目管理图-19)
- [10. 拖拽排序机制（图 20）](#10-拖拽排序机制图-20)
- [11. 前端颜色覆盖机制（图 21）](#11-前端颜色覆盖机制图-21)
- [12. 与 waypoint_recorder.py 对照](#12-与-waypointrecorderpy-对照)
- [13. 已知问题](#13-已知问题)
- [14. 已知限制与未来规划](#14-已知限制与未来规划)

---

## 1. 场景描述

建图打点模式 (`mapping-waypoint`) 用于在无人机完成 SLAM 建图后，在 3D 地图中标记关键航点：

1. 用户在 SceneSelectionDialog 选择「建图打点」
2. 系统自动订阅所有可用无人机的 `visual_slam/odom` topic
3. 用户点击机器人模型 → 弹出 WaypointPanel（而非 DroneControlPanel）
4. WaypointPanel 实时显示该无人机的 odom 位置 (x, y, z)
5. 用户点击 "Record" 将当前位置录入航点列表，可选 Z 轴调整
6. 航点列表变化时自动发布 MarkerArray 到 `/drone_{id}_waypoint_markers`（每架无人机独立 topic），3D 面板渲染球体 + 编号 + 连线
7. 用户可通过拖拽调整航点顺序，通过 Save/Load/Manage 管理航点项目集
8. 所有航点操作 topic 均为每机独立: `/drone_{id}_save_waypoints`、`/drone_{id}_load_waypoints` 等，WaypointPanel 通过 `droneTopics(droneId)` 动态构建 topic 名称
9. `useActiveDroneRouting` 在切换无人机时自动重映射 `waypointMarkers` topic

---

## 2. 完整数据流（图 13）

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          建图打点模式 数据流                               │
│                                                                          │
│  ROS 后端                    Foxglove Bridge         前端处理              │
│  ────────                    ──────────────          ────────             │
│                                                                          │
│  Visual SLAM                                                             │
│  /drone_{id}_visual_slam/odom  ──WS──►  ThreeDeeRender.tsx              │
│  (nav_msgs/Odometry)                    │                                │
│                                         │  消息处理循环                    │
│                                         │  正则: /^\/drone_\w+_visual_   │
│                                         │         slam\/odom$/           │
│                                         │                                │
│                                         ▼                                │
│                              extractDroneIdFromTopic(topic)              │
│                              → droneId = "1"                             │
│                              odom.pose.pose.position → {x, y, z}        │
│                                         │                                │
│                                         ▼                                │
│                              useWaypointStore                            │
│                              .updateOdom(droneId, {x, y, z})            │
│                                         │                                │
│                              ┌──────────┴──────────┐                     │
│                              ▼                      ▼                    │
│                    latestOdom["1"]          latestOdom["2"]              │
│                    = {x, y, z}             = {x, y, z}                  │
│                              │                                           │
│                              ▼                                           │
│                    WaypointPanel (droneId="1")                           │
│                    实时显示:                                              │
│                     X: 1.234  Y: 5.678  Z: 0.912                       │
│                              │                                           │
│           ┌──────────────────┼──────────────────┐                       │
│           ▼                  ▼                   ▼                       │
│    [Record 按钮]      [Del Last 按钮]     [Clear 按钮]                   │
│           │                  │                   │                       │
│           ▼                  ▼                   ▼                       │
│    addWaypoint()      deleteLast()       clearWaypoints()               │
│    ├── 读取 latestOdom                                                   │
│    ├── applyZ(rawZ, zSettings)                                          │
│    └── 存入 tables[droneId].waypoints                                    │
│                              │                                           │
│                              ▼                                           │
│                    useEffect: waypoints 变化检测                          │
│                              │                                           │
│                              ▼                                           │
│                    makeWaypointMarkerArray(waypoints, "world")           │
│                    构造 MarkerArray:                                      │
│                     ├── DELETEALL (清除旧标记)                            │
│                     ├── SPHERE × N (Spikive 橙 #EF833A)                 │
│                     ├── TEXT × N (白色编号)                               │
│                     └── LINE_STRIP (紫色连线 #9C27B0, ≥2点)             │
│                              │                                           │
│                              ▼                                           │
│                    publish("/drone_{id}_waypoint_markers", MarkerArray)   │
│                              │                                           │
│                              ▼                                           │
│                    ThreeDeeRender 颜色覆盖拦截                            │
│                    正则: /^\/drone_\d+_waypoint_markers$/                 │
│                    (SPHERE→橙, TEXT→白, LINE→紫)                         │
│                              │                                           │
│                              ▼                                           │
│                    3D Panel 渲染:                                         │
│                     ● ── ● ── ● ── ●  (航点球体 + 连线)                  │
│                     1    2    3    4   (编号标签)                         │
│                                                                          │
│  ┌─────────── 项目管理路径 (per-drone topics) ────────────────────┐       │
│  │                                                                 │       │
│  │  WaypointPanel 使用 droneTopics(droneId) 构建 topic 名          │       │
│  │                                                                 │       │
│  │  [Save]    → publish /drone_{id}_save_waypoints                │       │
│  │  [Load]    → publish /drone_{id}_load_waypoints                │       │
│  │  [Delete]  → publish /drone_{id}_delete_waypoint_project       │       │
│  │  [Reorder] → publish /drone_{id}_reorder_waypoints             │       │
│  │                                                                 │       │
│  │  后端 → /drone_{id}_waypoint_project_list                      │       │
│  │  → ThreeDeeRender 正则拦截                                      │       │
│  │  → setProjectList(droneId, list) → Dialog 展示可用项目列表      │       │
│  │                                                                 │       │
│  │  useActiveDroneRouting 在切换无人机时重映射 waypointMarkers     │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Odom 拦截机制（图 14）

```text
                ThreeDeeRender.tsx 消息处理循环
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  for (const message of currentFrameMessages) {             │
│    │                                                       │
│    │  ┌──────────────────────────────────────────────────┐ │
│    │  │ 正常渲染路径 (所有消息)                            │ │
│    │  │ → Renderer.handleMessage(message)                │ │
│    │  │ → 点云/Marker/TF 更新                             │ │
│    │  └──────────────────────────────────────────────────┘ │
│    │                                                       │
│    │  ┌──────────────────────────────────────────────────┐ │
│    │  │ Spikive Odom 拦截 (仅 mapping-waypoint 模式)      │ │
│    │  │                                                  │ │
│    │  │ if (sceneMode === "mapping-waypoint") {           │ │
│    │  │   if (/^\/drone_\w+_visual_slam\/odom$/           │ │
│    │  │       .test(message.topic))                       │ │
│    │  │   {                                              │ │
│    │  │     droneId = extractDroneIdFromTopic(topic)      │ │
│    │  │     ├── 正则: /^\/drone_(\w+)_/                   │ │
│    │  │     └── 返回: "1", "2", ...                       │ │
│    │  │                                                  │ │
│    │  │     position = message.message                    │ │
│    │  │       .pose.pose.position                        │ │
│    │  │     ├── x: number                                │ │
│    │  │     ├── y: number                                │ │
│    │  │     └── z: number                                │ │
│    │  │                                                  │ │
│    │  │     useWaypointStore                              │ │
│    │  │       .updateOdom(droneId, {x, y, z})            │ │
│    │  │   }                                              │ │
│    │  │ }                                                │ │
│    │  └──────────────────────────────────────────────────┘ │
│    │                                                       │
│  }  // end for                                             │
│                                                            │
│  关键行号 (ThreeDeeRender.tsx):                              │
│    L638-640: 读取 sceneMode 和 updateOdom                   │
│    L644-667: 动态订阅 odom topic (mapping 模式独有)          │
│    L730-745: odom 消息拦截和 Store 写入                      │
│                                                            │
│  订阅注入 (仅 mapping-waypoint 模式):                        │
│    topics.filter(t =>                                      │
│      /^\/drone_\w+_visual_slam\/odom$/.test(t.name))       │
│    → 额外订阅 {topic, preload: false,                      │
│        sampling: "latest-per-render-tick"}                  │
│                                                            │
└────────────────────────────────────────────────────────────┘

两条并行路径:
  ┌────────────┐         ┌────────────────┐
  │ 正常渲染    │         │ Odom 拦截       │
  │ (所有消息)  │         │ (仅 odom 消息)  │
  │            │         │                │
  │ Renderer   │         │ useWaypointStore│
  │ → Three.js │         │ → WaypointPanel │
  │ → Canvas   │         │ → 实时位置显示   │
  └────────────┘         └────────────────┘
  独立运行，互不干扰
```

---

## 4. useWaypointStore 状态机（图 15）

```text
                    useWaypointStore 状态结构
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  tables: Record<droneId, DroneWaypointState>            │
│  ┌─────────────────────────────────────────────────┐    │
│  │  "1": {                                         │    │
│  │    waypoints: [{idx:0, x:1.2, y:3.4, z:1.5},...│    │
│  │    zMode: "override"                            │    │
│  │    overrideZValue: 1.5                          │    │
│  │    zOffsetValue: 0.0                            │    │
│  │  }                                              │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  "2": { ... }                                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  latestOdom: Record<droneId, OdomPosition>              │
│  ┌─────────────────────────────────────────────────┐    │
│  │  "1": { x: 1.234, y: 5.678, z: 0.912 }         │    │
│  │  "2": { x: -0.5, y: 2.1, z: 1.3 }              │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  projectLists: Record<droneId, string[]>                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  "1": ["route_A", "route_B", "test_1"]          │    │
│  │  "2": ["patrol_1", "patrol_2"]                  │    │
│  └─────────────────────────────────────────────────┘    │
│  (每架无人机独立维护项目列表, setProjectList(droneId, list))│
│                                                         │
└─────────────────────────────────────────────────────────┘

                    状态转换图
┌──────────┐  getOrCreate(droneId)  ┌──────────────────────────┐
│ 空 (无记录)│ ──────────────────── ► │ 初始化状态                 │
│           │                       │ waypoints: []              │
└──────────┘                       │ zMode: "override"          │
                                   │ overrideZValue: 1.5        │
                                   │ zOffsetValue: 0.0          │
                                   └────────────┬───────────────┘
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         ▼                      ▼                      ▼
              ┌────────────────┐    ┌────────────────┐    ┌────────────────────┐
              │ addWaypoint()  │    │ updateZSettings│    │ updateOdom()       │
              │                │    │ ()             │    │ (高频: 每帧)        │
              │ 读 latestOdom  │    │ 更新 zMode /   │    │ 更新 latestOdom    │
              │ applyZ(rawZ)   │    │ overrideZ /    │    │ [droneId]          │
              │ 追加 waypoint  │    │ zOffset        │    │                    │
              │ 自动编号 idx   │    │                │    │ 不触发 waypoints   │
              └───────┬────────┘    └────────────────┘    │ 变化              │
                      │                                    └────────────────────┘
                      ▼
              ┌──────────────────────────────────────┐
              │ waypoints: [wp0, wp1, ..., wpN]       │
              └──────────┬────────────┬──────────────┘
                         │            │
              ┌──────────▼──┐  ┌──────▼──────────┐
              │ deleteLast()│  │ removeWaypoint() │
              │ 移除末尾     │  │ 按 idx 移除      │
              │             │  │ 重新编号          │
              └─────────────┘  └─────────────────┘
                         │            │
                         ▼            ▼
              ┌──────────────────────────────────────┐
              │ clearWaypoints()                      │
              │ waypoints: []                         │
              │ 回到初始化状态 (保留 zSettings)         │
              └──────────────────────────────────────┘

写入者与读取者:
  ┌────────────────────────────────────────────────────────────────┐
  │  写入者                           │  读取者                    │
  ├──────────────────────────────────┼──────────────────────────── │
  │  ThreeDeeRender (odom 拦截)       │  WaypointPanel             │
  │  → updateOdom() [每帧, 高频]      │  → latestOdom[droneId]     │
  │                                  │    (实时位置显示)            │
  │  WaypointPanel (用户操作)         │  → tables[droneId]         │
  │  → addWaypoint()                 │    .waypoints (航点列表)    │
  │  → removeWaypoint()              │  → tables[droneId]         │
  │  → deleteLast()                  │    .zMode (Z 轴模式)       │
  │  → clearWaypoints()              │  → projectLists[droneId]   │
  │  → updateZSettings()             │    (项目列表供 Dialog 使用)  │
  │                                  │                            │
  │  ThreeDeeRender (project_list    │                            │
  │    正则拦截 /drone_\d+_waypoint_  │                            │
  │    project_list)                 │                            │
  │  → setProjectList(droneId, list) │                            │
  └──────────────────────────────────┴────────────────────────────┘
```

---

## 5. Z 轴调整逻辑流程（图 16）

```text
                         applyZ(actualZ, state)
                         ┌──────────────┐
                         │  输入:        │
                         │  actualZ (odom │
                         │  实际 Z 值)    │
                         │  state (Z设置) │
                         └──────┬───────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  state.zMode = ?     │
                     └──────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
              ▼                 ▼                  ▼
    ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │ zMode="none" │  │ zMode="override" │  │ zMode="offset"   │
    │              │  │                  │  │                  │
    │ 返回原始值    │  │ 返回固定值        │  │ 返回偏移值        │
    │ → actualZ    │  │ → overrideZValue │  │ → actualZ +      │
    │              │  │   (默认 1.5m)     │  │   zOffsetValue   │
    │ 适用: 不需要  │  │                  │  │   (默认 0.0m)    │
    │ Z轴修正      │  │ 适用: 所有航点    │  │                  │
    │              │  │ 保持统一高度      │  │ 适用: 整体抬升    │
    └──────────────┘  └──────────────────┘  │ 或下降           │
                                            └──────────────────┘

WaypointPanel UI 布局:
┌────────────────────────────────────────────┐
│  Z 轴设置                                  │
│                                            │
│  ○ Raw Z (使用 odom 原始值)                 │
│  ● Override Z: [  1.5  ] m  (固定覆盖)     │
│  ○ Offset Z:  [  0.0  ] m  (加减偏移)     │
│                                            │
│  当前 Z 值: 0.912m                         │
│  调整后 Z:  1.500m (override 生效)         │
└────────────────────────────────────────────┘

与 waypoint_recorder.py 的 Z 轴处理完全对应:
  Python:  z_value = override_z if use_override else (raw_z + z_offset)
  TS:      z_value = applyZ(raw_z, {zMode, overrideZValue, zOffsetValue})
```

---

## 6. WaypointPanel 生命周期

```text
  触发条件: 用户点击机器人模型 + sceneMode == "mapping-waypoint"
          │
          ▼
  ┌───────────────────────────────────────────────────────────────┐
  │   React mount                                                 │
  │                                                               │
  │   topics = droneTopics(droneId)  // 动态构建 per-drone topic  │
  │                                                               │
  │   useEffect:                                                  │
  │     advertise(topics.waypointMarkers,                         │
  │       "visualization_msgs/MarkerArray")                       │
  │     advertise(topics.saveWaypoints, "std_msgs/String")        │
  │     advertise(topics.loadWaypoints, "std_msgs/String")        │
  │     advertise(topics.deleteWaypointProject, "std_msgs/String")│
  │     advertise(topics.reorderWaypoints, "std_msgs/String")     │
  │                                                               │
  │   getOrCreate(droneId)                                        │
  │   → 初始化该无人机的航点状态                                     │
  └─────────┬─────────────────────────────────────────────────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  用户操作循环                                                         │
  │                                                                      │
  │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌──────┐ ┌────┐│
  │  │ Record     │ │ Save     │ │ Load     │ │ New  │ │Manage│ │Clear││
  │  │ 录制航点   │ │ 保存项目 │ │ 加载项目 │ │ 新建 │ │ 管理 │ │清空 ││
  │  └─────┬──────┘ └────┬─────┘ └────┬─────┘ └──┬───┘ └──┬───┘ └──┬─┘│
  │        │              │            │          │        │        │   │
  │        ▼              ▼            ▼          ▼        ▼        ▼   │
  │   addWaypoint()  SaveProject  LoadProject  confirm  Manage   confirm│
  │   + applyZ()     Dialog       Dialog       clear    Projects clear  │
  │   + marker       → publish    → publish    dialog   Dialog   all   │
  │     rebuild      /drone_{id}_ /drone_{id}_ + clear  → publish       │
  │                  save_        load_        waypoints /drone_{id}_    │
  │                  waypoints    waypoints             delete_waypoint_ │
  │                                                     project         │
  │                                                                      │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │  拖拽排序 (DraggableWaypointRow)                              │   │
  │  │  onDragStart → onDragOver → onDrop                           │   │
  │  │  → 本地重排 + publish /drone_{id}_reorder_waypoints          │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  │                                                                      │
  │        ┌───────────────────────────────────────┐                    │
  │        │  useEffect: waypoints 变化              │                    │
  │        │  → makeWaypointMarkerArray()            │                    │
  │        │  → publish("/drone_{id}_waypoint_markers", array) │          │
  │        │  → 3D Panel 渲染更新                     │                    │
  │        └───────────────────────────────────────┘                    │
  └──────────────────────────────────────────────────────────────────────┘
            │
            │ (用户切换到其他无人机或退出)
            ▼
  ┌───────────────────────────────────────────────────────────────┐
  │   React unmount                                               │
  │                                                               │
  │   topics = droneTopics(droneId)                               │
  │   unadvertise(topics.waypointMarkers)                         │
  │   unadvertise(topics.saveWaypoints)                           │
  │   unadvertise(topics.loadWaypoints)                           │
  │   unadvertise(topics.deleteWaypointProject)                   │
  │   unadvertise(topics.reorderWaypoints)                        │
  └───────────────────────────────────────────────────────────────┘
```

---

## 7. MarkerArray 可视化

### makeWaypointMarkerArray() 构造的标记

| 标记类型 | 用途 | 原始颜色 | 前端覆盖颜色 | 尺寸 |
| --- | --- | --- | --- | --- |
| DELETEALL (type=3) | 清除旧标记 | — | — | — |
| SPHERE (type=2) | 航点位置球体 | 橙色 (1.0, 0.5, 0.0, 0.8) | **#EF833A** (r:0.937, g:0.514, b:0.227, a:1.0) | 0.3m |
| TEXT_VIEW_FACING (type=9) | 航点编号标签 | 黄色 (1.0, 1.0, 0.0, 1.0) | **白色** (r:1.0, g:1.0, b:1.0, a:1.0) | 0.3m |
| LINE_STRIP (type=4) | 航点连线 (>=2 点) | 绿色 (0.0, 1.0, 0.0, 0.8) | **#9C27B0** (r:0.612, g:0.153, b:0.690, a:1.0) | 0.05m 线宽 |

> **注意**: 颜色覆盖在 ThreeDeeRender.tsx 的消息处理循环中完成，详见 [11. 前端颜色覆盖机制](#11-前端颜色覆盖机制图-21)。

```text
3D 面板渲染效果 (颜色覆盖后):

          2
         ●           ● = Spikive 橙 #EF833A (SPHERE)
        / \           数字 = 白色 (TEXT_VIEW_FACING), 位于球体上方 0.4m
       /   \          ─── = 紫色 #9C27B0 (LINE_STRIP)
  1 ●─────── ● 3
              |
              |
              ● 4
```

### 发布生命周期

1. **mount**: `advertise("/drone_{id}_waypoint_markers", "visualization_msgs/MarkerArray", { datatypes: WaypointMarkerDatatypes })`
2. **waypoints 变化**: 完整重建 MarkerArray (DELETEALL + 新标记)，`publish()` 全量更新
3. **unmount**: `unadvertise("/drone_{id}_waypoint_markers")`

---

## 8. lastDroneIdRef 持久化机制

**问题**: 建图打点模式下，用户点击空白区域后 `selectedRenderable` 变为 `undefined`，导致 WaypointPanel 消失。用户正在录制航点时，这是不可接受的。

**解决方案** (Interactions.tsx):

```text
  const lastDroneIdRef = useRef<string | undefined>(undefined);

  // 从选中对象提取 droneId
  const droneId = topic ? extractDroneIdFromTopic(topic) : undefined;

  // 有新的 droneId 时更新 ref
  if (droneId != undefined) {
    lastDroneIdRef.current = droneId;
  }

  // 建图模式: 使用 ref 持久化
  const isMapping = sceneMode === "mapping-waypoint";
  const activeDroneId = droneId ?? (isMapping ? lastDroneIdRef.current : undefined);

  // 效果:
  //   autonomous 模式: 点击空白 → activeDroneId = undefined → 面板消失 ✓
  //   mapping 模式:    点击空白 → activeDroneId = lastDroneIdRef → 面板保持 ✓
```

---

## 9. 航点项目管理（图 19）

### 概述

航点项目管理允许用户将录制的航点集合保存为命名项目，以便后续加载复用或批量管理。所有持久化操作通过 ROS topic 与后端 waypoint_manager 节点通信，前端仅负责 UI 交互和消息发布。

### 项目管理 Topic 配置 (PROJECT_TOPICS)

所有项目管理 topic 均为每机独立，WaypointPanel 通过 `droneTopics(droneId)` 动态构建 topic 名称：

| Topic | 方向 | 消息类型 | 用途 |
| --- | --- | --- | --- |
| `/drone_{id}_save_waypoints` | 前端 → 后端 | std_msgs/String | 保存当前航点到指定项目名 |
| `/drone_{id}_load_waypoints` | 前端 → 后端 | std_msgs/String | 加载指定项目的航点数据 |
| `/drone_{id}_delete_waypoint_project` | 前端 → 后端 | std_msgs/String | 删除一个或多个项目 (逗号分隔) |
| `/drone_{id}_reorder_waypoints` | 前端 → 后端 | std_msgs/String | 重排航点顺序 (JSON: `{"order":[...]}`) |
| `/drone_{id}_waypoint_project_list` | 后端 → 前端 | std_msgs/String | 推送可用项目列表 (JSON: `{"projects":[...]}`) |

### 三个 Dialog 组件

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     项目管理 Dialog 组件架构                               │
│                                                                          │
│  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  SaveProjectDialog  │  │LoadProjectDialog │  │ManageProjectsDialog │ │
│  │                    │  │                  │  │                      │ │
│  │  MUI Autocomplete  │  │  MUI Select      │  │  MUI Checkbox List   │ │
│  │  + 输入验证         │  │  + 下拉选择       │  │  + 批量操作           │ │
│  │                    │  │                  │  │                      │ │
│  │  验证规则:          │  │  行为:            │  │  行为:                │ │
│  │  /^[a-zA-Z0-9]*$/  │  │  从 projectList  │  │  多选 Checkbox       │ │
│  │  仅字母+数字        │  │  中选择已保存项目 │  │  单项快捷删除 (🗑)    │ │
│  │  默认值: "waypoint" │  │  空列表禁用加载   │  │  批量 "Delete (N)"   │ │
│  │                    │  │                  │  │                      │ │
│  │  Enter 键提交       │  │                  │  │                      │ │
│  │  错误提示显示       │  │                  │  │                      │ │
│  └────────┬───────────┘  └────────┬─────────┘  └──────────┬───────────┘ │
│           │                       │                        │             │
│           ▼                       ▼                        ▼             │
│   onSave(name)             onLoad(name)           onDelete(names)       │
│   → publish                → publish              → publish             │
│   /drone_{id}_             /drone_{id}_           /drone_{id}_          │
│   save_waypoints           load_waypoints         delete_waypoint_      │
│   { data: "route_A" }     { data: "route_A" }     project              │
│                                                    { data: "r1,r2" }    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  数据源: useWaypointStore.projectLists[droneId]                    │ │
│  │  Dialog 接收 projectList 作为 prop (从 WaypointPanel 传入)         │ │
│  │  更新者: ThreeDeeRender 正则拦截 /drone_\d+_waypoint_project_list  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 项目列表同步流程（图 19）

```text
  后端 waypoint_manager (per-drone instance)
  publish → /drone_{id}_waypoint_project_list
  payload: { "projects": ["route_A", "route_B", "test_1"] }
                    │
                    ▼ Foxglove Bridge WebSocket
                    │
                    ▼ ThreeDeeRender.tsx 消息处理循环
                    │
                    │  正则匹配: /^\/drone_\d+_waypoint_project_list$/
                    │  提取 droneId: extractDroneIdFromTopic(topic)
                    │  {
                    │    payload = JSON.parse(message.data)
                    │    setProjectList(droneId, payload.projects ?? [])
                    │    continue;  // 不传递给 Renderer
                    │  }
                    │
                    ▼ useWaypointStore.projectLists[droneId]
                    │  = ["route_A", "route_B", "test_1"]
                    │
          ┌─────────┼─────────────────┐
          ▼         ▼                 ▼
  SaveProject   LoadProject    ManageProjects
  Dialog        Dialog         Dialog
  (Autocomplete (Select        (Checkbox
   建议列表)     下拉列表)       多选列表)
```

---

## 10. 拖拽排序机制（图 20）

### 概述

用户可以通过拖拽表格行来调整航点顺序。实现基于 HTML5 原生 Drag-and-Drop API，封装在 `DraggableWaypointRow` 子组件中。

### 交互流程（图 20）

```text
┌──────────────────────────────────────────────────────────────────┐
│                  DraggableWaypointRow 拖拽排序                    │
│                                                                  │
│  初始状态:                                                        │
│  ┌────┬───────────────────────────────────────────┬────┐         │
│  │ ≡  │  #1  X: 1.234   Y: 5.678   Z: 1.500     │ 🗑 │         │
│  ├────┼───────────────────────────────────────────┼────┤         │
│  │ ≡  │  #2  X: -0.567  Y: 3.210   Z: 1.500     │ 🗑 │         │
│  ├────┼───────────────────────────────────────────┼────┤         │
│  │ ≡  │  #3  X: 2.891   Y: -1.045  Z: 1.500     │ 🗑 │         │
│  └────┴───────────────────────────────────────────┴────┘         │
│  ≡ = 拖拽手柄 (DragIndicatorIcon, cursor: grab)                   │
│                                                                  │
│  用户拖拽 #1 到 #3 位置:                                           │
│                                                                  │
│  1. onDragStart(0)                                               │
│     └── dragIndex = 0                                            │
│     └── 被拖行 opacity → 0.4                                     │
│                                                                  │
│  2. onDragOver(2)                                                │
│     └── dropTarget = 2                                           │
│     └── 目标行显示蓝色上/下边框指示器                                │
│     └── e.preventDefault() 允许 drop                              │
│                                                                  │
│  3. onDrop(source=0, target=2)                                   │
│     ├── 计算新顺序: [#2, #3, #1] (原 idx: [2, 3, 1])             │
│     ├── 本地 store: 重排 waypoints 数组 + 重新编号                 │
│     └── 远程同步:                                                 │
│         publish("/drone_{id}_reorder_waypoints",                 │
│           { data: '{"order": [2, 3, 1]}' })                     │
│                                                                  │
│  4. onDragEnd()                                                  │
│     └── 清除 dragIndex / dropTarget                              │
│     └── 恢复 opacity → 1.0                                       │
│                                                                  │
│  排序后状态:                                                       │
│  ┌────┬───────────────────────────────────────────┬────┐         │
│  │ ≡  │  #1  X: -0.567  Y: 3.210   Z: 1.500     │ 🗑 │         │
│  ├────┼───────────────────────────────────────────┼────┤         │
│  │ ≡  │  #2  X: 2.891   Y: -1.045  Z: 1.500     │ 🗑 │         │
│  ├────┼───────────────────────────────────────────┼────┤         │
│  │ ≡  │  #3  X: 1.234   Y: 5.678   Z: 1.500     │ 🗑 │         │
│  └────┴───────────────────────────────────────────┴────┘         │
│  航点重新编号，MarkerArray 自动重建                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. 前端颜色覆盖机制（图 21）

### 概述

后端 `makeWaypointMarkerArray()` 生成的 MarkerArray 使用默认颜色。为统一 Spikive 品牌视觉，ThreeDeeRender 在消息传递给 Renderer 之前进行颜色拦截和重写。

### 颜色覆盖配置 (WAYPOINT_COLORS)

```typescript
// topicConfig.ts
export const WAYPOINT_COLORS = {
  sphere: { r: 0.937, g: 0.514, b: 0.227, a: 1.0 },   // #EF833A Spikive 橙
  text:   { r: 1.0,   g: 1.0,   b: 1.0,   a: 1.0 },   // 白色
  line:   { r: 0.612, g: 0.153, b: 0.690, a: 1.0 },    // #9C27B0 紫色
} as const;
```

### 拦截流程（图 21）

```text
  /drone_{id}_waypoint_markers 消息到达 ThreeDeeRender
              │
              ▼
  ┌───────────────────────────────────────────────────────────────┐
  │  消息处理循环: for (const message of currentFrameMessages)     │
  │                                                               │
  │  正则匹配: /^\/drone_\d+_waypoint_markers$/                   │
  │  提取 droneId: extractDroneIdFromTopic(message.topic)         │
  │                                                               │
  │  if (match) {                                                 │
  │    │                                                          │
  │    │  遍历 markers 数组:                                       │
  │    │                                                          │
  │    │  ┌────────────────────────────────────────────────────┐  │
  │    │  │ SPHERE (type=2)                                    │  │
  │    │  │ 条件: namespace === "waypoints" && id < 10000      │  │
  │    │  │                                                    │  │
  │    │  │ 1. 颜色覆盖:                                       │  │
  │    │  │    marker.color = WAYPOINT_COLORS.sphere            │  │
  │    │  │                                                    │  │
  │    │  │ 2. 解析为航点:                                      │  │
  │    │  │    waypoint = {                                     │  │
  │    │  │      idx: marker.id,                               │  │
  │    │  │      x: marker.pose.position.x,                    │  │
  │    │  │      y: marker.pose.position.y,                    │  │
  │    │  │      z: marker.pose.position.z                     │  │
  │    │  │    }                                               │  │
  │    │  │    → 收集到 parsedWaypoints[]                       │  │
  │    │  └────────────────────────────────────────────────────┘  │
  │    │                                                          │
  │    │  ┌────────────────────────────────────────────────────┐  │
  │    │  │ TEXT_VIEW_FACING (type=9)                           │  │
  │    │  │ → marker.color = WAYPOINT_COLORS.text              │  │
  │    │  └────────────────────────────────────────────────────┘  │
  │    │                                                          │
  │    │  ┌────────────────────────────────────────────────────┐  │
  │    │  │ LINE_STRIP (type=4)                                │  │
  │    │  │ → marker.color = WAYPOINT_COLORS.line              │  │
  │    │  │ → marker.colors[i] = WAYPOINT_COLORS.line (每点)   │  │
  │    │  └────────────────────────────────────────────────────┘  │
  │    │                                                          │
  │    │  解析完成后:                                               │
  │    │  setWaypointsFromMarkers(droneId, parsedWaypoints)       │
  │    │  → 同步 store 中该无人机的航点列表 (保持前端与后端一致)     │
  │    │                                                          │
  │    │  *** 不 continue — 颜色覆盖后的消息继续传递给 Renderer *** │
  │    │  订阅由 config routing 自动管理 (useActiveDroneRouting    │
  │    │  在切换无人机时重映射 waypointMarkers topic)               │
  │    │                                                          │
  │  }                                                            │
  └───────────────────────────────────────────────────────────────┘
```

---

## 12. 与 waypoint_recorder.py 对照

| 功能 | waypoint_recorder.py (Python) | WaypointPanel.tsx (TypeScript) |
| --- | --- | --- |
| Drone ID 来源 | `~drone_id` (private param) | `droneTopics(droneId)` 动态构建 |
| 多机部署 | 每架无人机独立实例: `rosrun ... _drone_id:=N` | 单实例前端, `droneTopics(droneId)` 动态路由 |
| Odom 订阅 | `rospy.Subscriber("odom", Odometry)` | ThreeDeeRender 消息循环拦截 |
| 航点录制 | `_record_waypoint()` 按钮回调 | `addWaypoint()` Store action |
| Z 轴调整 | `z_value = override_z if use_override else raw_z + z_offset` | `applyZ(actualZ, state)` |
| Z 模式 | Override / Offset 两种 | none / override / offset 三种 |
| 删除航点 | 按 index 删除 + 重编号 | `removeWaypoint(droneId, idx)` + 重编号 |
| 清空航点 | `_clear_waypoints()` | `clearWaypoints(droneId)` |
| 拖拽排序 | **不支持** | HTML5 D&D + `/drone_{id}_reorder_waypoints` publish |
| 可视化 | `MarkerArray` → `/drone_{id}_waypoint_markers` | `makeWaypointMarkerArray()` → `/drone_{id}_waypoint_markers` |
| 球体颜色 | 红色 (1,0,0) | **Spikive 橙 #EF833A** (前端覆盖) |
| 文字颜色 | 白色 (1,1,1) | **白色** (前端覆盖) |
| 连线颜色 | 绿色 (0,1,0) | **紫色 #9C27B0** (前端覆盖) |
| 项目保存 | **不支持** | SaveProjectDialog → `/drone_{id}_save_waypoints` |
| 项目加载 | **不支持** | LoadProjectDialog → `/drone_{id}_load_waypoints` |
| 项目管理 | **不支持** | ManageProjectsDialog → `/drone_{id}_delete_waypoint_project` |
| 导航状态机 | NAV_IDLE → NAV_SENDING → NAV_WAITING → NAV_DONE | **尚未实现** |
| 发送航点 | `_send_waypoint()` → GoalSet | **尚未实现** |
| DroneState 监听 | `/drone_{id}_state` | **尚未实现** |

### 功能差异总结

已超越 Python 版本的功能：

- **拖拽排序** — Python 版无此能力
- **项目持久化** — 命名保存 / 加载 / 批量删除
- **品牌色覆盖** — 统一的 Spikive 视觉标识
- **单实例多机路由** — 前端使用 `droneTopics(droneId)` 动态构建 topic，无需为每架无人机启动独立实例

仍待实现的 Python 版功能：

1. **航点导航状态机** — NAV_IDLE / NAV_SENDING / NAV_WAITING / NAV_DONE
2. **按序发送航点** — 逐个发送 GoalSet，等待 DroneState.reached 确认到达
3. **DroneState 订阅** — 监听 `/drone_{id}_state` 判断是否到达航点
4. **导航进度显示** — 当前航点 / 总航点数

---

## 13. 已知问题

### 13.1 Odom 拦截仅在 mapping 模式生效

**设计**: odom topic 的额外订阅和消息拦截逻辑仅在 `sceneMode === "mapping-waypoint"` 时激活。autonomous 模式下不会订阅 odom topic，也不会拦截消息。

**影响**: 如果需要在 autonomous 模式下也显示无人机位置，需要额外添加订阅。

### 13.2 MarkerArray 全量更新

**现象**: 每次航点变化时都发布完整的 MarkerArray（DELETEALL + 所有标记），而非增量更新。

**影响**: 航点数量较多时（>50），MarkerArray 消息体积较大。

**建议**: 当前航点数量在预期范围内（<20），全量更新可接受。如需优化，可改为增量标记管理。

### 13.3 多机航点隔离

**设计**: useWaypointStore 使用 `tables: Record<droneId, DroneWaypointState>`，每架无人机的航点独立存储。切换选中的无人机时，WaypointPanel 自动显示对应无人机的航点列表。

**已解决**: 所有航点 topic 均已改为每机独立（`/drone_{id}_waypoint_markers`、`/drone_{id}_save_waypoints` 等）。`useActiveDroneRouting` 在切换无人机时自动重映射 `waypointMarkers` topic。WaypointPanel 使用 `droneTopics(droneId)` 动态构建所有 topic 名称，确保多机数据完全隔离。项目列表也已改为 `projectLists: Record<droneId, string[]>`，每架无人机独立维护。

---

## 14. 已知限制与未来规划

### 14.1 面板滚动支持

**现状**: WaypointPanel 航点列表区域不支持上下滚动。当航点数量超出可视区域时，超出部分无法查看。

**计划**: 为航点表格容器添加 `overflow-y: auto` 和固定最大高度，实现内部滚动。

### 14.2 交互设计优化

**现状**: 打点 (Record)、清空 (Clear)、加载 (Load) 等操作的用户反馈不够直观——缺少操作成功/失败的 toast 通知，无法撤回误操作。

**计划**:

- 添加 MUI Snackbar 通知用户操作结果 (保存成功 / 加载完成 / 删除确认)
- 评估是否需要操作历史栈 (Undo/Redo) 支持
- 优化 Clear 和 Delete 的确认流程，减少误操作风险

### 14.3 连接逻辑更新

**现状**: MultiRobotSidebar 的连接管理使用简单的 WebSocket probe + 单次 `selectSource()` 调用，不支持自动重连、多数据源同时推流。

**计划**:

- 重构连接生命周期，支持断线自动重连
- 评估多数据源并行推流的可行性（当前为单活跃模型）
- 优化连接状态机，区分 "未连接" / "连接中" / "已连接" / "重连中" 状态

### 14.4 AstroManager 集成

**现状**: 地面站仅负责可视化和指令发送，无法管控机载软件栈的运行状态。

**计划**:

- 通过 AstroManager (Spikive-Manager) 服务接口，从地面站控制机器人后端模块：
  - 启动 / 重启 Visual SLAM
  - 启动 / 重启 EGO-Planner
  - 启动 / 重启驱动 (px4ctrl / 电机驱动)
  - 启动 / 重启 flight_manager
- 监听各模块运行状态 (running / stopped / error)，在侧边栏 RobotCard 中显示
- 实现远程日志查看和错误诊断
