# KF 一体化助手 Android 本地版

这是 `KF_Unified_Assistant` 的 Android 打包工程。APK 内置完整网页和图片资源，使用 Android SQLite 保存账号、战役、骑士、地图、遭遇及 AI/BP 状态，运行时不需要 PHP、电脑服务器或网络。

## 一键生成 APK

双击：

```text
build-apk.bat
```

脚本会自动执行以下操作：

1. 从项目根目录的 `public/` 同步最新网页资源。
2. 排除 PHP、测试文件、数据库、备份和日志。
3. 注入 Android 本地 API。
4. 构建、对齐并使用持久化本地密钥签名 APK。
5. 将产物写入 `dist` 并输出 SHA-256。

默认复用 `D:\download\ato2\ATO-android-local\.build-tools` 中现有的 JDK、Gradle 和 Android SDK。也可以指定其他同结构工具链：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -Toolchain "D:\path\to\.build-tools"
```

## 固定发布签名

本地构建使用 `.build-tools/kf-unified-local-release.jks` 中已有的发布密钥（别名 `kf-unified-local`）。请备份该文件并在更换构建电脑时恢复同一份密钥；文件缺失时构建会报错，不会自动生成新密钥。

GitHub Actions 发布必须配置以下仓库 Actions Secrets：

| Secret | 内容 |
| --- | --- |
| `KF_ANDROID_KEYSTORE_BASE64` | 固定发布 keystore 文件的 Base64 编码 |
| `KF_ANDROID_STORE_PASSWORD` | keystore 密码 |
| `KF_ANDROID_KEY_ALIAS` | 发布密钥别名 |
| `KF_ANDROID_KEY_PASSWORD` | 发布密钥密码 |

如需与本地 APK 保持相同签名，请使用上述本地 keystore。可在本目录执行以下命令，将编码复制到剪贴板后填写 Secret：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PWD '.build-tools/kf-unified-local-release.jks'))) | Set-Clipboard
```

缺少任一 Secret 时，发布流程直接失败，不会回退到 debug 签名或临时密钥。密钥文件及密码不得提交到仓库。

已安装的 APK 如果使用不同的 debug 或临时签名，不能直接覆盖升级到固定签名版本；请先导出存档，再卸载旧版、安装新版并导入存档。之后的版本持续使用同一密钥即可覆盖升级。

## 安装

开启手机 USB 调试并连接电脑，构建完成后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\dist\install-android.ps1
```

首次启动时在 App 内注册本地账号。数据位于 App 私有 SQLite 数据库；卸载 App 会删除本地数据，卸载前应先使用“导出存档”。
