# 06 业务场景: 航线执行模式 (Waypoint Execution)

## 目录

- [1. 场景描述](#1-场景描述)
- [2. 状态机设计](#2-状态机设计)
- [3. 完整数据流（图 22）](#3-完整数据流图-22)
- [4. 后端执行逻辑详解](#4-后端执行逻辑详解)
- [5. 前端组件架构](#5-前端组件架构)
- [6. Topic 合约](#6-topic-合约)
- [7. WaypointExecPanel 生命周期](#7-waypointexecpanel-生命周期)
- [8. DroneControlPanel 变更](#8-dronecontrolpanel-变更)
- [9. ThreeDeeRender 订阅与拦截重构](#9-threedeerender-订阅与拦截重构)
- [10. 安全守护与逻辑闭环](#10-安全守护与逻辑闭环)
- [11. 边界场景分析](#11-边界场景分析)

---

## 1. 场景描述

航线执行模式是自主飞行场景 (`autonomous-flight`) 的扩展功能，允许用户在自主飞行场景中：

1. 通过 "Load Path" 按钮加载建图打点场景保存的航点项目
2. 在 Select Object 面板中查看航点列表（只读）
3. 点击 "Execute" 一键启动自动逐点飞行
4. 后端状态机自动向 EGO-Planner 逐点发送目标
5. 监听 DroneState.reached 确认到达后自动推进到下一航点
6. 随时通过 "Stop" 终止执行

**核心思想**:
- 两个场景共享同一套 `drone_{id}_` topic 和 `waypoint_recorder.py` 后端
- 后端是执行状态的权威来源，前端只读取状态控制 UI 可用性
- 执行中禁止修改航点列表，Stop 同时停飞控和执行状态

---

## 2. 状态机设计

### 对外状态 (通过 topic 发布，前端可见)

```text
          start_waypoint_exec (条件: idle + tookoff + waypoints非空)
  IDLE ──────────────────────────────────────────────────► EXECUTING
   ▲                                                          │
   │  stop_waypoint_exec 或 所有航点到达                        │
   ◄──────────────────────────────────────────────────────────┘
```

topic `/drone_{id}_waypoint_exec_state` 仅发布两个值: `"idle"` 或 `"executing"`。

### 内部子状态 (后端私有，前端不可见)

```text
  EXECUTING 内部:
    SENDING ──(发送目标后)──► WAITING ──(DroneState.reached=true)──► SENDING
                                                                     │
                                                    nav_current_idx++
                                                                     │
                                                    全部完成 → _halt_execution()
```

### 转换条件详解

| 转换 | 触发 | 前置条件 |
| --- | --- | --- |
| idle → executing | `/drone_{id}_start_waypoint_exec` (Empty) | `exec_state == "idle"` + `drone_tookoff == True` + `len(waypoints) > 0` |
| executing → idle | `/drone_{id}_stop_waypoint_exec` (Empty) | `exec_state == "executing"` |
| executing → idle | 自动 | 所有航点到达 (`nav_current_idx >= len(waypoints)`) |
| executing → idle | 自动 | 节点 shutdown |
| sending → waiting | 自动 | 航点发送完成 (`_send_waypoint()` 执行后) |
| waiting → sending | 自动 | `DroneState.reached == True` |

---

## 3. 完整数据流（图 22）

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                      航线执行模式 完整数据流                                   │
│                                                                              │
│  用户操作                前端处理                   通信层       后端处理        │
│  ────────                ────────                   ────       ────────       │
│                                                                              │
│  ① 点选机器人   Interactions.tsx                                              │
│  ──────────►   extractDroneIdFromTopic(topic)                                │
│                activeDroneId = droneId ?? lastDroneIdRef                      │
│                     │                                                        │
│                     ▼                                                        │
│                DroneControlPanel(droneId) 渲染                                │
│                     │                                                        │
│  ② Load Path   LoadProjectDialog                    Foxglove    waypoint_    │
│  ──────────►   选择项目 → handleLoad(name)          Bridge     recorder.py   │
│                publish("/drone_{id}_load_waypoints",  ────►    load_json()   │
│                  { data: "route_A" })                           │             │
│                                                                 ▼             │
│                                                       _publish_markers()     │
│                                                       publish MarkerArray    │
│                                                         │                    │
│                ThreeDeeRender 拦截                ◄──── │                    │
│                  正则: /drone_\d+_waypoint_markers/     │                    │
│                  → 颜色覆盖 (橙/白/紫)                   │                    │
│                  → setWaypointsFromMarkers(droneId, wps)│                    │
│                     │                                                        │
│                     ▼                                                        │
│                useWaypointStore.tables[droneId].waypoints 更新               │
│                     │                                                        │
│                     ▼                                                        │
│                Interactions.tsx: hasWaypoints = true                          │
│                → 渲染 WaypointExecPanel(droneId)                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  WaypointExecPanel (Select Object 面板底部)                              │ │
│  │                                                                         │ │
│  │  ┌───────────────────────────────────────────┐                         │ │
│  │  │  #  │  X      │  Y      │  Z             │  ← 只读表格              │ │
│  │  │  1  │  1.234  │  2.345  │  1.500         │                         │ │
│  │  │  2  │  3.456  │  4.567  │  1.500         │                         │ │
│  │  │  3  │  5.678  │  6.789  │  1.500         │                         │ │
│  │  ├───────────────────────────────────────────┤                         │ │
│  │  │  [▶ Execute]           [🗑 Clear]        │                         │ │
│  │  │  disabled=isExecuting  disabled=isExec    │                         │ │
│  │  └───────────────────────────────────────────┘                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ③ 确认执行    确认弹窗 → Execute                    Foxglove    waypoint_   │
│  ──────────►  publish("/drone_{id}_start_            Bridge     recorder.py  │
│                waypoint_exec", {})                    ────►     _start_exec  │
│                                                                 _cb()        │
│                                                                  │           │
│                                                          ┌───────┴────────┐  │
│                                                          │ 条件检查:       │  │
│                                                          │ idle?    ✓     │  │
│                                                          │ tookoff? ✓     │  │
│                                                          │ waypoints? ✓   │  │
│                                                          └───────┬────────┘  │
│                                                                  │           │
│                                                                  ▼           │
│                                                      exec_state = "executing"│
│                                                      publish("executing")    │
│                                                      启动 5Hz Timer          │
│                                                                  │           │
│                ThreeDeeRender 拦截                 ◄─────────────│           │
│                  正则: /drone_\d+_waypoint_exec_state/           │           │
│                  → setExecState(droneId, "executing")            │           │
│                     │                                                        │
│                     ▼                                                        │
│                UI 更新: Execute/Clear/Load 按钮 disabled                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  后端导航循环 (_nav_tick, 5Hz)                                           │ │
│  │                                                                         │ │
│  │  sending:                                         px4ctrl / EGO-Planner │ │
│  │    _send_waypoint(idx)                                                  │ │
│  │    ├── publish /control cmd=4 (Continue)          ────►  恢复导航模式    │ │
│  │    ├── sleep(0.2s)                                                      │ │
│  │    └── publish /goal_with_id                      ────►  规划避障轨迹    │ │
│  │        { drone_id, goal:[x,y,z] }                                       │ │
│  │    → 子状态 = waiting                                                    │ │
│  │                                                                         │ │
│  │  waiting:                                                               │ │
│  │    _drone_state_cb(DroneState)                                          │ │
│  │    ├── DroneState.reached == true?                                      │ │
│  │    └── 是 → nav_current_idx++ → 子状态 = sending                        │ │
│  │                                                                         │ │
│  │  完成:                                                                   │ │
│  │    nav_current_idx >= len(waypoints)                                     │ │
│  │    → _halt_execution("All waypoints reached")                           │ │
│  │    → publish /control cmd=5 (Stop)                                      │ │
│  │    → exec_state = "idle"                                                │ │
│  │    → publish("idle")                                                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ④ 手动停止    DroneControlPanel.Stop                Foxglove    后端        │
│  ──────────►  handleAbort():                         Bridge                  │
│                ├── publish /control cmd=5             ────►   px4ctrl (急停)  │
│                └── publish /drone_{id}_              ────►   waypoint_       │
│                    stop_waypoint_exec                        recorder        │
│                                                              _halt_exec()   │
│                                                              publish("idle")│
│                                                                              │
│                ThreeDeeRender 拦截                  ◄────────────────────────│
│                → setExecState(droneId, "idle")                               │
│                → UI 按钮恢复正常                                              │
│                                                                              │
│  ⑤ 清除路径    WaypointExecPanel.Clear               Foxglove    waypoint_  │
│  ──────────►  publish("/drone_{id}_clear_            Bridge     recorder    │
│                waypoints", {})                        ────►    clear → []    │
│                                                               publish empty │
│                                                               MarkerArray   │
│                ThreeDeeRender 拦截                  ◄────────────────────────│
│                → setWaypointsFromMarkers(droneId, [])                        │
│                → hasWaypoints = false                                         │
│                → WaypointExecPanel unmount (自动销毁)                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 后端执行逻辑详解

### 文件: `/home/colman/Project/drone/ego_ws/src/Utils/waypoint_recorder/scripts/waypoint_recorder.py`

### 4.1 新增实例变量

```python
self.exec_state = "idle"          # 对外状态: "idle" | "executing"
self.nav_current_idx = 0          # 当前执行到第几个航点 (0-based)
self.drone_reached = False        # DroneState callback 设置
self.drone_tookoff = False        # DroneState callback 设置
self._nav_sub_state = "sending"   # 内部子状态: "sending" | "waiting"
self._nav_timer = None            # rospy.Timer (5Hz)
```

### 4.2 新增 Publisher

| Publisher | Topic | 类型 | Latched | 用途 |
| --- | --- | --- | --- | --- |
| `exec_state_pub` | `/drone_{id}_waypoint_exec_state` | `std_msgs/String` | Yes | 发布执行状态 |
| `goal_pub` | `/goal_with_id` | `quadrotor_msgs/GoalSet` | No | 发送航点给 EGO-Planner |
| `control_pub` | `/control` | `controller_msgs/cmd` | No | 发送飞行指令 |

### 4.3 新增 Subscriber

| Subscriber | Topic | 类型 | 回调 |
| --- | --- | --- | --- |
| `state_sub` | `/drone_{id}_state` | `controller_msgs/DroneState` | `_drone_state_cb` |
| `start_exec_sub` | `/drone_{id}_start_waypoint_exec` | `std_msgs/Empty` | `_start_exec_cb` |
| `stop_exec_sub` | `/drone_{id}_stop_waypoint_exec` | `std_msgs/Empty` | `_stop_exec_cb` |

### 4.4 执行流程时序

```text
  Frontend        waypoint_recorder.py        px4ctrl.cpp         EGO-Planner
     │                    │                       │                     │
     │  Empty (start)     │                       │                     │
     │───────────────────►│                       │                     │
     │                    │ 条件检查 (3项)          │                     │
     │                    │ exec_state="executing" │                     │
     │                    │ 启动 Timer (5Hz)       │                     │
     │                    │                       │                     │
     │                    │ === _nav_tick (sending) ===                  │
     │                    │                       │                     │
     │                    │ cmd=4 (Continue)       │                     │
     │                    │──────────────────────►│                     │
     │                    │                       │ is_stopped=false    │
     │                    │                       │                     │
     │                    │ sleep(0.2s)            │                     │
     │                    │                       │                     │
     │                    │ GoalSet(id, [x,y,z])  │                     │
     │                    │──────────────────────►│ goal_cb()           │
     │                    │                       │────────────────────►│
     │                    │                       │                     │ plan
     │                    │                       │                     │ traj
     │                    │ sub_state = waiting    │                     │
     │                    │                       │                     │
     │                    │ === _nav_tick (waiting) ===                  │
     │                    │                       │                     │
     │                    │      DroneState       │                     │
     │                    │◄──────────────────────│                     │
     │                    │  .reached = false      │ (飞行中)            │
     │                    │                       │                     │
     │                    │   ... 多次 tick ...    │                     │
     │                    │                       │                     │
     │                    │      DroneState       │                     │
     │                    │◄──────────────────────│                     │
     │                    │  .reached = true       │ (dist < 0.5m)      │
     │                    │                       │                     │
     │                    │ nav_current_idx++      │                     │
     │                    │ sub_state = sending    │                     │
     │                    │                       │                     │
     │                    │ === 重复上述循环 ===    │                     │
     │                    │                       │                     │
     │                    │ === 最后一个航点到达 === │                     │
     │                    │                       │                     │
     │                    │ _halt_execution()      │                     │
     │                    │ cmd=5 (Stop)           │                     │
     │                    │──────────────────────►│ is_stopped=true     │
     │                    │ exec_state="idle"      │                     │
     │                    │ publish("idle")        │                     │
     │  String("idle")    │                       │                     │
     │◄───────────────────│                       │                     │
```

### 4.5 _send_waypoint() 详解

参考 `waypoint_recorder_old.py` 的逻辑：

```python
def _send_waypoint(self, idx):
    wp = self.waypoints[idx]

    # Step 1: 发送 Continue 命令，恢复导航模式
    ctrl_msg = CmdMsg()
    ctrl_msg.header.stamp = rospy.Time.now()
    ctrl_msg.cmd = 4  # CONTINUE
    self.control_pub.publish(ctrl_msg)

    # Step 2: 等待 200ms，确保飞控切换完成
    rospy.sleep(0.2)

    # Step 3: 发送目标点给 EGO-Planner
    goal_msg = GoalSet()
    goal_msg.drone_id = int(self.drone_id)
    goal_msg.goal = [float(wp["x"]), float(wp["y"]), float(wp["z"])]
    self.goal_pub.publish(goal_msg)
```

**为什么需要先发 Continue?** px4ctrl 的 Stop 命令 (cmd=5) 会将 `is_stopped=true`，飞控将忽略后续轨迹指令。必须先发 Continue (cmd=4) 恢复 `is_stopped=false`，才能让新目标生效。

### 4.6 _halt_execution() 详解

所有执行→空闲的路径统一走此方法：

```python
def _halt_execution(self, reason=""):
    # 1. 发送 Stop 给飞控 (急停)
    ctrl_msg.cmd = 5
    self.control_pub.publish(ctrl_msg)

    # 2. 重置状态
    self.exec_state = "idle"
    self.nav_current_idx = 0
    self.drone_reached = False
    self._nav_sub_state = "sending"

    # 3. 通知前端
    self.exec_state_pub.publish(String(data="idle"))

    # 4. 停止 Timer
    self._nav_timer.shutdown()
    self._nav_timer = None
```

---

## 5. 前端组件架构

### 自主飞行模式下的 Select Object 面板组件树

```text
RendererOverlay
  └─ Interactions (ExpandingToolbar)
       └─ ToolGroup "Selected object"
            └─ ToolGroupFixedSizePane (maxHeight=undefined when hasWaypoints)
                 │
                 ├─ DroneControlPanel
                 │    ├─ Drone {id} header
                 │    ├─ Button grid (Takeoff, Land, Return, Continue)
                 │    ├─ Stop button ──► handleAbort() (双通道停止)
                 │    ├─ ──── Divider ────
                 │    ├─ Load Path button (disabled=isExecuting)
                 │    │    └─ LoadProjectDialog (modal, 复用建图打点组件)
                 │    ├─ ──── Divider ────
                 │    └─ Publish Pose button (disabled=isExecuting)
                 │
                 └─ WaypointExecPanel (仅当 hasWaypoints=true)
                      ├─ ──── Divider ────
                      ├─ RouteIcon + "Waypoint Path" + 状态标签
                      ├─ Read-only table (#, X, Y, Z)
                      ├─ [▶ Execute] button (disabled=isExecuting)
                      ├─ [🗑 Clear] button (disabled=isExecuting)
                      └─ Execute 确认弹窗 (MUI Dialog)
```

### 条件渲染逻辑 (Interactions.tsx)

```text
  selectedObject 的 topic → extractDroneIdFromTopic() → droneId
                                                         │
  lastDroneIdRef.current 缓存最后的 droneId ◄────────────┘
                                                         │
  activeDroneId = droneId ?? lastDroneIdRef.current  ◄───┘
  (两种模式都持久化，避免点击空白处面板消失)

  hasWaypoints = useWaypointStore(tables[activeDroneId]?.waypoints.length > 0)

  渲染:
    isMapping ? <WaypointPanel>
              : <>
                  <DroneControlPanel>
                  {hasWaypoints && <WaypointExecPanel>}
                </>
```

---

## 6. Topic 合约

### 新增 Topic

| Topic | 方向 | Msg Type | Latched | 用途 |
| --- | --- | --- | --- | --- |
| `/drone_{id}_waypoint_exec_state` | 后端→前端 | `std_msgs/String` | Yes | `"idle"` 或 `"executing"` |
| `/drone_{id}_start_waypoint_exec` | 前端→后端 | `std_msgs/Empty` | No | 开始执行命令 |
| `/drone_{id}_stop_waypoint_exec` | 前端→后端 | `std_msgs/Empty` | No | 停止执行命令 |

### 复用的已有 Topic

| Topic | Msg Type | 在本功能中的角色 |
| --- | --- | --- |
| `/drone_{id}_state` | `controller_msgs/DroneState` | 后端订阅: 检测 `tookoff` 和 `reached` |
| `/goal_with_id` | `quadrotor_msgs/GoalSet` | 后端发布: 发送航点给 EGO-Planner |
| `/control` | `controller_msgs/cmd` | 后端发布 cmd=4/5; 前端也发布 cmd=5 (Stop) |
| `/drone_{id}_load_waypoints` | `std_msgs/String` | 前端发布: 加载航点项目 |
| `/drone_{id}_clear_waypoints` | `std_msgs/Empty` | 前端发布: 清空航点 |
| `/drone_{id}_waypoint_markers` | `visualization_msgs/MarkerArray` | 后端发布: 航点可视化 (前端拦截解析) |
| `/drone_{id}_waypoint_project_list` | `std_msgs/String` | 后端发布: 项目列表 (前端拦截解析) |

### topicConfig.ts 新增字段

```typescript
// BASE_TOPICS 新增:
startWaypointExec: "start_waypoint_exec",
stopWaypointExec: "stop_waypoint_exec",
waypointExecState: "waypoint_exec_state",

// DroneTopics 类型新增 3 个 string 字段
// droneTopics() 函数新增 3 个返回值
```

---

## 7. WaypointExecPanel 生命周期

### 文件: `packages/suite-base/src/spikive/components/WaypointExecPanel.tsx`

```text
  触发条件: hasWaypoints == true (useWaypointStore.tables[droneId].waypoints.length > 0)
           + sceneMode == "autonomous-flight" (非 mapping 模式)
           │
           ▼
  ┌───────────────────────────────────────────────────────────────┐
  │   React mount                                                 │
  │                                                               │
  │   topics = droneTopics(droneId)                               │
  │                                                               │
  │   useEffect:                                                  │
  │     advertise(topics.startWaypointExec, "std_msgs/Empty")     │
  │     advertise(topics.stopWaypointExec, "std_msgs/Empty")      │
  │     advertise(topics.clearWaypoints, "std_msgs/Empty")        │
  │                                                               │
  │   Store 读取:                                                  │
  │     waypointList = tables[droneId]?.waypoints                 │
  │     execState = execStates[droneId] ?? "idle"                 │
  └─────────┬─────────────────────────────────────────────────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  用户操作                                                             │
  │                                                                      │
  │  ┌──────────────┐  ┌──────────────┐                                │
  │  │ Execute 按钮  │  │ Clear 按钮   │                                │
  │  │ disabled=     │  │ disabled=    │                                │
  │  │ isExecuting   │  │ isExecuting  │                                │
  │  └──────┬───────┘  └──────┬───────┘                                │
  │         │                  │                                        │
  │         ▼                  ▼                                        │
  │  确认弹窗              publish(                                     │
  │  → publish(             topics.clearWaypoints,                      │
  │    topics.start          {})                                        │
  │    WaypointExec,          │                                         │
  │    {})                    ▼                                         │
  │         │          后端清空 waypoints                                │
  │         │          → MarkerArray 为空                                │
  │         │          → setWaypointsFromMarkers(droneId, [])          │
  │         │          → hasWaypoints = false                           │
  │         │          → *** WaypointExecPanel unmount ***              │
  │         │                                                           │
  │         ▼                                                           │
  │  后端收到 start                                                      │
  │  → exec_state = "executing"                                         │
  │  → setExecState(droneId, "executing")                               │
  │  → isExecuting = true                                               │
  │  → Execute / Clear / Load 按钮 disabled                             │
  │  → Publish Pose 按钮 disabled                                       │
  └──────────────────────────────────────────────────────────────────────┘
            │
            │ (Clear 后 hasWaypoints=false，或 droneId 变化)
            ▼
  ┌───────────────────────────────────────────────────────────────┐
  │   React unmount                                               │
  │                                                               │
  │   unadvertise(topics.startWaypointExec)                       │
  │   unadvertise(topics.stopWaypointExec)                        │
  │   unadvertise(topics.clearWaypoints)                          │
  └───────────────────────────────────────────────────────────────┘
```

---

## 8. DroneControlPanel 变更

### 文件: `packages/suite-base/src/spikive/components/DroneControlPanel.tsx`

### 新增功能

| 功能 | 说明 |
| --- | --- |
| 读取 execState | `useWaypointStore(s => s.execStates[droneId] ?? "idle")` |
| 读取 projectList | `useWaypointStore(s => s.projectLists[droneId] ?? [])` |
| Load Path 按钮 | 打开 LoadProjectDialog，`disabled=isExecuting` |
| Publish Pose 禁用 | 执行中 `disabled=isExecuting` |
| handleAbort() | `sendCommand(STOP)` + `publish(topics.stopWaypointExec, {})` |

### 新增 Topic 广播

```text
  useEffect (mount):
    advertise("/control", "controller_msgs/cmd")           # 已有
    advertise(topics.loadWaypoints, "std_msgs/String")     # 新增
    advertise(topics.stopWaypointExec, "std_msgs/Empty")   # 新增
```

### Stop 按钮行为变更

```text
  旧行为:  onClick → sendCommand(STOP)          # 仅停飞控
  新行为:  onClick → handleAbort()               # 停飞控 + 停执行

  handleAbort():
    1. sendCommand(DRONE_COMMANDS.STOP)           → /control { cmd: 5 }
    2. publish(topics.stopWaypointExec, {})        → /drone_{id}_stop_waypoint_exec
```

**双通道停止**: 即使后端 waypoint_recorder 处理消息延迟，飞控会立即响应 `/control` cmd=5 急停。

---

## 9. ThreeDeeRender 订阅与拦截重构

### 文件: `packages/suite-base/src/panels/ThreeDeeRender/ThreeDeeRender.tsx`

### 订阅逻辑重构 (原 ~L664)

```text
  旧结构:
    if (sceneMode === "mapping-waypoint") {
      订阅 odom
      订阅 waypoint_project_list
    }
    订阅 battery (所有模式)

  新结构:
    if (topics) {
      订阅 waypoint_markers           # 所有模式 (新)
      订阅 waypoint_project_list      # 所有模式 (从 mapping-only 移出)
      订阅 waypoint_exec_state        # 所有模式 (新)
    }
    if (sceneMode === "mapping-waypoint") {
      订阅 odom                       # 仅 mapping (不变)
    }
    订阅 battery (所有模式)            # 不变
```

### 消息拦截重构 (原 ~L770)

```text
  旧结构:
    if (sceneMode === "mapping-waypoint") {
      拦截 odom → updateOdom()
      拦截 waypoint_markers → recolor + setWaypointsFromMarkers()
      拦截 waypoint_project_list → setProjectList()
    }
    拦截 battery → updateBattery()

  新结构:
    拦截 waypoint_markers → recolor + setWaypointsFromMarkers()    # 所有模式 (从 mapping-only 移出)
    拦截 waypoint_project_list → setProjectList()                  # 所有模式 (从 mapping-only 移出)
    拦截 waypoint_exec_state → setExecState()                      # 所有模式 (新)
    if (sceneMode === "mapping-waypoint") {
      拦截 odom → updateOdom()                                     # 仅 mapping (不变)
    }
    拦截 battery → updateBattery()                                 # 所有模式 (不变)
```

### 新增 exec_state 拦截逻辑

```text
  // 正则: /^\/drone_\d+_waypoint_exec_state$/
  if (match) {
    const payload = (message.message as { data: string }).data;
    if (payload === "idle" || payload === "executing") {
      const droneId = extractDroneIdFromTopic(message.topic);
      if (droneId != undefined) {
        setExecState(droneId, payload);
      }
    }
    continue;  // 数据 topic，不传递给 Renderer
  }
```

### Store 新增

```text
  useWaypointStore 新增:
    execStates: Record<string, ExecState>     // droneId → "idle" | "executing"
    setExecState(droneId, state)              // 更新执行状态
```

---

## 10. 安全守护与逻辑闭环

### 后端安全守护 (waypoint_recorder.py)

| 回调 | 执行中行为 | 原因 |
| --- | --- | --- |
| `_add_waypoint_cb` | **拒绝** + 日志警告 | 不允许在飞行中修改路线 |
| `_remove_waypoint_cb` | **拒绝** + 日志警告 | 同上 |
| `_clear_waypoints_cb` | **拒绝** + 日志警告 | 同上 |
| `_reorder_waypoints_cb` | **拒绝** + 日志警告 | 同上 |
| `_load_waypoints_cb` | **拒绝** + 日志警告 | 不允许飞行中换路线 |
| `_save_waypoints_cb` | **允许** | 保存快照是安全的 |
| `_delete_project_cb` | **允许** | 删除文件不影响内存中的航点 |
| `_start_exec_cb` | 三重条件检查 | idle + tookoff + waypoints非空 |
| `_halt_execution()` | 发 cmd=5 → idle → 停 Timer | 统一停止路径 |
| shutdown handler | 调用 `_halt_execution()` | 节点退出时安全停止 |

### 前端安全守护

| UI 元素 | 执行中行为 | 原因 |
| --- | --- | --- |
| Execute 按钮 | `disabled` | 防止重复发送 start |
| Clear 按钮 | `disabled` | 防止清空正在飞的航线 |
| Load Path 按钮 | `disabled` | 防止换路线 |
| Publish Pose 按钮 | `disabled` | 防止手动发点干扰自动导航 |
| Stop 按钮 | **始终可用** | 紧急停止必须随时可达 |

### 双重保护矩阵

| 场景 | 前端保护 | 后端保护 | 闭环 |
| --- | --- | --- | --- |
| 执行中 Load | 按钮 disabled | `_check_exec_guard` 拒绝 | ✅ |
| 执行中 Publish Pose | 按钮 disabled | — (无直接后端关联) | ✅ |
| 执行中 Clear | 按钮 disabled | `_check_exec_guard` 拒绝 | ✅ |
| 执行中 Add/Remove/Reorder | 自主飞行场景无此 UI | `_check_exec_guard` 拒绝 | ✅ |
| 点 Stop | 双通道: cmd=5 + stop_exec | `_halt_execution` 双保险 | ✅ |
| 飞机未起飞点 Execute | 确认弹窗提醒 | `drone_tookoff=False` 拒绝 | ✅ |
| 所有航点飞完 | 自动读到 idle | 自动 `_halt_execution` + cmd=5 | ✅ |
| 节点退出 | — | shutdown handler `_halt_execution` | ✅ |
| 切换激活无人机 | 新无人机独立 execState | 各 drone_id 独立状态 | ✅ |

---

## 11. 边界场景分析

### 11.1 飞机未起飞就点 Execute

**现象**: 确认弹窗通过，前端发送 `start_waypoint_exec`。
**后端行为**: `_start_exec_cb` 检测 `drone_tookoff == False`，日志警告，拒绝。
**前端效果**: `exec_state` 保持 `"idle"`，按钮状态不变。

### 11.2 空航点列表点 Execute

**现象**: 理论上不可能 — `WaypointExecPanel` 仅在 `hasWaypoints=true` 时渲染。
**兜底**: 后端检测 `len(waypoints) == 0`，拒绝。

### 11.3 执行完所有航点

**后端**: `nav_current_idx >= len(waypoints)` → `_halt_execution("All waypoints reached")`，发 cmd=5 + 发布 "idle"。
**前端**: `setExecState(droneId, "idle")` → 按钮恢复可用。

### 11.4 用户连续点击 Execute

**第一次**: 正常触发执行。
**第二次** (已在执行): 前端 Execute 按钮 disabled 阻止；即使绕过，后端 `exec_state != "idle"` 拒绝。

### 11.5 执行中切换到其他无人机

**行为**: 3D Panel 通过 `useActiveDroneRouting` 重映射到新 drone_id。旧无人机继续执行（后端独立）。新无人机显示自己的 `execState`（通常为 idle）。
**切回**: 旧无人机的 `execState` topic 是 latched，ThreeDeeRender 重新拦截后 store 更新，UI 正确反映状态。

### 11.6 连接断开后重连

**后端**: 继续执行，`exec_state_pub` 是 latched。
**前端**: 重连后 Foxglove Bridge 重新接收 latched 消息，ThreeDeeRender 拦截更新 store。

### 11.7 执行中 Clear (前端绕过/异步)

**前端**: Clear 按钮在执行中 disabled。
**后端兜底**: `_check_exec_guard("clear_waypoints")` 拒绝。航点列表不变，执行继续。

### 11.8 Load 触发但航点为空

**现象**: 用户 Load 了一个空项目。
**后端**: 加载空列表 → 发布空 MarkerArray。
**前端**: `setWaypointsFromMarkers(droneId, [])` → `hasWaypoints=false` → WaypointExecPanel unmount。无法点 Execute。
