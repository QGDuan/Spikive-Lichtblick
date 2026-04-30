# Drone ID Routing 与 Select/Visual 边界

## 1. 目标

Spikive 前端只允许一套业务选择 id：`activeDroneId`。卡片 Select、3D robotModel 点击、SelectObject 面板、控制面板、航点面板和 GoalSet 都围绕它工作，不能各自解释或维护第二套 id。

当前阶段的关键目标：

- 支持未来多机扩展，但当前单机优先默认可视化成功。
- `connectionId`、`droneId`、`activeDroneId`、`visualDroneId` 各司其职，不混用。
- 3D 点云、轨迹、路径、航点 marker 保持不可选中，不能进入控制选择链路。
- `selected_id`、marker `id`、`idFromMessage()`、`renderable.name` 都属于 Lichtblick 渲染对象层，不能当作 drone id。
- 选择/显示变更都是低频 UI 状态，不进入点云、odom、marker 高频渲染循环。

## 2. ID 类型边界

| 名称 | 来源 | 用途 | 禁止事项 |
| --- | --- | --- | --- |
| `connectionId` | 前端创建卡片时生成 | React key、删除卡片、WebSocket probe 状态 | 不能拼 ROS topic，不能发控制 |
| `droneId` | AddRobotDialog 手动输入并通过 Manager `drone_id` 握手确认；3D active 入口只从 robotModel topic 解析 | `/drone_{id}_...`、`base{id}`、Waypoint store、GoalSet、Manager Start/Stop | 不能当连接实例 id 使用；Manager 不能从 active/visual/selected object 推导 |
| `activeDroneId` | `setActiveDroneId(droneId)` 写入 | 卡片 Select 态、SelectObject 面板、控制/航点面板、GoalSet | 不能由点云、marker、path、trajectory 写入 |
| `visualDroneId` | 添加第一张卡片时初始化；当前单机模式默认开启 | 3D routing、`followTf`、点云设置同步 | 不能作为控制目标 |
| `visualRouteVersion` | Store 内部递增 | 请求 `useActiveDroneRouting()` 重新校验 layout | 不代表业务状态 |
| `selected_id` / marker `id` | Lichtblick/ROS 可视化对象内部字段 | 仅作为渲染对象标识 | 不能当 drone id 使用 |

## 3. 单一 Active 入口

当前 active 写入只有一个 action：

```ts
setActiveDroneId(droneId: string): void
```

入口规则：

- 卡片右上角 Select 点击：调用 `setActiveDroneId(robot.droneId)`。
- 3D robotModel 点击：只从真实 topic `/drone_{id}_odom_visualization/robot` 解析 `droneId`，再调用同一个 setter。
- 卡片 Visual 按钮：当前单机模式默认开启且禁用，只表达“会显示”，不写 active。
- 空白点击、点云、轨迹、路径、航点 marker：不改变 active。

`Interactions.tsx` 只能用 `extractDroneIdFromRobotModelTopic()` 作为 3D 选择入口，不能用通用 `extractDroneIdFromTopic()`，避免点云、路径、航点 topic 误导控制目标。

## 4. SelectObject 数据流

```text
RobotCard Select
  -> setActiveDroneId(robot.droneId)
  -> SelectObject / DroneControlPanel / WaypointPanel / GoalSet 读取 activeDroneId

3D robotModel click
  -> Renderer pick
  -> RendererOverlay selectedObject.interactionData.topic = renderable.topic
  -> extractDroneIdFromRobotModelTopic(topic)
  -> setActiveDroneId(droneId)
  -> 卡片 Select 态与控制面板同步

PointCloud / Path / Trajectory / Waypoint marker / blank click
  -> 不解析 droneId
  -> 不写 activeDroneId
```

多对象重叠菜单必须保留真实 `renderable`，并用 `renderable.topic` 作为 topic identity。`renderable.name` 只能作为调试显示 fallback，不能拿来推 drone id。

## 5. 闭环数据流

