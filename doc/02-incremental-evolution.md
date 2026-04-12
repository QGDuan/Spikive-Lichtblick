# 02 增量架构演进记录

## 目录

- [演进概览（图 8）](#演进概览图-8)
- [文件修改热力图（图 9）](#文件修改热力图图-9)
- [Commit 1: 基座导入](#commit-1-31cc543--基座导入)
- [Commit 2: 多机器人侧边栏](#commit-2-e58d9ea--多机器人侧边栏)
- [Commit 3: drone_id 动态路由](#commit-3-8a8d9c4--droneid-动态路由)
- [Commit 4: Pickable 过滤](#commit-4-3f7eea0--pickable-过滤)
- [Commit 5: 控制面板替换](#commit-5-363239e--控制面板替换)
- [Commit 6: WebSocket 监控 + GoalSet](#commit-6-7575959--websocket-监控--goalset)
- [未提交: 场景模式 + 建图打点](#未提交工作-场景模式--建图打点)

---

## 演进概览（图 8）

```text
时间轴  2026-04-09          04-10           04-10           04-10           04-11          (进行中)
        ──────────────────────────────────────────────────────────────────────────────────────►

Commit   #1 基座导入        #2 多机侧边栏   #3 drone_id路由  #4 Pickable    #5 控制面板     #6 WS监控
         31cc543            e58d9ea         8a8d9c4         3f7eea0        363239e        7575959
         │                  │               │               │              │              │
功能     │                  │               │               │              │              │
叠加     │                  │               │               │              │              │
         │                  │               │               │              │              │
场景模式 │                  │               │               │              │              │          ███ SceneSelectionDialog
         │                  │               │               │              │              │          ███ useSceneModeStore
         │                  │               │               │              │              │
航点系统 │                  │               │               │              │              │          ███ WaypointPanel
         │                  │               │               │              │              │          ███ useWaypointStore
         │                  │               │               │              │              │          ███ Odom 拦截
         │                  │               │               │              │              │          ███ MarkerArray
         │                  │               │               │              │              │
GoalSet  │                  │               │               │              │              ████████████ GoalSet publish
         │                  │               │               │              │              ████████████ publishDroneIdRef
         │                  │               │               │              │              │
健康监控 │                  │               │               │              │              ████████████ useWebSocketMonitor
         │                  │               │               │              │              ████████████ probeWebSocket
         │                  │               │               │              │              │
控制面板 │                  │               │               │              ███████████████ DroneControlPanel
         │                  │               │               │              ███████████████ /control publish
         │                  │               │               │              │              │
Pickable │                  │               │               ███████████████████████████████████████████
         │                  │               │               │              │              │
Topic    │                  │               ████████████████████████████████████████████████████████████
路由     │                  │               │               │              │              │
         │                  │               │               │              │              │
多机侧   │                  ████████████████████████████████████████████████████████████████████████████
边栏     │                  │               │               │              │              │
         │                  │               │               │              │              │
基座     ██████████████████████████████████████████████████████████████████████████████████████████████
         │                  │               │               │              │              │

新增行    302,170 (原始)     +695            +474            +170           +252           +342         (WIP)
```

---

## 文件修改热力图（图 9）

```text
文件                                          │ C1 │ C2 │ C3 │ C4 │ C5 │ C6 │ WIP │
──────────────────────────────────────────────┼────┼────┼────┼────┼────┼────┼─────┤
Lichtblick 基座 (2139 文件)                    │ ██ │    │    │    │    │    │     │
                                              │    │    │    │    │    │    │     │
【新增层 - spikive/】                          │    │    │    │    │    │    │     │
  spikive/config/topicConfig.ts               │    │ ++ │ ██ │    │ ██ │ ██ │     │
  spikive/hooks/useActiveDroneRouting.ts      │    │    │ ++ │ ██ │    │    │     │
  spikive/components/ThemeToggleButton.tsx     │    │ ++ │    │    │    │    │     │
  spikive/components/DroneControlPanel.tsx     │    │    │    │    │ ++ │    │     │
  spikive/components/SceneSelectionDialog.tsx  │    │    │    │    │    │    │ ++  │
  spikive/components/WaypointPanel.tsx         │    │    │    │    │    │    │ ++  │
  spikive/stores/useSceneModeStore.ts         │    │    │    │    │    │    │ ++  │
  spikive/stores/useWaypointStore.ts          │    │    │    │    │    │    │ ++  │
  spikive/styles/spikiveGlobalOverrides.css   │    │ ++ │    │    │    │    │     │
                                              │    │    │    │    │    │    │     │
【新增层 - MultiRobotSidebar/】               │    │    │    │    │    │    │     │
  MultiRobotSidebar/index.tsx                 │    │ ++ │    │    │    │ ██ │     │
  MultiRobotSidebar/RobotCard.tsx             │    │ ++ │ ██ │    │    │ ██ │     │
  MultiRobotSidebar/AddRobotDialog.tsx        │    │ ++ │ ██ │    │    │ ██ │     │
  MultiRobotSidebar/useRobotConnections.ts    │    │ ++ │ ██ │    │    │    │     │
  MultiRobotSidebar/useWebSocketMonitor.ts    │    │    │    │    │    │ ++ │     │
  MultiRobotSidebar/types.ts                  │    │ ++ │    │    │    │    │     │
                                              │    │    │    │    │    │    │     │
【注入层】                                     │    │    │    │    │    │    │     │
  Workspace.tsx                               │    │ ██ │    │    │    │    │ ██  │
  defaultLayout.ts                            │    │    │ ++ │ ██ │    │    │     │
  Sidebars/index.tsx                          │    │ ██ │    │    │    │    │     │
  WorkspaceContext.ts                         │    │ ██ │    │    │    │    │     │
                                              │    │    │    │    │    │    │     │
【补丁层】                                     │    │    │    │    │    │    │     │
  ThreeDeeRender.tsx                          │    │    │    │    │    │ ██ │ ██  │
  Interactions/Interactions.tsx               │    │    │    │    │ ██ │    │ ██  │
  Renderer.ts                                 │    │    │    │ ++ │    │ ██ │     │
  publish.ts                                  │    │    │    │    │    │ ++ │ ██  │
  settings.ts (BaseSettings)                  │    │    │    │ ++ │    │    │     │
  RendererOverlay.tsx                         │    │    │    │    │ ██ │    │     │
  FoxgloveWebSocketPlayer/index.ts            │    │    │    │    │    │ ██ │     │

图例: ++ = 新建文件   ██ = 修改文件   C1-C6 = Commit 1-6   WIP = 未提交
```

---

## Commit 1: `31cc543` — 基座导入

**日期**: 2026-04-09 15:35  
**新增**: 2,139 文件, 302,170 行  

### 设计决策

将 Lichtblick Suite v1.24.3 完整源码作为项目基座导入。选择 Lichtblick 而非 Foxglove Studio 的原因：

1. **MPL-2.0 开源许可**，允许商业修改
2. **可扩展的 Panel 架构**，支持自定义面板注入
3. **内置 Foxglove Bridge 支持**，原生 WebSocket → ROS1 桥接
4. **Three.js 封装的 3D 渲染引擎**，支持点云 / Marker / TF 可视化

### 基座保留的关键能力

- 3D Panel (ThreeDeeRender) —— 点云、Marker、TF 渲染
- Foxglove WebSocket Player —— WebSocket 数据源连接
- Layout 系统 —— JSON 配置驱动面板布局
- Settings 系统 —— 每个 topic 独立的渲染参数

---

## Commit 2: `e58d9ea` — 多机器人侧边栏

**日期**: 2026-04-09 17:59  
**新增**: 695 行, 19 文件  

### 设计目标

替换 Lichtblick 原生的数据源选择流程（文件/URL 选择），建立面向无人机编队的连接管理 UI。

### 架构决策

**为什么用 Zustand 而非 React Context?**
- 跨组件 selector 性能优于 Context 的全量 re-render
- 无需 Provider 嵌套，任何组件可直接 `useStore(selector)`
- 适合中小规模状态（最多 ~10 架无人机）

**为什么禁用 DataSourceDialog?**
- 无人机场景不需要 rosbag/MCAP 文件选择
- MultiRobotSidebar 完全替代数据源管理功能

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `MultiRobotSidebar/index.tsx` | ~130 | 侧边栏主组件，渲染机器人列表 |
| `MultiRobotSidebar/RobotCard.tsx` | ~100 | 单个机器人卡片 (状态/操作) |
| `MultiRobotSidebar/AddRobotDialog.tsx` | ~80 | 添加机器人对话框 (URL + droneId) |
| `MultiRobotSidebar/useRobotConnections.ts` | ~75 | Zustand Store (URL/droneId 互斥) |
| `MultiRobotSidebar/types.ts` | ~30 | 类型定义 (RobotEntry, ConnectionStatus) |
| `MultiRobotSidebar/*.style.ts` | ~50 | Emotion 样式 |
| `spikive/components/ThemeToggleButton.tsx` | 30 | 主题切换按钮 |
| `spikive/styles/spikiveGlobalOverrides.css` | 32 | 全局 CSS 覆盖 (隐藏原生 UI) |
| `spikive/config/topicConfig.ts` | ~40 | Topic 配置初版 |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `Workspace.tsx` | +import MultiRobotSidebar; 左侧边栏仅 "robots" 标签; 禁用 DataSourceDialog |
| `Sidebars/index.tsx` | +hideClose prop 阻止用户关闭侧边栏 |
| `Sidebars/types.ts` | +hideClose, +headerActions 类型定义 |
| `WorkspaceContext.ts` | +LeftSidebarItemKeys 添加 "robots" |

---

## Commit 3: `8a8d9c4` — drone_id 动态路由

**日期**: 2026-04-10 18:07  
**新增**: 474 行, 9 文件  

### 设计目标

实现 drone_id → topic 命名规范 → 3D Panel 配置动态重写的完整链路。

### 核心设计: Topic Builder 模式

```text
                    输入                        输出
                    ────                        ────
droneTopics("1")  ──►  { pointCloud: "/drone_1_cloud_registered",
                         optimalTrajectory: "/drone_1_ego_planner_node/optimal_list",
                         goalPoint: "/drone_1_ego_planner_node/goal_point",
                         robotModel: "/drone_1_odom_visualization/robot",
                         path: "/drone_1_odom_visualization/path",
                         odom: "/drone_1_visual_slam/odom" }

droneBodyFrame("1")  ──►  "base1"
```

### remapTopics 算法

```text
useActiveDroneRouting 监测到 activeRobot 变化:

1. 从当前 3D Panel config 中读取 topics 配置
2. 遍历 BASE_TOPICS 中的 5 个 key
3. 对每个 key:
   oldTopic = droneTopics(fromId)[key]   // "/drone_1_cloud_registered"
   newTopic = droneTopics(toId)[key]     // "/drone_2_cloud_registered"
   将 config.topics[oldTopic] 的设置复制到 config.topics[newTopic]
   删除 config.topics[oldTopic]
4. 更新 followTf: droneBodyFrame(fromId) → droneBodyFrame(toId)
5. 调用 currentLayoutActions 写入新配置
```

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/hooks/useActiveDroneRouting.ts` | 207 | 核心路由 hook |
| `doc/drone-id-routing.md` | 204 | 架构规格文档 |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `topicConfig.ts` | 全面重写: 定义真实 ROS topic, droneTopics(), droneBodyFrame(), extractDroneIdFromTopic() |
| `AddRobotDialog.tsx` | +droneId 输入字段 (数字校验) + 双重互斥 (URL + droneId 唯一性) |
| `RobotCard.tsx` | +显示 "Drone {id}" 标签, 活跃态高亮 |
| `useRobotConnections.ts` | +droneId 字段, +互斥校验逻辑 |
| `defaultLayout.ts` | +import TOPIC_CONFIG, 用配置驱动默认 topic |

---

## Commit 4: `3f7eea0` — Pickable 过滤

**日期**: 2026-04-10 20:37  
**新增**: 170 行, 4 文件  

### 设计目标

解决密集点云层阻挡机器人模型 GPU 拾取的问题。

### 问题分析

```text
原始行为:
  用户点击 3D 面板 → GPU ray pick → 命中最近的 renderable
  问题: 密集的点云几乎总是在最前面，阻挡了机器人模型的选择

解决方案:
  在 GPU pick pass 前，临时隐藏所有标记为 pickable: false 的 renderable
  ───────────────────────────────────────────────────────────────
  Topic                              │ pickable  │ 原因
  ───────────────────────────────────┼───────────┼────────────
  点云 (cloud_registered)             │ false     │ 密度太高，遮挡选择
  轨迹 (ego_planner_node/optimal_list)│ false     │ 线条干扰
  目标点 (ego_planner_node/goal_point)│ false     │ 不需要交互
  航迹 (odom_visualization/path)      │ false     │ 线条干扰
  机器人模型 (odom_visualization/robot)│ true      │ 唯一需要选择的对象
```

### Renderer.ts 新增方法

- `#isRenderablePickable(renderable)` — 检查 topic 的 `pickable` 设置
- `#hideNonPickableRenderables()` — pick 前临时隐藏 non-pickable, 返回被隐藏列表
- pick 完成后恢复所有被隐藏的 renderable 的 visible 状态

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `Renderer.ts` | +#isRenderablePickable(), +#hideNonPickableRenderables(), ~click/hover handler |
| `settings.ts` | +BaseSettings.pickable?: boolean 字段 |
| `defaultLayout.ts` | +为 4 个 topic 设置 pickable: false |
| `useActiveDroneRouting.ts` | +ensurePickableFlags() 修补缓存中缺失的 pickable 标记 |

---

## Commit 5: `363239e` — 控制面板替换

**日期**: 2026-04-10 22:31  
**新增**: 252 行, 6 文件  

### 设计目标

用户点击机器人模型后，显示飞行控制按钮替代原始的 JSON 属性详情面板。

### DroneControlPanel 设计

```text
┌────────────────────────────────────────┐
│  Drone 1 Controls                      │
│                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Takeoff │ │  Land   │ │ Return  │  │
│  │ (cmd=1) │ │ (cmd=2) │ │ (cmd=3) │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│  ┌─────────┐ ┌─────────┐              │
│  │Continue │ │  Stop   │              │
│  │ (cmd=4) │ │ (cmd=5) │              │
│  └─────────┘ └─────────┘              │
│                                        │
│  ┌────────────────────────────────┐    │
│  │       Publish Pose             │    │
│  └────────────────────────────────┘    │
└────────────────────────────────────────┘

生命周期:
  mount (drone selected)
    └── advertise("/control", "controller_msgs/cmd")
  sendCommand(cmdCode)
    └── publish({ header: {...}, cmd: cmdCode })
  unmount (click empty space)
    └── unadvertise("/control")
```

### topicConfig.ts 新增

- `CONTROL_TOPIC = "/control"`
- `DRONE_COMMANDS = { TAKEOFF: 1, LAND: 2, RETURN: 3, CONTINUE: 4, STOP: 5 }`
- `PUBLISH_TOPICS = { goalPose, goalWithId, clickedPoint, initialPose }`

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/components/DroneControlPanel.tsx` | 183 | 飞行控制面板 |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `Interactions.tsx` | +import DroneControlPanel; 替换原始 Selected Object JSON 面板 |
| `RendererOverlay.tsx` | +透传 publish/advertise/unadvertise 回调到 Interactions |
| `topicConfig.ts` | +CONTROL_TOPIC, +DRONE_COMMANDS, +PUBLISH_TOPICS |

---

## Commit 6: `7575959` — WebSocket 监控 + GoalSet

**日期**: 2026-04-11 19:56  
**新增**: 342 行, 13 文件  

### 设计目标

1. WebSocket 连接健康检测：3s 周期 ping + 延迟测量
2. EGO-Planner 集成：发布 `quadrotor_msgs/GoalSet` 到 `/goal_with_id`
3. drone_id 锁定：publish 开始时锁定选中对象的 drone_id，防止切换漂移

### useWebSocketMonitor 设计

```text
┌─────────────────────────────────────────────┐
│  useWebSocketMonitor (3s 周期)               │
│                                             │
│  for each robot in robots:                  │
│    ws = new WebSocket(robot.url)            │
│    t0 = Date.now()                          │
│    ws.onopen → latency = Date.now() - t0    │
│    ┌──────────────────────────────────────┐ │
│    │ latency < 500ms  → status: connected │ │
│    │ latency >= 500ms → status: slow      │ │
│    │ timeout (3s)     → status: error     │ │
│    └──────────────────────────────────────┘ │
│    ws.close()                               │
│    updateStatus(robot.id, status, latency)  │
└─────────────────────────────────────────────┘
```

### GoalSet 发布流程

```text
  用户点击 "Publish Pose" 按钮
    │
    ▼
  ThreeDeeRender: publishClickType 变为 "pose"
    │
    ├── advertise("/goal_with_id", "quadrotor_msgs/GoalSet", GoalSetDatatypes)
    │
    └── publishDroneIdRef.current = Renderer.getSelectedRenderableInfo()
        提取选中对象 topic → extractDroneIdFromTopic() → 锁定 droneId
    │
    ▼
  用户在 3D 面板中点击目标位置
    │
    ▼
  handlePublishSubmit(event):
    │
    ├── re-advertise("/goal_with_id")  // 确保 advertise 生效
    │
    └── goalSetMsg = makeGoalSetMessage(droneId, event.pose.position)
        │   → { drone_id: int16, goal: [x, y, z] }
        │
        └── context.publish("/goal_with_id", goalSetMsg)
            │
            ▼
          EGO-Planner (ego_replan_fsm) 接收并规划轨迹
```

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `MultiRobotSidebar/useWebSocketMonitor.ts` | ~130 | WebSocket 健康监控 hook |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `ThreeDeeRender.tsx` | +GoalSet advertise/publish, +publishDroneIdRef 锁定 |
| `Renderer.ts` | +getSelectedRenderableInfo() 方法 |
| `publish.ts` | +GoalSetDatatypes, +makeGoalSetMessage() |
| `RobotCard.tsx` | +延迟显示 (ms), +连接状态指示灯 |
| `AddRobotDialog.tsx` | +连接预检 (probeWebSocket), +Loading 状态 |
| `MultiRobotSidebar/index.tsx` | +useWebSocketMonitor() 调用, +probeWebSocket() |
| `FoxgloveWebSocketPlayer/index.ts` | +debug logging for advertise/publish |
| `topicConfig.ts` | +goalWithId publish topic, 切换默认 publish 类型 |

### 已知问题 (此次提交记录)

1. **首次 publish-pose 失败** — advertise 与 Foxglove Bridge 之间存在时序竞争
2. **新机器人需清缓存** — 浏览器 localStorage 中的 stale layout 阻碍新 topic 生效
3. **publish pose 坐标系错误** — 使用了 local frame 而非 world frame

---

## 未提交工作: 场景模式 + 建图打点

### 设计目标

引入场景模式机制，将系统分为两个独立业务场景。新增建图打点的完整工作流：odom 拦截 → 航点录制 → Z 轴调整 → MarkerArray 可视化。

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/components/SceneSelectionDialog.tsx` | 95 | 启动时的场景模式选择对话框 |
| `spikive/components/WaypointPanel.tsx` | 330 | 航点录制/管理面板 |
| `spikive/stores/useSceneModeStore.ts` | 19 | 场景模式 Zustand Store |
| `spikive/stores/useWaypointStore.ts` | 169 | 航点数据 Zustand Store |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `Workspace.tsx` | +import SceneSelectionDialog; +渲染场景选择对话框 |
| `ThreeDeeRender.tsx` | +import sceneMode/waypointStore; +odom topic 动态订阅; +odom 消息拦截 → updateOdom() |
| `Interactions.tsx` | +import WaypointPanel/useSceneModeStore; +场景模式分支渲染; +lastDroneIdRef 持久化 |
| `publish.ts` | +WaypointMarkerDatatypes; +makeWaypointMarkerArray() 函数 |

### 数据流变更

```text
新增数据路径 (建图打点模式):

  ROS /drone_{id}_visual_slam/odom
    │
    ▼ Foxglove Bridge WebSocket
    │
    ▼ ThreeDeeRender.tsx (消息处理循环)
    │   正则匹配: /^\/drone_\w+_visual_slam\/odom$/
    │   提取 droneId → extractDroneIdFromTopic()
    │   提取 position → odom.pose.pose.position
    │
    ▼ useWaypointStore.updateOdom(droneId, {x, y, z})
    │
    ▼ WaypointPanel 订阅 latestOdom[droneId]
    │   实时显示: X: 1.234  Y: 5.678  Z: 0.912
    │
    ▼ 用户点击 "Record"
    │
    ▼ useWaypointStore.addWaypoint(droneId, x, y, applyZ(z))
    │
    ▼ WaypointPanel useEffect 检测 waypoints 变化
    │
    ▼ makeWaypointMarkerArray(waypoints, "world")
    │   → DELETEALL + SPHERE(×N) + TEXT(×N) + LINE_STRIP
    │
    ▼ publish("/waypoint_markers", MarkerArray)
    │
    ▼ 3D Panel 渲染航点球体 + 编号 + 连线
```
