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
| 状态管理 | Zustand (3 个独立 Store) |
| UI 组件库 | MUI (Material UI) |
| 3D 渲染 | Three.js (Lichtblick Renderer 封装) |
| 通信桥接 | Foxglove Bridge WebSocket → ROS1 |
| 后端节点 | flight_manager / ego_replan_fsm / odom_visualization |
| 消息系统 | ROS1 (controller_msgs, quadrotor_msgs, visualization_msgs) |
| 构建工具 | Yarn Workspaces + Webpack |

## 文档导读

| 文档 | 适用场景 |
| --- | --- |
| [01-architecture-overview.md](./01-architecture-overview.md) | 需要理解系统全貌、设计哲学、架构图 |
| [02-incremental-evolution.md](./02-incremental-evolution.md) | 需要了解每次提交的设计决策和演进逻辑 |
| [03-scenario-autonomous-flight.md](./03-scenario-autonomous-flight.md) | 开发或调试 **自主飞行** 场景 |
| [04-scenario-mapping-waypoint.md](./04-scenario-mapping-waypoint.md) | 开发或调试 **建图打点** 场景 |
| [05-api-reference.md](./05-api-reference.md) | 查找具体函数签名、Store API、消息格式 |
| [drone-id-routing.md](./drone-id-routing.md) | 深入理解 drone_id 路由机制 (已有文档) |

## 文档维护规范

- **新增功能模块** → 更新 `05-api-reference.md` 对应章节
- **新增业务场景** → 新建 `0N-scenario-xxx.md`，在本文件添加导读条目
- **每次 git 提交** → 在 `02-incremental-evolution.md` 末尾追加演进记录
- **架构变更** → 更新 `01-architecture-overview.md` 中的相关图表