```text
AddRobotDialog
  -> addRobot(url, droneId)
  -> RobotEntry { connectionId, droneId, url, status }
  -> if visualDroneId is empty: visualDroneId = droneId

3D Visual routing
  -> read visualDroneId (fallback: first card droneId)
  -> useActiveDroneRouting()
  -> configById["3D!spikive3d"].topics + followTf
  -> mounted ThreeDeeRender renderer config + follow frame

Control / Waypoint / GoalSet
  -> read activeDroneId only
```

这条闭环把“显示”和“控制”分开：添加卡片后可以默认显示点云和模型，但不会默认获得控制权；用户必须点击卡片 Select 或 3D robotModel 才会写入 `activeDroneId`。

## 5.1 Manager Start/Stop ID 闭环

Manager 生命周期控制只使用卡片自己的 `RobotEntry.droneId`：

```text
AddRobotDialog 手动输入 droneId + url
  -> WebSocket probe 成功
  -> 短订阅 /drone_{id}_auto_manager_status
  -> message.drone_id === 输入 droneId
  -> addRobot(url, droneId)

RobotCard Start/Stop
  -> read robot.droneId
  -> publish once /drone_{id}_command_topic: start_all | shutdown_all
  -> extra_data carries {request_id, seq, drone_id}
  -> wait for AutoManager.command.extra_data.request_id ACK
```

Manager status 中的 `drone_id` 只做握手和一致性校验，不作为第二套 id 来源。Start/Stop 不读取 `activeDroneId`、`visualDroneId`、SelectObject、`selected_id` 或 3D topic，避免后端启动停止目标被控制选择或可视化选择误导。

命令闭环采用“单次发布 + 后端 status ACK”，不是重发机制。前端确认点击后只发布一次；后端 `_on_command()` 会先做接收阶段校验，armed、starting/stopping、重复 start、空 stop、未知命令直接拒绝且不进入队列。通过校验的命令入队后，或被拒绝的命令记录错误后，后端都会把最近命令写入 `AutoManager.command` 并发布 status。前端收到同一个 `request_id` 后退出等待状态，再继续按后端权威的 `starting/stopping/is_active/last_error_seq` 渲染。ACK 只代表后端已接收/处理该 request，不代表启动或停止成功；ACK 超时只恢复 UI 并标记失败，不自动再次发布，避免网络抖动时产生重复启动/停止。

## 6. 为什么不引入 selectId 或派生 active 对象

当前只保留一个业务选择 id，原因是：

- `activeDroneId` 已经能表达 SelectObject、控制、航点和 GoalSet 的唯一目标。
- 新增 `selectId` 会和 `activeDroneId` 形成双主键，未来多机更容易出现状态分叉。
- `connectionId` 是前端实例生命周期，删除卡片和 WebSocket probe 需要它；它不应该污染 ROS topic。
- `visualDroneId` 是显示目标，不能因为默认可视化、状态刷新或高频消息自动变成控制权。
- `selected_id` 是 Lichtblick 原生对象 id，保留原语义更利于调试，不应改造成业务 id。

相比每个组件各自解析 id，当前只有两个身份入口：

- `topicConfig.ts` 提供 `droneTopics()`、`droneBodyFrame()`、`extractDroneIdFromTopic()`、`extractDroneIdFromRobotModelTopic()`。
- `useRobotConnectionsStore.setActiveDroneId()` 统一写入 active。

## 7. 3D Routing 行为

`useActiveDroneRouting()` 只订阅：

- `visualDroneId`
- `visualRouteVersion`

它不读取高频消息。为兼容热更新和旧 store，会从第一张卡片派生一个只读 fallback droneId；selector 返回字符串，连接延迟和卡片 Select 状态不会触发路由。

切换或刷新时：

- 从当前 config 推断现有 drone id。
- 补齐目标 drone 的 6 个核心可视化 topic：`pointCloud`、`optimalTrajectory`、`goalPoint`、`robotModel`、`path`、`waypointMarkers`。
- 目标 topic 强制 `visible: true`。
- 非 robotModel 强制 `pickable: false`。
- 其他 drone 的核心 3D topic 从当前 panel config 中移除，保持单 panel 单 visual drone。
- `followTf` 写为 `base{id}`。
- 配置无变化时不调用 `savePanelConfigs()`。

