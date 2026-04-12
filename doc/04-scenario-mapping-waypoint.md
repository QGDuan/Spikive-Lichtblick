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
- [9. 与 waypoint_recorder.py 对照](#9-与-waypointrecorderpy-对照)
- [10. 已知问题](#10-已知问题)

---

## 1. 场景描述

建图打点模式 (`mapping-waypoint`) 用于在无人机完成 SLAM 建图后，在 3D 地图中标记关键航点：

1. 用户在 SceneSelectionDialog 选择「建图打点」
2. 系统自动订阅所有可用无人机的 `visual_slam/odom` topic
3. 用户点击机器人模型 → 弹出 WaypointPanel（而非 DroneControlPanel）
4. WaypointPanel 实时显示该无人机的 odom 位置 (x, y, z)
5. 用户点击 "Record" 将当前位置录入航点列表，可选 Z 轴调整
6. 航点列表变化时自动发布 MarkerArray 到 `/waypoint_markers`，3D 面板渲染球体 + 编号 + 连线

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
│                     ├── SPHERE × N (橙色球体)                             │
│                     ├── TEXT × N (黄色编号)                               │
│                     └── LINE_STRIP (绿色连线, ≥2点)                      │
│                              │                                           │
│                              ▼                                           │
│                    publish("/waypoint_markers", MarkerArray)             │
│                              │                                           │
│                              ▼                                           │
│                    3D Panel 渲染:                                         │
│                     ● ── ● ── ● ── ●  (航点球体 + 连线)                  │
│                     1    2    3    4   (编号标签)                         │
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
  │  → clearWaypoints()              │                            │
  │  → updateZSettings()             │                            │
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
  ┌───────────────────┐
  │   React mount     │
  │                   │
  │   useEffect:      │
  │     advertise(    │
  │       "/waypoint_ │
  │       markers",   │
  │       "visualiza- │
  │       tion_msgs/  │
  │       MarkerArray"│
  │     )             │
  │                   │
  │   getOrCreate(    │
  │     droneId)      │
  │   → 初始化该无人  │
  │     机的航点状态   │
  └─────────┬─────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────┐
  │  用户操作循环                                         │
  │                                                      │
  │  ┌────────────┐  ┌──────────┐  ┌──────────────────┐ │
  │  │ Record     │  │ Del Last │  │ Clear All        │ │
  │  │ 按钮       │  │ 按钮     │  │ 按钮             │ │
  │  │            │  │          │  │                  │ │
  │  │ addWaypoint│  │deleteLast│  │ clearWaypoints   │ │
  │  │ (droneId,  │  │ (droneId)│  │ (droneId)        │ │
  │  │  x, y, z)  │  │          │  │                  │ │
  │  └─────┬──────┘  └────┬─────┘  └────────┬─────────┘ │
  │        │              │                  │           │
  │        └──────────────┼──────────────────┘           │
  │                       │                              │
  │                       ▼                              │
  │        useEffect: waypoints 变化                      │
  │        │                                             │
  │        ▼                                             │
  │        makeWaypointMarkerArray(waypoints, "world")   │
  │        │                                             │
  │        ▼                                             │
  │        publish("/waypoint_markers", markerArray)     │
  │        │                                             │
  │        ▼                                             │
  │        3D Panel 渲染更新                               │
  └──────────────────────────────────────────────────────┘
            │
            │ (用户切换到其他无人机或退出)
            ▼
  ┌───────────────────┐
  │   React unmount   │
  │                   │
  │   unadvertise(    │
  │     "/waypoint_   │
  │     markers")     │
  └───────────────────┘
```

---

## 7. MarkerArray 可视化

### makeWaypointMarkerArray() 构造的标记

| 标记类型 | 用途 | 颜色 | 尺寸 |
| --- | --- | --- | --- |
| DELETEALL (type=3) | 清除旧标记 | — | — |
| SPHERE (type=2) | 航点位置球体 | 橙色 (1.0, 0.5, 0.0, 0.8) | 0.3m |
| TEXT_VIEW_FACING (type=9) | 航点编号标签 | 黄色 (1.0, 1.0, 0.0, 1.0) | 0.3m |
| LINE_STRIP (type=4) | 航点连线 (≥2 点) | 绿色 (0.0, 1.0, 0.0, 0.8) | 0.05m 线宽 |

```text
3D 面板渲染效果:

          2
         ●
        / \
       /   \
  1 ●─────── ● 3
              |
              |
              ● 4

  ● = 橙色球体 (SPHERE)
  数字 = 黄色文字 (TEXT_VIEW_FACING), 位于球体上方 0.4m
  ─── = 绿色连线 (LINE_STRIP)
```

### 发布生命周期

1. **mount**: `advertise("/waypoint_markers", "visualization_msgs/MarkerArray", { datatypes: WaypointMarkerDatatypes })`
2. **waypoints 变化**: 完整重建 MarkerArray (DELETEALL + 新标记)，`publish()` 全量更新
3. **unmount**: `unadvertise("/waypoint_markers")`

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

## 9. 与 waypoint_recorder.py 对照

| 功能 | waypoint_recorder.py (Python) | WaypointPanel.tsx (TypeScript) |
| --- | --- | --- |
| Odom 订阅 | `rospy.Subscriber("odom", Odometry)` | ThreeDeeRender 消息循环拦截 |
| 航点录制 | `_record_waypoint()` 按钮回调 | `addWaypoint()` Store action |
| Z 轴调整 | `z_value = override_z if use_override else raw_z + z_offset` | `applyZ(actualZ, state)` |
| Z 模式 | Override / Offset 两种 | none / override / offset 三种 |
| 删除航点 | 按 index 删除 + 重编号 | `removeWaypoint(droneId, idx)` + 重编号 |
| 清空航点 | `_clear_waypoints()` | `clearWaypoints(droneId)` |
| 可视化 | `MarkerArray` → `/waypoint_markers` | `makeWaypointMarkerArray()` → `/waypoint_markers` |
| 球体颜色 | 红色 (1,0,0) | 橙色 (1,0.5,0) |
| 文字颜色 | 白色 (1,1,1) | 黄色 (1,1,0) |
| 连线颜色 | 绿色 (0,1,0) | 绿色 (0,1,0) |
| 导航状态机 | NAV_IDLE → NAV_SENDING → NAV_WAITING → NAV_DONE | **尚未实现** |
| 发送航点 | `_send_waypoint()` → GoalSet | **尚未实现** |
| DroneState 监听 | `/drone_{id}_state` | **尚未实现** |

### 尚未实现的功能

Python 版本 `waypoint_recorder.py` 中的以下功能在前端 WaypointPanel 中尚未实现：

1. **航点导航状态机** — NAV_IDLE / NAV_SENDING / NAV_WAITING / NAV_DONE
2. **按序发送航点** — 逐个发送 GoalSet，等待 DroneState.reached 确认到达
3. **DroneState 订阅** — 监听 `/drone_{id}_state` 判断是否到达航点
4. **航点 JSON 导入/导出** — 保存和加载航点文件
5. **导航进度显示** — 当前航点 / 总航点数

---

## 10. 已知问题

### 10.1 Odom 拦截仅在 mapping 模式生效

**设计**: odom topic 的额外订阅和消息拦截逻辑仅在 `sceneMode === "mapping-waypoint"` 时激活。autonomous 模式下不会订阅 odom topic，也不会拦截消息。

**影响**: 如果需要在 autonomous 模式下也显示无人机位置，需要额外添加订阅。

### 10.2 MarkerArray 全量更新

**现象**: 每次航点变化时都发布完整的 MarkerArray（DELETEALL + 所有标记），而非增量更新。

**影响**: 航点数量较多时（>50），MarkerArray 消息体积较大。

**建议**: 当前航点数量在预期范围内（<20），全量更新可接受。如需优化，可改为增量标记管理。

### 10.3 多机航点隔离

**设计**: useWaypointStore 使用 `tables: Record<droneId, DroneWaypointState>`，每架无人机的航点独立存储。切换选中的无人机时，WaypointPanel 自动显示对应无人机的航点列表。

**注意**: `/waypoint_markers` 是全局 topic，不带 drone_id 前缀。当前 MarkerArray 只显示当前选中无人机的航点。
