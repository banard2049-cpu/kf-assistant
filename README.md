# KF 助手

KF 助手是面向《Kingdoms Forlorn》的非官方一体化战役管理工具。仓库同时包含可自托管的 PHP Web 版和完全离线的 Android 本地版，用于统一管理骑士档案、战役、地图深入、怪物池、遭遇战以及 AI/BP 状态。

> 本项目是玩家自制工具，与游戏发行商及版权方无关。图片、卡牌、版图、角色立绘等美术资源不包含在 Git 仓库中。

## 主要功能

- 多账号、多战役和用户级共享骑士档案
- 地图深入、探索牌、线索、标记、怪物池与遭遇交接
- 遭遇版图、角色与怪物放置、攻击图案、阶段和结算
- AI/BP 牌库、杂兵轨、损伤、晋升、历史记录与撤销
- 完整战役存档的 JSON 导入与导出
- IndexedDB 离线队列、字段级同步和 SQLite 自动备份
- Web 自托管与 Android 完全离线两种运行方式

## 仓库结构

```text
.
├─ KF_Unified_Assistant/          # PHP 8.2+ / SQLite Web 应用
│  ├─ public/                     # Web 入口及地图、遭遇、AI/BP 模块
│  ├─ tools/                      # 管理、数据导入与测试脚本
│  ├─ compose.yaml                # Docker Compose 配置
│  └─ start-windows.bat           # Windows 启动脚本
└─ KF_Unified_Assistant_Android/  # Android 本地版外壳与构建脚本
   ├─ app/                        # Android 应用
   └─ build-apk.bat               # 一键同步 Web 资源并构建 APK
```

## 图片资源

仓库通过根目录 `.gitignore` 排除了 `png`、`jpg`、`jpeg`、`gif`、`webp`、`bmp`、`ico` 和 `svg` 等图片文件，同时排除了 Android 构建时生成的完整 Web 资源副本。

因此，直接克隆本仓库可以阅读、修改和测试业务代码，但界面中的卡牌、版图、图标及角色图片会缺失。若要完整运行，请从你合法持有的本地项目副本恢复图片，并保持原目录和文件名不变，主要位置包括：

```text
KF_Unified_Assistant/public/assets/
KF_Unified_Assistant/public/modules/*/assets/
```

Android 版无需手工复制第二份资源；构建脚本会从相邻的 Web 项目同步到 `app/src/main/assets/web/`。

### 打包图片资源用于分发

在**已有完整图片**的本地副本上运行下面的脚本，可以把所有被 `.gitignore` 排除的图片打包成单个 zip，交给其他开发者补齐资源：

```powershell
cd KF_Unified_Assistant\tools
.\pack-ignored-images.ps1
```

默认在仓库根目录生成 `KF_Assistant_Images_<日期>.zip` 和对应的 `.sha256.txt`。脚本直接使用 git 的忽略规则来判断哪些图片没有进仓库，因此不需要手工维护目录清单。

压缩包内保留完整的仓库相对路径，接收方在仓库根目录解压覆盖即可，无需移动目录：

```powershell
Expand-Archive -LiteralPath KF_Assistant_Images_<日期>.zip -DestinationPath . -Force
```

常用参数：

| 参数 | 用途 |
| --- | --- |
| `-DryRun` | 只统计文件数量、体积和目录分布，不写出文件 |
| `-OutputPath <路径>` | 指定输出位置，默认仓库根目录 |
| `-Force` | 覆盖已存在的同名输出文件 |
| `-IncludeGenerated` | 一并打包 Android 生成的 web 副本和便携版运行时中的图片 |
| `-NoHash` | 跳过 SHA256 校验文件 |

脚本始终排除 `.env`、`data/`、`backups/` 和 `logs/`，即使通过 `-Extension` 传入了自定义扩展名，也不会把本地配置或数据库打进包里。由于 `modules/*/assets/` 中的部分图片是 `public/assets/` 的副本，压缩包体积会明显大于去重后的实际素材量；这样做是为了解压后可以直接运行，不需要额外的恢复步骤。

## Web 版运行

### Windows

要求：PHP 8.2 或更高版本，并启用 `pdo_sqlite`、`sqlite3` 和 `mbstring` 扩展。

```bat
cd KF_Unified_Assistant
check-windows.bat
start-windows.bat
```

启动后访问 [http://127.0.0.1:8789](http://127.0.0.1:8789)。首次运行会根据 `.env.example` 创建本地 `.env`；数据库、备份和日志均不会提交到 Git。

### Windows 免安装包

已有可用的 PHP 8.2+ 环境时，可以生成自带 PHP 运行时的便携 ZIP：

```powershell
cd KF_Unified_Assistant
powershell -ExecutionPolicy Bypass -File .\tools\build-portable-windows.ps1
```

也可以通过 `-PhpSource` 指定包含 `php.exe` 的目录，通过 `-OutputPath` 指定输出文件。生成的 ZIP、SHA-256 校验文件和本地 `runtime/` 均不会提交到 Git。

### Docker / NAS

```bash
cd KF_Unified_Assistant
docker compose up -d --build
```

服务默认监听 `8789` 端口，持久化数据保存在 `KF_Unified_Assistant/data/`，备份保存在 `KF_Unified_Assistant/backups/`。

可用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ALLOW_REGISTRATION` | `true` | 是否开放账号注册 |
| `SESSION_DAYS` | `30` | 登录会话有效天数 |
| `DATA_DIR` | `./data` | SQLite 数据目录 |
| `BACKUP_DIR` | `./backups` | 自动备份目录 |

## Android 本地版

Android 版将 Web 前端打包进 APK，并使用 Android SQLite 保存数据，不依赖 PHP、外部服务器或网络。

```bat
cd KF_Unified_Assistant_Android
build-apk.bat
```

构建脚本会同步相邻 `KF_Unified_Assistant/public/` 下的最新代码和本地图片资源，再生成签名 APK。构建工具链、签名密钥、APK 及同步后的 Web 副本均已忽略。

也可以显式指定本地工具链：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -Toolchain "D:\path\to\.build-tools"
```

## 数据与管理

Windows 下可使用：

```bat
cd KF_Unified_Assistant
php-admin-windows.bat backup
php-admin-windows.bat list
php-admin-windows.bat reset-password 用户名 新密码
```

Docker 或 Linux 环境可执行同等命令：

```bash
php tools/admin.php backup
php tools/admin.php list
php tools/admin.php reset-password 用户名 新密码
```

存档导入仅支持 `kf-unified-campaign` v2 格式。卸载 Android App 会清除其私有数据库，请先从应用内导出存档。

## 测试

项目的规则回归测试是可直接运行的 Node.js 脚本，不影响 PHP Web 版的生产运行要求。例如：

```bash
cd KF_Unified_Assistant
node tools/test-map-fog-rules.js
node tools/test-encounter-attack-range.js
node tools/test-aibp-boss-rules.js
```

## 安全提示

默认配置适合可信局域网。若部署到公网，请至少配置 HTTPS、关闭开放注册、使用强密码，并为 `data/` 和 `backups/` 设置独立的访问控制与备份策略。
