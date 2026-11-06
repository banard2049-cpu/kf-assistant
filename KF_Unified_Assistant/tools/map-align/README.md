# 地图对齐工具

`public/modules/map/data/map-layout.js` 由本目录的 `stitch_map.py` 生成。地图页和第二屏共用这份几何数据和校正贴图；没有布局数据时退回 TTS 原坐标。

新版先把 199 处相邻边归并为共用坐标，按卡面印刷网格确定整数尺寸，消除扫描尺寸差异造成的缝隙、重叠和四块交角的小孔。然后从 `--source-dir` 指定的原图备份里检测出口，为 154 条通道确定共用位置。

贴图采用透视拟合和边界残差网格校正：四角锁定、外边保持矩形，只移动地形中的通道位置。透视拟合后的网格用连续三角片采样，避免片内接缝；采样使用边缘颜色延拓，防止重采样引入黑边。生成的正面图写入 `public/assets/map/aligned/`，文件名包含源图和网格哈希。

布局还保存同一套网格，地图 Token、队伍头像、线索和拖放命中均使用其正向或逆向变换。已有存档继续保存原始卡面百分比坐标；背面不使用正面校正。地图、详情预览和第二屏共用校正后的正面图。

125 张旧正面图已迁出项目，保存在项目外的原图备份中，附逐张 SHA256 清单和迁移前的数据文件。当前本机备份为 `D:/files/kf-map-backups/2026-11-06-map-originals/`，原图位于其 `faces/` 子目录。125 张背面图仍是未探索板块的必需资源，继续保留在 `public/assets/map/`。

地图页和第二屏挂载地图时调用 `KFMapView.bindMapStage`。它在共用边下方绘制按设备像素定位的窄幅贴图底层，填补浏览器缩放、旋转裁切留下的亚像素露底，并在缩放、滚动和窗口变化后更新。板块本身、通道、命中区域和标记继续使用同一份布局坐标。

## 重新生成

需要 Python 3、`numpy`、`Pillow`，以及项目外备份的原始正面图。在 `KF_Unified_Assistant/` 下执行，将下列路径替换为实际备份目录：

```bash
python tools/map-align/stitch_map.py --source-dir "原图备份目录/faces"
python tools/map-align/check_stitch.py
node tools/test-map-aligned-layout.js
node tools/test-map-stitch-browser.cjs
node tools/test-map-pixel-seams-browser.cjs
```

浏览器验证需要 Playwright 和 Chrome，覆盖两王国、主屏与只读第二屏、三种缩放，以及旋转板块上 Token 的拖放、保存和刷新恢复。截图写入仓库 `output/map-stitch/browser/`。

像素接缝验证另外需要 `pngjs`：用不透明的纯白图检查两王国全部 199 处共用边，并覆盖 100%、125%、200% 显示缩放，以及横纵接缝、四种地图缩放和滚动后的 96 种组合。修复前后实图截图写入 `output/map-stitch/black-line/`。

`check_stitch.py` 独立读取生成贴图最外侧的白色通道像素，检查实际图像而非只检查控制点坐标。2026-11-06 结果：153 条可测通道偏差中位数 0.25 像素、最大 1.90 像素（原图尺度）；POS 支线 11–12 的出口紧贴徽章，另作放大实图核对。

生成报告位于仓库 `output/map-stitch/stitch-report.json`，记录每条共用边、原始出口、共用通道位置和原图校正量。生成过程会拒绝通道数量变化、网格翻折、内部覆盖或贴图采样空洞。重复运行复用哈希一致的贴图。

`map-data.js` 的正面地址已经指向校正图。脚本检测到该情况而未提供 `--source-dir` 时会停止，避免对校正图重复变换。

分发时必须一并包含新的 `map-layout.js` 和 `public/assets/map/aligned/`。项目图片资源不进入 Git，因此需要随完整资源包或本地安装目录分发。

`align_map.py` 保留为旧版布局的初始化工具和出口检测模块。旧算法同时近似求解边缘、通道和平移；闭环区域会保留残差，不能用它的 `write` 命令覆盖新版布局。
