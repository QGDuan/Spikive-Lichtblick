# 05 API 参考手册

> **注意**: 行号对应当前工作树状态 (2026-04-12)，后续提交可能导致行号偏移。

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
│  │  │  └───────────────────┘  └──────────────────┘              │   │   │
│  │  │           ▲                      ▲                        │   │   │
│  └──┼───────────┼──────────────────────┼────────────────────────┘   │   │
│     │           │                      │                            │   │
│  ┌──┼───────────┼──────────────────────┼────────────────────────┐   │   │
│  │  │           │    spikive/components/                         │   │   │
│  │  │           │                      │                        │   │   │
│  │  │  ┌────────┴──────────┐  ┌────────┴──────────┐            │   │   │
│  │  │  │SceneSelection     │  │ WaypointPanel     │            │   │   │
│  │  │  │Dialog.tsx         │  │ .tsx              │            │   │   │
│  │  │  └───────────────────┘  └───────────────────┘            │   │   │
│  │  │                                                          │   │   │
│  │  └──┐  ┌──────────────────┐  ┌──────────────────┐          │   │   │
│  │     │  │DroneControlPanel │  │ThemeToggleButton  │          │   │   │
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
│  └──────────────────┘  └────────────────┘  └──────────────────┘  │   │
│                                                                   │   │
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

**路径**: `packages/suite-base/src/spikive/config/topicConfig.ts` (99 行)

**导出清单**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `DEFAULT_DRONE_ID` | `string` ("1") | 默认 drone_id |
| `DroneTopics` | `type` | `{ pointCloud, optimalTrajectory, goalPoint, robotModel, path, odom }` |
| `droneTopics(droneId: string)` | `function → DroneTopics` | 输入 drone_id，返回完整 topic 路径映射 |
| `droneBodyFrame(droneId: string)` | `function → string` | 输入 drone_id，返回 TF 帧名 `"base{id}"` |
| `extractDroneIdFromTopic(topic: string)` | `function → string \| undefined` | 从 topic 路径提取 drone_id |
| `CONTROL_TOPIC` | `string` ("/control") | 飞行指令发布 topic |
| `DRONE_COMMANDS` | `object` | `{ TAKEOFF: 1, LAND: 2, RETURN: 3, CONTINUE: 4, STOP: 5 }` |
| `TOPIC_CONFIG` | `object` | 聚合配置: `{ subscribe, publish, followTf }` |

**调用关系**:

| 函数 | 被以下模块调用 |
| --- | --- |
| `droneTopics()` | `useActiveDroneRouting.ts`, `defaultLayout.ts` |
| `droneBodyFrame()` | `useActiveDroneRouting.ts`, `defaultLayout.ts` |
| `extractDroneIdFromTopic()` | `Interactions.tsx`, `ThreeDeeRender.tsx`, `DroneControlPanel.tsx` |
| `CONTROL_TOPIC` | `DroneControlPanel.tsx` |
| `DRONE_COMMANDS` | `DroneControlPanel.tsx` |
| `TOPIC_CONFIG` | `ThreeDeeRender.tsx`, `defaultLayout.ts` |

---

### 2.2 useActiveDroneRouting.ts

**路径**: `packages/suite-base/src/spikive/hooks/useActiveDroneRouting.ts` (207 行)

**导出**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `useActiveDroneRouting()` | `hook → void` | 监听活跃机器人变化，自动重写 3D Panel topic 订阅 |

**内部函数**:

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `ensurePickableFlags` | `(topics: Record, droneId: string) → patched \| undefined` | 确保新 topic 的 pickable 标记正确，返回修补后的配置或 undefined (无需修补) |
| `remapTopics` | `(oldTopics: Record, fromId: string, toId: string) → Record` | 将 3D Panel 配置中的 topic 从 drone_fromId 重写为 drone_toId |

**依赖**:

| 依赖 | 来源 |
| --- | --- |
| `useRobotConnectionsStore` | `MultiRobotSidebar/useRobotConnections.ts` |
| `useCurrentLayoutActions` | Lichtblick 内部 API |
| `droneTopics`, `droneBodyFrame` | `topicConfig.ts` |

**调用位置**: `MultiRobotSidebar/index.tsx` 中调用 `useActiveDroneRouting()`

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

**路径**: `packages/suite-base/src/spikive/stores/useWaypointStore.ts` (169 行)

**导出**:

