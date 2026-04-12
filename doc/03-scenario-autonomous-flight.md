# 03 业务场景: 自主飞行模式

## 目录

- [1. 场景描述](#1-场景描述)
- [2. 完整数据流（图 10）](#2-完整数据流图-10)
- [3. GoalSet 发布时序（图 11）](#3-goalset-发布时序图-11)
- [4. DroneControlPanel 生命周期（图 12）](#4-dronecontrolpanel-生命周期图-12)
- [5. 各阶段详解](#5-各阶段详解)
- [6. 后端处理链路](#6-后端处理链路)
- [7. 已知问题](#7-已知问题)

---

## 1. 场景描述

自主飞行模式 (`autonomous-flight`) 是地面站的核心控制场景：

1. 用户在 SceneSelectionDialog 选择「自主飞行」
2. 通过 MultiRobotSidebar 添加并激活目标无人机
3. 在 3D 面板中点选机器人模型 → 弹出 DroneControlPanel
4. 发送飞行指令（Takeoff/Land/Return/Stop/Continue）
5. 使用 Publish Pose 工具在 3D 空间中点击目标位置
6. 系统自动发布 GoalSet 消息 → EGO-Planner 生成避障轨迹 → 无人机自主导航

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
│  ③ 激活机器人  RobotCard.setActive()                                      │
│  ──────────►  useActiveDroneRouting()                                    │
│               remapTopics(oldId, newId)                                   │
│               followTf = base{newId}                                     │
│                     │                                                    │
│                     ▼                                                    │
│              3D Panel 订阅 5 个 topic:              Foxglove     ROS1      │
│               /drone_{id}_cloud_registered    ◄───  Bridge  ◄── SLAM     │
│               /drone_{id}_odom_vis/robot      ◄───  (WS)    ◄── odom_vis │
│               /drone_{id}_odom_vis/path       ◄───           ◄──         │
│               /drone_{id}_ego_planner/optimal  ◄──           ◄── planner │
│               /drone_{id}_ego_planner/goal     ◄──           ◄──         │
│                     │                                                    │
│                     ▼                                                    │
│              Renderer 渲染: 点云+模型+轨迹+航迹                             │
│                     │                                                    │
│                     ▼                                                    │
│  ④ 点选机器人  GPU Pick (pickable filter)                                  │
│  ──────────►  → 仅机器人模型可被选中                                        │
│               → extractDroneIdFromTopic(topic) = droneId                  │
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
                   │     return () =>    │
                   │       unadvertise(  │
                   │         "/control"  │
                   │       );            │
                   │   }, []);           │
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
     │ publish(     │ │ 触发     │ │ = undefined          │         │
     │  "/control", │ │ Publish  │ │                      │         │
     │  {cmd: N}    │ │ Click    │ └──────────┬───────────┘         │
     │ )            │ │ Tool     │            │                     │
     └──────┬───────┘ └────┬─────┘            ▼                     │
            │              │       ┌────────────────────┐           │
            │              │       │   React unmount    │           │
            └──────────────┘       │                    │           │
                   │               │   unadvertise(    │           │
                   │               │     "/control"    │           │
                   └───────────────┤   )               │           │
                   继续等待操作     │                    │           │
                   ────────────────►└────────────────────┘           │
                                                                    │
                   ┌────────────────────────────────────────────┐   │
                   │ 切换到其他机器人 (新 droneId)                │   │
                   │   unmount 旧 panel → mount 新 panel        │───┘
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
4. `setActive(robotId)` — 标记为活跃机器人

**关键文件**: `MultiRobotSidebar/index.tsx`, `AddRobotDialog.tsx`

### 5.2 Topic 订阅阶段

**入口**: `useActiveDroneRouting()` 检测到 `activeRobot.droneId` 变化

**流程**:
1. `remapTopics(fromId, toId)` — 重写 3D Panel 的 topics 配置
2. `ensurePickableFlags()` — 确保新 topic 的 pickable 标记正确
3. 更新 `followTf` = `base{toId}`
4. Lichtblick 内核自动根据新配置重新订阅

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
6. `Interactions.tsx` 检测到 selectedRenderable 变化 → 渲染 DroneControlPanel

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
  drone_id: 1,        // int16, 从选中对象 topic 提取
  goal: [1.5, 2.3, 1.0]  // float32[3], 用户点击的 3D 坐标
}
```

**发布 topic**: `/goal_with_id` (全局)

**drone_id 锁定机制**: 在 Publish Pose 工具激活时 (`publishClickType` 变化)，通过 `Renderer.getSelectedRenderableInfo()` 获取当前选中对象的 topic，用 `extractDroneIdFromTopic()` 提取 droneId，存入 `publishDroneIdRef.current`。之后无论用户如何切换视角或选中其他对象，publish 时始终使用锁定的 droneId。

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

## 7. 已知问题

### 7.1 首次 Publish Pose 失败

**现象**: 第一次使用 Publish Pose 工具点击目标位置时，GoalSet 消息不会被 ROS 端接收。

**原因**: `advertise()` 调用后，Foxglove Bridge 需要一定时间注册 publisher。第一次 `publish()` 时注册可能尚未完成。

**临时解决**: 代码中在 `handlePublishSubmit` 时再次调用 `re-advertise()`，但仍存在时序竞争。

**建议修复**: 在 `advertise()` 后添加确认回调或延迟，确保 publisher 注册完成再允许 publish。

### 7.2 切换机器人后缓存残留

**现象**: 连接新机器人后，3D Panel 仍显示旧 topic 的数据。

**原因**: 浏览器 localStorage 中缓存了 Lichtblick layout 配置，`useActiveDroneRouting` 可能未覆盖所有缓存字段。

**临时解决**: 手动清除浏览器缓存。

### 7.3 Publish Pose 坐标系错误

**现象**: 发布的 GoalSet 目标点坐标与 3D 面板中点击的位置不一致。

**原因**: Publish Pose 工具使用 camera local frame 坐标，而 EGO-Planner 期望 world frame 坐标。

**建议修复**: 在 `handlePublishSubmit` 中将坐标从 camera frame 变换到 world frame。
