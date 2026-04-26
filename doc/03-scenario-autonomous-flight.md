# 03 业务场景: 自主飞行模式

## 目录

- [1. 场景描述](#1-场景描述)
- [2. 完整数据流（图 10）](#2-完整数据流图-10)
- [3. GoalSet 发布时序（图 11）](#3-goalset-发布时序图-11)
- [4. DroneControlPanel 生命周期（图 12）](#4-dronecontrolpanel-生命周期图-12)
- [5. 各阶段详解](#5-各阶段详解)
- [6. 后端处理链路](#6-后端处理链路)
- [7. 航线加载与执行](#7-航线加载与执行)
- [8. 已知问题](#8-已知问题)

---

## 1. 场景描述

自主飞行模式 (`autonomous-flight`) 是地面站的核心控制场景：

1. 用户在 SceneSelectionDialog 选择「自主飞行」
2. 通过 MultiRobotSidebar 添加目标无人机，3D Panel 默认显示第一张卡片对应的可视化数据
3. 点击卡片 Select 或在 3D 面板中点选机器人模型 → 写入 `activeDroneId` 并弹出 DroneControlPanel
4. 发送飞行指令（Takeoff/Land/Return/Stop）
5. 使用 Publish Pose 工具在 3D 空间中点击目标位置
6. 系统自动发布 GoalSet 消息 → EGO-Planner 生成避障轨迹 → 无人机自主导航
7. 加载建图打点场景保存的航点项目，一键执行自动逐点导航航线
8. 执行中所有修改操作（Load/Clear/Publish Pose）自动禁用，Stop 双通道急停

---

## 2. 完整数据流（图 10）

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          自主飞行模式 数据流                               │
│                                                                          │
│  用户操作                前端处理                    通信层      后端处理     │
│  ────────                ────────                    ────      ────────    │
│                                                                          │
│  ① 选择场景   SceneSelectionDialog                                        │
│  ──────────►  setSceneMode("autonomous-flight")                          │
│                     │                                                    │
│                     ▼                                                    │
│  ② 添加机器人  AddRobotDialog                                             │
│  ──────────►  probeWebSocket(url)                                        │
│               addRobot(url, droneId)                                     │
│                     │                                                    │
│                     ▼                                                    │
│  ③ 默认可视化  addRobot 初始化 visualDroneId                               │
│  ──────────►  useActiveDroneRouting()                                    │
│               remapTopics(oldId, newId)                                   │
│               followTf = base{newId}                                     │
│                     │                                                    │
│                     ▼                                                    │
│              3D Panel 订阅 6 个 topic:              Foxglove     ROS1      │
│               /drone_{id}_cloud_registered    ◄───  Bridge  ◄── SLAM     │
│               /drone_{id}_odom_vis/robot      ◄───  (WS)    ◄── odom_vis │
│               /drone_{id}_odom_vis/path       ◄───           ◄──         │
│               /drone_{id}_ego_planner/optimal  ◄──           ◄── planner │
│               /drone_{id}_ego_planner/goal     ◄──           ◄──         │
│               /drone_{id}_waypoint_markers     ◄──           ◄── waypoints│
│                     │                                                    │
│                     ▼                                                    │
│              Renderer 渲染: 点云+模型+轨迹+航迹                             │
│                     │                                                    │
│                     ▼                                                    │
│  ④ 点选机器人  GPU Pick (pickable filter)                                  │
│  ──────────►  → 仅机器人模型可被选中                                        │
│               → extractDroneIdFromRobotModelTopic(topic) = droneId        │
│                     │                                                    │
│                     ▼                                                    │
│              Interactions.tsx 分支:                                        │
│               sceneMode == "autonomous-flight"                            │
│               → 渲染 DroneControlPanel(droneId)                          │
│                     │                                                    │
│                     ▼                                                    │
│  ⑤ 飞行控制   DroneControlPanel                     Foxglove     ROS1    │
│  ──────────►  sendCommand(TAKEOFF=1)                                     │
│               publish("/control",                  ──Bridge──► flight_   │
│                 {header, cmd: 1})                     (WS)      manager  │
│                                                                  │       │
│  ⑥ 发布目标   Publish Pose 工具激活                                  │       │
│  ──────────►  publishDroneIdRef = droneId (锁定)                   │       │
│               advertise("/goal_with_id",                          │       │
│                 "quadrotor_msgs/GoalSet")                         ▼       │
│                     │                                                    │
│  ⑦ 点击位置   handlePublishSubmit(event)                                  │
│  ──────────►  makeGoalSetMessage(droneId, pos)     ──Bridge──► ego_      │
│               publish("/goal_with_id",                (WS)     replan_   │
│                 {drone_id, goal:[x,y,z]})                      fsm      │
│                                                                  │       │
│                                                                  ▼       │
│                                                      trajectory 生成     │
│                                                      /drone_{id}_planning│
│              3D Panel 实时显示新规划轨迹:    ◄─────────/trajectory          │
│               /drone_{id}_ego_planner/optimal                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. GoalSet 发布时序（图 11）

```text
  User          DroneControlPanel    ThreeDeeRender      Renderer       Foxglove Bridge    ROS Backend
   │                  │                    │                 │                 │                │
   │  点击机器人       │                    │                 │                 │                │
   │─────────────────────────────────────►│ GPU Pick        │                 │                │
   │                  │                    │ pickable filter │                 │                │
   │                  │                    │◄────────────────│                 │                │
   │                  │                    │  selectedInfo   │                 │                │
   │                  │  mount             │                 │                 │                │
   │                  │◄───────────────────│                 │                 │                │
   │                  │                    │                 │                 │                │
   │                  │  advertise("/control", cmd)          │                 │                │
   │                  │────────────────────────────────────────────────────►│                │
   │                  │                    │                 │                 │                │
   │  点击 Takeoff    │                    │                 │                 │                │
   │─────────────────►│                    │                 │                 │                │
   │                  │  publish("/control", {cmd:1})        │                 │                │
   │                  │────────────────────────────────────────────────────►│ ──────────────►│
   │                  │                    │                 │                 │   flight_mgr   │
   │                  │                    │                 │                 │                │
   │  点击 Publish    │                    │                 │                 │                │
   │  Pose 按钮       │                    │                 │                 │                │
   │─────────────────►│ onClickPublish()  │                 │                 │                │
   │                  │───────────────────►│                 │                 │                │
   │                  │                    │  lock droneId   │                 │                │
   │                  │                    │  = getSelected  │                 │                │
   │                  │                    │    Renderable   │                 │                │
   │                  │                    │    Info()       │                 │                │
   │                  │                    │◄────────────────│                 │                │
   │                  │                    │  publishDroneId │                 │                │
   │                  │                    │  Ref.current    │                 │                │
   │                  │                    │  = droneId      │                 │                │
   │                  │                    │                 │                 │                │
   │                  │                    │  advertise("/goal_with_id",       │                │
   │                  │                    │    "quadrotor_msgs/GoalSet")      │                │
   │                  │                    │──────────────────────────────────►│                │
   │                  │                    │                 │                 │                │
   │  点击 3D 目标位置 │                    │                 │                 │                │
   │──────────────────────────────────────►│                 │                 │                │
   │                  │                    │  handlePublish  │                 │                │
   │                  │                    │  Submit(event)  │                 │                │
   │                  │                    │                 │                 │                │
   │                  │                    │  re-advertise   │                 │                │
   │                  │                    │──────────────────────────────────►│                │
   │                  │                    │                 │                 │                │
   │                  │                    │  makeGoalSet    │                 │                │
   │                  │                    │  Message(       │                 │                │
   │                  │                    │   droneId,      │                 │                │
   │                  │                    │   position)     │                 │                │
   │                  │                    │                 │                 │                │
   │                  │                    │  publish("/goal_with_id",         │                │
   │                  │                    │   {drone_id, goal:[x,y,z]})      │                │
   │                  │                    │──────────────────────────────────►│ ──────────────►│
   │                  │                    │                 │                 │  ego_replan_   │
   │                  │                    │                 │                 │  fsm           │
   │                  │                    │                 │                 │                │
   │                  │                    │                 │                 │  trajectory    │
   │                  │                    │  渲染新轨迹     │                 │◄───────────────│
   │                  │                    │◄──────────────────────────────────│  /drone_{id}_  │
   │                  │                    │                 │                 │  planning/     │
   │                  │                    │                 │                 │  trajectory    │
```

---

## 4. DroneControlPanel 生命周期（图 12）

```text
                      ┌──────────────────────────────────────┐
                      │       DroneControlPanel 生命周期       │
                      └──────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │ 触发条件: 用户点击机器人模型 (GPU Pick 命中 pickable renderable) │
  │           + sceneMode == "autonomous-flight"                    │
  └──────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
                   ┌─────────────────────┐
                   │   React mount       │
                   │                     │
                   │   useEffect(() => { │
                   │     advertise(      │
                   │       "/control",   │
                   │       "controller_  │
                   │        msgs/cmd",   │
                   │       {datatypes}   │
                   │     );              │
                   │     advertise(      │
                   │       topics.load   │
                   │       Waypoints,    │
                   │       "std_msgs/    │
                   │        String",     │
                   │     );              │
                   │     advertise(      │
                   │       topics.stop   │
                   │       WaypointExec, │
                   │       "std_msgs/    │
                   │        Empty",      │
                   │     );              │
                   │     return () =>    │
                   │       unadvertise(  │
                   │         ...3 topics │
                   │       );            │
                   │   }, [topics]);     │
                   └─────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │     等待用户操作 (循环)        │◄──────────────────────┐
              └──────────────┬───────────────┘                       │
                             │                                       │
              ┌──────────────┼──────────────────────┐                │
              ▼              ▼                       ▼                │
     ┌──────────────┐ ┌──────────┐ ┌──────────────────────┐         │
     │ 飞行指令按钮  │ │ Publish  │ │ 点击空白区域           │         │
     │              │ │ Pose 按钮│ │                      │         │
     │ sendCommand()│ │          │ │ selectedRenderable   │         │
     │ publish(     │ │ disabled │ │ = undefined          │         │
     │  "/control", │ │ when     │ │                      │         │
     │  {cmd: N}    │ │ isExec   │ └──────────┬───────────┘         │
     │ )            │ │          │            │                     │
     └──────┬───────┘ └────┬─────┘            ▼                     │
            │              │       ┌────────────────────┐           │
     ┌──────┴───────┐      │       │   React unmount    │           │
     │ Stop 按钮     │      │       │                    │           │
     │ handleAbort() │      │       │   unadvertise(    │           │
     │ ├── cmd=5     │      │       │     ...3 topics   │           │
     │ └── stop_exec │      │       │   )               │           │
     └──────┬───────┘      │       └────────────────────┘           │
            │              │                                         │
            └──────────────┘  继续等待操作                           │
                   ─────────────────────────────────────────────────┘
                   ┌────────────────────────────────────────────┐
                   │ 切换到其他机器人 (新 droneId)                │───┘
                   │   unmount 旧 panel → mount 新 panel        │
                   │   (advertise/unadvertise 自动重新执行)       │
                   └────────────────────────────────────────────┘
```

---

## 5. 各阶段详解

### 5.1 连接建立阶段

**入口**: `AddRobotDialog` → "连接" 按钮

**流程**:
1. `probeWebSocket(url)` — 尝试 WebSocket 握手，3s 超时
2. 成功 → `useRobotConnectionsStore.addRobot(url, droneId)`
   - 互斥检查: URL 唯一 + droneId 唯一
3. `selectSource()` — 调用 Lichtblick 的 `PlayerSelection` API 建立 Foxglove 连接
4. 如果当前没有可视化目标，初始化 `visualDroneId = droneId`，但不自动写入 `activeDroneId`

**关键文件**: `MultiRobotSidebar/index.tsx`, `AddRobotDialog.tsx`

### 5.2 Topic 订阅阶段

**入口**: `useActiveDroneRouting()` 检测到 `visualDroneId` 或 `visualRouteVersion` 变化

**流程**:
1. `remapTopics(fromId, toId)` — 重写 3D Panel 的 topics 配置
2. `ensurePickableFlags()` — 确保新 topic 的 pickable 标记正确
3. 更新 `followTf` = `base{toId}`
4. 同步修复 layout cache 和 mounted renderer config，避免当前 3D panel 等待 remount 才显示

**关键文件**: `spikive/hooks/useActiveDroneRouting.ts`

### 5.3 3D 渲染阶段

由 Lichtblick 核心处理：
- `currentFrameMessages` 接收 WebSocket 推送的 ROS 消息
- 消息分发到对应的 SceneExtension (PointClouds, Markers, etc.)
- Three.js 渲染到 Canvas

### 5.4 机器人选择阶段

**入口**: 用户在 3D 面板点击

**流程**:
1. Renderer 接收 click event
2. `#hideNonPickableRenderables()` — 临时隐藏点云等 non-pickable 层
3. GPU ray pick — 仅对 visible (= pickable) 的 renderable 做射线检测
4. 恢复被隐藏的 renderable
5. `setSelectedRenderable()` — 设置选中对象
6. `Interactions.tsx` 只在 selected object 是 robotModel topic 时调用 `setActiveDroneId(droneId)`
7. `activeDroneId` 写入后渲染 DroneControlPanel；点云、轨迹、路径、航点 marker 不改变 active

**关键文件**: `Renderer.ts`, `Interactions/Interactions.tsx`

### 5.5 控制指令发送

**入口**: DroneControlPanel 按钮点击

**消息格式**:
```typescript
// controller_msgs/cmd
{
  header: { stamp: { sec, nsec }, frame_id: "" },
  cmd: 1  // TAKEOFF=1, LAND=2, RETURN=3, CONTINUE=4, STOP=5
}
```

**发布 topic**: `/control` (全局，不带 drone_id 前缀)

### 5.6 GoalSet 发布

**入口**: Publish Pose 工具 → 用户点击 3D 空间位置

**消息格式**:
```typescript
// quadrotor_msgs/GoalSet
{
  drone_id: 1,        // int16, 来自 activeDroneId 或 robotModel topic
  goal: [1.5, 2.3, 1.0]  // float32[3], 用户点击的 3D 坐标
}
```

**发布 topic**: `/goal_with_id` (全局)

**drone_id 锁定机制**: 在 Publish Pose 工具激活时 (`publishClickType` 变化)，优先从当前选中的 robotModel topic 解析 `droneId`，否则使用 `activeDroneId`，并存入 `publishDroneIdRef.current`。之后无论用户如何切换视角或选中其他对象，publish 时始终使用锁定的 droneId。

---

## 6. 后端处理链路

```text
  /control (cmd=1, Takeoff)
    │
    ▼
  flight_manager.cpp
    cmdCallback(): switch(cmd)
    case 1: 执行起飞流程
    case 3: publish GoalSet(init_x, init_y, init_z) → /goal_with_id (返航)
    case 4: publish GoalSet(current_pos) → /goal_with_id (继续)

  /goal_with_id (GoalSet: drone_id=1, goal=[x,y,z])
    │
    ▼
  ego_replan_fsm.cpp
    waypointCallback(): 提取 3D 坐标
    设置 have_target_ = true
    FSM: WAIT_TARGET → GEN_NEW_TRAJ
    │
    ▼
  planFromGlobalTraj()
    生成 min-snap 多项式轨迹 (避障)
    │
    ▼
  发布: /drone_{id}_planning/trajectory (PolyTraj)
    │
    ▼
  traj_server
    解算 PolyTraj → 200Hz PositionCommand
    │
    ▼
  px4ctrl
    PositionCommand → SO3Command → 飞控执行
```

---

## 7. 航线加载与执行

自主飞行模式扩展了航线加载与自动逐点执行功能。详细设计文档见 [06-scenario-waypoint-execution.md](./06-scenario-waypoint-execution.md)。

### 7.1 航线加载流程

```text
用户操作 Load Path 按钮
  │
  ▼
DroneControlPanel 打开 LoadProjectDialog
  │ projectList 从 useWaypointStore.projectLists[droneId] 读取
  │ (由 ThreeDeeRender 从 /drone_{id}_waypoint_project_list 拦截填充)
  │
  ▼ 用户选择项目名称
DroneControlPanel.handleLoad(name)
  │ publish("/drone_{id}_load_waypoints", { data: name })
  │
  ▼ Foxglove Bridge → ROS1
waypoint_recorder.py._load_waypoints_cb()
  │ 读取 JSON 文件 → self.waypoints = data.waypoints
  │ 调用 _publish_markers() → MarkerArray
  │
  ▼ Foxglove Bridge → 前端
ThreeDeeRender 消息拦截 (/drone_\d+_waypoint_markers)
  │ 颜色覆盖 (SPHERE→橙, TEXT→白, LINE→紫)
  │ 解析 sphere markers → waypoints 列表
  │ setWaypointsFromMarkers(droneId, waypoints)
  │
  ▼ Zustand Store 更新
useWaypointStore.tables[droneId].waypoints 更新
  │
  ▼ Interactions.tsx 响应
hasWaypoints = true
  │
  ▼ 渲染 WaypointExecPanel(droneId)
     只读航点表格 + Execute/Clear 按钮
```

### 7.2 DroneControlPanel 新增行为 (Commit 11)

| 功能 | 说明 |
| --- | --- |
| `execState` 读取 | `useWaypointStore(s => s.execStates[droneId] ?? "idle")` |
| `projectList` 读取 | `useWaypointStore(s => s.projectLists[droneId] ?? [])` |
| Load Path 按钮 | 打开 `LoadProjectDialog`，执行中 `disabled={isExecuting}` |
| Publish Pose 禁用 | 执行中 `disabled={isExecuting}` |
| `handleAbort()` | Stop 按钮双通道: `sendCommand(STOP)` + `publish(topics.stopWaypointExec, {})` |
| Advertise 扩展 | mount 时额外 advertise `loadWaypoints` + `stopWaypointExec` |

### 7.3 WaypointExecPanel 条件渲染

```text
Interactions.tsx:
  activeDroneId = useRobotConnectionsStore(s => s.activeDroneId)
  hasWaypoints = useWaypointStore(tables[activeDroneId]?.waypoints.length > 0)

  渲染逻辑:
    isMapping ? <WaypointPanel>
              : <>
                  <DroneControlPanel>
                  {hasWaypoints && <WaypointExecPanel droneId={activeDroneId} />}
                </>
```

### 7.4 执行中 UI 禁用矩阵

| UI 元素 | 执行中状态 | 原因 |
| --- | --- | --- |
| Execute 按钮 | `disabled` | 防止重复发送 start |
| Clear 按钮 | `disabled` | 防止清空正在飞的航线 |
| Load Path 按钮 | `disabled` | 防止换路线 |
| Publish Pose 按钮 | `disabled` | 防止手动发点干扰自动导航 |
| Stop 按钮 | **始终可用** | 紧急停止必须随时可达 |

---

## 8. 已知问题

### 8.1 首次 Publish Pose 失败

**现象**: 第一次使用 Publish Pose 工具点击目标位置时，GoalSet 消息不会被 ROS 端接收。

**原因**: `advertise()` 调用后，Foxglove Bridge 需要一定时间注册 publisher。第一次 `publish()` 时注册可能尚未完成。

**临时解决**: 代码中在 `handlePublishSubmit` 时再次调用 `re-advertise()`，但仍存在时序竞争。

**建议修复**: 在 `advertise()` 后添加确认回调或延迟，确保 publisher 注册完成再允许 publish。

### 8.2 切换机器人后缓存残留

**现象**: 连接新机器人后，3D Panel 仍显示旧 topic 的数据。

**原因**: 浏览器 localStorage 中缓存了 Lichtblick layout 配置，`useActiveDroneRouting` 可能未覆盖所有缓存字段。

**临时解决**: 手动清除浏览器缓存。

### 8.3 Publish Pose 坐标系错误

**现象**: 发布的 GoalSet 目标点坐标与 3D 面板中点击的位置不一致。

**原因**: Publish Pose 工具使用 camera local frame 坐标，而 EGO-Planner 期望 world frame 坐标。

**建议修复**: 在 `handlePublishSubmit` 中将坐标从 camera frame 变换到 world frame。
