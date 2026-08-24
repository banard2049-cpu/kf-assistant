# KF 一体化战役管理

PHP 8.2+ / SQLite 的《Kingdoms Forlorn》本地 Web 助手，包含骑士档案、战役、地图深入、遭遇战和 AI/BP。

完整使用说明请看仓库根目录的 [README.md](../README.md)。下面只保留应用目录内的常用入口。

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

访问 `http://服务器IP:8789/`。本地 Compose 使用 `./data` 和 `./backups` 持久化存档与备份；直接拉取 GHCR 镜像时，更新命令为：

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
php tools/admin.php list
php tools/admin.php reset-password 用户名 新密码
```

图片资源不在 Git 仓库中，应恢复到 `public/assets/` 和 `public/modules/*/assets/`。存档导入仅支持 `kf-unified-campaign` v2。
