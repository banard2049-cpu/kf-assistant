# KF Assistant

[简体中文](README.md)

An unofficial campaign companion for *Kingdoms Forlorn* that tracks knights, map exploration, encounters, and AI/BP.

## Install

Download the package for your platform from [GitHub Releases](https://github.com/banard2049-cpu/kf-assistant/releases).

| Platform | How to start |
| --- | --- |
| Windows | Extract the Windows x64 portable archive and double-click `start-windows.bat`. |
| macOS | Extract the portable archive (`arm64` for Apple silicon, `x64` for Intel) and double-click `start-macos.command`. |
| Android | Install the APK and open KF Assistant. |

On Windows and macOS, open `http://127.0.0.1:8789/` in your browser.

To run from source, use PHP 8.2+ with SQLite, mbstring, and Argon2id support. From `KF_Unified_Assistant/`, run `start-windows.bat` on Windows or `bash start-macos.sh` on macOS or Linux.

### Docker / NAS

With Docker and Docker Compose installed, run this command in the directory where you want to keep your data. Then open `http://<server-ip>:8789/`.

```bash
curl -fsSL https://raw.githubusercontent.com/banard2049-cpu/kf-assistant/main/tools/install-docker.sh | bash
```

## Game artwork

Set up the game artwork separately using a complete asset pack prepared from game materials you legally own.

- For **portable and source installs**, copy the contents of `KF_Unified_Assistant/public/assets/` from the pack into `public/assets/` in your app folder.
- On **Android**, choose **Import Resource ZIP** (「导入资源 ZIP」) in the sidebar. Importing replaces existing artwork, so use the full ZIP.
- For **Docker / NAS**, put the artwork in `assets/` next to `compose.yaml`.

## Play and update

Register and sign in on first launch. Select or create a campaign, add your party with **New Knight** (「新建骑士」), and open map exploration, encounters, or AI/BP from the sidebar. Choose **Import Save** (「导入存档」) to resume an existing save.

Back up your progress with **Export Save** (「导出存档」) before updating. Keep `data/` and `public/assets/` when replacing a portable install. On Android, install the new APK over the existing app. For Docker, run `docker compose pull` and `docker compose up -d` from your deployment directory.

This project is licensed for noncommercial use under the [PolyForm Noncommercial 1.0.0 license](LICENSE). Game assets belong to their respective rights holders.
