# 地图对齐工具

`public/modules/map/data/map-layout.js` 由本目录的 `align_map.py` 生成：从卡面原图里找出每条边上的通道出口（白色细条 + 编号徽章），把相连两张板块的出口配对，再一次性解出所有板块的位置，让相邻板块边贴边、通道对通道。地图页和第二屏优先使用这份数据；没有它时退回 TTS 原坐标。

板块尺寸取自卡面图片本身（所有卡面统一为每格约 236.2 像素）。TTS 模组里小卡缩小了约 2%、支线长条卡放大了约 3%，这是原来错位的来源之一。

## 重新生成

需要 Python 3、`numpy`、`Pillow`，以及 `public/assets/map/` 里的卡面原图。在 `KF_Unified_Assistant/` 下执行：

```bash
python tools/map-align/align_map.py detect public/assets/map tools/map-align/exits.json
python tools/map-align/align_map.py solve tools/map-align/exits.json tools/map-align/layout.json
python tools/map-align/align_map.py write tools/map-align/layout.json public/modules/map/data/map-layout.js
```

`solve` 会打印对齐后的误差（按原图像素），并在 `layout_report.json` 里列出每条连接的匹配情况：

- `matched`：两侧出口都找到并对齐。
- `virtual`：数据里相连，但两张板块在地图上并不相邻（支线入口等跳转），不参与对齐。
- `labelledDir`：数据里标的方向与板块实际相邻的一侧不一致，已按实际相邻的一侧处理。

2026-10 的结果：154 条相邻通道全部匹配，对齐后通道错位中位数 0.9 像素、最大 7.8 像素；板块缝隙中位数 0.9 像素、最大 5.9 像素（对齐前缝隙中位数 16 像素、最大 42 像素）。
