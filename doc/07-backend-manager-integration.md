# Backend Manager Start/Stop 集成

## 1. 目标

Spikive-Lichtblick 的 Manager 集成只负责“卡片对应机器人后端模块的启动/停止”。它不参与 SelectObject、飞控目标、3D 可视化目标，也不改变 `activeDroneId` 或 `visualDroneId`。

## 2. 添加卡片握手

添加卡片必须同时满足两个条件：

1. Foxglove Bridge URL 可以建立 WebSocket 连接。
2. 手动输入的 `Drone ID` 与 `/drone_{id}_auto_manager_status` 消息中的 `drone_id` 一致。

流程：

```text
Add Robot
  -> probe WebSocket
  -> subscribe /drone_{id}_auto_manager_status
  -> receive astro_manager/AutoManager
  -> check message.drone_id === input droneId
  -> add RobotEntry { connectionId, droneId, url }
```

未握手成功的 id 不进入卡片列表。这样 `RobotEntry.droneId` 是用户意图和后端事实一致后的唯一业务 id。

## 3. Topic 协议

Manager status:

```text
/drone_{id}_auto_manager_status
astro_manager/AutoManager
```

前端只接受 `message.drone_id === RobotEntry.droneId` 的状态。状态灯固定显示：

- Drivers: `MavROS`, `Lidar`
- Tasks: `SLAM`, `Planner`

状态值：`0=stopped/unknown`，`1=partial`，`2=ready`。

Manager command:

```text
/drone_{id}_command_topic
astro_manager/Command.command_type = "start_all" | "shutdown_all"
astro_manager/Command.extra_data = {"request_id":"...","seq":N,"drone_id":"id"}
```

前端不发布 restart。后端收到 restart 类命令应按 unknown command 拒绝。

命令发布是单次动作，不做自动重发。用户确认 Start/Stop 后，前端生成 `request_id`，发布一次 command，然后等待 status ACK：

```text
RobotCard confirm
  -> Manager command store pendingRequest
  -> 3D bridge publish once
  -> node_manager._on_command() admission guard
  -> accepted command is queued, rejected command records last_error_seq
  -> AutoManager.command.extra_data 回显 request_id
  -> frontend markAcked()
```

如果 ACK 超时或 publish 抛错，前端只恢复按钮并标记失败，不再次 publish。ACK 只代表后端已接收/处理该 request，不代表启动或停止成功；真正能否启动/停止继续由后端 `starting/stopping/is_active/last_error_seq` 决定。

## 4. 安全闭环

前端按钮逻辑：

- Manager offline/stale：禁用。
- `armed=true`：禁用。
- `starting=true` 或 `mode="starting"`：禁用。
- `stopping=true` 或 `mode="stopping"`：禁用。
- `is_active=false`：显示 Start。
- `is_active=true`：显示 Stop。

后端是安全权威。即使前端误触或网络延迟，`node_manager.py` 仍必须在 `_on_command()` 接收阶段拒绝 armed、starting/stopping、队列已有待处理命令、重复 start、空 stop、未知命令，并立即发布 `last_error` / `last_error_seq`。这些被拒绝的命令不进入队列，避免启动过程中收到的 stop 在启动完成后被延迟执行。

后端在 `_on_command()` 成功入队或接收阶段拒绝时，都立即更新 `AutoManager.command` 并发布一次 status，作为“后端已接收/处理该 request”的 ACK；通过 admission guard 的命令随后由 worker 执行状态机。这样前端不会把“发布成功”误当成“后端已接收”，也不会因为网络差而重复发送危险命令。

## 5. ID 边界

Manager Start/Stop 只读卡片自己的 `robot.droneId`：

- 不读 `activeDroneId`。
- 不读 `visualDroneId`。
- 不读 SelectObject。
- 不从 robotModel、点云、path、marker topic 推导 Manager id。
- 不使用 `connectionId` 拼 ROS topic。

这保证“后端启动停止目标”和“当前控制/显示目标”互不影响。

## 6. 构建验证

后端改动消息后需要在机器人端重新构建：

```bash
catkin build
rosmsg show astro_manager/AutoManager
rosmsg show astro_manager/Command
```

`AutoManager` 应包含 `string drone_id` 和 `bool stopping`。`Command` 当前只描述 `start_all` / `shutdown_all`。