实现分两层：

- `useActiveDroneRouting()` 更新 layout cache，保证刷新、重开页面、panel remount 后仍然是同一个 visual drone 配置。
- `ThreeDeeRender` 在已挂载 renderer 内直接应用同一份 `buildActiveDronePanelConfig()`，保证当前 3D panel 跟随 `visualDroneId`，不依赖 panel remount。

点云设置同步：

- 新建或修复 `/drone_{id}_cloud_registered` 时必须带完整点云渲染参数：`visible`、`pickable=false`、`colorField`、`colorMode`、`colorMap`、`decayTime`、`explicitAlpha`、`pointSize`。
- `ThreeDeeRender` 的 visualization settings 只按 visual drone topic 和当前 config 中的点云 topic 写入，不再因为 renderer topic 列表尚未 ready 而回退覆盖 `/drone_1_cloud_registered`。
- 点云设置同步只在 visual/config/visualization settings 变化时执行，不能放入高频 message loop。

## 8. 渲染效率与鲁棒性

- 不 remount 3D Panel。
- 不重新连接 WebSocket。
- 不重新 `selectSource()`。
- 不在 `ThreeDeeRender` 高频 message loop 里写 active。
- 不把 clicked/selected object id 写入 Zustand store。
- `setActiveDroneId()` 对相同值跳过 `setState`，避免卡片闪烁和 React render loop。
- Visual 默认开启且禁用，不产生重复 route refresh；routing 只在可视化目标或配置需要修复时运行。
- WebSocket probe 用 `connectionId` 更新状态，不能用 `droneId`。
- 正则放在模块级常量，避免在高频消息循环重复创建。
- `Renderer` 和 layout 双层保证非 robotModel 不可 pick，避免点云点击回归。

## 9. 潜在开放性 bug

- 多机未来启用后，`visualDroneId` 需要明确切换入口；当前 Visual 禁用适合单机，不适合多机同时显示。
- 旧 cached layout 可能残留错误 topic 或 `pickable`，必须保留 `ensurePickableFlags()` 和 routing 修复逻辑。
- 如果用户未 Select 但尝试控制，应保持控制面板不出现，避免默认可视化等同默认控制。
- 如果 robotModel topic 不存在，3D 点击不能选择，只能通过卡片 Select 进入控制。
- 如果后端 TF 不发布 `world -> base{id}`，点云可能存在但相机跟随失败。
- 如果未来新增可视化 topic，必须先进入 `topicConfig.ts` 和 routing 白名单，再决定是否 pickable。

## 10. 调试路径

3D Panel 空白：

1. 确认已添加卡片，`visualDroneId` 或第一张卡片 fallback 是目标 drone。
2. 确认 Visual 按钮是禁用但开启状态；它不负责点击刷新。
3. 检查 3D panel config 是否包含 `/drone_{id}_cloud_registered` 等 6 个 topic。
4. 检查这些 topic 是否 `visible: true`，点云是否没有被缓存 config 设成不可见。
5. 检查 `followTf` 是否为 `base{id}`，ROS 侧是否发布 `world -> base{id}`。
6. 检查当前 mounted renderer config 是否也已切到目标 drone；只改 layout cache 不够。
7. 检查点云消息 `header.frame_id`。当前后端 `/drone_{id}_cloud_registered` 通常是 `world`，应能通过 `world -> base{id}` 显示。

Active 混乱：

1. 查是否有组件绕过 `setActiveDroneId()` 写 active。
2. 查是否把 `connectionId` 当作 `droneId` 使用。
3. 查 3D selected object topic 是否不是 robotModel。
4. 查是否把 `visualDroneId` 当作控制目标使用。
5. 查是否从 `selected_id`、marker `id`、`idFromMessage()` 或 `renderable.name` 推 drone id。

点云可点击：

1. 查 `Renderer.ts` 的 pickable 过滤。
2. 查 3D config 中非 robotModel topic 是否被设成 `pickable: false`。
3. 不要引入 `fix/performance-and-publish` 中会让点云参与 pick 的回归。
