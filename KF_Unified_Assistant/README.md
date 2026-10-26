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
