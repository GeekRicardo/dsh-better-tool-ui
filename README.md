# dsh-better-tool-ui

DeepSeek Harness（DSH）web 插件：把模型输出的**工具调用卡片**、**MCP 调用**和 **thinking 行**渲染成紧凑的时间线——左侧贯通色轨、行内图标 + 工具名 + 中文描述 + 参数摘要、GitHub PR 风格的代码变更视图，goal 工具渲染成 callout 色块。

> 本包早期叫 `dsh-hebbian-rows`，v2 起更名为 `dsh-better-tool-ui`（渲染范围已经不止最初那套行样式）。

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/GeekRicardo/dsh-better-tool-ui/main/install.sh | bash
```

装完**重启 dsh web 并硬刷新**（Cmd/Ctrl+Shift+R）生效。

先看效果再决定（不写任何文件）：

```bash
curl -fsSL https://raw.githubusercontent.com/GeekRicardo/dsh-better-tool-ui/main/install.sh | bash -s -- --dry-run
```

## 渲染覆盖

**内置工具行**（`tool.call.toolview` 按名接管，19 个 key）：

| 工具 | 行摘要 | 展开详情 |
| --- | --- | --- |
| bash | 命令全文 | 深色终端块（`$ 命令` + 尾部输出 + 退出码/信号条） |
| read | 相对路径 `:#起-止` | 行号代码块 |
| write / edit | 文件名 | GitHub 风 diff（文件名头 + 徽标 + +N−M + 行号 + 整行红绿底色） |
| grep / glob | pattern | 按文件分组的匹配 / 路径列表 |
| web_search / web_fetch | query / url | 引用列表 / 正文回放 |
| todo_write | `N 项 · X 完成 · Y 进行中` | 勾选清单 |
| job_output 等 job 系列 | job_id | 终端块 + `[status:]` 彩色状态条 |
| subagent / send_message 等 | description / 目标 id | 输入输出回放 |
| str_replace_editor | 路径（+view_range） | view→内容回放；create/insert→纯新增视图；str_replace→diff 视图 |
| skill | 技能名 | 内容回放 |

**MCP 工具行**（`mcp__<server>__<tool>`）：

- 行首是 MCP 官方标志（simple-icons 的 `modelcontextprotocol` 路径），标题是去掉服务器前缀的工具名（`mcp__dsh__dsh_status` → `status`），紧跟一枚服务器 chip（`dsh`），摘要按 `url / query / path / name …` 的顺序取第一个命中的主参数，都没有就退回 `第一个标量参数=值`。
- 展开后分「参数 / 结果」两段：参数排成 key/value 网格（对象与数组折进 pretty JSON 小块），结果按内容分流——合法 JSON 走轻着色（键/字符串/数字/字面量分色），host 端丢弃字节后留下的 `[image: …]` `[audio: …]` `[resource: …]` 占位行收成 chip，其余按纯文本回放。
- 调用失败时结果段让位给统一的红色错误块（错误名 · code + 正文），不重复渲染同一段文字。

> MCP 的公开名由用户装了哪些服务器决定，插件里无从枚举，而 keyed 槽位按精确 key 派发。所以插件订阅 `ctx.sessions` 的会话快照，扫出 `mcp__` 开头的调用名后即时补注册，并把认领过的名字存进 `localStorage`，下次启动先行注册——首次遇到某个 MCP 工具时可能闪一帧出厂卡片，之后不会。

**goal 系列**：`create_goal` 蓝 / `get_goal` 灰 / `update_goal`（complete 绿、blocked 红、pause 黄）callout 色块，直接嵌入消息流。

**thinking 行**：紫色轨（`#8c93f8`）+ 与工具行统一的 12px 网格、图标位对齐。

**流式工具行**（`conversation.chat.streamingCall` 按名接管，含已认领的 MCP 名）：write/edit 等大参数工具在参数流式生成期间，**消息流里**（正式卡片将要落地的位置）出现一行「生成中… + 目标 + 已生成字符数」，展开显示实时内容尾部；参数流完、正式卡片物化后自动让位。该座位由 DSH 原生提供，未被本插件接管的工具名走 DSH 自带的原生流式行。

> **旧版 DSH 兼容**：`conversation.chat.streamingCall` 是较新的 DSH 才声明的座位（0.1.0-rc.5 及更早没有）。没有它的版本上，同一行改从 `conversation.input.dock` 出场——渲染在输入框上方，内容与逻辑完全一致，只是位置不同。两种形态由座位是否声明仲裁：座位在，dock 行让位；座位不在，dock 行顶上，所以任何一个版本上都只会有一行预览。

**bash 展开的最短停留**：running 的 bash 行自动展开看实时输出，完成后自动收回。亚秒级命令会让这一展一收变成一次闪烁，所以自动展开至少停留 **2 秒**再收。这只推迟折叠——左侧色轨的蓝（运行中）→ 绿（完成）仍按真实完成时刻变色，两者互不影响。

**间距**：连续工具行 / think 步骤之间 2px 等距贴合（负 margin 抵消聊天列 16px gap），含正文段落的消息不受影响。

**色轨语义**：绿 `#34d59a` 完成 / 蓝 `#3dbbf5` 运行中（呼吸动画）/ 红 `#ee5858` 错误或非零退出码。

## 卸载

```bash
cd ~/.dsh/profiles/web
node -e '
const fs = require("fs");
const p = "package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
delete (j.dependencies || {})["dsh-better-tool-ui"];
const b = j.dsh?.profile?.bundles ?? [];
j.dsh.profile.bundles = b.filter((x) => x !== "dsh-better-tool-ui");
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'
pnpm install
```

重启 dsh web 后恢复出厂渲染。

## 工作原理

DSH web 的 profile（`~/.dsh/profiles/web`）在 boot 时按 `package.json` 的 `dsh.profile.bundles` 顺序加载 bundle 包；本包的 `cordis.patch.yml` 往 host composition 插入一行插件，web 端按 `package.json` 的 `dsh.client` 拉取 `lib/client.js` 执行。插件本体只做四件事：

1. 往 keyed 槽位 `tool.call.toolview` 注册同名 key，**遮蔽**出厂工具卡片（停止插件即恢复，不动出厂代码）；
2. 往 keyed 槽位 `conversation.chat.streamingCall` 注册同一套 key 接管流式预览行，并在没有该座位的旧版 DSH 上退回 `conversation.input.dock`；
3. 从会话快照里发现 MCP 工具名并补注册上述槽位；
4. 注入一段样式表，把 DSH 原生 thinking 行（`[data-variant="think"]`）与节点间距调整到统一网格。

全部颜色走 DSH 主题 token（`--dsw-alias-*`），明暗主题自动跟随。

## 开发

```
lib/client.js     web 端全部渲染逻辑（ModuleLoader 工厂格式，无构建步骤）
lib/index.js      host 侧空挂载点（本插件无 host 能力）
cordis.patch.yml  bundle 挂载补丁（插入插件行）
dsh.plugin.json   插件清单
install.sh        curl|bash 安装器（幂等改写 profile package.json + pnpm install）
scripts/build-dynamic.mjs  由 lib/client.js 生成动态插件形态（沙盒里免装即改即试）
```

改动后：升 `package.json` 与 `dsh.plugin.json` 的 version → push → 使用侧 `cd ~/.dsh/profiles/web && pnpm up dsh-better-tool-ui` → 重启 dsh web。

## License

MIT
