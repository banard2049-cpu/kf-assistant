# KF 一体化战役管理

PHP 8.2+ / SQLite 的《Kingdoms Forlorn》本地 Web 助手，包含骑士档案、战役、地图深入、遭遇战和 AI/BP。

完整使用说明请看仓库根目录的 [README.md](../README.md)。下面只保留应用目录内的常用入口。

## 怪物中文名称与位阶

统一映射位于 [`public/monster-labels.js`](public/monster-labels.js)。AI/BP、遭遇战、主控制台、地图深入及第二屏都读取这份映射。

修改 `monsters` 中对应 ID 的 `zh` 即可改中文名；修改 `tiers` 可调整“杂兵、封臣、国王、恶魔、巨龙”的显示名称。保留 `en`、怪物 ID 和英文 `tier` 值，它们用于关联原始数据和已有存档。`aliases` 用于兼容其他英文拼写。修改后刷新页面；若浏览器仍显示旧名称，按 Ctrl+F5 强制刷新。

检查映射覆盖与跨模块显示：`node tools/test-monster-labels.js`。

## 装备预览

主界面侧栏和各模块顶栏的“装备预览”打开独立页面 `/modules/equipment/`，无需选择战役即可浏览。目录包含 27 个来源分类和 6 张阶级说明卡；同名、同来源和同阶级的复数卡牌叠放，放大时仍可逐张查看不同卡面。支持来源筛选、多选阶级、名称/来源搜索，以及点击卡面放大、翻面和前后切换。键盘 `←` / `→` 切换、`F` 翻面、`Esc` 关闭；筛选条件保留在网址中，刷新后可继续浏览。

图片位于 `public/assets/equipment/`，随完整图片资源包分发。可从合法持有的本地 TTS 副本重新导入目录和图片：

```powershell
node tools/import-tts-equipment.js --save "路径/Mods/Workshop/(Don)KF 1.8.json" --images "路径/Mods/Images"
```

导入器合并同一 CardID 的重复副本与来源标签，保留不同 CardID 的装备版本，修正先民战士来源标签拼写，并单列剧情装备。验证目录、筛选、排序、正反面图集裁切和导入行为：`node tools/test-equipment-catalog.js`。缺少图片时页面显示补齐资源提示，目录仍可浏览。

## 肉鸽之路与进阶 Withergraal

基础路径完成最远端任意一个 V 级节点并结算奖励即通关。点击“进入进阶肉鸽”，在同一存档内保留队伍、金钱、成长、奖励及圣杯叹息，共享复活设为 20。阶段选择可回看基础路径；已有存档若已完成一个 V 级终点，刷新后即可获得继续入口。进阶地图采用原规则 PDF 的彩色版，两王国包含 VI–XII 遭遇表，所有扩展内容均开放。

首次进入进阶肉鸽时，播放约 7 秒的地图燃烧过场：基础地图多处焦化、烧穿，伴随火舌、烟和翻卷碎灰，逐步露出下层进阶地图，随后返回可操作的进阶路径。可点击“跳过过场”或按 Esc 跳过；系统开启“减少动态效果”或设备不支持 WebGL 时直接进入。阶段进度在播放前保存，刷新或回看地图不会重播。浏览器验证：`node tools/test-rogue-stage-transition.cjs`（需要 Playwright）。

基础节点胜利后，每名参与骑士各从当前或更低等级的同类未领奖励中选择一项。选项标明来源等级，选择刷新后可恢复；每人的领取名额独立，同一勾选框不能重复领取，不同等级的同名奖励仍分别计算。双形态装备作为同一个选项领取。

枯萎节点按图向每名骑士发放虔信指示物，不补保底复活。公主、圣徒、精通、属性提升及传奇装备按团队共享奖励表领取：每次从当前或更低等级的同类未领项目中选一项，消耗对应的一个共享勾选框。多个随机精通分别占用名额，记录实际抽取名称并对全队去重；IX 的狂热阈值／Magic Limit 二选一、VII 的 Slawia／30 黄金二选一均共用各自的单个名额。选择金钱时由玩家选择一名骑士记账，全队合计只增加 30。

奖励界面显示来源等级。属性符号按用户提供的《A1 KF中规1.06》使用战意、烈度上限、灾祸耐限、移速、卡牌刷新、烈度刷新、手牌上限、强度等关键词；该册未给出 Magic Limit 的完整译名，因此保留英文。数值成长可在独立肉鸽骑士表中修改，奖励卡效果按实物卡执行。

高等级 AI/BP 使用附录的逐级数据，trait 区累计显示已达到门槛的能力原图及当前等级属性行，点击可放大；第二屏同步显示。被替换的旧能力会有说明。蓝行额外加值、杂兵初始晋升和新增复杂能力按原图人工结算；附录未列展览初始损伤时需手动设置。

短能力贴图按原比例竖向堆叠。第二屏优先将它们放进杂兵轨道的空位，不覆盖实际 BP 或杂兵；放不下的参考图保留在轨道下方。

当前等级属性图与高等级特殊 trait 可在“大卡”上方的“等级属性与特质 · 放到面板”中选放，也可在下方参考卡旁点击“放到面板”。放置后可拖动，使用 − / ＋ 调整大小或 × 移除；位置和大小随存档保存、支持撤销并同步到第二屏。已放到面板的图片不会在第二屏轨道中重复显示，移除后恢复参考展示。改变等级后，旧等级属性图会移除，可再选择新等级的属性图。

进阶图片仍存放在不进入 Git 的 `public/assets/`，完整图片资源包会包含它们。持有原 PDF 时可重建地图、图标、等级数据及能力贴图：