| 导出名 | 类型 | 说明 |
| --- | --- | --- |
| `Waypoint` | `type` | `{ idx: number, x: number, y: number, z: number }` |
| `OdomPosition` | `type` | `{ x: number, y: number, z: number }` |
| `ZMode` | `type` | `"none" \| "override" \| "offset"` |
| `DroneWaypointState` | `type` | `{ waypoints, zMode, overrideZValue, zOffsetValue }` |
| `useWaypointStore` | `Zustand Store` | 航点数据全局状态 |

**State**:

```typescript
{
  tables: Record<string, DroneWaypointState>;  // droneId → 航点状态
  latestOdom: Record<string, OdomPosition>;    // droneId → 最新 odom 位置
}
```

**Actions**:

| Action | 签名 | 说明 |
| --- | --- | --- |
| `getOrCreate` | `(droneId: string) → DroneWaypointState` | 获取或初始化该无人机的航点状态 |
| `addWaypoint` | `(droneId: string, x: number, y: number, z: number) → void` | 添加航点 (自动 applyZ + 编号) |
| `removeWaypoint` | `(droneId: string, idx: number) → void` | 按索引删除航点，重新编号 |
| `deleteLast` | `(droneId: string) → void` | 删除最后一个航点 |
| `updateZSettings` | `(droneId: string, settings: Partial<ZSettings>) → void` | 更新 Z 轴模式/值 |
| `clearWaypoints` | `(droneId: string) → void` | 清空该无人机所有航点 |
| `updateOdom` | `(droneId: string, pos: OdomPosition) → void` | 更新最新 odom 位置 (高频) |

**内部函数**:

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `defaultDroneState` | `() → DroneWaypointState` | 返回默认航点状态 (zMode="override", overrideZ=1.5) |
| `applyZ` | `(actualZ: number, state: DroneWaypointState) → number` | 根据 zMode 计算最终 Z 值 |

---

### 2.5 DroneControlPanel.tsx

**路径**: `packages/suite-base/src/spikive/components/DroneControlPanel.tsx` (183 行)

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

- `useEffect(mount)`: `advertise("/control", "controller_msgs/cmd", { datatypes: CmdDatatypes })`
- `sendCommand(cmd: number)`: `publish("/control", { header: {...}, cmd })`
- `useEffect(unmount)`: `unadvertise("/control")`

**调用位置**: `Interactions.tsx` → `sceneMode === "autonomous-flight"` 时渲染

---

### 2.6 SceneSelectionDialog.tsx

**路径**: `packages/suite-base/src/spikive/components/SceneSelectionDialog.tsx` (95 行)

**Props**: 无

**行为**: MUI Dialog，启动时阻塞 (`disableEscapeKeyDown`)，用户选择模式后调用 `useSceneModeStore.setSceneMode()` 并关闭。

**调用位置**: `Workspace.tsx` 中直接渲染 `<SceneSelectionDialog />`

---

### 2.7 WaypointPanel.tsx

**路径**: `packages/suite-base/src/spikive/components/WaypointPanel.tsx` (330 行)

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

- `useEffect(mount)`: `advertise("/waypoint_markers", "visualization_msgs/MarkerArray", { datatypes: WaypointMarkerDatatypes })`
- `useEffect(waypoints change)`: `makeWaypointMarkerArray(waypoints, "world")` → `publish("/waypoint_markers", markerArray)`
- `handleRecord()`: 读取 `latestOdom[droneId]` → `addWaypoint(droneId, x, y, z)`
- `useEffect(unmount)`: `unadvertise("/waypoint_markers")`

**调用位置**: `Interactions.tsx` → `sceneMode === "mapping-waypoint"` 时渲染

---

