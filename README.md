# KF 助手

《Kingdoms Forlorn》的非官方战役管理工具，整合骑士档案、战役、地图深入、遭遇战和 AI/BP。项目不包含游戏图片等受版权保护的素材；请从你合法持有的本地副本补齐资源。

## 从 Release 运行（推荐）

版本标签会自动构建 Windows/macOS portable 包和 Android APK，文件位于 [GitHub Releases](https://github.com/banard2049-cpu/kf-assistant/releases)。下载对应平台的完整压缩包后解压运行；更新时保留旧目录中的 `data/` 和本地图片资源。

## Docker / NAS

服务器或 NAS 安装 Docker 后，执行一行命令即可从公开 GHCR 镜像部署：

```bash
curl -fsSL https://raw.githubusercontent.com/banard2049-cpu/kf-assistant/main/tools/install-docker.sh | bash
```

默认访问 `http://服务器IP:8789/`。脚本会把 `compose.yaml`、`data/` 和 `backups/` 放在执行命令时的当前目录；更新不会丢失这些目录。也可以通过 `KF_DIR=/目标目录` 指定安装位置。

手动更新：

```bash
cd /你的部署目录
docker compose pull
docker compose up -d
```

也可以固定版本：

```bash
curl -fsSL https://raw.githubusercontent.com/banard2049-cpu/kf-assistant/main/tools/install-docker.sh \
  | KF_IMAGE=ghcr.io/banard2049-cpu/kf-assistant:1.0.9 bash
```

本地构建 Docker：

```bash
cd KF_Unified_Assistant
./start-docker.sh
```

## 本地运行

Windows：安装 PHP 8.2+（启用 `pdo_sqlite`），进入 `KF_Unified_Assistant`，运行：

```bat
check-windows.bat
start-windows.bat
```

macOS/Linux：

```bash
cd KF_Unified_Assistant
./start-macos.sh
```

默认地址为 `http://127.0.0.1:8789/`。

## 图片资源

Git 仓库忽略 `png/jpg/jpeg/gif/webp/bmp/ico/svg` 等图片。现在所有模块共用同一个资源目录：`KF_Unified_Assistant/public/assets/`；模块目录下不再需要单独的 `assets/` 副本。

如果只是给已有安装包补齐或更新图片，压缩并分发 `public/assets/` 即可。推荐使用下方脚本生成 ZIP，它会保留 `KF_Unified_Assistant/public/assets/...` 路径，Web 解压可直接覆盖，Android 的“导入资源 ZIP”也能识别。不要把它当成完整程序包。

如果要分发可运行的 Web/PHP 应用，仍需分发 Release 生成的完整压缩包（其中包含 HTML、JS、CSS、data、API 和 `public/assets`）。Android 直接分发 APK；Docker 分发镜像或完整 Docker 部署目录。Docker 的独立部署目录还需另行提供图片资源，并放在部署目录的 `assets/`（Compose 会挂载该目录）。

在拥有完整图片资源的副本中，也可以用下面的脚本生成带仓库相对路径的资源 ZIP：

```powershell
cd KF_Unified_Assistant\tools
.\pack-ignored-images.ps1
```

生成的资源 ZIP 不包含 `.env`、`data/`、`backups/` 或日志。Android 版可在主界面通过“导入资源 ZIP”恢复图片。

## 数据与管理

存档导入格式为 `kf-unified-campaign` v2。备份、列出用户或重置密码：

```bash
cd KF_Unified_Assistant
php tools/admin.php backup
php tools/admin.php list
php tools/admin.php reset-password 用户名 新密码
```

默认配置适合可信局域网。公网部署请配置 HTTPS、关闭开放注册并限制 `data/`、`backups/` 的访问。

## 开发

业务代码位于 `KF_Unified_Assistant/public/`，工具和测试位于 `KF_Unified_Assistant/tools/`。项目为玩家自制工具，与游戏发行商及版权方无关。
