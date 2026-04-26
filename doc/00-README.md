# Spikive-Lichtblick 多机器人地面站 — 开发文档

## 项目概述

| 项目 | 说明 |
| --- | --- |
| 项目名称 | Spikive-Lichtblick |
| 基座版本 | Lichtblick Suite v1.24.3 (MPL-2.0) |
| 核心目标 | 多无人机 SLAM + EGO-Planner 地面站可视化与控制 |
| 部署方式 | 独立地面站 PC，通过 WiFi/Ethernet 连接无人机群 |
| 通信协议 | Foxglove Bridge WebSocket (ws://IP:8765) |

## 技术栈速览

| 层级 | 技术 |
| --- | --- |
| 前端框架 | React 18 + TypeScript |
| 状态管理 | Zustand（按连接、场景、航点、遥测、可视化等领域拆分） |
| UI 组件库 | MUI (Material UI) |
| 3D 渲染 | Three.js (Lichtblick Renderer 封装) |
| 通信桥接 | Foxglove Bridge WebSocket → ROS1 |
| 后端节点 | flight_manager / ego_replan_fsm / odom_visualization / waypoint_recorder |
| 消息系统 | ROS1 (controller_msgs, quadrotor_msgs, visualization_msgs, nav_msgs, std_msgs) |
| 构建工具 | Yarn Workspaces + Webpack |

## 当前 ID 闭环

- `activeDroneId` 是唯一选择/控制目标，卡片 Select 与 3D robotModel 点击都写入它。
- SelectObject 面板、飞控、航点和 GoalSet 只读 `activeDroneId`。
- `visualDroneId` 只负责 3D 显示和 routing；当前单机场景默认开启且不等同控制权。
- `selected_id`、marker `id`、`idFromMessage()`、`renderable.name` 只是渲染对象标识，不能当作 drone id。

## 文档导读

| 文档 | 适用场景 |
| --- | --- |
| [01-architecture-overview.md](./01-architecture-overview.md) | 需要理解系统全貌、设计哲学、架构图 |
| [02-incremental-evolution.md](./02-incremental-evolution.md) | 需要了解每次提交的设计决策和演进逻辑 |
| [03-scenario-autonomous-flight.md](./03-scenario-autonomous-flight.md) | 开发或调试 **自主飞行** 场景 |
| [04-scenario-mapping-waypoint.md](./04-scenario-mapping-waypoint.md) | 开发或调试 **建图打点** 场景 |
| [05-api-reference.md](./05-api-reference.md) | 查找具体函数签名、Store API、消息格式 |
| [06-scenario-waypoint-execution.md](./06-scenario-waypoint-execution.md) | 开发或调试 **航线执行** 功能 (自主飞行模式下加载并自动执行航线) |
| [drone-id-routing.md](./drone-id-routing.md) | Select/Visual 边界、drone_id 路由、渲染效率与鲁棒性策略 |

## 文档维护规范

- **新增功能模块** → 更新 `05-api-reference.md` 对应章节
- **新增业务场景** → 新建 `0N-scenario-xxx.md`，在本文件添加导读条目
- **每次 git 提交** → 在 `02-incremental-evolution.md` 末尾追加演进记录
- **架构变更** → 更新 `01-architecture-overview.md` 中的相关图表
