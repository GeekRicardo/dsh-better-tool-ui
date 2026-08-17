# dsh-hebbian-rows

DeepSeek Harness（DSH）web 插件：把模型输出的**工具调用卡片**和 **thinking 行**渲染成 [hebbian](https://github.com/) desktop 的时间线风格——左侧贯通色轨、行内图标 + 工具名 + 中文描述 + 参数摘要、GitHub PR 风格的代码变更视图，goal 工具渲染成 callout 色块。

一句话：让 DSH 的工具流看起来像 hebbian 的活动流。

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/GeekRicardo/dsh-hebbian-rows/main/install.sh | bash
```

装完**重启 dsh web 并硬刷新**（Cmd/Ctrl+Shift+R）生效。

先看效果再决定（不写任何文件）：

```bash
curl -fsSL https://raw.githubusercontent.com/GeekRicardo/dsh-hebbian-rows/main/install.sh | bash -s -- --dry-run
```

## 渲染覆盖

**工具行**（`tool.call.toolview` 按名接管，19 个 key）：

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

**goal 系列**：`create_goal` 蓝 / `get_goal` 灰 / `update_goal`（complete 绿、blocked 红、pause 黄）callout 色块，直接嵌入消息流。

**thinking 行**：紫色轨（`#8c93f8`）+ 与工具行统一的 12px 网格、图标位对齐。

**流式工具预览**：write/edit 等大参数工具在参数流式生成期间，输入框上方出现一行「生成中… + 目标文件 + 已生成字符数」的实时预览，参数流完、正式卡片物化后自动消失。（DSH 的 tool-call 节点在参数流完才物化，这是插件层能拿到的最早信号。）

**间距**：连续工具行 / think 步骤之间 2px 等距贴合（负 margin 抵消聊天列 16px gap），含正文段落的消息不受影响。

**色轨语义**：绿 `#34d59a` 完成 / 蓝 `#3dbbf5` 运行中（呼吸动画）/ 红 `#ee5858` 错误或非零退出码；颜色取自 hebbian `runningRailColor` 原值。

## 卸载

```bash
cd ~/.dsh/profiles/web
node -e '
const fs = require("fs");
const p = "package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
delete (j.dependencies || {})["dsh-hebbian-rows"];
const b = j.dsh?.profile?.bundles ?? [];
j.dsh.profile.bundles = b.filter((x) => x !== "dsh-hebbian-rows");
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'
pnpm install
```

重启 dsh web 后恢复出厂渲染。

## 工作原理

DSH web 的 profile（`~/.dsh/profiles/web`）在 boot 时按 `package.json` 的 `dsh.profile.bundles` 顺序加载 bundle 包；本包的 `cordis.patch.yml` 往 host composition 插入一行插件，web 端按 `package.json` 的 `dsh.client` 拉取 `lib/client.js` 执行。插件本体只做两件事：

1. 往 keyed 槽位 `tool.call.toolview` 注册同名 key，**遮蔽**出厂工具卡片（停止插件即恢复，不动出厂代码）；
2. 注入一段样式表，把 DSH 原生 thinking 行（`[data-variant="think"]`）与节点间距调整到 hebbian 网格。

全部颜色走 DSH 主题 token（`--dsw-alias-*`），明暗主题自动跟随。

## 与动态插件的关系

本包是会话内动态 Cordis 插件 `hebrow-2`（v9）的固化版。动态版用于会话里边看边改（`cordis_define` / `cordis_run`），进程重启即丢；本包装进 profile 后随每次启动自动挂载。

## 开发

```
lib/client.js   web 端全部渲染逻辑（ModuleLoader 工厂格式，无构建步骤）
lib/index.js    host 侧空挂载点（本插件无 host 能力）
cordis.patch.yml  bundle 挂载补丁（插入插件行）
dsh.plugin.json   插件清单
install.sh        curl|bash 安装器（幂等改写 profile package.json + pnpm install）
```

改动后：升 `package.json` 与 `dsh.plugin.json` 的 version → push → 使用侧 `cd ~/.dsh/profiles/web && pnpm up dsh-hebbian-rows` → 重启 dsh web。

## License

MIT
