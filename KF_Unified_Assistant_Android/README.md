# KF 一体化助手 Android 本地版

这是 `KF_Unified_Assistant` 的独立 Android 版本。APK 内置完整网页和图片资源，使用 Android SQLite 保存账号、战役、骑士、地图、遭遇及 AI/BP 状态，运行时不需要 PHP、电脑服务器或网络。

## 一键生成 APK

双击：

```text
build-apk.bat
```

脚本会自动执行以下操作：

1. 从相邻的 `KF_Unified_Assistant/public` 同步最新网页资源。
2. 排除 PHP、测试文件、数据库、备份和日志。
3. 注入 Android 本地 API。
4. 构建、对齐并使用持久化本地密钥签名 APK。
5. 将产物写入 `dist` 并输出 SHA-256。

默认复用 `D:\download\ato2\ATO-android-local\.build-tools` 中现有的 JDK、Gradle 和 Android SDK。也可以指定其他同结构工具链：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -Toolchain "D:\path\to\.build-tools"
```

## 安装

开启手机 USB 调试并连接电脑，构建完成后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\dist\install-android.ps1
```

首次启动时在 App 内注册本地账号。数据位于 App 私有 SQLite 数据库；卸载 App 会删除本地数据，卸载前应先使用“导出存档”。
