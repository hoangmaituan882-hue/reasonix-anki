# Reasonix Anki 调度 QA 操作手册

> 仅用于独立测试 Profile。任何自动评分、撤销和调度写入都必须在名称精确为
> `Reasonix QA` 的 Profile 中执行；该 Profile 不得登录或同步 AnkiWeb。

## 1. 构建并安装插件

在仓库根目录执行：

```powershell
npm run addon:package
```

产物为 `dist/reasonix-anki-addon.ankiaddon`。当前 manifest 精确锁定已核对的
Anki 25.09.2（后续版本先完成适配与回归再放宽）。在 Anki 中打开“工具 → 插件 →
从文件安装”，选择该文件并按 Anki 提示重启。插件只监听
`127.0.0.1:8766`；它不会启动 Anki，Anki 仍由用户手动启动。

## 2. 创建隔离 Profile

1. 在 Anki Profile 管理器中新建名称精确为 `Reasonix QA` 的 Profile。
2. 不登录 AnkiWeb，不启用自动同步。
3. 切换到该 Profile 后保持 Anki 打开。
4. 先执行只读闸门：

```powershell
npm run qa:preflight
```

只有输出 `active profile is 'Reasonix QA'` 才能继续。名称缺失、近似匹配、连接
失败或其他 Profile 都会拒绝运行。

## 3. 播种确定性 Lapis 样本

```powershell
npm run qa:seed -- --apply
```

脚本会创建或严格核验 `Reasonix QA::Lapis`、`Reasonix QA Lapis` 模型、五个
Lapis 卡模板和确定性测试笔记。重复执行不会重复建卡；既有样本结构不一致时会
停止而不是覆盖。

## 4. 授权与实机对照

1. 保持 `Reasonix QA` 为活动 Profile，启动 Reasonix。
2. Reasonix 先调用 `status`；确认 `profileName`、`profileKey`、插件/Anki 版本和
   capability 列表。
3. 首次 `requestPermission` 会在 Anki 窗口弹出中文确认；默认策略是首次批准后记住到
   整个 Anki 安装。可从 `工具 → Reasonix 设置…` 或附加组件管理器的“配置”按钮
   撤销授权、切换为每次启动询问或始终拒绝。
4. 对同一测试牌组逐步记录并比较：scheduler 第一张、四档文案、评分后的下一张
   与剩余计数、revlog、撤销恢复卡片、重复 requestId。
5. 任一步与 Anki 原生 Reviewer 不一致，立即停止 P3–P5 UI 扩建并修正适配层。

### 4.1 稳定性与状态监测

- 插件 HTTP 服务只绑定 `127.0.0.1:8766`，启动失败不会再阻止 Anki 加载插件；
  失败会记录为 `HTTP_SERVER_START_FAILED`，修复端口占用后重新加载插件或重启 Anki 即可恢复。
- `status` 响应的 `health` 字段包含服务状态、线程存活、最近心跳、请求/失败计数、
  最近错误和同步尝试时间线。Anki 的“工具 → Reasonix 设置…”页面会每秒刷新这些
  诊断信息，并可复制给开发者。
- 同步请求在收到 `sync_will_start` 前保持 pending，不会因登录/确认流程尚未结束而
  提前报告空闲；30 秒未收到钩子会进入 `SYNC_START_TIMEOUT`。前端对可重试故障按
  1/2/4/8 秒退避，最多 4 次；明确拒绝或 `retryable=false` 的错误不会重复弹窗。
- Anki `sync_did_finish` 在 25.09.2 没有成功参数，因此状态只能准确报告“完成钩子已到达”，
  不伪造服务端同步成功详情。

## 5. 最近一次实机结果

2026-08-10 已在 Anki 25.09.2 与独立 `Reasonix QA` Profile 完成调度闸门：

- 原生 Reviewer 与插件 `session.next` 的队首 cardId 一致；
- `session.reveal` 的四档文案与原生 Reviewer 逐字一致；
- 评分后下一张与剩余计数符合原生队列，revlog 只增加一条；
- 使用相同 `requestId` 重放 `session.answer` 未重复评分；
- `session.undo` 恢复原队首与剩余计数，并移除对应 revlog；
- 撤销后再次打开原生 Reviewer，队首与四档文案仍一致。

安全写保护仍是永久前置条件：每次重新执行调度写测试前都必须再次运行
`npm run qa:preflight`，不得把本次通过状态当作永久授权。
