# 05 API 参考手册

> **注意**: 行号对应当前工作树状态 (2026-04-14)，后续提交可能导致行号偏移。

## 目录

- [1. 模块依赖关系（图 17）](#1-模块依赖关系图-17)
- [2. Spikive 新增模块](#2-spikive-新增模块)
- [3. MultiRobotSidebar 模块](#3-multirobotsidebar-模块)
- [4. Lichtblick 修改点详表](#4-lichtblick-修改点详表)
- [5. ROS 消息格式](#5-ros-消息格式)

---

## 1. 模块依赖关系（图 17）

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      Spikive 模块依赖关系图                              │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    spikive/config/                                │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐                                            │   │
│  │  │  topicConfig.ts   │◄──────────────────────────────────────┐   │   │
│  │  │  (核心配置)        │                                       │   │   │
│  │  │  +WAYPOINT_COLORS │                                       │   │   │
│  │  └──────────────────┘                                        │   │   │
│  │           ▲  ▲  ▲                                            │   │   │
│  └───────────┼──┼──┼────────────────────────────────────────────┘   │   │
│              │  │  │                                                │   │
│  ┌───────────┼──┼──┼────────────────────────────────────────────┐   │   │
│  │           │  │  │         spikive/hooks/                      │   │   │
│  │  ┌────────┘  │  │                                            │   │   │
│  │  │  ┌────────────┴──────────┐                                │   │   │
│  │  │  │ useActiveDroneRouting │──────► Lichtblick               │   │   │
│  │  │  │ .ts                   │        useCurrentLayoutActions  │   │   │
│  │  │  └───────────────────────┘        useRobotConnectionsStore│   │   │
│  │  │                                                            │   │   │
│  └──┼────────────────────────────────────────────────────────────┘   │   │
│     │                                                                │   │
│  ┌──┼────────────────────────────────────────────────────────────┐   │   │
│  │  │             spikive/stores/                                │   │   │
│  │  │                                                            │   │   │
│  │  │  ┌───────────────────┐  ┌──────────────────┐              │   │   │
│  │  │  │ useSceneModeStore │  │ useWaypointStore │              │   │   │
│  │  │  │ .ts               │  │ .ts              │              │   │   │
│  │  │  └───────────────────┘  │ +projectLists   │              │   │   │
│  │  │           ▲              │ +setProjectList  │              │   │   │
│  │  │           │              │ +setWaypoints... │              │   │   │
│  │  │           │              └──────────────────┘              │   │   │
│  │  │           │                ▲     ▲     ▲                  │   │   │
│  └──┼───────────┼────────────────┼─────┼─────┼──────────────────┘   │   │
│     │           │                │     │     │                      │   │
│  ┌──┼───────────┼────────────────┼─────┼─────┼──────────────────┐   │   │
│  │  │           │    spikive/components/│     │                  │   │   │
│  │  │           │                │     │     │                  │   │   │
│  │  │  ┌────────┴──────────┐  ┌─┴─────┴─────┴──────────┐      │   │   │
│  │  │  │SceneSelection     │  │ WaypointPanel           │      │   │   │
│  │  │  │Dialog.tsx         │  │ .tsx (630 行)            │      │   │   │
│  │  │  └───────────────────┘  │ ┌─────────────────────┐ │      │   │   │
│  │  │                         │ │ SaveProjectDialog    │ │      │   │   │
│  │  │                         │ │ LoadProjectDialog    │ │      │   │   │
│  │  │                         │ │ ManageProjectsDialog │ │      │   │   │
│  │  │                         │ └─────────────────────┘ │      │   │   │
│  │  │                         └─────────────────────────┘      │   │   │
│  │  │                                                          │   │   │
│  │  └──┐  ┌──────────────────┐  ┌──────────────────┐          │   │   │
│  │  ┌──┐  ┌──────────────────┐  ┌──────────────────┐          │   │   │
│  │     │  │DroneControlPanel │  │ThemeToggleButton  │          │   │   │
│  │     │  │.tsx              │  │.tsx               │          │   │   │
│  │     │  └──────────────────┘  └──────────────────┘          │   │   │
│  │     │  ┌──────────────────┐                                  │   │   │
│  │     │  │WaypointExecPanel │                                  │   │   │
│  │     │  │.tsx              │                                  │   │   │
│  │     │  └──────────────────┘                                  │   │   │
│  │     │  │.tsx              │  │.tsx               │          │   │   │
│  │     │  └──────────────────┘  └──────────────────┘          │   │   │
│  └─────┼──────────────────────────────────────────────────────┘   │   │
│        │                                                          │   │
│  ┌─────┼──────────────────────────────────────────────────────┐   │   │
│  │     │     MultiRobotSidebar/                                │   │   │
│  │     │                                                       │   │   │
│  │     │  ┌──────────────────┐  ┌──────────────────────────┐  │   │   │
│  │     └─►│ index.tsx         │  │ useRobotConnections.ts   │  │   │   │
│  │        │ (主组件)          │──►│ (Zustand Store)          │  │   │   │
│  │        └──────────────────┘  └──────────────────────────┘  │   │   │
│  │                │                       ▲                    │   │   │
│  │        ┌───────┴──────┐        ┌───────┴──────────┐        │   │   │
│  │        ▼              ▼        │                  │        │   │   │
│  │  ┌───────────┐ ┌────────────┐  │ ┌──────────────┐ │        │   │   │
│  │  │RobotCard  │ │AddRobot    │──┘ │useWebSocket  │ │        │   │   │
│  │  │.tsx       │ │Dialog.tsx  │    │Monitor.ts    │─┘        │   │   │
│  │  └───────────┘ └────────────┘    └──────────────┘          │   │   │
│  └────────────────────────────────────────────────────────────┘   │   │
│                                                                   │   │
│  ─────────────────── Lichtblick 修改点 ───────────────────────   │   │
│                                                                   │   │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐  │   │
│  │ Workspace.tsx     │  │ Interactions   │  │ ThreeDeeRender   │  │   │
│  │ +SceneSelection  │  │ .tsx           │  │ .tsx             │  │   │
│  │ +ThemeToggle     │  │ +DroneControl  │  │ +odom 拦截       │  │   │
│  │ +MultiRobotSidebar│  │ +WaypointPanel │  │ +GoalSet publish │  │   │
│  └──────────────────┘  └────────────────┘  │ +颜色覆盖        │  │   │
│                                             │ +per-drone拦截   │  │   │
│                                             └──────────────────┘  │   │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐  │   │
│  │ Renderer.ts       │  │ publish.ts     │  │ defaultLayout.ts │  │   │
│  │ +pickable filter  │  │ +GoalSet msg   │  │ +topic config   │  │   │
│  │ +getSelectedInfo  │  │ +MarkerArray   │  │ +pickable flags │  │   │
│  └──────────────────┘  └────────────────┘  └──────────────────┘  │   │
│                                                                   │   │
└───────────────────────────────────────────────────────────────────┘

箭头方向: A ──► B 表示 A 依赖 (import) B
```

---

## 2. Spikive 新增模块

### 2.1 topicConfig.ts

**路径**: `packages/suite-base/src/spikive/config/topicConfig.ts` (~150 行)

**导出清单**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `DEFAULT_DRONE_ID` | `string` ("1") | 默认 drone_id |
| `DroneTopics` | `type` | 18 字段: `{ pointCloud, optimalTrajectory, goalPoint, robotModel, path, odom, addWaypoint, removeWaypoint, clearWaypoints, saveWaypoints, loadWaypoints, deleteProject, reorderWaypoints, waypointMarkers, waypointProjectList, startWaypointExec, stopWaypointExec, waypointExecState }` |
| `droneTopics(droneId: string \| number)` | `function → DroneTopics` | 输入 drone_id，返回所有 18 个完整 topic 路径映射 (含 `/drone_{id}_` 前缀) |
| `droneBodyFrame(droneId: string \| number)` | `function → string` | 输入 drone_id，返回 TF 帧名 `"base{id}"` |
| `extractDroneIdFromTopic(topic: string)` | `function → string \| undefined` | 从 topic 路径提取 drone_id |
| `extractDroneIdFromRobotModelTopic(topic)` | `function → string \| undefined` | 只从 `/drone_{id}_odom_visualization/robot` 提取 drone_id |
| `isDroneRobotModelTopic(topic)` | `function → boolean` | 判断 topic 是否为唯一可选中的 robotModel topic |
| `TELEMETRY_TOPICS` | `object` | 遥测 topic: `{ battery: "/mavros/battery" }` |
| `CONTROL_TOPIC` | `string` ("/control") | 飞行指令发布 topic |
| `DRONE_COMMANDS` | `object` | `{ TAKEOFF: 1, LAND: 2, RETURN: 3, CONTINUE: 4, STOP: 5 }` |
| `TOPIC_CONFIG` | `object` | 聚合配置: `{ subscribe, publish, followTf }` |
| `WAYPOINT_COLORS` | `object` | 航点标记颜色: `{ sphere: #EF833A, text: white, line: #9C27B0 }` |

> **注意**: `PROJECT_TOPICS` 常量已移除。所有航点管理 topic (save/load/delete/reorder/markers/projectList) 现在通过 `droneTopics()` 生成 per-drone 前缀的 topic 名，不再使用全局常量。

**DroneTopics 18 字段说明**:

| 字段 | 生成的 topic 格式 | 用途 |
| --- | --- | --- |
| `pointCloud` | `/drone_{id}_cloud_registered` | 点云订阅 |
| `optimalTrajectory` | `/drone_{id}_ego_planner_node/optimal_list` | EGO-Planner 轨迹订阅 |
| `goalPoint` | `/drone_{id}_ego_planner_node/goal_point` | 目标点订阅 |
| `robotModel` | `/drone_{id}_odom_visualization/robot` | 机器人模型订阅 (pickable) |
| `path` | `/drone_{id}_odom_visualization/path` | 路径订阅 |
| `odom` | `/drone_{id}_visual_slam/odom` | 里程计订阅 |
| `addWaypoint` | `/drone_{id}_add_waypoint` | 添加航点 (前端→后端) |
| `removeWaypoint` | `/drone_{id}_remove_waypoint` | 删除航点 (前端→后端) |
| `clearWaypoints` | `/drone_{id}_clear_waypoints` | 清空航点 (前端→后端) |
| `saveWaypoints` | `/drone_{id}_save_waypoints` | 保存项目 (前端→后端) |
| `loadWaypoints` | `/drone_{id}_load_waypoints` | 加载项目 (前端→后端) |
| `deleteProject` | `/drone_{id}_delete_waypoint_project` | 删除项目 (前端→后端) |
| `reorderWaypoints` | `/drone_{id}_reorder_waypoints` | 重排航点 (前端→后端) |
| `waypointMarkers` | `/drone_{id}_waypoint_markers` | 航点可视化标记 (后端→前端) |
| `waypointProjectList` | `/drone_{id}_waypoint_project_list` | 项目列表推送 (后端→前端) |
| `startWaypointExec` | `/drone_{id}_start_waypoint_exec` | 开始航线执行 (前端→后端) |
| `stopWaypointExec` | `/drone_{id}_stop_waypoint_exec` | 停止航线执行 (前端→后端) |
| `waypointExecState` | `/drone_{id}_waypoint_exec_state` | 执行状态推送 (后端→前端) |

**WAYPOINT_COLORS 详细定义**:

```typescript
export const WAYPOINT_COLORS = {
  sphere: { r: 0.937, g: 0.514, b: 0.227, a: 1.0 },  // #EF833A Spikive 橙
  text:   { r: 1.0,   g: 1.0,   b: 1.0,   a: 1.0 },  // 白色
  line:   { r: 0.612, g: 0.153, b: 0.690, a: 1.0 },   // #9C27B0 紫色
} as const;
```

**调用关系**:

| 函数 | 被以下模块调用 |
| --- | --- |
| `droneTopics()` | `useActiveDroneRouting.ts`, `WaypointPanel.tsx`, `DroneControlPanel.tsx`, `WaypointExecPanel.tsx`, `defaultLayout.ts` |
| `droneBodyFrame()` | `useActiveDroneRouting.ts`, `defaultLayout.ts` |
| `extractDroneIdFromTopic()` | `ThreeDeeRender.tsx`, `DroneControlPanel.tsx` |
| `extractDroneIdFromRobotModelTopic()` | `Interactions.tsx`, `ThreeDeeRender.tsx` |
| `isDroneRobotModelTopic()` | `Renderer.ts`, `defaultLayout.ts` |
| `TELEMETRY_TOPICS` | `ThreeDeeRender.tsx` |
| `CONTROL_TOPIC` | `DroneControlPanel.tsx` |
| `DRONE_COMMANDS` | `DroneControlPanel.tsx` |
| `TOPIC_CONFIG` | `ThreeDeeRender.tsx`, `defaultLayout.ts` |
| `WAYPOINT_COLORS` | `ThreeDeeRender.tsx` |

---

### 2.2 useActiveDroneRouting.ts

**路径**: `packages/suite-base/src/spikive/hooks/useActiveDroneRouting.ts`

**导出**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `useActiveDroneRouting()` | `hook → void` | 监听当前可视化目标，自动重写 3D Panel topic 订阅 |
| `buildActiveDronePanelConfig()` | `(currentConfig, targetDroneId) → config \| undefined` | 纯函数，生成目标 drone 对应的 3D panel 配置；layout cache 和 mounted renderer 共用 |

**内部常量**:

| 常量 | 值 | 说明 |
| --- | --- | --- |
| `TOPIC_FIELDS` | `["pointCloud", "optimalTrajectory", "goalPoint", "robotModel", "path", "waypointMarkers"]` (6 项) | 单 active drone 3D 可视化核心 topic |
| `NON_PICKABLE_FIELDS` | `Set<"pointCloud", "optimalTrajectory", "goalPoint", "path", "waypointMarkers">` | 不参与 GPU pick 的 topic 字段 (仅 robotModel 为 pickable)，包含 `waypointMarkers` |

> **约束**: `useActiveDroneRouting()` 只订阅 `visualDroneId` 和 `visualRouteVersion`。卡片 Select 状态、WebSocket latency 更新不能触发 3D routing。

**内部函数**:

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `ensurePickableFlags` | `(topics: Record, droneId: string) → patched \| undefined` | 确保新 topic 的 pickable 标记正确，返回修补后的配置或 undefined (无需修补) |
| `remapTopics` | `(oldTopics: Record, fromId: string, toId: string) → Record` | 将 3D Panel 配置中的 topic 从 drone_fromId 重写为 drone_toId |
| `ensureVisibleTargetTopics` | `(topics: Record, droneId: string) → { topics, changed }` | 补齐目标 drone 6 个核心 topic，强制 visible/pickable 契约，并移除其他 drone 的核心 3D topic |

**两层路由同步**:

- `useActiveDroneRouting()` 写 `configById["3D!spikive3d"]`，保证 layout cache 与后续 remount 正确。
- `ThreeDeeRender.tsx` 在 mounted renderer 中直接调用同一份 `buildActiveDronePanelConfig()`，保证当前 3D panel 立即跟随 `visualDroneId`，不等待 panel remount。
- 点云 topic 创建/修复时带完整渲染参数，并保持 `pickable: false`。

**依赖**:

| 依赖 | 来源 |
| --- | --- |
| `useRobotConnectionsStore` | `MultiRobotSidebar/useRobotConnections.ts` |
| `useCurrentLayoutActions` | Lichtblick 内部 API |
| `droneTopics`, `droneBodyFrame` | `topicConfig.ts` |

**调用位置**: `MultiRobotSidebar/index.tsx` 中调用 `useActiveDroneRouting()`

---

### 2.2.1 Active Drone ID

**路径**: `packages/suite-base/src/components/MultiRobotSidebar/types.ts` 与 `useRobotConnections.ts`

**ID 边界**:

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `connectionId` | `string` | 前端连接/卡片实例 id，用于 React key、删除卡片、WebSocket probe 状态 |
| `droneId` | `string` | 业务身份，用于 ROS topic、TF、Waypoint store、GoalSet |
| `activeDroneId` | `string \| undefined` | 当前选择和控制目标 |
| `visualDroneId` | `string \| undefined` | 当前 3D 显示和路由目标；当前单机模式添加第一张卡片时默认开启 |
| `visualRouteVersion` | `number` | 低频路由校验版本 |

**Active 写入**:

| action | 来源 | 行为 |
| --- | --- | --- |
| `setActiveDroneId(droneId)` | 卡片右上角 Select 按钮 | 设置唯一选择/控制目标 `activeDroneId` |
| `setActiveDroneId(droneId)` | 3D robotModel selected object | 从 `/drone_{id}_odom_visualization/robot` 解析 `droneId` 后写入同一个 active |

**约束**:

- SelectObject、控制面板、航点面板和 GoalSet 只读 `activeDroneId`。
- 高频点云、marker、odom 消息循环不能 dispatch active intent。
- 点云、轨迹、路径、航点 marker 不能成为 active 入口。
- `selected_id`、marker `id`、`idFromMessage()`、`renderable.name` 不能推导业务 `droneId`。
- 点云 visualization settings 只在 visual/config/settings 变化时同步到 visual/config 中的点云 topic，不能在 renderer topics 尚未 ready 时默认覆盖 drone 1。
- 当前单机模式下卡片 Visual 按钮默认开启且禁用，只表达显示状态，不参与 Select/active intent。

---

### 2.2.2 Manager Start/Stop

**路径**: `packages/suite-base/src/spikive/manager/`

**身份边界**:

| 项 | 说明 |
| --- | --- |
| 添加卡片 | 手动输入 `droneId`，先通过 `/drone_{id}_auto_manager_status` 的 `drone_id` 握手 |
| Manager status | 以 `RobotEntry.droneId` 为 key；`message.drone_id` 只做一致性校验 |
| Manager command | 只向 `/drone_{id}_command_topic` 单次发布 `start_all` / `shutdown_all` |
| Manager ACK | 后端在 `AutoManager.command.extra_data.request_id` 回显同一个 request id |

**Store**:

```typescript
type ManagerStatusSnapshot = {
  droneId: string;
  mode: string;
  isActive: boolean;
  starting: boolean;
  stopping: boolean;
  armed: boolean;
  mavrosStatus: 0 | 1 | 2;
  lidarStatus: 0 | 1 | 2;
  slamStatus: 0 | 1 | 2;
  plannerStatus: 0 | 1 | 2;
  lastCommandType: string;
  lastCommandRequestId: string;
  lastUpdateMs: number;
};
```

**约束**:

- Manager Start/Stop 不读取 `activeDroneId`、`visualDroneId`、SelectObject 或 robotModel topic。
- 前端不发布 restart，后端也不实现 restart。
- 一次确认只产生一次 publish；`pendingRequest` 等待 status ACK，超时或 publish 异常只标记失败，不自动重发。
- `astro_manager/Command.extra_data` 使用 JSON `{request_id, seq, drone_id}` 做 ACK 关联，不参与后端安全决策。
- ACK 只表示后端已接收/处理该 request，不表示启动或停止成功；真正结果继续读取 `starting/stopping/is_active/last_error_seq`。
- 后端在 `_on_command()` 接收阶段拒绝 armed、busy、队列已有待处理命令、重复 start、空 stop、未知命令；被拒绝命令不进入队列，但仍回显 request id 并更新 `last_error_seq`。
- 卡片状态灯固定为 Drivers: MavROS/Lidar，Tasks: SLAM/Planner。
- Manager status 低频订阅，不进入 3D routing，不影响点云渲染路径。

---

### 2.3 useSceneModeStore.ts

**路径**: `packages/suite-base/src/spikive/stores/useSceneModeStore.ts` (19 行)

**导出**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `SceneMode` | `type` | `"autonomous-flight" \| "mapping-waypoint"` |
| `useSceneModeStore` | `Zustand Store` | 场景模式全局状态 |

**State & Actions**:

```typescript
{
  sceneMode: SceneMode | undefined;  // 初始 undefined，选择后不可变
  setSceneMode: (mode: SceneMode) => void;
}
```

**写入者**: `SceneSelectionDialog.tsx` → `setSceneMode()`

**读取者**: `Interactions.tsx` (分支渲染), `ThreeDeeRender.tsx` (odom 订阅开关)

---

### 2.4 useWaypointStore.ts

**路径**: `packages/suite-base/src/spikive/stores/useWaypointStore.ts` (~120 行)

**导出**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `Waypoint` | `type` | `{ idx: number, x: number, y: number, z: number }` |
| `OdomPosition` | `type` | `{ x: number, y: number, z: number }` |
| `ZMode` | `type` | `"none" \| "override"` |
| `ExecState` | `type` | `"idle" \| "executing"` |
| `DroneWaypointState` | `type` | `{ waypoints, zMode, overrideZValue }` |
| `applyZ` | `function` | 根据 zMode 计算最终 Z 值 (导出供 WaypointPanel 使用) |
| `useWaypointStore` | `Zustand Store` | 航点数据全局状态 |

**State**:

```typescript
{
  tables: Record<string, DroneWaypointState>;          // droneId → 航点状态
  latestOdom: Record<string, OdomPosition>;            // droneId → 最新 odom 位置
  projectLists: Record<string, string[]>;              // droneId → 可用项目名列表 (由后端 per-drone 推送)
  execStates: Record<string, ExecState>;               // droneId → 执行状态 "idle"|"executing"
}
```

> **变更**: 新增 `execStates` 状态和 `setExecState` action，用于跟踪 per-drone 的航线执行状态。

**Actions**:

| Action | 签名 | 说明 |
| --- | --- | --- |
| `getOrCreate` | `(droneId: string) → DroneWaypointState` | 获取或初始化该无人机的航点状态 |
| `updateZSettings` | `(droneId: string, settings: Partial<...>) → void` | 更新 Z 轴模式/值 |
| `updateOdom` | `(droneId: string, pos: OdomPosition) → void` | 更新最新 odom 位置 (高频) |
| `setWaypointsFromMarkers` | `(droneId: string, waypoints: Waypoint[]) → void` | 从 marker 解析批量同步航点列表 |
| `setProjectList` | `(droneId: string, list: string[]) → void` | 替换指定 drone 的项目列表 (由 ThreeDeeRender 拦截 per-drone 消息后调用) |
| `setExecState` | `(droneId: string, state: ExecState) → void` | 更新指定 drone 的执行状态 (由 ThreeDeeRender 拦截 exec_state 消息后调用) |

> **变更**: `setProjectList` 签名从 `(list: string[]) → void` 改为 `(droneId: string, list: string[]) → void`，按 droneId 更新对应的项目列表。`addWaypoint`、`removeWaypoint`、`deleteLast`、`clearWaypoints` 等旧的本地操作 action 已移除 (航点操作现在由后端通过 per-drone topic 处理)。

**内部函数**:

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `defaultDroneState` | `() → DroneWaypointState` | 返回默认航点状态 (zMode="none", overrideZ=1.5) |

**写入者与读取者**:

| 写入者 | Action | 读取者 |
| --- | --- | --- |
| ThreeDeeRender (odom 拦截) | `updateOdom()` | WaypointPanel → `latestOdom[droneId]` |
| ThreeDeeRender (marker 拦截) | `setWaypointsFromMarkers()` | WaypointPanel → `tables[droneId].waypoints`, Interactions → `hasWaypoints`, WaypointExecPanel → `tables[droneId].waypoints` |
| ThreeDeeRender (project list 拦截) | `setProjectList()` | WaypointPanel → `projectLists[droneId]` → 传递给 Dialog 组件, DroneControlPanel → `projectLists[droneId]` |
| ThreeDeeRender (exec state 拦截) | `setExecState()` | DroneControlPanel → `execStates[droneId]`, WaypointExecPanel → `execStates[droneId]` |
| WaypointPanel (Z 模式切换) | `updateZSettings()` | WaypointPanel → Z 设置 |

---

### 2.5 DroneControlPanel.tsx

**路径**: `packages/suite-base/src/spikive/components/DroneControlPanel.tsx` (~240 行)

**Props**:

```typescript
{
  droneId: string;
  onClickPublish: () => void;
  publishActive: boolean;
  canPublish: boolean;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (topic: string, schemaName: string, options?: AdvertiseOptions) => void;
  unadvertise?: (topic: string) => void;
  dataSourceProfile?: string;
}
```

**关键行为**:

- `useMemo(() => droneTopics(droneId), [droneId])`: 根据 droneId 动态构建所有 per-drone topic 名
- `useWaypointStore(s => s.execStates[droneId] ?? "idle")`: 读取执行状态
- `useWaypointStore(s => s.projectLists[droneId] ?? [])`: 读取项目列表
- `useEffect(mount)`: advertise 3 个 topic:
  - `"/control"` → `"controller_msgs/cmd"`
  - `topics.loadWaypoints` → `"std_msgs/String"`
  - `topics.stopWaypointExec` → `"std_msgs/Empty"`
- `sendCommand(cmd: number)`: `publish("/control", { header: {...}, cmd })`
- `handleAbort()`: `sendCommand(STOP)` + `publish(topics.stopWaypointExec, {})` (双通道急停)
- `handleLoad(name: string)`: `publish(topics.loadWaypoints, { data: name })`
- Load Path 按钮: `disabled={isExecuting}`
- Publish Pose 按钮: `disabled={isExecuting}`
- `useEffect(unmount)`: unadvertise 全部 3 个 topic

**调用位置**: `Interactions.tsx` → `sceneMode === "autonomous-flight"` 时渲染

---

### 2.5b WaypointExecPanel.tsx

**路径**: `packages/suite-base/src/spikive/components/WaypointExecPanel.tsx` (~215 行)

**Props**:

```typescript
{
  droneId: string;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (topic: string, schemaName: string, options?: AdvertiseOptions) => void;
  unadvertise?: (topic: string) => void;
}
```

**关键行为**:

- `useMemo(() => droneTopics(droneId), [droneId])`: 根据 droneId 动态构建所有 per-drone topic 名
- `useWaypointStore(s => s.tables[droneId]?.waypoints ?? [])`: 读取航点列表 (只读)
- `useWaypointStore(s => s.execStates[droneId] ?? "idle")`: 读取执行状态
- `useEffect(mount)`: advertise 3 个 topic:
  - `topics.startWaypointExec` → `"std_msgs/Empty"`
  - `topics.stopWaypointExec` → `"std_msgs/Empty"`
  - `topics.clearWaypoints` → `"std_msgs/Empty"`
- Execute 按钮: 确认弹窗 → `publish(topics.startWaypointExec, {})`, `disabled={isExecuting}`
- Clear 按钮: `publish(topics.clearWaypoints, {})`, `disabled={isExecuting}`
- `useEffect(unmount)`: unadvertise 全部 3 个 topic

**条件渲染**: `Interactions.tsx` 中当 `sceneMode === "autonomous-flight"` 且 `hasWaypoints === true` 时渲染

---

### 2.6 SceneSelectionDialog.tsx

**路径**: `packages/suite-base/src/spikive/components/SceneSelectionDialog.tsx` (95 行)

**Props**: 无

**行为**: MUI Dialog，启动时阻塞 (`disableEscapeKeyDown`)，用户选择模式后调用 `useSceneModeStore.setSceneMode()` 并关闭。

**调用位置**: `Workspace.tsx` 中直接渲染 `<SceneSelectionDialog />`

---

### 2.7 WaypointPanel.tsx

**路径**: `packages/suite-base/src/spikive/components/WaypointPanel.tsx` (630 行)

**Props**:

```typescript
{
  droneId: string;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (topic: string, schemaName: string, options?: AdvertiseOptions) => void;
  unadvertise?: (topic: string) => void;
}
```

**关键行为**:

- `useMemo(() => droneTopics(droneId), [droneId])`: 根据 `droneId` 动态构建所有 per-drone topic 名 (无硬编码 topic 常量)
- Store 读取使用实际 `droneId` 作为 key (非 `DEFAULT_DRONE_ID`):
  - `latestOdom[droneId]` — 最新 odom 位置
  - `tables[droneId]?.waypoints` — 当前航点列表
  - `projectLists[droneId] ?? []` — 该 drone 的项目列表
- `useEffect(mount / droneId change)`: advertise 7 个 per-drone topic (依赖 `topics`，droneId 变化时重新 advertise):
  - `topics.addWaypoint` ("geometry_msgs/PoseStamped")
  - `topics.removeWaypoint` ("std_msgs/Int32")
  - `topics.clearWaypoints` ("std_msgs/Empty")
  - `topics.saveWaypoints` ("std_msgs/String")
  - `topics.loadWaypoints` ("std_msgs/String")
  - `topics.deleteProject` ("std_msgs/String")
  - `topics.reorderWaypoints` ("std_msgs/String")
- `useEffect(unmount)`: unadvertise 全部 7 个 topic
- `handleRecord()`: 读取 `latestOdom[droneId]` → `publish(topics.addWaypoint, PoseStamped)`
- `handleRemove(idx)`: `publish(topics.removeWaypoint, { data: idx })`
- `handleClearConfirm()`: `publish(topics.clearWaypoints, {})`
- `handleSave(name)`: `publish(topics.saveWaypoints, { data: name })`
- `handleLoad(name)`: `publish(topics.loadWaypoints, { data: name })`
- `handleDeleteProject(names)`: `publish(topics.deleteProject, { data: names })` (逗号分隔)
- `handleDrop(src, tgt)`: 重排 → `publish(topics.reorderWaypoints, { data: JSON.stringify({order}) })`

> **变更**: 所有 topic 名从硬编码全局常量 (如 `/save_waypoints`) 改为 per-drone 动态构建 (如 `/drone_1_save_waypoints`)。Advertise effect 依赖 `topics` 对象，droneId 切换时自动重新 advertise。

**内部子组件**:

| 组件 | 说明 |
| --- | --- |
| `DraggableWaypointRow` | HTML5 D&D 可拖拽行，封装拖拽手柄 + 视觉反馈 (opacity, border) |

**集成的 Dialog 组件**:

| Dialog | 触发 | 传递 props | 回调 |
| --- | --- | --- | --- |
| `SaveProjectDialog` | toolbar Save 按钮 | `projectList={projectList}` | `onSave(name)` → handleSave |
| `LoadProjectDialog` | toolbar Load 按钮 | `projectList={projectList}` | `onLoad(name)` → handleLoad |
| `ManageProjectsDialog` | toolbar Manage 按钮 | `projectList={projectList}` | `onDelete(names)` → handleDeleteProject |

**调用位置**: `Interactions.tsx` → `sceneMode === "mapping-waypoint"` 时渲染

---

### 2.8 SaveProjectDialog.tsx

**路径**: `packages/suite-base/src/spikive/components/SaveProjectDialog.tsx` (~120 行)

**Props**:

```typescript
{
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  projectList: string[];        // 由 WaypointPanel 从 useWaypointStore.projectLists[droneId] 传入
}
```

**关键行为**:

- MUI Autocomplete 输入框，`projectList` 作为建议列表
- 输入验证: `/^[a-zA-Z0-9]*$/` (仅字母数字)，非法字符实时错误提示
- 空输入默认使用 `"waypoint"`
- Enter 键提交 (无验证错误时)
- 关闭时重置输入状态

> **变更**: 不再直接访问 `useWaypointStore`，改为通过 `projectList: string[]` prop 接收数据。

---

### 2.9 LoadProjectDialog.tsx

**路径**: `packages/suite-base/src/spikive/components/LoadProjectDialog.tsx` (~79 行)

**Props**:

```typescript
{
  open: boolean;
  onClose: () => void;
  onLoad: (name: string) => void;
  projectList: string[];        // 由 WaypointPanel 从 useWaypointStore.projectLists[droneId] 传入
}
```

**关键行为**:

- MUI Select 下拉列表展示 `projectList` 中的已保存项目
- 空列表时显示 "No saved projects found."
- 未选择时 Load 按钮禁用
- 关闭时重置选择状态

> **变更**: 不再直接访问 `useWaypointStore`，改为通过 `projectList: string[]` prop 接收数据。

---

### 2.10 ManageProjectsDialog.tsx

**路径**: `packages/suite-base/src/spikive/components/ManageProjectsDialog.tsx` (~140 行)

**Props**:

```typescript
{
  open: boolean;
  onClose: () => void;
  onDelete: (names: string) => void;  // 逗号分隔的项目名
  projectList: string[];              // 由 WaypointPanel 从 useWaypointStore.projectLists[droneId] 传入
}
```

**关键行为**:

- MUI Checkbox List 多选界面，展示 `projectList` 中的项目
- 每项右侧有快捷删除按钮，支持单项直接删除
- 批量选择后显示 "Delete Selected (N)" 按钮
- 空列表时显示 "No saved projects."
- 关闭时清除选择状态
- `onDelete` 回调传递逗号分隔的项目名字符串

> **变更**: 不再直接访问 `useWaypointStore`，改为通过 `projectList: string[]` prop 接收数据。

---

### 2.11 ThemeToggleButton.tsx

**路径**: `packages/suite-base/src/spikive/components/ThemeToggleButton.tsx` (30 行)

**行为**: 切换 `AppSetting.COLOR_SCHEME` 在 `"light"` 和 `"dark"` 之间

**调用位置**: `Workspace.tsx` → `leftHeaderActions` prop

---

## 3. MultiRobotSidebar 模块

### 3.1 types.ts

**路径**: `packages/suite-base/src/components/MultiRobotSidebar/types.ts`

```typescript
type ConnectionStatus = "connecting" | "connected" | "slow" | "disconnected" | "error";

interface RobotEntry {
  connectionId: string; // 前端连接/卡片实例 ID
  droneId: string;      // 唯一业务 drone_id (如 "1")
  url: string;          // WebSocket URL
  status: ConnectionStatus;
  latencyMs?: number;   // WebSocket 握手延迟
  errorMessage?: string;
}

```

### 3.2 useRobotConnections.ts

**路径**: `packages/suite-base/src/components/MultiRobotSidebar/useRobotConnections.ts`

**Store State**:

```typescript
{
  robots: RobotEntry[];
  activeDroneId?: string;
  visualDroneId?: string;
  visualConnectionId?: string;
  visualRouteVersion: number;
}
```

**Actions**:

| Action | 说明 |
| --- | --- |
| `addRobot(url, droneId)` | 添加已通过 Manager `drone_id` 握手的机器人 (URL 去尾斜杠标准化, 互斥检查: URL + droneId 唯一) |
| `removeRobot(connectionId)` | 移除连接/卡片；如果移除 active drone，则清空 active |
| `setActiveDroneId(droneId)` | 统一处理卡片 Select、3D robotModel 等选择/控制目标变更 |
| `updateStatus(connectionId, status, latencyMs?)` | 通过连接实例 ID 更新连接状态和延迟 |

**内部函数**: `normalizeUrl(url)` — URL 标准化 (去尾斜杠); `generateConnectionId()` — 前端连接实例 ID 生成

> **ID 约束**: `connectionId` 不能拼 ROS topic，`droneId` 不能作为连接实例 key。SelectObject 面板只读 `activeDroneId`，不能从 `selected_id`、marker id 或 `renderable.name` 推 drone id。

### 3.3 useWebSocketMonitor.ts

**路径**: `packages/suite-base/src/components/MultiRobotSidebar/useWebSocketMonitor.ts`

**配置常量**:

| 常量 | 值 | 说明 |
| --- | --- | --- |
| `PING_INTERVAL_MS` | 3000 | 探测间隔 (ms) |
| `PING_TIMEOUT_MS` | 3000 | 探测超时 (ms) |
| `SLOW_THRESHOLD_MS` | 500 | 慢连接阈值 (ms) |

**行为**: 为每个 robot 维护周期性 WebSocket 握手探测，测量延迟，更新 `ConnectionStatus`

### 3.4 index.tsx (MultiRobotSidebar)

**路径**: `packages/suite-base/src/components/MultiRobotSidebar/index.tsx`

**内部函数**: `probeWebSocket(url: string): Promise<void>` — 添加机器人前的连接预检

**调用的 hooks**:
- `useActiveDroneRouting()` — drone_id 路由
- `useWebSocketMonitor()` — 健康监控

### 3.5 RobotCard.tsx

**Props**: `{ robot: RobotEntry, isActive, onSelectDrone, onRemove }`

**功能**: 状态指示灯 (绿/黄/红), 延迟显示 (ms), Select Radio, 默认开启但禁用的 Visual 图标, 删除确认

### 3.6 AddRobotDialog.tsx

**Props**: `{ open, onClose, onConnect: (url, droneId) => void }`

**内部验证**: `validateDroneId(v: string)` — 纯数字校验; `validateUrl(v: string)` — ws:// 或 wss:// 校验

**默认值**: URL = `ws://192.168.1.10:8765`, droneId = `"1"`

---

## 4. Lichtblick 修改点详表

### 4.1 Renderer.ts

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/Renderer.ts`

| 新增/修改 | 位置 | 签名 | 说明 |
| --- | --- | --- | --- |
| 新增方法 | ~L1062 | `getSelectedRenderableInfo(): { topic, details } \| undefined` | 返回当前选中 renderable 的 topic 和详细信息 |
| 新增私有方法 | ~L1620 | `#isRenderablePickable(renderable: Renderable): boolean` | 检查 renderable 的 topic 是否标记为 pickable |
| 新增私有方法 | ~L1426 | `#hideNonPickableRenderables(): Renderable[]` | pick 前临时隐藏 non-pickable，返回被隐藏列表 |
| 修改 | ~L1456 | click handler | 调用 hideNonPickableRenderables() 后 pick，再恢复 |
| 修改 | ~L1502 | hover handler | 同上 |

### 4.2 publish.ts

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/publish.ts`

| 新增 | 位置 | 名称 | 说明 |
| --- | --- | --- | --- |
| 常量 | L83-L94 | `GoalSetDatatypes: Map<string, MessageDefinition>` | `quadrotor_msgs/GoalSet` 的 datatype 定义 |
| 函数 | L96-L101 | `makeGoalSetMessage(droneId: number, position: Point): GoalSetMsg` | 构造 GoalSet 消息 `{ drone_id, goal: [x,y,z] }` |
| 常量 | L106-L119 | `WaypointMarkerDatatypes: Map<string, MessageDefinition>` | `visualization_msgs/MarkerArray` 的 datatype 定义 |
| 函数 | L135-L228 | `makeWaypointMarkerArray(waypoints: Waypoint[], frameId: string): MarkerArrayMsg` | 构造航点可视化 MarkerArray (DELETEALL + SPHERE + TEXT + LINE_STRIP) |

### 4.3 ThreeDeeRender.tsx

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/ThreeDeeRender.tsx` (~1200 行)

| 新增/修改 | 位置 | 说明 |
| --- | --- | --- |
| import | L37-39 | `TOPIC_CONFIG, WAYPOINT_COLORS, extractDroneIdFromTopic, TELEMETRY_TOPICS` from topicConfig |
| import | L40-42 | `useDroneTelemetryStore`, `useSceneModeStore`, `useWaypointStore` |
| import | L56-57 | `GoalSetDatatypes, makeGoalSetMessage` from publish |
| 读取 Store | L645-651 | `sceneMode`, `updateOdom`, `setWaypointsFromMarkers`, `setProjectList`, `setExecState`, `updateBattery` |
| 动态订阅 (所有模式) | L664-690 | 正则订阅: waypoint_markers + waypoint_project_list + waypoint_exec_state (所有模式共享) |
| 动态订阅 (mapping only) | L691-703 | mapping 模式: 正则 `/^\/drone_\w+_visual_slam\/odom$/` 匹配所有 odom topic |
| 动态订阅 (telemetry) | L705-715 | 所有模式: 订阅 `TELEMETRY_TOPICS.battery` |
| 消息拦截 (markers) | L795-845 | **所有模式**: 正则 `/^\/drone_\d+_waypoint_markers$/` → 颜色覆盖 + `setWaypointsFromMarkers(droneId, waypoints)` |
| 消息拦截 (project list) | L848-860 | **所有模式**: 正则 `/^\/drone_\d+_waypoint_project_list$/` → JSON 解析 → `setProjectList(droneId, projects)` |
| 消息拦截 (exec state) | L862-875 | **所有模式**: 正则 `/^\/drone_\d+_waypoint_exec_state$/` → `setExecState(droneId, state)` |
| 消息拦截 (odom) | L877-890 | **mapping 模式**: 正则匹配 → `extractDroneIdFromTopic` → `updateOdom(droneId, pos)` |
| 消息拦截 (battery) | L895-903 | 所有模式: 拦截 battery 消息 → `updateBattery(voltage)` |
| Ref 定义 | L969 | `publishDroneIdRef = useRef<string \| undefined>(undefined)` |
| advertise | L989-998 | GoalSet topic: `TOPIC_CONFIG.publish.goalWithId` (`/goal_with_id`) |
| unadvertise | L1000-1005 | cleanup 全部 publish topic |
| lock droneId | L1013-1015 | publish 工具启动时从选中对象锁定 droneId |
| re-advertise | L1034-1043 | publish submit 时重新 advertise (含 GoalSet) |
| GoalSet publish | L1056-1067 | `makeGoalSetMessage(droneId, position)` → `context.publish()` |

> **变更 (Commit 11)**: `waypoint_markers`、`waypoint_project_list` 订阅和拦截从 mapping-only 提升到所有模式。新增 `waypoint_exec_state` 订阅和拦截。`odom` 订阅和拦截仍保留在 mapping-only。`setExecState` 被添加到 useEffect 依赖数组。

### 4.4 Interactions.tsx

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/Interactions/Interactions.tsx`

| 新增/修改 | 位置 | 说明 |
| --- | --- | --- |
| import | L27-31 | DroneControlPanel, WaypointExecPanel, WaypointPanel, extractDroneIdFromRobotModelTopic, useSceneModeStore, useWaypointStore |
| droneId 提取 | L77 | 只从 robotModel topic 执行 `extractDroneIdFromRobotModelTopic(topic)` |
| active 写入 | L90-94 | robotModel 选中后调用 `setActiveDroneId(droneId)`；非 robotModel 不写 active |
| activeDroneId | L87 | SelectObject、控制、航点、GoalSet 只读 store 中的 `activeDroneId` |
| hasWaypoints | L91-93 | `useWaypointStore(s => tables[activeDroneId]?.waypoints.length > 0)` |
| maxHeight 条件 | L108 | `isMapping \|\| hasWaypoints ? undefined : 240` |
| 条件渲染 | L110-135 | `isMapping ? <WaypointPanel> : <><DroneControlPanel/>{hasWaypoints && <WaypointExecPanel/>}</>` |

### 4.5 settings.ts

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/settings.ts`

| 新增 | 位置 | 说明 |
| --- | --- | --- |
| 字段 | ~L25 | `BaseSettings.pickable?: boolean` — 控制 topic 层是否参与 GPU pick |

### 4.6 defaultLayout.ts

**路径**: `packages/suite-base/src/providers/CurrentLayoutProvider/defaultLayout.ts`

全文重写为 Spikive 锁定布局：
- Panel ID: `"3D!spikive3d"`
- 6 个核心可视化 topic 配置 + pickable 标记 (仅 robot model 为 pickable)
- Camera preset: 俯视角度，followTf = TOPIC_CONFIG.followTf
- Publish 配置: topic 名称来自 TOPIC_CONFIG

### 4.7 Workspace.tsx

**路径**: `packages/suite-base/src/Workspace.tsx`

| 新增/修改 | 位置 | 说明 |
| --- | --- | --- |
| import | L40-41 | SceneSelectionDialog, ThemeToggleButton |
| 左侧边栏 | L358-364 | 仅保留 "robots" 标签 (MultiRobotSidebar) |
| 右侧边栏 | L366-369 | 清空 (空 Map) |
| SceneSelectionDialog | L517 | 渲染阻塞式场景选择对话框 |
| ThemeToggleButton | L534 | 作为 leftHeaderActions |
| DataSourceDialog | L569-570 | 禁用启动数据源对话框 |

### 4.8 其他修改

| 文件 | 修改 |
| --- | --- |
| `Sidebars/index.tsx` | +hideClose prop, +headerActions prop |
| `Sidebars/types.ts` | +hideClose, +headerActions 类型定义 |
| `NewSidebar.tsx` | +hideClose, +headerActions 实现 |
| `WorkspaceContext.ts` | +LeftSidebarItemKeys 添加 "robots" |
| `WorkspaceContextProvider.tsx` | 默认左侧栏改为 "robots" |
| `FoxgloveWebSocketPlayer/index.ts` | +advertise/publish debug logging |
| `RendererOverlay.tsx` | +透传 publish/advertise/unadvertise 到 Interactions |
| `web/src/entrypoint.tsx` | +import spikiveGlobalOverrides.css |

---

## 5. ROS 消息格式

### 5.1 controller_msgs/cmd

**用途**: 飞行控制指令
**发布 topic**: `/control`
**发布者**: DroneControlPanel

```text
std_msgs/Header header
  uint32 seq
  time stamp
  string frame_id

uint8 cmd
  # 1 = TAKEOFF  (起飞)
  # 2 = LAND     (降落)
  # 3 = RETURN   (返航)
  # 4 = CONTINUE (继续)
  # 5 = STOP     (急停)
```

### 5.2 quadrotor_msgs/GoalSet

**用途**: 向 EGO-Planner 发送目标点
**发布 topic**: `/goal_with_id`
**发布者**: ThreeDeeRender (publish pose 工具)

```text
int16 drone_id       # 目标无人机 ID
float32[3] goal      # 目标坐标 [x, y, z] (world frame, 单位: 米)
```

### 5.3 controller_msgs/DroneState

**用途**: 无人机状态反馈 (后端内部使用)
**topic**: `/drone_{id}_state`
**订阅者**: waypoint_recorder.py (检测 `tookoff` 和 `reached`)

```text
std_msgs/Header header
bool tookoff    # 是否已起飞
bool landed     # 是否已降落
bool reached    # 是否到达目标点
bool returned   # 是否已返航
```

> **注意**: DroneState 目前由后端 waypoint_recorder 内部订阅，前端不直接订阅。后端通过 `waypoint_exec_state` topic 将执行状态摘要发布给前端。

### 5.3b 航线执行消息

#### /drone_{id}_waypoint_exec_state

**用途**: 航线执行状态推送 (后端 → 前端)
**消息类型**: `std_msgs/String` (latched)
**发布者**: waypoint_recorder.py
**拦截者**: ThreeDeeRender → `setExecState(droneId, state)`

```text
string data    # "idle" 或 "executing"
```

#### /drone_{id}_start_waypoint_exec

**用途**: 开始航线执行命令 (前端 → 后端)
**消息类型**: `std_msgs/Empty`
**发布者**: WaypointExecPanel

#### /drone_{id}_stop_waypoint_exec

**用途**: 停止航线执行命令 (前端 → 后端)
**消息类型**: `std_msgs/Empty`
**发布者**: DroneControlPanel (handleAbort), WaypointExecPanel

### 5.4 visualization_msgs/MarkerArray

**用途**: 航点可视化标记
**发布 topic**: `/drone_{id}_waypoint_markers` (per-drone)
**发布者**: 后端 (根据前端通过 `/drone_{id}_add_waypoint` 等操作 topic 触发)
**颜色覆盖**: ThreeDeeRender 拦截后重写颜色 (WAYPOINT_COLORS)

```text
visualization_msgs/Marker[] markers
  # DELETEALL (type=3, action=3): 清除旧标记
  # SPHERE    (type=2): 航点球体, 前端覆盖为 Spikive 橙 #EF833A, 0.3m
  # TEXT_VIEW_FACING (type=9): 航点编号, 前端覆盖为白色, 0.3m
  # LINE_STRIP (type=4): 航点连线, 前端覆盖为紫色 #9C27B0, 0.05m 线宽
```

### 5.5 nav_msgs/Odometry (订阅/拦截)

**用途**: 无人机里程计 (位置 + 姿态 + 速度)
**topic**: `/drone_{id}_visual_slam/odom`
**拦截方式**: ThreeDeeRender 消息循环中正则匹配

```text
std_msgs/Header header
string child_frame_id
geometry_msgs/PoseWithCovariance pose
  geometry_msgs/Pose pose
    geometry_msgs/Point position    ◄── 拦截提取: x, y, z
      float64 x
      float64 y
      float64 z
    geometry_msgs/Quaternion orientation
  float64[36] covariance
geometry_msgs/TwistWithCovariance twist
```

### 5.6 项目管理消息 (std_msgs/String, JSON payload)

**用途**: 航点项目的保存、加载、删除、排序和列表同步
**消息类型**: 统一使用 `std_msgs/String`，`data` 字段承载不同格式的 payload

```text
std_msgs/String
  string data    # JSON 或纯文本 payload
```

**各 Topic 的 payload 格式**:

> 所有航点管理 topic 均为 per-drone 格式 `/drone_{id}_<base>`。后端通过 topic 中的 drone_id 前缀识别目标无人机，无需额外 `_drone_id` 参数。

| Topic | 方向 | data 内容 | 示例 |
| --- | --- | --- | --- |
| `/drone_{id}_save_waypoints` | 前端→后端 | 项目名 (纯文本) | `"route_A"` |
| `/drone_{id}_load_waypoints` | 前端→后端 | 项目名 (纯文本) | `"route_A"` |
| `/drone_{id}_delete_waypoint_project` | 前端→后端 | 逗号分隔的项目名 | `"route_A,route_B"` |
| `/drone_{id}_reorder_waypoints` | 前端→后端 | JSON: 新航点顺序 | `'{"order": [2, 3, 1, 4]}'` |
| `/drone_{id}_waypoint_project_list` | 后端→前端 | JSON: 可用项目列表 | `'{"projects": ["route_A", "test_1"]}'` |

**航点操作 Topic** (payload 格式不同):

| Topic | 消息类型 | 方向 | payload | 示例 |
| --- | --- | --- | --- | --- |
| `/drone_{id}_add_waypoint` | `geometry_msgs/PoseStamped` | 前端→后端 | PoseStamped (含 position + orientation) | `{ header: {...}, pose: { position: {x, y, z}, orientation: {x:0, y:0, z:0, w:1} } }` |
| `/drone_{id}_remove_waypoint` | `std_msgs/Int32` | 前端→后端 | 航点索引号 | `{ data: 2 }` |
| `/drone_{id}_clear_waypoints` | `std_msgs/Empty` | 前端→后端 | 空 | `{}` |