```powershell
python tools/extract-withergraal-assets.py --source "路径/KF_Withergraal_Sheets.pdf"
python tools/extract-postgame-assets.py --source-dir "包含沉没的王国（69.pdf、斯托恩公国（70.pdf、万种多肉恐惧（76.pdf的目录"
```

提取脚本使用 PyMuPDF；地图拼接另外使用 Pillow。验证：`node tools/test-rogue-withergraal.js`、`node tools/test-aibp-postgame.js`、`node tools/test-postgame-assets.js`。安装 Playwright 后可运行 `node tools/test-withergraal-browser.cjs` 检查完整流程；其浏览器配置、缓存和截图均写入工作区 `tmp/`。

基础和进阶地图均以用户最终提供的 `kf-rogue-map-2026-10-27 (3).json` 为准，原文件留存为 `tools/rogue-map-approved-2026-10-27.json`。基础 103 个节点、114 条连线及进阶 87 个节点、99 条连线已写入默认数据。旧存档和旧地图模板首次载入时升级两阶段地图，保留骑士、已完成节点、资源、奖励和待结算内容；升级后仍可在编辑页手动修改。旧浏览器全局标签不会自动覆盖这份默认。`tools/rogue-map-audit.json` 记录两阶段核验依据，运行 `node tools/test-rogue-map-audit.js` 检查来源一致性、奖励归属及存档迁移。基础 IV 级 Paracelsa 与 Ser Ubar 的招数格已按原表归位，旧领取记录继续占用原来的勾选名额。

地图编辑保留为维护工具，常规界面隐藏入口；需要时可直接打开 `/modules/rogue/editor.html`，修正基础和进阶地图。选择“添加连线”或“删除连线”后依次点击两个节点；右侧可修改等级、奖励、复活和虔信，支持撤销、重做和 JSON 导入导出。点击“保存地图”才应用到存档，可选当前存档或当前战役的全部肉鸽存档；保留骑士、资源、奖励和完成进度，当前存档的新建战役会继承其地图配置。主屏和第二屏读取同一配置；没有连接战役时可本机编辑并导出备份。验证：`node tools/test-rogue-map-config.js`、`node tools/test-rogue-map-editor-browser.cjs`（后者需要 Playwright）。

## 圣徒神堡 · 尤拉

主控制台或侧栏“圣徒神堡 · 尤拉”可启用万千恐惧扩展，记录六项专属委托、当前层级和化圣碎片，并建造和配置设施、圣言。目录提供 13 种设施与 9 种圣言，可点击卡名查看卡面；素材位于 `public/assets/jura/`，随完整图片资源包分发。

建设时自动扣除化圣碎片与所选骑士档案的金钱，支持多张记录表合并支付和撤销。设施与圣言按当前层级的累计槽位配置，可将配装命名保存并恢复；卡牌效果按原卡结算。尤拉账本在同一账号的战役间共享，随完整存档导出和导入；Web 与 Android 均支持保存，旧战役记录会迁移到共享账本。

## 许可证：禁止商用

本项目原创代码、文档及项目自有图标采用 [PolyForm Noncommercial License 1.0.0](public/LICENSE.txt)，仅允许许可证规定的非商业用途，商业使用未获授权。修改和再分发必须遵守许可证，并保留完整许可证及 `Required Notice:` 版权声明；商业用途须另行获得相关版权所有者的书面授权。游戏素材、第三方组件和运行时仍归各自版权所有者所有，并遵循其自身许可证。

## 从 Release 运行（推荐）

Windows/macOS portable 包和 Android APK 位于仓库的 [GitHub Releases](https://github.com/banard2049-cpu/kf-assistant/releases)。下载对应平台的完整压缩包后解压运行；更新时保留旧目录中的 `data/` 和本地图片资源。

## Docker / NAS

从服务器一键安装公开 GHCR 镜像：

```bash
curl -fsSL https://raw.githubusercontent.com/banard2049-cpu/kf-assistant/main/tools/install-docker.sh | bash
```

本目录用于本地构建时执行：

```bash
docker compose up -d --build
```

访问 `http://服务器IP:8789/`。一键脚本默认将 `compose.yaml`、`data/` 和 `backups/` 放在执行命令时的当前目录；直接拉取 GHCR 镜像时，更新命令为：

```bash
docker compose pull
docker compose up -d
```

## Windows / macOS

Windows 需要 PHP 8.2+ 和 `pdo_sqlite`：

```bat
check-windows.bat
start-windows.bat
```

macOS/Linux：

```bash
./start-macos.sh
./start-docker.sh
```

默认监听 `8789` 端口。管理员命令示例：

```bash
php tools/admin.php backup
php tools/admin.php compact
php tools/admin.php list
php tools/admin.php reset-password 用户名 新密码
```

备份独立保存在 `backups/*.db`，不会随存档一起读取。更新后会自动归档旧版重复的同步快照并收缩主库；原始日志保存在 `backups/*-operation-history.jsonl.gz`（无 gzip 时为 `.jsonl`），当前存档、撤销历史及同步去重信息保持完整。`compact` 可立即执行同一整理流程；失败时保留原数据并稍后重试。

图片资源不在 Git 仓库中，统一恢复到 `public/assets/`；模块目录下不再需要单独的 `assets/` 副本。只更新图片时可单独分发 `public/assets/` 的压缩包，并覆盖到同名目录。可运行的 Web/PHP 应用仍需完整 Release 压缩包；Android 请直接分发 APK，Docker 请分发镜像或完整部署目录，并另行把资源放到部署目录的 `assets/`。存档导入仅支持 `kf-unified-campaign` v2。
