# 01 系统架构与设计哲学

## 目录

- [1. 设计原则](#1-设计原则)
- [2. 硬件部署拓扑（图 1）](#2-硬件部署拓扑图-1)
- [3. 系统总体架构（图 2）](#3-系统总体架构图-2)
- [4. React 组件树与数据依赖（图 3）](#4-react-组件树与数据依赖图-3)
- [5. Zustand Store 状态流（图 4）](#5-zustand-store-状态流图-4)
- [6. Lichtblick 三层嫁接策略（图 5）](#6-lichtblick-三层嫁接策略图-5)
- [7. 场景模式分支逻辑（图 6）](#7-场景模式分支逻辑图-6)
- [8. Topic 路由映射（图 7）](#8-topic-路由映射图-7)
- [9. 场景共享与差异矩阵](#9-场景共享与差异矩阵)
- [10. 前后端职责边界](#10-前后端职责边界)

---

## 1. 设计原则

### 1.1 增量嫁接原则 (Incremental Grafting)

在 Lichtblick v1.24.3 基座上，以最小侵入性为目标进行功能扩展：

- **新增代码** 全部放在 `spikive/` 命名空间下，与 Lichtblick 原始代码物理隔离
- **修改原文件** 时仅添加 import 和条件分支（注入点），所有修改行带 `// Spikive:` 注释标记
- **不动核心渲染引擎**，不改全局状态机制，保证 Lichtblick upstream 可合并性

### 1.2 场景驱动架构 (Scene-Driven Architecture)

系统面向两个业务场景设计——「自主飞行」和「建图打点」：

- `useSceneModeStore` 作为全局模式开关，在应用启动时由用户选择
- 两个场景 **共享** 基础设施层（MultiRobotSidebar、droneTopics 路由、Pickable 过滤）
- **差异部分** 通过 `Interactions.tsx` 的条件分支注入不同面板（DroneControlPanel / WaypointPanel）
- 场景之间不互相感知，通过 Store 状态隔离

### 1.3 Topic 路由即身份 (Topic Routing as Identity)

`drone_id` 是系统的核心路由键，贯穿前后端全链路：

- **Topic 命名规范**：`/drone_{id}_{base_topic}`（如 `/drone_1_cloud_registered`）
- **TF 帧命名**：`base{id}`（如 `base1`）
- **路由函数**：`droneTopics(id)` 输入一个 ID，输出完整的 18 个 topic 路径（含航点管理和执行相关 topic）
- 切换活跃无人机时，通过 `useActiveDroneRouting` hook 重写 3D Panel 的全部 topic 订阅

### 1.4 Zustand 单向数据流

- 每个 Store 是 Single Source of Truth，组件通过 selector 订阅
- Store 之间 **不互相订阅**，通过 hook 层（如 `useActiveDroneRouting`）协调
- 避免 prop drilling：深层组件直接读 Store，不通过 React Context Provider 嵌套

---

## 2. 硬件部署拓扑（图 1）

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          局域网 (WiFi / Ethernet)                    │
│                                                                     │
│  ┌─────────────────────┐      ┌─────────────────────┐              │
│  │   地面站 PC           │      │   无人机 #1          │              │
│  │                     │      │   (机载计算机)        │              │
│  │  ┌───────────────┐  │ ws://│  ┌───────────────┐   │              │
│  │  │ Spikive-      │  │ IP:  │  │ Foxglove      │   │              │
│  │  │ Lichtblick    │◄─┼─8765─┼─►│ Bridge        │   │              │
│  │  │ (浏览器)       │  │      │  └───────┬───────┘   │              │
│  │  └───────────────┘  │      │          │ ROS1      │              │
│  │                     │      │  ┌───────┴───────┐   │              │
│  │                     │      │  │ Visual SLAM   │   │              │
│  │                     │      │  │ EGO-Planner   │   │              │
│  │                     │      │  │ flight_manager│   │              │
│  │                     │      │  │ odom_visual.  │   │              │
│  │                     │      │  └───────────────┘   │              │
│  └─────────────────────┘      └─────────────────────┘              │
│                                                                     │
│                               ┌─────────────────────┐              │
│                               │   无人机 #2          │              │
│                        ws://  │   (机载计算机)        │              │
│                   ◄────IP:8765┼─► Foxglove Bridge    │              │
│                               │   + ROS1 节点栈      │              │
│                               └─────────────────────┘              │
│                                                                     │
│                               ┌─────────────────────┐              │
│                               │   无人机 #N          │              │
│                        ws://  │   ...                │              │
│                   ◄────IP:8765┼─► ...                │              │
│                               └─────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘

通信模型：
  地面站 ──── 1:N WebSocket ────► 每架无人机独立运行 Foxglove Bridge
  每次只有一架无人机处于"活跃"状态（Topic 订阅指向该机）
  其余无人机保持连接但不推流数据
```

**关键设计决策**：
- 每架无人机独立运行 Foxglove Bridge 实例，地面站通过 WebSocket 直连
- 当前架构为单活跃无人机模型：同一时间只有一架无人机的数据被 3D Panel 订阅
- 切换活跃无人机通过 Topic 重映射实现，无需断开/重连 WebSocket

---

## 3. 系统总体架构（图 2）

```text
┌══════════════════════════════════════════════════════════════════════════┐
║                        浏览器层 (Spikive-Lichtblick Web App)             ║
║                                                                        ║
║  ┌──────────────────┐  ┌────────────────────────────────────────────┐  ║
║  │  左侧边栏          │  │              3D Panel (ThreeDeeRender)     │  ║
║  │  MultiRobotSidebar│  │                                            │  ║
║  │                   │  │  ┌──────────────────────────────────────┐  │  ║
║  │ ┌───────────────┐ │  │  │         Renderer (Three.js)          │  │  ║
║  │ │ RobotCard #1  │ │  │  │                                      │  │  ║
║  │ │ [active] 12ms │ │  │  │  点云 / 轨迹 / 机器人模型 / 航迹      │  │  ║
║  │ └───────────────┘ │  │  │       ↓ GPU Pick (pickable filter)   │  │  ║
║  │ ┌───────────────┐ │  │  └──────────────────────────────────────┘  │  ║
║  │ │ RobotCard #2  │ │  │                                            │  ║
║  │ │ [idle]   8ms  │ │  │  ┌──────────────────────────────────────┐  │  ║
║  │ └───────────────┘ │  │  │    RendererOverlay → Interactions     │  │  ║
║  │                   │  │  │    ┌────────────────────────────────┐ │  │  ║
║  │ ┌───────────────┐ │  │  │    │  场景模式 == autonomous?       │ │  │  ║
║  │ │ [+ 添加机器人] │ │  │  │    │  ├── YES → DroneControlPanel  │ │  │  ║
║  │ └───────────────┘ │  │  │    │  └── NO  → WaypointPanel      │ │  │  ║
║  └──────────────────┘  │  │    └────────────────────────────────┘ │  │  ║
║                        │  └──────────────────────────────────────┘  │  ║
║  ┌─────────────────────┴────────────────────────────────────────────┘  ║
║  │  SceneSelectionDialog (启动时阻塞，选择场景模式)                       ║
║  └────────────────────────────────────────────────────────────────────  ║
║                                                                        ║
║  ┌────────────────────── Zustand Stores ─────────────────────────────┐ ║
║  │  useRobotConnectionsStore  │  useSceneModeStore  │ useWaypointStore│ ║
║  │  (机器人连接状态)            │  (场景模式)          │ (航点数据)      │ ║
║  └────────────────────────────┴────────────────────┴─────────────────┘ ║
╚═══════════════════════════════════════╤══════════════════════════════════╝
                                        │
                         Foxglove Bridge WebSocket (ws://IP:8765)
                                        │
╔═══════════════════════════════════════╧══════════════════════════════════╗
║                        ROS1 层 (每架无人机机载)                           ║
║                                                                        ║
║  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐   ║
║  │ foxglove_bridge │  │ flight_manager │  │ ego_replan_fsm         │   ║
║  │ (WS↔ROS 桥接)   │  │ (/control路由)  │  │ (轨迹规划 + 避障)       │   ║
║  └───────┬────────┘  └───────┬────────┘  └───────┬────────────────┘   ║
║          │                   │                    │                    ║
║  ┌───────┴───────────────────┴────────────────────┴──────────────┐    ║
║  │                      ROS Topic 网络                            │    ║
║  │                                                                │    ║
║  │  订阅方向 (ROS → 前端):                                         │    ║
║  │    /drone_{id}_cloud_registered        (PointCloud2)           │    ║
║  │    /drone_{id}_visual_slam/odom        (Odometry)              │    ║
║  │    /drone_{id}_odom_visualization/*    (Marker, Path, TF)      │    ║
║  │    /drone_{id}_ego_planner_node/*      (Marker)                │    ║
║  │                                                                │    ║
║  │  发布方向 (前端 → ROS):                                         │    ║
║  │    /control                            (controller_msgs/cmd)   │    ║
║  │    /goal_with_id                       (quadrotor_msgs/GoalSet)│    ║
║  │    /drone_{id}_waypoint_markers        (MarkerArray)           │    ║
║  │    /drone_{id}_save_waypoints          (std_msgs/String)       │    ║
║  │    /drone_{id}_load_waypoints          (std_msgs/String)       │    ║
║  │    /drone_{id}_delete_waypoint_project (std_msgs/String)       │    ║
║  │    /drone_{id}_reorder_waypoints       (std_msgs/String)       │    ║
║  │                                                                │    ║
║  │  订阅方向 (ROS → 前端, per-drone):                               │    ║
║  │    /drone_{id}_waypoint_markers        (MarkerArray)           │    ║
║  │    /drone_{id}_waypoint_project_list   (std_msgs/String)       │    ║
║  │    /drone_{id}_waypoint_exec_state     (std_msgs/String)       │    ║
║  │    /drone_{id}_state                   (DroneState)            │    ║
║  └────────────────────────────────────────────────────────────────┘    ║
║                                                                        ║
║  ┌────────────────────┐  ┌─────────────────┐                          ║
║  │ odom_visualization  │  │ Visual SLAM      │                          ║
║  │ (TF广播+可视化标记)   │  │ (定位 + 建图)     │                          ║
║  └────────────────────┘  └─────────────────┘                          ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

## 4. React 组件树与数据依赖（图 3）

```text
Workspace (根组件)
│
├── SceneSelectionDialog ·················· 读: useSceneModeStore
│   └── 启动时阻塞，用户选择场景模式后关闭     写: setSceneMode()
│
├── NewSidebar (左侧边栏)
│   ├── ThemeToggleButton ················· 读/写: AppSetting.COLOR_SCHEME
│   │
│   └── MultiRobotSidebar ················ 读: useRobotConnectionsStore
│       ├── RobotCard (×N)                  写: setActive / toggleVisibility / removeRobot
│       │   └── 状态灯 + 延迟 + 操作按钮     读: useWebSocketMonitor (latency)
│       │
│       ├── AddRobotDialog                  写: addRobot (probeWebSocket 预检)
│       │
│       ├── useActiveDroneRouting() ······· 读: activeRobot.droneId
│       │   └── 重写 3D Panel 的 topic 订阅   写: currentLayoutActions.setTopics()
│       │
│       └── useWebSocketMonitor() ········· 写: updateStatus(latencyMs)
│
└── 3D Panel (ThreeDeeRender)
    │
    ├── Renderer ·························· Lichtblick 核心
    │   ├── Three.js 场景图
    │   ├── #isRenderablePickable() ······· 补丁: pickable 过滤
    │   ├── #hideNonPickableRenderables()
    │   └── getSelectedRenderableInfo() ··· 补丁: 返回选中对象信息
    │
    ├── [消息处理循环] ···················· currentFrameMessages
    │   ├── 正常渲染路径 → Renderer
    │   └── Odom 拦截 (mapping 模式) ····· 写: useWaypointStore.updateOdom()
    │
    ├── [GoalSet 发布逻辑]
    │   ├── publishDroneIdRef (锁定机制)
    │   └── makeGoalSetMessage() → /goal_with_id
    │
    └── RendererOverlay
        └── Interactions
            ├── 场景模式分支判断 ··········· 读: useSceneModeStore
            │
            ├── [autonomous] DroneControlPanel
            │   ├── sendCommand() ········· 写: publish /control
            │   ├── handleAbort() ········· 写: publish /control + /stop_waypoint_exec
            │   ├── LoadProjectDialog ····· prop: projectList (from useWaypointStore)
            │   └── isExecuting 禁用 ······· 读: useWaypointStore.execStates
            │
            ├── [autonomous + hasWaypoints] WaypointExecPanel (条件渲染)
            │   ├── 只读航点表格 ··········· 读: useWaypointStore.tables[droneId].waypoints
            │   ├── Execute 按钮 ·········· 写: publish /start_waypoint_exec
            │   ├── Clear 按钮 ··········· 写: publish /clear_waypoints
            │   └── 执行状态 ·············· 读: useWaypointStore.execStates[droneId]
            │
            └── [mapping] WaypointPanel
                ├── 实时位置显示 ··········· 读: useWaypointStore.latestOdom
                ├── 航点录制 ·············· 写: useWaypointStore.addWaypoint()
                ├── Marker 发布 ··········· 写: publish /drone_{id}_waypoint_markers
                ├── 拖拽排序 ·············· 写: publish /drone_{id}_reorder_waypoints
                ├── SaveProjectDialog ····· prop: projectList (from store via WaypointPanel)
                ├── LoadProjectDialog ····· prop: projectList (from store via WaypointPanel)
                └── ManageProjectsDialog ·· prop: projectList (from store via WaypointPanel)

图例:
  ─── 组件父子关系      ···· 数据依赖 (读/写 Store 或 Context)
  [方括号] 条件分支       () 函数调用
  ★ Spikive 新增组件     (无标记) Lichtblick 原始组件
```

---

## 5. Zustand Store 状态流（图 4）

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    useRobotConnectionsStore                         │
│                                                                     │
│  State:                                                             │
│    robots: RobotEntry[]                                             │
│    ├── id, droneId, url, status, latencyMs, isActive, isVisible     │
│                                                                     │
│  写入者 (Actions):                          读取者 (Subscribers):    │
│    AddRobotDialog → addRobot()              MultiRobotSidebar       │
│    RobotCard      → removeRobot()           RobotCard (×N)          │
│    RobotCard      → setActive()             useActiveDroneRouting   │
│    RobotCard      → toggleVisibility()      useWebSocketMonitor     │
│    useWebSocketMonitor → updateStatus()                             │
└─────────────────────────────────────────────────────────────────────┘
         │                                              │
         │ (无直接依赖，通过 hook 层协调)                    │
         │                                              │
         │  useActiveDroneRouting 监听 activeRobot       │
         │  的 droneId 变化 → 重写 3D Panel topic 配置     │
         ▼                                              ▼
┌──────────────────────────────┐  ┌────────────────────────────────┐
│    useSceneModeStore          │  │     useWaypointStore            │
│                              │  │                                │
│  State:                      │  │  State:                        │
│    sceneMode:                │  │    tables:                     │
│      undefined               │  │      Record<droneId,           │
│      | "autonomous-flight"   │  │        DroneWaypointState>     │
│      | "mapping-waypoint"    │  │    latestOdom:                 │
│                              │  │      Record<droneId,           │
│  写入者:                      │  │        OdomPosition>           │
│    SceneSelectionDialog      │  │    projectLists:               │
│    → setSceneMode()          │  │      Record<droneId, string[]> │
│                              │  │      (per-drone 航点项目名列表)  │
│                              │  │    execStates:                 │
│                              │  │      Record<droneId,           │
│                              │  │        "idle"|"executing">     │
│                              │  │      (per-drone 航线执行状态)    │
│  读取者:                      │  │                                │
│    Interactions              │  │  写入者:                        │
│    (分支: DroneControl       │  │    ThreeDeeRender              │
│     vs Waypoint)             │  │    → updateOdom() [odom 拦截]   │
│    ThreeDeeRender            │  │    → setWaypointsFromMarkers() │
│    (odom 订阅开关)            │  │      [marker 颜色覆盖时解析]    │
│                              │  │    → setProjectList(droneId)   │
│                              │  │      [/drone_{id}_waypoint_    │
│                              │  │       project_list 消息拦截]    │
│                              │  │    → setExecState(droneId)     │
│                              │  │      [/drone_{id}_waypoint_    │
│                              │  │       exec_state 消息拦截]      │
│                              │  │    WaypointPanel               │
│                              │  │    → addWaypoint()             │
│                              │  │    → removeWaypoint()          │
│                              │  │    → deleteLast()              │
│                              │  │    → clearWaypoints()          │
│                              │  │    → updateZSettings()         │
│                              │  │                                │
│                              │  │  读取者:                        │
│                              │  │    WaypointPanel               │
│                              │  │    → latestOdom[droneId]       │
│                              │  │    → tables[droneId].waypoints │
│                              │  │    → projectLists[droneId]     │
│                              │  │    SaveProjectDialog (prop)    │
│                              │  │    LoadProjectDialog (prop)    │
│                              │  │    ManageProjectsDialog (prop) │
│                              │  │    DroneControlPanel           │
│                              │  │    → execStates[droneId]       │
│                              │  │    → projectLists[droneId]     │
│                              │  │    WaypointExecPanel           │
│                              │  │    → tables[droneId].waypoints │
│                              │  │    → execStates[droneId]       │
└──────────────────────────────┘  └────────────────────────────────┘

数据流方向:
  SceneSelectionDialog ──设置模式──► useSceneModeStore ──读取──► Interactions / ThreeDeeRender
  AddRobotDialog ──添加机器人──► useRobotConnectionsStore ──读取──► useActiveDroneRouting
  ThreeDeeRender ──odom拦截──► useWaypointStore ──读取──► WaypointPanel
  ThreeDeeRender ──marker拦截──► useWaypointStore.setWaypointsFromMarkers(droneId, ...)
  ThreeDeeRender ──projectList拦截──► useWaypointStore.setProjectList(droneId, list) ──prop──► Dialogs
  ThreeDeeRender ──execState拦截──► useWaypointStore.setExecState(droneId, state) ──读取──► DroneControlPanel / WaypointExecPanel
  WaypointPanel ──读取projectLists[droneId]──► 通过 prop 传递给 Save/Load/Manage Dialogs
```

---

## 6. Lichtblick 三层嫁接策略（图 5）

```text
                    ┌─────────────────────────────────────────┐
                    │           第一层: 新增层 (spikive/)       │
                    │           完全新增代码，零侵入              │
                    │                                         │
                    │  config/topicConfig.ts                   │
                    │  hooks/useActiveDroneRouting.ts          │
                    │  stores/useSceneModeStore.ts             │
                    │  stores/useWaypointStore.ts              │
                    │  components/DroneControlPanel.tsx        │
                    │  components/WaypointExecPanel.tsx        │
                    │  components/WaypointPanel.tsx            │
                    │  components/SceneSelectionDialog.tsx     │
                    │  components/SaveProjectDialog.tsx        │
                    │  components/LoadProjectDialog.tsx        │
                    │  components/ManageProjectsDialog.tsx     │
                    │  components/ThemeToggleButton.tsx        │
                    │  styles/spikiveGlobalOverrides.css       │
                    │  + MultiRobotSidebar/ (完整组件目录)      │
                    └─────────────────┬───────────────────────┘
                                      │ import
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │        第二层: 注入层 (最小侵入修改)       │
                    │        添加 import + 条件分支              │
                    │                                         │
                    │  Workspace.tsx                           │
                    │    +import SceneSelectionDialog          │
                    │    +import ThemeToggleButton             │
                    │    +左侧边栏 → robots only               │
                    │    +禁用 DataSourceDialog                │
                    │                                         │
                    │  Interactions.tsx                        │
                    │    +import DroneControlPanel             │
                    │    +import WaypointPanel                 │
                    │    +import useSceneModeStore             │
                    │    +场景模式条件分支渲染                    │
                    │                                         │
                    │  defaultLayout.ts                        │
                    │    +import TOPIC_CONFIG                  │
                    │    +锁定布局 + pickable 标记               │
                    │                                         │
                    │  Sidebars/ (hideClose, headerActions)    │
                    │  WorkspaceContext (添加 "robots" key)     │
                    └─────────────────┬───────────────────────┘
                                      │ 调用 Lichtblick 内部 API
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │       第三层: 补丁层 (核心逻辑改动)        │
                    │       修改 Lichtblick 渲染/发布核心        │
                    │                                         │
                    │  Renderer.ts                             │
                    │    +#isRenderablePickable()   (新增方法)  │
                    │    +#hideNonPickableRenderables() (新增)  │
                    │    +getSelectedRenderableInfo()   (新增)  │
                    │    ~click/hover handler 中调用 pickable  │
                    │                                         │
                    │  publish.ts                              │
                    │    +GoalSetDatatypes          (新增常量)  │
                    │    +makeGoalSetMessage()      (新增函数)  │
                    │    +WaypointMarkerDatatypes   (新增常量)  │
                    │    +makeWaypointMarkerArray() (新增函数)  │
                    │                                         │
                    │  ThreeDeeRender.tsx                      │
                    │    +odom topic 动态订阅        (新增逻辑)  │
                    │    +odom 消息拦截 → Store      (新增逻辑)  │
                    │    +GoalSet advertise/publish  (新增逻辑)  │
                    │    +waypoint 颜色覆盖拦截      (新增逻辑)  │
                    │    +projectList 消息拦截       (新增逻辑)  │
                    │    +execState 消息拦截         (新增逻辑)  │
                    │    +订阅重构: marker/projectList  (重构)   │
                    │    +  从 mapping-only 提升到所有模式       │
                    │    +publishDroneIdRef 锁定      (新增逻辑)  │
                    │                                         │
                    │  settings.ts                             │
                    │    +BaseSettings.pickable 字段  (新增属性)  │
                    └─────────────────────────────────────────┘

修改量统计:
  ┌──────────┬──────────────┬──────────┐
  │ 层级     │ 文件数        │ 新增行数   │
  ├──────────┼──────────────┼──────────┤
  │ 新增层   │ 15+ 文件      │ ~1400 行  │
  │ 注入层   │ 6 文件        │ ~80 行    │
  │ 补丁层   │ 4 文件        │ ~450 行   │
  └──────────┴──────────────┴──────────┘
```

---

## 7. 场景模式分支逻辑（图 6）

```text
                        应用启动
                          │
                          ▼
                ┌─────────────────────┐
                │ SceneSelectionDialog │
                │ (阻塞式模态对话框)     │
                └─────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
   ┌──────────────────┐    ┌──────────────────┐
   │  autonomous-      │    │  mapping-         │
   │  flight           │    │  waypoint         │
   │  (自主飞行)        │    │  (建图打点)        │
   └────────┬─────────┘    └────────┬─────────┘
            │                       │
            ▼                       ▼
   useSceneModeStore.setSceneMode("autonomous-flight" | "mapping-waypoint")
            │                       │
            │                       │
  ══════════╪═══════════════════════╪═══════════════════════════
  ║ 共享层:  │                       │                         ║
  ║         ▼                       ▼                         ║
  ║  ┌─────────────────────────────────────────────────────┐  ║
  ║  │           MultiRobotSidebar (机器人管理)              │  ║
  ║  │  添加/删除/切换无人机 → useActiveDroneRouting        │  ║
  ║  │  WebSocket 健康监控 → useWebSocketMonitor           │  ║
  ║  └─────────────────────────────────────────────────────┘  ║
  ║                          │                                ║
  ║                          ▼                                ║
  ║  ┌─────────────────────────────────────────────────────┐  ║
  ║  │           3D Panel 渲染 (ThreeDeeRender)             │  ║
  ║  │  droneTopics(id) 动态路由订阅 6 个 topic             │  ║
  ║  │  (含 waypointMarkers, 由 useActiveDroneRouting 驱动)  │  ║
  ║  │  Pickable 过滤 (仅机器人模型可点选)                    │  ║
  ║  │  Camera followTf = base{id}                         │  ║
  ║  └─────────────────────────────────────────────────────┘  ║
  ═══════════════════════════╪═══════════════════════════════════
                             │
              ┌──────────────┴──────────────┐
              │  用户点击机器人模型 (GPU Pick) │
              └──────────────┬──────────────┘
                             │
               Interactions.tsx 条件分支
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
   ┌────────────────────┐       ┌────────────────────────┐
   │  autonomous-flight  │       │  mapping-waypoint       │
   │                    │       │                        │
   │ DroneControlPanel  │       │ WaypointPanel          │
   │ ┌────────────────┐│       │ ┌────────────────────┐  │
   │ │ Takeoff / Land ││       │ │ 实时位置显示 (odom)  │  │
   │ │ Return / Stop  ││       │ │ Record / Delete     │  │
   │ │ Continue       ││       │ │ Z 轴调整            │  │
   │ │ Publish Pose   ││       │ │ MarkerArray 发布     │  │
   │ │ Load Path      ││       │ └────────────────────┘  │
   │ └────────────────┘│       │                        │
   │                    │       │ 发布 (per-drone):       │
   │ WaypointExecPanel │       │  /drone_{id}_waypoint_  │
   │ (条件: hasWaypoints)│      │    markers              │
   │ ┌────────────────┐│       │  /drone_{id}_save_      │
   │ │ 航点表格 (只读) ││       │    waypoints            │
   │ │ Execute / Clear││       │  /drone_{id}_load_      │
   │ └────────────────┘│       │    waypoints            │
   │                    │       │  /drone_{id}_delete_    │
   │ 发布:               │       │    waypoint_project     │
   │  /control (cmd)    │       │  /drone_{id}_reorder_   │
   │  /goal_with_id     │       │    waypoints            │
   │  (GoalSet)         │       │                        │
   │  /drone_{id}_start │       │ ThreeDeeRender 额外行为: │
   │   _waypoint_exec   │       │  +odom topic 动态订阅    │
   │  /drone_{id}_stop  │       │  +odom 消息拦截→Store    │
   │   _waypoint_exec   │       │  +per-drone waypoint_   │
   │  /drone_{id}_load  │       │    markers 颜色覆盖拦截  │
   │   _waypoints       │       │  +per-drone projectList │
   └────────────────────┘       │    (regex 订阅) 拦截     │
                                └────────────────────────┘

   ThreeDeeRender 所有模式共享行为:
    +waypoint_markers 正则订阅 + 颜色覆盖拦截
    +waypoint_project_list 正则订阅 + JSON 解析拦截
    +waypoint_exec_state 正则订阅 + 状态拦截
    +battery 遥测订阅
```

---

## 8. Topic 路由映射（图 7）

```text
                     droneTopics(id) 函数
                     ┌─────────────┐
         输入:       │             │     输出:
         droneId ──►│ topicConfig  │──► 完整 Topic 路径
         (string)   │  .ts         │
                     └─────────────┘

  ┌───────────────────────────────────────────────────────────────┐
  │                 Topic 映射表 (droneTopics 18 字段)              │
  │                                                               │
  │  BASE_TOPICS              droneTopics("1")                    │
  │  ─────────────            ──────────────────────────────────  │
  │  cloud_registered    ──►  /drone_1_cloud_registered           │
  │  ego_planner_node/   ──►  /drone_1_ego_planner_node/          │
  │    optimal_list               optimal_list                    │
  │  ego_planner_node/   ──►  /drone_1_ego_planner_node/          │
  │    goal_point                 goal_point                      │
  │  odom_visualization/ ──►  /drone_1_odom_visualization/        │
  │    robot                      robot                           │
  │  odom_visualization/ ──►  /drone_1_odom_visualization/        │
  │    path                       path                            │
  │  visual_slam/odom    ──►  /drone_1_visual_slam/odom           │
  │  add_waypoint        ──►  /drone_1_add_waypoint               │
  │  remove_waypoint     ──►  /drone_1_remove_waypoint            │
  │  clear_waypoints     ──►  /drone_1_clear_waypoints            │
  │  save_waypoints      ──►  /drone_1_save_waypoints             │
  │  load_waypoints      ──►  /drone_1_load_waypoints             │
  │  delete_waypoint_    ──►  /drone_1_delete_waypoint_project    │
  │    project                                                    │
  │  reorder_waypoints   ──►  /drone_1_reorder_waypoints          │
  │  waypoint_markers    ──►  /drone_1_waypoint_markers           │
  │  waypoint_project_   ──►  /drone_1_waypoint_project_list      │
  │    list                                                       │
  │  start_waypoint_exec ──►  /drone_1_start_waypoint_exec        │
  │  stop_waypoint_exec  ──►  /drone_1_stop_waypoint_exec         │
  │  waypoint_exec_state ──►  /drone_1_waypoint_exec_state        │
  └───────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────┐
  │                    TF 帧映射                                   │
  │                                                               │
  │  droneBodyFrame("1")  ──►  "base1"                            │
  │  droneBodyFrame("2")  ──►  "base2"                            │
  │  droneBodyFrame("N")  ──►  "baseN"                            │
  │                                                               │
  │  用途: 3D Panel 的 camera followTf 参数                        │
  └───────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────┐
  │              全局 Topic (不带 drone_id 前缀)                     │
  │                                                               │
  │  /control            ◄── DroneControlPanel 发布飞行指令         │
  │  /goal_with_id       ◄── ThreeDeeRender 发布 GoalSet 目标点    │
  │  /move_base_simple/  ◄── 3D Panel Publish Pose 工具            │
  │    goal                                                       │
  └───────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────┐
  │         Per-Drone Waypoint Topic (drone_{id}_ 前缀)             │
  │                                                               │
  │  发布方向 (前端 → ROS, 由 WaypointPanel 通过 droneTopics(id)   │
  │  动态构建 topic 名称):                                          │
  │  /drone_{id}_waypoint_markers        (MarkerArray)             │
  │  /drone_{id}_add_waypoint            (std_msgs/String)         │
  │  /drone_{id}_remove_waypoint         (std_msgs/String)         │
  │  /drone_{id}_clear_waypoints         (std_msgs/String)         │
  │  /drone_{id}_save_waypoints          (std_msgs/String)         │
  │  /drone_{id}_load_waypoints          (std_msgs/String)         │
  │  /drone_{id}_delete_waypoint_project (std_msgs/String)         │
  │  /drone_{id}_reorder_waypoints       (std_msgs/String)         │
  │                                                               │
  │  订阅方向 (ROS → 前端):                                        │
  │  /drone_{id}_waypoint_markers  ──► config 路由(6 字段之一)      │
  │    useActiveDroneRouting 自动重映射                              │
  │    ThreeDeeRender 正则拦截 + 颜色覆盖 → setWaypointsFromMarkers │
  │                                                               │
  │  /drone_{id}_waypoint_project_list                             │
  │    ThreeDeeRender 正则订阅所有 drone 的 project_list            │
  │    (/^\/drone_\d+_waypoint_project_list$/)                     │
  │    → setProjectList(droneId, list)                             │
  └───────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────┐
  │          Topic 切换流程 (切换活跃无人机, 6 字段路由)               │
  │                                                               │
  │  useActiveDroneRouting 监测到 activeRobot.droneId 变化:        │
  │                                                               │
  │  TOPIC_FIELDS (6 字段):                                        │
  │    pointCloud, optimalTrajectory, goalPoint,                  │
  │    robotModel, path, waypointMarkers                          │
  │                                                               │
  │  remapTopics(fromId="1", toId="2"):                           │
  │                                                               │
  │    /drone_1_cloud_registered        ──►  /drone_2_cloud_...   │
  │    /drone_1_ego_planner_node/...    ──►  /drone_2_ego_...     │
  │    /drone_1_odom_visualization/...  ──►  /drone_2_odom_...    │
  │    /drone_1_waypoint_markers        ──►  /drone_2_waypoint_...│
  │    camera.followTf: "base1"         ──►  "base2"              │
  │                                                               │
  │  NON_PICKABLE_FIELDS:                                         │
  │    pointCloud, optimalTrajectory, goalPoint,                  │
  │    path, waypointMarkers  (仅 robotModel 可点选)               │
  │                                                               │
  │  同时确保 pickable flags 正确 (ensurePickableFlags)             │
  └───────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────┐
  │               extractDroneIdFromTopic() 反向提取                │
  │                                                               │
  │  输入: "/drone_3_cloud_registered"                              │
  │  正则: /^\/drone_(\d+)_/                                       │
  │  输出: "3"                                                     │
  │                                                               │
  │  用途:                                                         │
  │    - Interactions.tsx: 从选中对象的 topic 提取 droneId           │
  │    - ThreeDeeRender.tsx: 从 odom 消息的 topic 提取 droneId      │
  │    - ThreeDeeRender.tsx: 从 waypoint_markers 消息提取 droneId   │
  │    - ThreeDeeRender.tsx: 从 waypoint_project_list 消息提取      │
  │      droneId (正则 /^\/drone_\d+_waypoint_markers$/ 等)        │
  │    - DroneControlPanel: 确定控制指令发送给哪架无人机               │
  └───────────────────────────────────────────────────────────────┘
```

---

## 9. 场景共享与差异矩阵

| 能力 | 自主飞行 | 建图打点 | 类型 |
| --- | --- | --- | --- |
| MultiRobotSidebar (机器人管理) | Y | Y | 共享 |
| droneTopics 路由 + Topic 重映射 (6 字段) | Y | Y | 共享 |
| Pickable Filter (仅机器人可点选) | Y | Y | 共享 |
| waypointMarkers 路由 (useActiveDroneRouting 第 6 字段) | Y | Y | 共享 |
| WebSocket 健康监控 | Y | Y | 共享 |
| SceneSelectionDialog | Y | Y | 共享 (启动时) |
| defaultLayout 锁定布局 | Y | Y | 共享 |
| Per-drone waypoint_markers 正则订阅 + 颜色覆盖 | Y | Y | 共享 |
| Per-drone waypoint_project_list 正则订阅 | Y | Y | 共享 |
| Per-drone waypoint_exec_state 正则订阅 | Y | Y | 共享 |
| Per-drone battery 遥测订阅 | Y | Y | 共享 |
| lastDroneIdRef 持久化选中 (两种模式) | Y | Y | 共享 |
| DroneControlPanel (飞行指令 + Load Path + Stop 双通道) | **Y** | N | **差异** |
| WaypointExecPanel (航线执行面板, 条件渲染) | **Y** | N | **差异** |
| GoalSet 发布 (/goal_with_id) | **Y** | N | **差异** |
| WaypointPanel (航点录制) | N | **Y** | **差异** |
| Odom 拦截 → Store | N | **Y** | **差异** |
| Per-drone MarkerArray 发布 (前端 publish) | N | **Y** | **差异** |
| 项目管理 (Save/Load/Delete/Manage, per-drone topics) | N | **Y** | **差异** |
| 拖拽排序 (DraggableWaypointRow) | N | **Y** | **差异** |

**分支点**：`Interactions.tsx` 中根据 `useSceneModeStore.sceneMode` 的值决定渲染哪个面板。

---

## 10. 前后端职责边界

| 职责 | 前端 (Spikive-Lichtblick) | 后端 (ROS1 节点) |
| --- | --- | --- |
| 连接管理 | WebSocket 连接/断开/健康监控 | Foxglove Bridge 服务端 |
| 数据可视化 | 点云/轨迹/模型/航迹 3D 渲染 | odom_visualization 生成 Marker |
| 机器人选择 | GPU Pick → droneId 提取 | — |
| Topic 路由 | droneTopics() 动态重映射 | Topic 命名遵循 `/drone_{id}_` 规范 |
| 飞行控制 | UI 按钮 → publish /control cmd | flight_manager 接收并执行 |
| 目标设置 | 3D 点击 → GoalSet → /goal_with_id | ego_replan_fsm 接收并规划轨迹 |
| 轨迹规划 | — | EGO-Planner 避障 + 最优轨迹生成 |
| 航点录制 | odom 拦截 → Z 调整 → publish PoseStamped | waypoint_recorder 接收 + 维护列表 |
| 航点可视化 | marker 拦截 → 颜色覆盖 → 渲染 | waypoint_recorder 发布 MarkerArray |
| 航点项目持久化 | Dialog UI + per-drone topic 发布 | waypoint_recorder 磁盘 JSON + 列表推送 |
| 航线加载 | LoadProjectDialog → publish load_waypoints | waypoint_recorder 读 JSON → 发布 markers |
| 航线执行 | WaypointExecPanel → publish start/stop | waypoint_recorder 状态机 + 逐点 GoalSet |
| 执行状态显示 | execState Store → UI 禁用控制 | waypoint_recorder 发布 exec_state |
| 急停保护 | handleAbort() 双通道: cmd=5 + stop_exec | flight_manager 急停 + waypoint_recorder 停执行 |
| 定位 (SLAM) | — | Visual SLAM 输出 Odometry + TF |
| TF 广播 | camera followTf 跟随 | odom_visualization 广播 world→base{id} |
