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