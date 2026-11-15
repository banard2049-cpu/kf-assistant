# KF 助手

[English](README.en.md)

《Kingdoms Forlorn》的非官方战役助手，用来管理骑士、地图深入、遭遇战和 AI/BP。

## 安装

从 [GitHub Releases](https://github.com/banard2049-cpu/kf-assistant/releases) 下载对应平台的安装包。

| 平台 | 启动方式 |
| --- | --- |
| Windows | 解压 Windows x64 便携包，双击 `start-windows.bat`。 |
| macOS | 解压便携包（Apple 芯片选 `arm64`，Intel 选 `x64`），双击 `start-macos.command`。 |
| Android | 安装 APK，打开 KF 助手。 |

Windows 和 macOS 的浏览器入口是 `http://127.0.0.1:8789/`。

从源码运行时，准备 PHP 8.2+（带 SQLite、mbstring 和 Argon2id 支持），进入 `KF_Unified_Assistant/`。Windows 运行 `start-windows.bat`，macOS 或 Linux 运行 `bash start-macos.sh`。

### Docker / NAS

安装 Docker 和 Docker Compose 后，在要存放数据的目录执行下方命令。启动后访问 `http://服务器IP:8789/`。

```bash
curl -fsSL https://raw.githubusercontent.com/banard2049-cpu/kf-assistant/main/tools/install-docker.sh | bash
```

## 图片资源

游戏图片需单独准备，请使用从合法持有的游戏资源整理出的完整资源包。

- **便携版和源码运行**都将包里的 `KF_Unified_Assistant/public/assets/` 内容复制到应用目录下的 `public/assets/`。
- 在 **Android** 的侧栏点「导入资源 ZIP」。导入会替换已有图片，请选完整 ZIP。
- 使用 **Docker / NAS** 时，将图片放到 `compose.yaml` 同级的 `assets/`。

## 开始游玩和更新

首次打开后注册并登录。选择或新建战役，点击「新建骑士」添加队员，再从侧栏打开地图深入、遭遇战或 AI/BP。有旧进度时，使用「导入存档」。

更新前用侧栏「导出存档」备份。便携版换新包时保留 `data/` 和 `public/assets/`。Android 用新版 APK 覆盖安装。Docker 在原部署目录运行 `docker compose pull` 和 `docker compose up -d`。

本项目采用 [PolyForm Noncommercial 1.0.0 许可证](LICENSE)，仅限非商业用途。游戏素材归各自版权方所有。
