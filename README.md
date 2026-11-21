# 生物能源试验站

中国农业大学烟台研究院 · AgriHackathon 主赛道作品。用同一套厌氧消化模型比较农业废弃物进料方案，查看每天的产气、甲烷占比和 pH，以及整段时间累计多产或少产了多少气。

[打开试验站](https://elvis882309.github.io/bioenergy-station/) · 固定版本：[v1.1.1-agri](https://github.com/Elvis882309/bioenergy-station/tree/v1.1.1-agri)

## 评委体验路径

打开进料罐，保留默认配方并读取第一份记录。将玉米青贮增加 1 m³/d，保持相同天数，读取第二份记录。点“方案对比”看两份方案，也可以切到“三通道分步”，在同一时刻比较不同求解方法和累计气量。增加进料也增加原料投入，总产气变化应与 pH、甲烷占比一起读。

公开版使用 Python 服务生成的真实记录。单罐支持青贮 11.4、12.4、13.4 m³/d，猪粪 6.1 和牛粪 5.0 m³/d，在 42 °C 的默认条件下分别提供 30、150、300 天轨迹。科研页面提供其预置案例。同一组输入才可读取相应记录。气泡和设备剖面用于解释过程，数值属于模型仿真。估计与标定使用合成观测。

## 界面说明

顶栏把入口分为「沙盘 / 模型分析 / 科研工具 / 原仪表盘」四组。键盘 Tab 可聚焦模块标签，←/→/Home/End 切换，地址栏同步 `?view=`，浏览器前进后退可用；「原仪表盘」保留原有页面，通过 iframe 嵌入。

试验站工作台右侧是操作台与读数区。读取记录前，读数区显示空态，草稿不会被当作结果；读取成功后，读数移到操作台上方。回放条显示当前时刻和总窗口，没有结果时不能回放。未收录工况会明确提示，并保留上一次结果。

音效与静态模式有两组独立作用域：「工作台」只对当前页面生效、不持久化；「本页」属于原仪表盘，沿用原有的 localStorage 设置。静态模式或系统「减少动态」会关闭界面过渡与动画，三维场景的交互与渲染方式不变。

本次界面改版（2026-11）只涉及控制台外壳与 DOM 微动效；模型、数据、记录和公开版语义未变：公开版仍读取预计算记录，不在浏览器里现场求解。

## 从源码运行自定义工况

以下步骤运行的是当前 main（固定版本 v1.1.1-agri）的源码，打开后即为 2026-11 新版控制台界面。8848 是本机后端模式，与公网演示的预计算记录模式不同。

建议使用 Python 3.12，在仓库根目录的虚拟环境中执行：

```sh
python -m pip install . fastapi uvicorn
python webdemo/app.py --port 8848
```

打开 http://127.0.0.1:8848/static/station/index.html 。单罐使用 SciPy，Julia 通道还需要 juliacall 及其 Julia 项目依赖，详见 _setup_julia.py。公开网页无需安装这些依赖。

## 复核一次结果

docs/records/index.json 保存每条请求的 URL、输入快照、压缩文件名和响应原文 SHA-256。用 gzip 解压对应文件即可查看数值。时间游标上的累计量由相邻记录点梯形积分计算。自行启动服务后，运行 python tools/collect.py 导出新记录，然后运行 python tools/build_pages.py 重新构建公开版。

模型、底物库及配套科研模块基于 [PyADM1ODE](https://github.com/dgaida/PyADM1ODE)、[PyADM1ODE_calibration](https://github.com/dgaida/PyADM1ODE_calibration) 和 [PyADM1ODE_estimate](https://github.com/dgaida/PyADM1ODE_estimate)。上游许可见 LICENSE。三维界面使用 Three.js，轨迹界面注明了 [HALOFLUX](https://github.com/Ryder191/haloflux) 的非商业视觉参考。参赛工作围绕进料台账、设备交互、求解轨迹观察和方案比较展开。