### 2.8 ThemeToggleButton.tsx

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
  id: string;           // 内部唯一 ID (UUID)
  droneId: string;      // 用户输入的 drone_id (如 "1")
  url: string;          // WebSocket URL (如 "ws://192.168.1.10:8765")
  status: ConnectionStatus;
  latencyMs?: number;   // WebSocket 握手延迟
  isActive: boolean;    // 是否为当前活跃机器人
  isVisible: boolean;   // 是否显示其数据
  errorMessage?: string;
}
```

### 3.2 useRobotConnections.ts

**路径**: `packages/suite-base/src/components/MultiRobotSidebar/useRobotConnections.ts`

**Store State**:

```typescript
{
  robots: RobotEntry[];
}
```

**Actions**:

| Action | 说明 |
| --- | --- |
| `addRobot(url, droneId)` | 添加机器人 (URL 去尾斜杠标准化, 互斥检查: URL + droneId 唯一) |
| `removeRobot(id)` | 移除机器人 |
| `setActive(id)` | 设置活跃机器人 (排他: 其余全部 isActive=false) |
| `toggleVisibility(id)` | 切换数据可见性 |
| `updateStatus(id, status, latencyMs?)` | 更新连接状态和延迟 |

**内部函数**: `normalizeUrl(url)` — URL 标准化 (去尾斜杠); `generateId()` — UUID 生成

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

**Props**: `{ robot: RobotEntry, onSetActive, onToggleVisibility, onRemove }`

**功能**: 状态指示灯 (绿/黄/红), 延迟显示 (ms), 活跃 Radio, 可见 Toggle, 删除确认

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

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/ThreeDeeRender.tsx`

| 新增/修改 | 位置 | 说明 |
| --- | --- | --- |
| import | L34 | `TOPIC_CONFIG, extractDroneIdFromTopic` from topicConfig |
| import | L35-36 | `useSceneModeStore`, `useWaypointStore` |
| import | L50-57 | `GoalSetDatatypes, makeGoalSetMessage` from publish |
| 读取 Store | L638-640 | `sceneMode`, `updateOdom` |
| 动态订阅 | L644-667 | mapping 模式下额外订阅 `/drone_\w+_visual_slam/odom` |
| 消息拦截 | L730-745 | odom 消息正则匹配 → extractDroneIdFromTopic → updateOdom() |
| Ref 定义 | L841 | `publishDroneIdRef = useRef<string \| undefined>(undefined)` |
| advertise | L866-870 | GoalSet topic: `/goal_with_id` |
| unadvertise | L876 | cleanup GoalSet topic |
| lock droneId | L885-887 | publish 工具启动时锁定 droneId |
| re-advertise | L913-915 | publish submit 时重新 advertise |
| GoalSet publish | L928-942 | `makeGoalSetMessage(droneId, position)` → `context.publish()` |

### 4.4 Interactions.tsx

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/Interactions/Interactions.tsx`

| 新增/修改 | 位置 | 说明 |
| --- | --- | --- |
| import | L27-30 | DroneControlPanel, WaypointPanel, extractDroneIdFromTopic, useSceneModeStore |
| droneId 提取 | L77 | `extractDroneIdFromTopic(topic)` |
| sceneMode 读取 | L78 | `useSceneModeStore(s => s.sceneMode)` |
| lastDroneIdRef | L80-85 | mapping 模式下持久化选中的 droneId |
| activeDroneId | L87-89 | `droneId ?? (isMapping ? lastDroneIdRef.current : undefined)` |
| 条件渲染 | L102-121 | `isMapping ? <WaypointPanel> : <DroneControlPanel>` |

### 4.5 settings.ts

**路径**: `packages/suite-base/src/panels/ThreeDeeRender/settings.ts`

| 新增 | 位置 | 说明 |
| --- | --- | --- |
| 字段 | ~L25 | `BaseSettings.pickable?: boolean` — 控制 topic 层是否参与 GPU pick |

### 4.6 defaultLayout.ts

**路径**: `packages/suite-base/src/providers/CurrentLayoutProvider/defaultLayout.ts`

全文重写为 Spikive 锁定布局：
- Panel ID: `"3D!spikive3d"`
- 5 个 topic 配置 + pickable 标记 (仅 robot model 为 pickable)
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

**用途**: 无人机状态反馈 (后端 → 前端，尚未订阅)
**topic**: `/drone_{id}_state`

```text
std_msgs/Header header
bool tookoff    # 是否已起飞
bool landed     # 是否已降落
bool reached    # 是否到达目标点
bool returned   # 是否已返航
```

### 5.4 visualization_msgs/MarkerArray

**用途**: 航点可视化标记
**发布 topic**: `/waypoint_markers`
**发布者**: WaypointPanel

```text
visualization_msgs/Marker[] markers
  # DELETEALL (type=3, action=3): 清除旧标记
  # SPHERE    (type=2): 航点球体, 橙色, 0.3m
  # TEXT_VIEW_FACING (type=9): 航点编号, 黄色, 0.3m
  # LINE_STRIP (type=4): 航点连线, 绿色, 0.05m 线宽
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
