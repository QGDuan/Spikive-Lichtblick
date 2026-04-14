我现在要做一套多机器人定位，建图，规划用的可视化系统：
你给我做制定开发原则，开发计划。作为Claude的Skill指导claude的开发
你要仔细阅读依赖，

依赖：
前端可视化组件：Lichtblick(https://github.com/lichtblick-suite/lichtblick.git)
后端机器人的实现：
slam：https://github.com/QGDuan/LSDC_SLAM
Egoplanner v2：https://github.com/ZJU-FAST-Lab/EGO-Planner-v2.git
我自己写的上位机模块启动软件（管理驱动，定位，规划的启动逻辑）

1、现有机器人业务的几种模式：
场景一：机器人自主飞行场景-机器人根据地面站发送的/业务逻辑执行飞行任务
    两种模式：
        交互式自主飞行模式:
            a.启动定位及定位确认
            b.启动Ego及起飞
            c.人通过地面站，点击3DPanel上的位置（使用Lichtblick自带的2D navgation pose工具），飞机根据Ego的航线自主规划过去
            d.降落
        固定航线规划模式
            a.启动定位及定位确认
            b.地面站加载路径规划的json文件给飞机，并成功可视化路径节点和节点之间连线
            c.启动Ego及起飞
            d.执行路径规划任务，两路径点之间由ego规划任务
            e.降落
    注意：
    定位确认中有localization模式，需要手动输入人眼估计的坐标或者用Lichtblick自带的Pose Estimate的工具
    定位中也有不带Localization的模式，就是普通的定位
场景二：建图及打点场景：
a.启动定位及定位确认
b.使用Lichtblick自带的2D navgation pose工具打点


我的需求

1、前端界面部分：本质上是对Lichtblick的可配置界面做“减法”; 根据几种场景或者模式，固定可视化的数据类型，可视化效果。要用白色极简风格的效果
2、暂时只留3D界面，隐藏掉Lichtblick的所有可点击的界面
3、topic名称先通过config固定，不暴露在外部，现阶段每个机器人的topic暂时一样，后面会有相关逻辑。
4、实现多机点云可视化在同一个Panel中，左侧要有列表操作各个机器人，选择是否可视化这个机器人的数据。3Dpanel中的2D navgation要和选择的机器人联动。这个操作逻辑可以参考Ego-Swarm的rviz逻辑设计
5、机器人和可视化地面站都在一个局域网中，地面站是一个单独的机器
6、先只可视化SLAM的点云/path/odomtry.planner的goalpoint和优化的路径点

---

## ROS Topic 参考

> 命名规则：每个无人机的 topic 以 `/drone_{id}_` 为前缀（如 `/drone_1_visual_slam/odom`）。
> 前端配置见 `packages/suite-base/src/spikive/config/topicConfig.ts`。

### 1. SLAM & 里程计

| Topic | 消息类型 | 方向 | 发布者 | 说明 |
|---|---|---|---|---|
| `/drone_{id}_visual_slam/odom` | `nav_msgs/Odometry` | 后端 → 前端 | LSDC_SLAM | 视觉 SLAM 输出的 6DOF 位姿，所有下游节点的里程计来源 |
| `/drone_{id}_cloud_registered` | `sensor_msgs/PointCloud2` | 后端 → 前端 | LSDC_SLAM | 配准后的全局点云，3D Panel 中可视化的地图数据 |

### 2. 路径规划 (EGO-Planner)

| Topic | 消息类型 | 方向 | 发布者 | 说明 |
|---|---|---|---|---|
| `/drone_{id}_ego_planner_node/optimal_list` | `visualization_msgs/Marker` | 后端 → 前端 | ego_planner_node | 优化后的轨迹点序列，前端渲染为路径线 |
| `/drone_{id}_ego_planner_node/goal_point` | `visualization_msgs/Marker` | 后端 → 前端 | ego_planner_node | 当前目标点标记 |
| `/drone_{id}_planning/trajectory` | `traj_utils/PolyTraj` | 后端内部 | ego_planner_node | 多项式轨迹，传给 traj_server 执行（前端不直接使用） |
| `/goal_with_id` | `quadrotor_msgs/GoalSet` | 前端 → 后端 | 前端 3D Panel | 带 drone_id 的目标点，字段：`drone_id (int32)`, `goal[3] (float64)` |
| `/move_base_simple/goal` | `geometry_msgs/PoseStamped` | 前端 → 后端 | 前端 3D Panel | 2D Nav Goal 工具发出的原始目标位姿 |

### 3. 里程计可视化

| Topic | 消息类型 | 方向 | 发布者 | 说明 |
|---|---|---|---|---|
| `/drone_{id}_odom_visualization/robot` | `visualization_msgs/Marker` | 后端 → 前端 | odom_visualization | 无人机 3D 模型 Mesh 标记 |
| `/drone_{id}_odom_visualization/path` | `nav_msgs/Path` | 后端 → 前端 | odom_visualization | 历史运动轨迹 |

### 4. 飞行控制

| Topic | 消息类型 | 方向 | 发布者 | 说明 |
|---|---|---|---|---|
| `/control` | `controller_msgs/cmd` | 前端 → 后端 | 前端侧边栏 | 飞行指令。`cmd` 字段：1=Takeoff, 2=Land, 3=Return, 4=Continue, 5=Stop |
| `/drone_state` | `controller_msgs/DroneState` | 后端 → 前端 | px4ctrl | 飞行状态标志位：`tookoff`, `landed`, `reached`, `returned` (bool) |
| `/mavros/setpoint_raw/local` | `mavros_msgs/PositionTarget` | 后端内部 | px4ctrl | 发送给飞控的位置指令（前端不直接使用） |
| `/mavros/state` | `mavros_msgs/State` | MAVROS | MAVROS | 飞控连接状态与模式 |

### 5. 遥测

| Topic | 消息类型 | 方向 | 发布者 | 说明 |
|---|---|---|---|---|
| `/mavros/battery` | `sensor_msgs/BatteryState` | 后端 → 前端 | MAVROS | 电池状态。前端使用 `voltage` 字段，6S LiPo 阈值：>21V 绿色, 19.8-21V 黄色, <19.8V 红色 |

### 6. 航点管理 (waypoint_recorder)

> 航点 topic 采用 `/drone_{id}_` 前缀，与 SLAM/规划 topic 一致。

| Topic | 消息类型 | 方向 | 发布者 | 说明 |
|---|---|---|---|---|
| `/drone_{id}_waypoint_markers` | `visualization_msgs/MarkerArray` | 后端 → 前端 | waypoint_recorder.py | 航点可视化标记（球体+文字+连线），前端重着色后渲染 |
| `/drone_{id}_waypoint_project_list` | `std_msgs/String` | 后端 → 前端 | waypoint_recorder.py | JSON 格式的已保存项目列表：`{"projects": ["proj1", "proj2"]}` |
| `/drone_{id}_add_waypoint` | `geometry_msgs/PoseStamped` | 前端 → 后端 | 前端 3D Panel | 添加航点（从 2D Nav Goal 拦截坐标） |
| `/drone_{id}_remove_waypoint` | `std_msgs/Int32` | 前端 → 后端 | 前端侧边栏 | 按索引删除航点 |
| `/drone_{id}_clear_waypoints` | `std_msgs/Empty` | 前端 → 后端 | 前端侧边栏 | 清空所有航点 |
| `/drone_{id}_save_waypoints` | `std_msgs/String` | 前端 → 后端 | 前端侧边栏 | 保存航点为项目文件，payload 为项目名称 |
| `/drone_{id}_load_waypoints` | `std_msgs/String` | 前端 → 后端 | 前端侧边栏 | 加载指定项目的航点 |
| `/drone_{id}_delete_waypoint_project` | `std_msgs/String` | 前端 → 后端 | 前端侧边栏 | 删除项目文件 |
| `/drone_{id}_reorder_waypoints` | `std_msgs/String` | 前端 → 后端 | 前端侧边栏 | 重排序航点，JSON 格式的索引数组 |

### 7. 集群通信 (swarm_bridge)

| Topic | 消息类型 | 方向 | 说明 |
|---|---|---|---|
| `/broadcast_traj_from_planner` | `traj_utils/MINCOTraj` | 本机 → 网络 | 本机轨迹广播给集群 |
| `/broadcast_traj_to_planner` | `traj_utils/MINCOTraj` | 网络 → 本机 | 接收其他无人机的轨迹用于避障 |
| `/others_odom` | `nav_msgs/Odometry` | 网络 → 本机 | 其他无人机的里程计（UDP/TCP 桥接） |
| `/goal_user2brig` | `quadrotor_msgs/GoalSet` | 本机 → 网络 | 用户目标广播 |

### 8. 自定义消息类型

| 消息类型 | 包 | 关键字段 |
|---|---|---|
| `quadrotor_msgs/GoalSet` | quadrotor_msgs | `drone_id (int32)`, `goal[3] (float64)` |
| `quadrotor_msgs/PositionCommand` | quadrotor_msgs | `header`, `position`, `velocity`, `acceleration`, `yaw`, `trajectory_id` |
| `controller_msgs/cmd` | controller_msgs | `header (std_msgs/Header)`, `cmd (uint8)` |
| `controller_msgs/DroneState` | controller_msgs | `tookoff`, `landed`, `reached`, `returned` (bool) |
| `traj_utils/PolyTraj` | traj_utils | `drone_id`, `order`, `coef_x/y/z[]`, `duration[]` |
| `traj_utils/MINCOTraj` | traj_utils | `drone_id`, `traj_id`, `start_time`, inner waypoints, duration |

### 9. TF 坐标系

| Frame | 说明 |
|---|---|
| `world` | 全局固定坐标系 |
| `base{id}` | 无人机机体坐标系（如 `base1`），由 odom_visualization 广播，3D Panel 的 followTf 目标 |