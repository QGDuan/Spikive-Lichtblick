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
- [Commit 7: 场景模式 + 建图打点](#commit-7-3784c14--场景模式--建图打点)
- [Commit 8: 标记可视化修复与颜色覆盖](#commit-8-3788abc--标记可视化修复与颜色覆盖)
- [Commit 9: README 重写](#commit-9-c8516ea--readme-重写)
- [Commit 10: 项目持久化与拖拽排序](#commit-10-826e5d8--项目持久化与拖拽排序)
- [Commit 11: 航线执行模式](#commit-11-a85008b--航线执行模式)
- [Commit 12: 极简 UI + 可视化设置弹窗](#commit-12-极简-ui--可视化设置弹窗)

---

## 演进概览（图 8）

```text
时间轴  2026-04-09       04-10        04-10        04-10        04-11       04-12        04-12       04-12       04-13       04-16
        ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────►

Commit   #1 基座导入     #2 多机侧栏  #3 drone路由  #4 Pickable  #5 控制面板  #6 WS监控    #7 场景+打点  #8 标记修复  #9 README   #10 项目持久化  #11 航线执行
         31cc543         e58d9ea     8a8d9c4      3f7eea0     363239e     7575959      3784c14     3788abc    c8516ea    826e5d8        a85008b
         │               │           │            │           │           │            │           │          │          │
功能     │               │           │            │           │           │            │           │          │          │
叠加     │               │           │            │           │           │            │           │          │          │
         │               │           │            │           │           │            │           │          │          │
项目管理 │               │           │            │           │           │            │           │          │          ██ SaveProjectDialog
         │               │           │            │           │           │            │           │          │          ██ LoadProjectDialog
         │               │           │            │           │           │            │           │          │          ██ ManageProjectsDialog
         │               │           │            │           │           │            │           │          │          ██ 拖拽排序
         │               │           │            │           │           │            │           │          │          │
颜色覆盖 │               │           │            │           │           │            │           ██████████████████████████
         │               │           │            │           │           │            │           ██ 前端色覆  │          │
         │               │           │            │           │           │            │           │          │          │
场景模式 │               │           │            │           │           │            ██████████████████████████████████████
         │               │           │            │           │           │            ██ SceneDialog│         │          │
         │               │           │            │           │           │            │           │          │          │
航点系统 │               │           │            │           │           │            ████████████████████████████████████████
         │               │           │            │           │           │            ██ WaypointPanel       │          │
         │               │           │            │           │           │            ██ useWaypointStore    │          │
         │               │           │            │           │           │            ██ Odom 拦截 + Marker  │          │
         │               │           │            │           │           │            │           │          │          │
GoalSet  │               │           │            │           │           ██████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │
健康监控 │               │           │            │           │           ██████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │
控制面板 │               │           │            │           ██████████████████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │
Pickable │               │           │            ██████████████████████████████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │
Topic路由│               │           ██████████████████████████████████████████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │
多机侧栏 │               ██████████████████████████████████████████████████████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │
基座     ██████████████████████████████████████████████████████████████████████████████████████████████████████████████████
         │               │           │            │           │           │            │           │          │          │

新增行   302,170(原始)    +695        +474         +170        +252        +342         +613        +207       +172       +685       +350       +280
```

---

## 文件修改热力图（图 9）

```text
文件                                          │ C1 │ C2 │ C3 │ C4 │ C5 │ C6 │ C7  │ C8  │ C9  │ C10 │
──────────────────────────────────────────────┼────┼────┼────┼────┼────┼────┼─────┼─────┼─────┼─────┤
Lichtblick 基座 (2139 文件)                    │ ██ │    │    │    │    │    │     │     │     │     │
                                              │    │    │    │    │    │    │     │     │     │     │
【新增层 - spikive/】                          │    │    │    │    │    │    │     │     │     │     │
  spikive/config/topicConfig.ts               │    │ ++ │ ██ │    │ ██ │ ██ │     │ ██  │     │ ██  │
  spikive/hooks/useActiveDroneRouting.ts      │    │    │ ++ │ ██ │    │    │     │     │     │     │
  spikive/components/ThemeToggleButton.tsx     │    │ ++ │    │    │    │    │     │     │     │     │
  spikive/components/DroneControlPanel.tsx     │    │    │    │    │ ++ │    │     │     │     │     │
  spikive/components/SceneSelectionDialog.tsx  │    │    │    │    │    │    │ ++  │     │     │     │
  spikive/components/WaypointPanel.tsx         │    │    │    │    │    │    │ ++  │ ██  │     │ ██  │
  spikive/components/SaveProjectDialog.tsx     │    │    │    │    │    │    │     │     │     │ ++  │
  spikive/components/LoadProjectDialog.tsx     │    │    │    │    │    │    │     │     │     │ ++  │
  spikive/components/ManageProjectsDialog.tsx  │    │    │    │    │    │    │     │     │     │ ++  │
  spikive/stores/useSceneModeStore.ts         │    │    │    │    │    │    │ ++  │     │     │     │
  spikive/stores/useWaypointStore.ts          │    │    │    │    │    │    │ ++  │ ██  │     │ ██  │
  spikive/styles/spikiveGlobalOverrides.css   │    │ ++ │    │    │    │    │     │     │     │     │
                                              │    │    │    │    │    │    │     │     │     │     │
【新增层 - MultiRobotSidebar/】               │    │    │    │    │    │    │     │     │     │     │
  MultiRobotSidebar/index.tsx                 │    │ ++ │    │    │    │ ██ │     │     │     │     │
  MultiRobotSidebar/RobotCard.tsx             │    │ ++ │ ██ │    │    │ ██ │     │     │     │     │
  MultiRobotSidebar/AddRobotDialog.tsx        │    │ ++ │ ██ │    │    │ ██ │     │     │     │     │
  MultiRobotSidebar/useRobotConnections.ts    │    │ ++ │ ██ │    │    │    │     │     │     │     │
  MultiRobotSidebar/useWebSocketMonitor.ts    │    │    │    │    │    │ ++ │     │     │     │     │
  MultiRobotSidebar/types.ts                  │    │ ++ │    │    │    │    │     │     │     │     │
                                              │    │    │    │    │    │    │     │     │     │     │
【注入层】                                     │    │    │    │    │    │    │     │     │     │     │
  Workspace.tsx                               │    │ ██ │    │    │    │    │ ██  │     │     │     │
  defaultLayout.ts                            │    │    │ ++ │ ██ │    │    │     │     │     │     │
  Sidebars/index.tsx                          │    │ ██ │    │    │    │    │     │     │     │     │
  WorkspaceContext.ts                         │    │ ██ │    │    │    │    │     │     │     │     │
                                              │    │    │    │    │    │    │     │     │     │     │
【补丁层】                                     │    │    │    │    │    │    │     │     │     │     │
  ThreeDeeRender.tsx                          │    │    │    │    │    │ ██ │ ██  │ ██  │     │ ██  │
  Interactions/Interactions.tsx               │    │    │    │    │ ██ │    │ ██  │     │     │     │
  Renderer.ts                                 │    │    │    │ ++ │    │ ██ │     │     │     │     │
  publish.ts                                  │    │    │    │    │    │ ++ │ ██  │     │     │     │
  settings.ts (BaseSettings)                  │    │    │    │ ++ │    │    │     │     │     │     │
  RendererOverlay.tsx                         │    │    │    │    │ ██ │    │     │     │     │     │
  FoxgloveWebSocketPlayer/index.ts            │    │    │    │    │    │ ██ │     │     │     │     │
                                              │    │    │    │    │    │    │     │     │     │     │
【文档】                                       │    │    │    │    │    │    │     │     │     │     │
  README.md                                   │    │    │    │    │    │    │     │     │ ██  │     │
  doc/*.md (6 文件)                            │    │    │    │    │    │    │     │     │     │     │

图例: ++ = 新建文件   ██ = 修改文件   C1-C10 = Commit 1-10
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

## Commit 7: `3784c14` — 场景模式 + 建图打点

**日期**: 2026-04-12 01:42  
**新增**: 613 行, 8 文件  

### 设计目标

引入场景模式机制，将系统分为两个独立业务场景（自主飞行 / 建图打点）。新增建图打点的完整工作流：odom 拦截 → 航点录制 → Z 轴调整 → MarkerArray 可视化。

### 架构决策

**为什么引入场景模式而非始终显示所有功能?**
- 两个场景的交互逻辑互斥：自主飞行需要 DroneControlPanel (控制指令)，建图打点需要 WaypointPanel (航点管理)
- 场景模式在启动时确定后不可变，避免运行时状态混乱
- `useSceneModeStore` 仅 19 行，最小化模式切换的架构成本

**为什么在 ThreeDeeRender 中拦截 Odom 而非单独组件?**
- ThreeDeeRender 的消息处理循环是数据流的唯一入口点
- 在此拦截可以避免额外的 topic 订阅管道
- 拦截与正常渲染并行，不影响 3D 面板性能

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/components/SceneSelectionDialog.tsx` | 95 | 启动时的场景模式选择对话框 (MUI Dialog, 不可关闭) |
| `spikive/components/WaypointPanel.tsx` | 330 | 航点录制/管理面板 (Record/Del/Clear + Z 轴调整) |
| `spikive/stores/useSceneModeStore.ts` | 19 | 场景模式 Zustand Store (`"autonomous-flight" \| "mapping-waypoint"`) |
| `spikive/stores/useWaypointStore.ts` | 169 | 航点数据 Zustand Store (per-drone 航点表 + odom 缓存) |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `Workspace.tsx` | +import SceneSelectionDialog; +渲染启动阻塞对话框 |
| `ThreeDeeRender.tsx` | +import sceneMode/waypointStore; +odom topic 动态订阅 (mapping 模式); +odom 消息正则拦截 → updateOdom() |
| `Interactions.tsx` | +import WaypointPanel/useSceneModeStore; +场景模式条件分支渲染; +lastDroneIdRef 持久化 (mapping 模式下点击空白不丢失面板) |
| `publish.ts` | +WaypointMarkerDatatypes (MarkerArray datatype 定义); +makeWaypointMarkerArray() 构造航点球体/编号/连线 |

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

---

## Commit 8: `3788abc` — 标记可视化修复与颜色覆盖

**日期**: 2026-04-12 16:29  
**新增**: 207 行, 4 文件  

### 设计目标

1. 修复航点标记渲染异常（颜色不正确、列表不同步）
2. 实现前端颜色覆盖机制，统一 Spikive 品牌色
3. 新增行内删除和批量清空操作

### 核心设计: 前端颜色覆盖机制

```text
问题:
  publish.ts 中 makeWaypointMarkerArray() 使用原始颜色 (橙/黄/绿)
  但 3D 面板渲染效果不够统一，需要品牌化配色

解决方案:
  ThreeDeeRender 消息处理循环中，对 /waypoint_markers 消息进行拦截，
  在传递给 Renderer 之前重写 marker 颜色:

  原始消息 ──► 拦截 ──► 颜色重写 ──► Renderer
                 │
                 ├── SPHERE (namespace="waypoints", id<10000)
                 │   → 解析为航点列表 → setWaypointsFromMarkers()
                 │   → 颜色: #EF833A (Spikive 橙, r:0.937 g:0.514 b:0.227 a:1.0)
                 │
                 ├── TEXT_VIEW_FACING
                 │   → 颜色: 白色 (r:1.0 g:1.0 b:1.0 a:1.0)
                 │
                 └── LINE_STRIP
                     → 颜色: #9C27B0 (紫色, r:0.612 g:0.153 b:0.690 a:1.0)
```

### WAYPOINT_COLORS 配置 (topicConfig.ts)

```typescript
export const WAYPOINT_COLORS = {
  sphere: { r: 0.937, g: 0.514, b: 0.227, a: 1.0 },   // #EF833A
  text:   { r: 1.0,   g: 1.0,   b: 1.0,   a: 1.0 },   // 白色
  line:   { r: 0.612, g: 0.153, b: 0.690, a: 1.0 },    // #9C27B0
} as const;
```

### 新增功能

| 功能 | 实现位置 | 说明 |
| --- | --- | --- |
| 前端颜色覆盖 | ThreeDeeRender.tsx 消息循环 | 拦截 /waypoint_markers，按 marker type 重写颜色 |
| WAYPOINT_COLORS 常量 | topicConfig.ts | 集中管理品牌配色 |
| 行内删除按钮 | WaypointPanel.tsx | 每行航点右侧 Delete 图标按钮 |
| Clear 确认对话框 | WaypointPanel.tsx | MUI Confirm Dialog 防止误操作 |
| Marker→Store 同步 | ThreeDeeRender.tsx | 从 sphere marker 解析航点列表 → setWaypointsFromMarkers() |

### Lichtblick 修改点

| 文件 | 修改内容 |
| --- | --- |
| `ThreeDeeRender.tsx` | +/waypoint_markers 消息拦截; +颜色重写逻辑; +sphere→store 解析 |
| `WaypointPanel.tsx` | +行内 Delete 按钮; +Clear 确认对话框; +修复 store key 匹配 |
| `topicConfig.ts` | +WAYPOINT_COLORS 常量 (品牌色定义) |
| `useWaypointStore.ts` | +setWaypointsFromMarkers() action (从 marker 批量同步航点列表) |

---

## Commit 9: `c8516ea` — README 重写

**日期**: 2026-04-12 17:03  
**修改**: 1 文件  

### 变更内容

将 Lichtblick 原始 README.md 替换为 Spikive 地面站项目专属文档，覆盖：

- 项目简介与多机管理核心功能
- 双场景模式 (自主飞行 + 建图打点) 说明
- 技术栈概览 (React 18 / TypeScript / MUI / Three.js / Zustand / ROS1)
- 项目目录结构
- 快速启动与部署指南
- 部署架构图 (地面站 ↔ 多无人机 LAN)
- 设计原则 (增量嫁接 + 场景驱动)
- 文档索引链接

---

## Commit 10: `826e5d8` — 项目持久化与拖拽排序

**日期**: 2026-04-13  
**新增**: 685 行, 7 文件  

### 设计目标

为建图打点场景构建完整的航点项目持久化工作流：保存 / 加载 / 管理航点项目集合，以及通过拖拽重新排列航点顺序。

### 架构决策

**为什么将 Dialog 拆分为独立组件?**
- WaypointPanel 已经 330 行（C7），继续在内部添加 Dialog 逻辑会导致文件过大且难以维护
- SaveProjectDialog 需要 Autocomplete + 输入验证，LoadProjectDialog 需要 Select，ManageProjectsDialog 需要 Checkbox 批量操作——三者 UI 模式完全不同
- 独立 Dialog 符合 "保持 Lichtblick 核心纯洁" 原则，所有新文件在 spikive/ 命名空间下

**为什么项目管理通过 ROS topic 通信而非本地文件?**
- 航点数据需要后端 waypoint_manager 节点参与持久化（磁盘 JSON + 导航状态机）
- 前端仅负责 UI 交互和 topic 发布，保持前后端职责清晰
- 5 个项目管理 topic 均为 std_msgs/String，payload 使用 JSON 序列化

**为什么用 HTML5 原生 Drag-and-Drop 而非拖拽库?**
- 航点列表项数预期 <20，原生 D&D 足够
- 避免引入额外依赖（react-beautiful-dnd 等），减小 bundle size
- DraggableWaypointRow 作为独立子组件封装拖拽逻辑，不污染 WaypointPanel

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/components/SaveProjectDialog.tsx` | ~100 | MUI Autocomplete + 字母数字验证，保存航点项目 |
| `spikive/components/LoadProjectDialog.tsx` | ~70 | MUI Select 下拉选择，加载已保存项目 |
| `spikive/components/ManageProjectsDialog.tsx` | ~110 | Checkbox 多选 + 批量删除，管理项目列表 |

### 修改文件

| 文件 | 变更 | 说明 |
| --- | --- | --- |
| `topicConfig.ts` | +11 行 | 新增 `PROJECT_TOPICS` 常量 (5 个项目管理 topic) |
| `useWaypointStore.ts` | +7 行 | 新增 `projectList: string[]` state + `setProjectList()` action |
| `WaypointPanel.tsx` | 330→627 行 | +Dialog 集成 +拖拽排序 +toolbar 按钮 +4 个新 topic advertise |
| `ThreeDeeRender.tsx` | +27 行 | +/waypoint_project_list 订阅与 JSON 拦截 → setProjectList() |

### 项目管理数据流（图 18）

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     航点项目管理 完整数据流                                     │
│                                                                              │
│  ┌─────────────────── 项目列表同步 (后端 → 前端) ─────────────────────┐       │
│  │                                                                   │       │
│  │  ROS 后端 waypoint_manager                                        │       │
│  │  publish → /waypoint_project_list                                 │       │
│  │  payload: { "projects": ["route_A", "route_B", "test_1"] }        │       │
│  │                          │                                        │       │
│  │                          ▼ Foxglove Bridge WebSocket              │       │
│  │                          │                                        │       │
│  │                          ▼ ThreeDeeRender.tsx                     │       │
│  │                          │  消息拦截: topic === PROJECT_TOPICS     │       │
│  │                          │    .projectList                        │       │
│  │                          │  JSON.parse(data) → { projects: [] }   │       │
│  │                          │                                        │       │
│  │                          ▼ useWaypointStore.setProjectList()      │       │
│  │                          │                                        │       │
│  │              ┌───────────┼───────────┐                            │       │
│  │              ▼           ▼           ▼                            │       │
│  │   SaveProjectDialog  LoadProject  ManageProjects                  │       │
│  │   (Autocomplete      Dialog       Dialog                         │       │
│  │    建议列表)          (Select     (Checkbox                       │       │
│  │                       下拉列表)    多选列表)                       │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────── 用户操作 (前端 → 后端) ────────────────────────┐       │
│  │                                                                   │       │
│  │  用户点击 Save 按钮                                                │       │
│  │  → SaveProjectDialog 输入项目名 (字母数字校验)                      │       │
│  │  → WaypointPanel.handleSave(name)                                 │       │
│  │  → publish("/save_waypoints", { data: "route_A" })                │       │
│  │                                                                   │       │
│  │  用户点击 Load 按钮                                                │       │
│  │  → LoadProjectDialog 选择项目                                      │       │
│  │  → WaypointPanel.handleLoad(name)                                 │       │
│  │  → publish("/load_waypoints", { data: "route_A" })                │       │
│  │                                                                   │       │
│  │  用户在 Manage 中删除                                              │       │
│  │  → ManageProjectsDialog 勾选 + 确认                               │       │
│  │  → WaypointPanel.handleDeleteProject(names)                       │       │
│  │  → publish("/delete_waypoint_project", { data: "r1,r2" })        │       │
│  │                                                                   │       │
│  │  用户拖拽排序航点                                                   │       │
│  │  → DraggableWaypointRow HTML5 D&D                                 │       │
│  │  → WaypointPanel.handleDrop()                                     │       │
│  │  → publish("/reorder_waypoints", { data: '{"order":[1,3,2]}' })  │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### WaypointPanel 新增 UI 布局

```text
┌────────────────────────────────────────────────────────┐
│  Drone {id} Waypoints                                  │
│  X: 1.234  Y: 5.678  Z: 0.912                         │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  [Record]  [Save💾]  [Load📂]  [New➕]  [⚙ Manage] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Z Mode: ○ Raw Z  ● Override [1.5] m                   │
│                                                        │
│  ┌────┬───────────┬───────────┬───────────┬────┬─────┐│
│  │ ≡  │  X        │  Y        │  Z        │ 🗑 │  #  ││
│  ├────┼───────────┼───────────┼───────────┼────┼─────┤│
│  │ ≡  │  1.234    │  5.678    │  1.500    │ 🗑 │  1  ││
│  │ ≡  │ -0.567    │  3.210    │  1.500    │ 🗑 │  2  ││
│  │ ≡  │  2.891    │ -1.045    │  1.500    │ 🗑 │  3  ││
│  └────┴───────────┴───────────┴───────────┴────┴─────┘│
│  ≡ = 拖拽手柄  🗑 = 行内删除按钮                          │
│                                                        │
│  [Clear All ✕] (确认对话框)                              │
└────────────────────────────────────────────────────────┘
```

### 拖拽排序实现

```text
  DraggableWaypointRow (HTML5 Drag-and-Drop)
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  onDragStart(index)                                 │
  │    └── 设置 dragIndex state + 降低 opacity           │
  │                                                     │
  │  onDragOver(targetIndex)                            │
  │    └── 设置 dropTarget state + 显示蓝色边框指示器     │
  │    └── e.preventDefault() 允许 drop                  │
  │                                                     │
  │  onDrop(sourceIndex, targetIndex)                   │
  │    └── 计算新 order 数组                              │
  │    └── 本地 store: 重排 waypoints 数组               │
  │    └── 远程同步:                                     │
  │        publish("/reorder_waypoints",                │
  │          { data: JSON.stringify({ order: [1,3,2] })│
  │        })                                           │
  │                                                     │
  │  onDragEnd()                                        │
  │    └── 清除 dragIndex / dropTarget state            │
  │    └── 恢复 opacity                                  │
  └─────────────────────────────────────────────────────┘
```

### 已知限制与未来规划

1. **面板上下滚动** — 当航点数量超出可视区域时，WaypointPanel 不支持滚动，需要添加 overflow-y: auto 和固定高度容器
2. **交互设计优化** — 打点 / 清空 / 加载等操作的用户确认流程和反馈可以更完善（如 toast 通知、操作撤回）
3. **连接逻辑更新** — 当前 MultiRobotSidebar 的连接管理逻辑需要重构，以支持更稳定的重连和多数据源同时推流
4. **AstroManager 集成** — 通过 AstroManager 控制机器人后端模块的启动 / 重启 / 状态监听 (SLAM, EGO-Planner, 驱动, flight_manager)，实现从地面站全面管控机载软件栈

---

## Commit 11: `a85008b` — 航线执行模式

**日期**: 2026-04-16
**新增**: ~350 行, 7 文件 (2 新增 + 5 修改)
**详细设计文档**: [06-scenario-waypoint-execution.md](./06-scenario-waypoint-execution.md)

### 设计目标

为自主飞行模式新增航线加载与自动逐点执行功能。建图打点场景保存的航点项目可以被加载到自主飞行场景中，通过后端状态机自动向 EGO-Planner 逐点发送目标，实现航线自动导航。

### 架构决策

**为什么将 marker/project_list/exec_state 订阅从 mapping-only 提升到所有模式?**
- 自主飞行模式需要加载航点项目（依赖 project_list）、显示航点标记（依赖 markers）、监听执行状态（依赖 exec_state）
- 这些拦截逻辑原本仅在 mapping 模式下生效，需要重构为所有模式共享
- odom 拦截仍保留在 mapping-only（只有打点场景需要实时位置）

**为什么用双通道 Stop (cmd=5 + stop_waypoint_exec)?**
- cmd=5 到 flight_manager 立即急停无人机（物理安全保障）
- stop_waypoint_exec 到 waypoint_recorder 停止执行状态机（逻辑安全保障）
- 即使 waypoint_recorder 处理消息有延迟，飞控仍会立即响应急停

**为什么 WaypointExecPanel 条件渲染而非始终显示?**
- 没有加载航点时显示空表格没有意义
- `hasWaypoints` 状态由后端 marker 数据驱动，当加载项目后自动出现，清空后自动消失
- 面板 expand/collapse 高度也需要根据内容动态调整（`maxHeight=undefined when hasWaypoints`）

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/components/WaypointExecPanel.tsx` | ~215 | 航线执行面板: 只读航点表格 + Execute/Clear 按钮 + 确认弹窗 |
| `doc/06-scenario-waypoint-execution.md` | ~689 | 航线执行场景详细设计文档 |

### 修改文件

| 文件 | 变更 | 说明 |
| --- | --- | --- |
| `topicConfig.ts` | +6 行 | 新增 `startWaypointExec`, `stopWaypointExec`, `waypointExecState` 3 个字段 (18 总字段) |
| `useWaypointStore.ts` | +10 行 | 新增 `ExecState` 类型, `execStates` 状态, `setExecState()` action |
| `DroneControlPanel.tsx` | +77 行 | +LoadProjectDialog 集成, +handleAbort() 双通道 Stop, +isExecuting 禁用逻辑 |
| `Interactions.tsx` | +22 行 | +hasWaypoints 条件渲染 WaypointExecPanel, +lastDroneIdRef 两种模式持久化 |
| `ThreeDeeRender.tsx` | +125/-60 行 | 订阅与拦截重构: marker/projectList/execState 提升到所有模式, odom 保留 mapping-only |

### 数据流概要

```text
用户操作 Load Path
  → LoadProjectDialog 选择项目
  → DroneControlPanel.handleLoad(name)
  → publish("/drone_{id}_load_waypoints", { data: name })
    → waypoint_recorder.py 加载 JSON
    → _publish_markers() → MarkerArray
      → ThreeDeeRender 拦截 + 颜色覆盖 + setWaypointsFromMarkers()
        → hasWaypoints = true → WaypointExecPanel 渲染

用户操作 Execute
  → WaypointExecPanel → 确认弹窗
  → publish("/drone_{id}_start_waypoint_exec", {})
    → waypoint_recorder.py 状态机启动
    → 5Hz _nav_tick: cmd=4 → GoalSet → 等待 reached → 下一航点
    → publish("executing") → ThreeDeeRender 拦截 → setExecState()
      → UI 按钮全部 disabled

用户操作 Stop
  → DroneControlPanel.handleAbort()
  → publish("/control", {cmd:5}) + publish("/drone_{id}_stop_waypoint_exec", {})
    → flight_manager 急停 + waypoint_recorder._halt_execution()
    → publish("idle") → UI 恢复
```

---

## Commit 12: 极简 UI + 可视化设置弹窗

**日期**: 2026-04-17
**新增**: ~280 行, 10 文件 (3 新增 + 7 修改)

### 设计目标

1. 用自定义 SpikiveTitleBar 替换原生 Lichtblick 导航栏，统一极简 UI 风格
2. 新增可视化设置弹窗，允许用户动态调整背景颜色、点云性能档位和渲染样式
3. 隐藏原生 3D 工具栏和侧栏标签行等多余 UI 元素

### 架构决策

**为什么用 Zustand Store 而非直接修改 Renderer config?**
- 设置弹窗（SpikiveSettingsDialog）与 3D 渲染器（ThreeDeeRender）在组件树中距离较远
- Zustand 提供跨组件的响应式状态共享，避免 prop drilling
- 个别 selector 订阅（`useVisualizationStore(s => s.decayTime)`）避免无关字段变化触发重渲染

**为什么绕过 SettingsManager.handleAction 而直接调用扩展的 handleSettingsAction?**
- `SettingsManager.handleAction()` 沿设置树遍历路径寻找 handler，topic 节点只有在数据到达后才注册
- 若 topic 尚未收到数据，遍历静默返回，handler 不触发
- 直接调用 `sceneExtensions.get("foxglove.PointClouds").handleSettingsAction()` 绕过这个限制

**为什么对所有 `*_cloud_registered` topic 统一应用设置?**
- 多无人机场景下每台无人机有独立的点云 topic
- 用户期望所有点云共用同一可视化样式（颜色、透明度、大小、衰减时间）

### 新增文件

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `spikive/components/SpikiveTitleBar.tsx` | ~84 | 自定义标题栏：品牌图标 + 标题 + 设置按钮 |
| `spikive/components/SpikiveSettingsDialog.tsx` | ~173 | 设置弹窗：背景颜色、性能档位、点云可视化参数 |
| `spikive/stores/useVisualizationStore.ts` | ~33 | 可视化设置 Zustand Store |

### 修改文件

| 文件 | 变更 | 说明 |
| --- | --- | --- |
| `Workspace.tsx` | +2/-2 | 用 SpikiveTitleBar 替换原生 appBar，移除 ThemeToggleButton |
| `ThreeDeeRender.tsx` | +51 | 从 Zustand 读取可视化设置，批量更新所有点云 topic 的 config 并刷新 renderable |
| `Renderer.ts` | +2/-2 | 降低选中遮罩透明度 0.8→0.2（避免遮暗场景） |
| `RendererOverlay.tsx` | +1/-1 | 添加 data-testid 供 CSS 选择器隐藏 3D 工具栏 |
| `spikiveGlobalOverrides.css` | +13 | 隐藏 3D Panel 工具栏、侧栏标签行 |
| `StudioWindow.ts` | +3/-1 | 标题栏高度 44→32px |
| `desktop/renderer/index.ts` | +2 | 导入全局 CSS 覆盖 |
| `migrations.ts` | +18 | v1→v2 迁移：强制左侧栏为 "robots" |
| `WorkspaceContextProvider.tsx` | +8/-2 | 链式迁移逻辑 v0→v1→v2 |

### 设置项一览

| 设置 | 选项 | 存储位置 |
| --- | --- | --- |
| 背景颜色 | 白色 / 黑色 | AppSetting.COLOR_SCHEME (localStorage) |
| 性能档位 | 低(15s) / 中(45s) / 高(90s) / 极高(180s) | useVisualizationStore.decayTime |
| 颜色模式 | 纯色 / 渐变 / 色图 / RGB | useVisualizationStore.colorMode |
| 色图类型 | Turbo / Rainbow (仅色图模式) | useVisualizationStore.colorMap |
| 透明度 | 0.05 ~ 1.0 | useVisualizationStore.explicitAlpha |
| 点大小 | 0.1 ~ 5.0 | useVisualizationStore.pointSize |

### 数据流

```text
SpikiveSettingsDialog
  → useVisualizationStore.updateSettings({ decayTime: 90 })
    → Zustand 状态更新
      → ThreeDeeRender useEffect 触发
        → renderer.updateConfig() 批量写入所有 *_cloud_registered topic
        → pcExt.handleSettingsAction() 刷新 renderable 材质/缓冲区
          → updatePointCloud() 重建 THREE.js 材质
```
