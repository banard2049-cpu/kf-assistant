# KF 一体化战役管理（PHP 自托管版）

以骑士记录表为控制台，统一管理《Kingdoms Forlorn》的战役、地图深入、怪物池、遭遇战和 AI/BP 状态。后端使用 PHP 8.2+ 与 SQLite，不依赖 Node.js 或云服务。

地图、遭遇和 AI/BP 没有重新实现，也没有使用 iframe，而是直接复制以下现有实现并作为同源原生模块运行：

- `KF_Map_Assistant` v5：完整地图深入主持器
- `KF_Encounter_Assistant` v1：完整遭遇战助手
- `KF_AIBP_Assistant` v3：完整 AI/BP、杂兵轨、晋升和撤销

三套模块均以原实现为主体；`module-bridge.js` 负责登录校验、骑士名单、统一导航以及把各模块原生状态同步到当前 PHP 战役。地图模块以 `public/modules/map` 为唯一维护副本，后续地图代码和数据修改只在此目录进行，不再回写旧的独立项目。

地图卡背人工标注原件保存在 `public/modules/map/data/card-back-labels.json`，合并后的运行数据为同目录的 `map-data.js`。更新标注文件后运行 `tools/import_map_labels.py`，即可重新校验并导入全部 125 张地图板块。

## 已统合功能

- 多账号、多战役、用户级共享骑士档案及 30 天回收站
- 同一名骑士在所有战役中复用同一份状态；战役仅保存主骑士和出征队伍引用
- 新建档案时通过立绘卡片从 7 名骑士（Stoneface、Fleischritter、Renholder、Ser Sonch、Paracelsa、Ser Ubar、Kara）中选择
- 出征队伍固定为 4 席，主骑士必定出战，空缺席位自动由具体侍从卡补齐
- 骑士和侍从是独立角色类别；其余 8 名角色只作为侍从补位，并分别传递到原版地图和遭遇模块
- 唯一主游戏骑士与 TTS `20×22` 怪物池比对矩阵
- 沉没王国固定 3 个区域、巨石王国固定 4 个区域
- 怪物池自动洗牌、区域分配及地图遭遇交接
- 原版双王国地图、板块、探索牌、线索、标记、深入轮和撤销
- 原版遭遇版图、英雄与怪物放置、攻击图案、阶段和结算
- 原版 AI/BP 牌库、杂兵轨、损伤、自动晋升、特质、历史和撤销；全部 22 个怪物均内嵌汉化冲突设置、战后处理与独立战场地图，并按战役王国切换对应版本
- 新版完整存档 JSON 导入导出；导入时按骑士身份复用已有共享档案
- 字段级跨设备同步、IndexedDB 离线队列和 SQLite 自动备份

不兼容旧版独立工具存档；导入只接受 `kf-unified-campaign` v2。

登录并选择战役后，可直接访问：

- `/modules/map/`
- `/modules/encounter/`
- `/modules/aibp/`

## Windows

1. 准备 PHP 8.2 或更高版本，并启用 `pdo_sqlite`；不需要 Node.js。
2. 双击 `check-windows.bat`。
3. 双击 `start-windows.bat`。
4. 访问 `http://127.0.0.1:8789`，局域网设备使用脚本显示的地址。

## Docker / NAS

```bash
docker compose up -d --build
```

访问 `http://NAS地址:8789`。数据库与备份分别保存在 `./data`、`./backups`。

群晖 Web Station 可将文档根目录直接指向 `public`，PHP 必须启用 `pdo_sqlite`。

## 配置

- `ALLOW_REGISTRATION`：是否允许注册。
- `SESSION_DAYS`：会话有效天数。
- `DATA_DIR`、`BACKUP_DIR`：持久化目录。

## 管理与备份

```bat
php-admin-windows.bat backup
php-admin-windows.bat list
php-admin-windows.bat reset-password 用户名 新密码
```

Docker/NAS 可使用 `php tools/admin.php` 执行相同命令。系统每天创建 SQLite 一致性快照，保留最近 7 个日备份和 4 个周备份。

默认面向可信局域网；如需公网访问，必须配置 HTTPS 并关闭开放注册。
