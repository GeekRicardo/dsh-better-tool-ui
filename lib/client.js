// dsh-better-tool-ui — web client face
//
// 把模型输出的工具调用卡片 / thinking 行渲染成紧凑的时间线风格：
// 左侧贯通色轨（done #34d59a / running #3dbbf5 / error #ee5858 / reasoning #8c93f8），
// 行内图标 + 工具名 + 中文描述 + 参数摘要，展开详情按工具分体（终端 / 行号代码 /
// GitHub 风 diff / 搜索结果 / web 引用 / todo 清单），goal 工具渲染成 callout 色块。
//
window.__ModuleLoader__.load({
  id: "dsh-better-tool-ui",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    // sessions 只用于扫出会话里出现过的工具名（见 startToolDiscovery）
    var inject = ["slots", "sessions"];
    var e = React.createElement;

    // 定时器统一走这两个 disposer 形态的包装：bundle 环境直接用 window 定时器，
    // 动态插件形态里换成 ctx.interval / ctx.timeout（随插件卸载自动清理）。
    var intervalFn = function (cb, ms) {
      var id = window.setInterval(cb, ms);
      return function () { window.clearInterval(id); };
    };
    var timeoutFn = function (cb, ms) {
      var id = window.setTimeout(cb, ms);
      return function () { window.clearTimeout(id); };
    };

    // Model Context Protocol 官方标志（simple-icons 的 modelcontextprotocol，24×24 填充路径）。
    // 其余图标是 lucide 风格的描边稿，所以这一个要单独走 fill 分支，不能套描边的 common 属性。
    var MCP_LOGO = "M13.85 0a4.16 4.16 0 0 0-2.95 1.217L1.456 10.66a.835.835 0 0 0 0 1.18a.835.835 0 0 0 1.18 0l9.442-9.442a2.49 2.49 0 0 1 3.541 0a2.49 2.49 0 0 1 0 3.541L8.59 12.97l-.1.1a.835.835 0 0 0 0 1.18a.835.835 0 0 0 1.18 0l.1-.098l7.03-7.034a2.49 2.49 0 0 1 3.542 0l.049.05a2.49 2.49 0 0 1 0 3.54l-8.54 8.54a1.96 1.96 0 0 0 0 2.755l1.753 1.753a.835.835 0 0 0 1.18 0a.835.835 0 0 0 0-1.18l-1.753-1.753a.266.266 0 0 1 0-.394l8.54-8.54a4.185 4.185 0 0 0 0-5.9l-.05-.05a4.16 4.16 0 0 0-2.95-1.218c-.2 0-.401.02-.6.048a4.17 4.17 0 0 0-1.17-3.552A4.16 4.16 0 0 0 13.85 0m0 3.333a.84.84 0 0 0-.59.245L6.275 10.56a4.186 4.186 0 0 0 0 5.902a4.186 4.186 0 0 0 5.902 0L19.16 9.48a.835.835 0 0 0 0-1.18a.835.835 0 0 0-1.18 0l-6.985 6.984a2.49 2.49 0 0 1-3.54 0a2.49 2.49 0 0 1 0-3.54l6.983-6.985a.835.835 0 0 0 0-1.18a.84.84 0 0 0-.59-.245";

    // DSH 自带的 bash 行图标（ui-primitives 的 IconApiOutline14 / figma ic_ds_api_outline）。
    // 整份取自 dsh 的 SVG：14×14 viewBox、三段 fill 路径、统一 translate。插件不引 dsh 的
    // React 组件（bundle 形态只有 ModuleLoader 的 require("react")），所以按原样内联路径。
    var DSH_API_ICON = {
      transform: "translate(0.6689 1.073)",
      paths: [
        "M11.4818 5.57813C11.4818 4.45301 11.4807 3.66237 11.4075 3.05908C11.3359 2.46953 11.2024 2.13852 10.9939 1.89441C10.9247 1.81341 10.8493 1.73801 10.7683 1.66882C10.5242 1.46033 10.1932 1.32686 9.60364 1.25525C9.00034 1.18198 8.20974 1.18091 7.0846 1.18091L5.57813 1.18091C4.45301 1.18091 3.66238 1.18198 3.05908 1.25525C2.46953 1.32686 2.13852 1.46033 1.89441 1.66882C1.81341 1.73801 1.73801 1.81341 1.66882 1.89441C1.46033 2.13852 1.32686 2.46953 1.25525 3.05908C1.18198 3.66238 1.18091 4.45301 1.18091 5.57813L1.18091 6.2771C1.18091 7.40218 1.18197 8.19288 1.25525 8.79614C1.32687 9.38553 1.46036 9.71674 1.66882 9.96082C1.73797 10.0417 1.81347 10.1173 1.89441 10.1864C2.13851 10.3948 2.46965 10.5275 3.05908 10.5991C3.66238 10.6724 4.45298 10.6735 5.57813 10.6735L7.0846 10.6735C8.20977 10.6735 9.00033 10.6724 9.60364 10.5991C10.1931 10.5275 10.5242 10.3948 10.7683 10.1864C10.8493 10.1173 10.9247 10.0417 10.9939 9.96082C11.2024 9.71674 11.3358 9.38553 11.4075 8.79614C11.4808 8.19288 11.4818 7.40218 11.4818 6.2771L11.4818 5.57813ZM12.6627 6.2771C12.6627 7.37222 12.6637 8.247 12.5798 8.93799C12.4942 9.64284 12.3133 10.2359 11.8928 10.7282C11.7834 10.8562 11.6637 10.9751 11.5356 11.0845C11.0434 11.5049 10.4511 11.6867 9.74634 11.7723C9.05525 11.8563 8.17999 11.8552 7.0846 11.8552L5.57813 11.8552C4.48273 11.8552 3.60747 11.8563 2.91638 11.7723C2.21157 11.6867 1.61933 11.5049 1.12708 11.0845C0.99901 10.9751 0.879281 10.8562 0.769898 10.7282C0.349454 10.2359 0.168506 9.64284 0.0828864 8.93799C-0.00101964 8.247 4.88512e-07 7.37222 6.47206e-07 6.2771L6.47206e-07 5.57813C6.47206e-07 4.48273 -0.00106163 3.60747 0.0828864 2.91638C0.168502 2.21168 0.349594 1.61928 0.769898 1.12708C0.879302 0.998981 0.998981 0.879302 1.12708 0.769898C1.61928 0.349594 2.21168 0.168502 2.91638 0.0828864C3.60747 -0.00106163 4.48273 6.47206e-07 5.57813 6.47206e-07L7.0846 6.47206e-07C8.17999 6.47206e-07 9.05525 -0.00106163 9.74634 0.0828864C10.451 0.168505 11.0434 0.349587 11.5356 0.769898C11.6637 0.879302 11.7834 0.998981 11.8928 1.12708C12.3131 1.61928 12.4942 2.21169 12.5798 2.91638C12.6638 3.60747 12.6627 4.48273 12.6627 5.57813L12.6627 6.2771Z",
        "M6.02607 5.50955L6.44306 5.9274L3.84284 8.52762L3.425 8.11063L3.00715 7.69278L4.77253 5.9274L3.00715 4.16202L3.84284 3.32633L6.02607 5.50955Z",
        "M9.23789 7.35397L9.23789 8.53488L6.96238 8.53488L6.96238 7.35397L9.23789 7.35397Z",
      ],
    };

    // ---------- lucide 风格描边小图标（内联 SVG，无依赖） ----------
    function svgIcon(kind) {
      var common = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
      var P = (d) => e("path", { d: d, key: "p" + d.slice(0, 12) });
      var L = (x1, y1, x2, y2) => e("line", { x1: x1, y1: y1, x2: x2, y2: y2, key: "l" + x1 + y1 + x2 + y2 });
      var C = (cx, cy, r) => e("circle", { cx: cx, cy: cy, r: r, key: "c" + cx + cy });
      var PL = (points) => e("polyline", { points: points, key: "pl" + points.slice(0, 10) });
      var R = (x, y, w, h, rx) => e("rect", { x: x, y: y, width: w, height: h, rx: rx, key: "r" + x + y + w + h });
      switch (kind) {
        // bash / 终端类：用 dsh 自带的那枚，和出厂行保持同一个视觉符号
        case "terminal": return e("svg", { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
          DSH_API_ICON.paths.map((d, i) => e("path", { key: "a" + i, transform: DSH_API_ICON.transform, d: d, fill: "currentColor" })));
        case "read": return e("svg", common, P("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"), PL("14 2 14 8 20 8"), L(16, 13, 8, 13), L(16, 17, 8, 17));
        case "pencil": return e("svg", common, P("M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"));
        case "search": return e("svg", common, C(11, 11, 8), L(21, 21, 16.65, 16.65));
        case "globe": return e("svg", common, C(12, 12, 10), L(2, 12, 22, 12), P("M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"));
        case "todo": return e("svg", common, PL("9 11 12 14 22 4"), P("M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"));
        case "sparkles": return e("svg", common, P("M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"));
        case "flag": return e("svg", common, P("M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"), L(4, 22, 4, 15));
        case "bot": return e("svg", common, P("M12 8V4H8"), R(4, 8, 16, 12, 2), P("M2 14h2"), P("M20 14h2"), P("M15 13v2"), P("M9 13v2"));
        case "send": return e("svg", common, P("m22 2-7 20-4-9-9-4Z"), P("M22 2 11 13"));
        case "help": return e("svg", common, C(12, 12, 10), P("M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"), L(12, 17, 12.01, 17));
        case "check": return e("svg", common, P("M22 11.08V12a10 10 0 1 1-5.93-9.14"), PL("22 4 12 14.01 9 11.01"));
        case "stop": return e("svg", common, C(12, 12, 9), R(9, 9, 6, 6, 1));
        case "mcp": return e("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" }, e("path", { d: MCP_LOGO, key: "mcp" }));
        default: return e("svg", common, P("M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"), PL("3.3 7 12 12 20.7 7"), L(12, 22, 12, 12));
      }
    }

    // ---------- 工具元数据映射（行内图标 / 名称 / 中文描述） ----------
    var TOOL_META = {
      bash: { label: "Bash", desc: "运行命令", icon: "terminal" },
      read: { label: "Read", desc: "读取文件", icon: "read" },
      write: { label: "Write", desc: "写入文件", icon: "pencil" },
      edit: { label: "Edit", desc: "编辑文件", icon: "pencil" },
      grep: { label: "Grep", desc: "搜索代码", icon: "search" },
      glob: { label: "Glob", desc: "匹配文件", icon: "search" },
      web_search: { label: "WebSearch", desc: "网络搜索", icon: "globe" },
      web_fetch: { label: "Fetch", desc: "抓取网页内容", icon: "globe" },
      todo_write: { label: "TodoWrite", desc: "任务列表", icon: "todo" },
      skill: { label: "Skill", desc: "读取技能说明", icon: "sparkles" },
      job_output: { label: "JobOutput", desc: "读取后台任务输出", icon: "terminal" },
      job_list: { label: "JobList", desc: "列出后台任务", icon: "todo" },
      job_kill: { label: "JobKill", desc: "停止后台任务", icon: "stop" },
      subagent: { label: "Subagent", desc: "委派子代理", icon: "bot" },
      subagent_fork: { label: "SubagentFork", desc: "派生上下文子代理", icon: "bot" },
      list_agents: { label: "ListAgents", desc: "列出子代理", icon: "bot" },
      send_message: { label: "SendMessage", desc: "派发消息", icon: "send" },
      validate_dsh_ui: { label: "ValidateUI", desc: "校验 GenUI 规范", icon: "check" },
      workflow: { label: "Workflow", desc: "编排多代理工作流", icon: "bot" },
      ask_user_question: { label: "AskUser", desc: "向用户提问", icon: "help" },
      interrupt_agent: { label: "InterruptAgent", desc: "打断子代理", icon: "stop" },
      report: { label: "Report", desc: "子代理汇报", icon: "send" },
      pwsh: { label: "PowerShell", desc: "运行命令", icon: "terminal" },
      ralph: { label: "Ralph", desc: "循环执行", icon: "bot" },
      read_image: { label: "ReadImage", desc: "读取图片", icon: "read" },
      notebook_edit: { label: "NotebookEdit", desc: "编辑 notebook", icon: "pencil" },
      exit_plan_mode: { label: "ExitPlanMode", desc: "退出计划模式", icon: "check" },
      cordis_run: { label: "CordisRun", desc: "执行 Cordis 脚本", icon: "terminal" },
      cordis_define: { label: "CordisDefine", desc: "定义动态插件", icon: "sparkles" },
      cordis_undefine: { label: "CordisUndefine", desc: "撤销动态插件", icon: "stop" },
      cordis_inspect_query: { label: "CordisQuery", desc: "查询 Cordis 图", icon: "search" },
      cordis_inspect_self: { label: "CordisSelf", desc: "读取自身节点", icon: "search" },
      cordis_inspect_list: { label: "CordisList", desc: "列出 Cordis 节点", icon: "todo" },
      probe_cordis_env: { label: "ProbeCordisEnv", desc: "探查 Cordis 环境", icon: "search" },
    };

    // ---------- 工具名归一 ----------
    // 同一件事在不同层的名字并不一样：dsh 自己发的调用是 bash / todo_write 这种蛇形小写，
    // 而 subagent、workflow 内层派发出来的子调用（tool/code-dispatch）带的是**驱动那一侧**
    // 的名字——例如 claude-in-dsh 驱动时是 Bash / Read / TodoWrite / Task 这种大驼峰。
    // keyed 槽位按精确 key 派发，所以这些名字过去全部落到出厂卡片。渲染分派统一先过这一层：
    // 大驼峰拆成蛇形小写，再走一张别名表，同一个工具无论出现在哪一层都落到同一套渲染。
    var NAME_ALIASES = {
      task: "subagent",
      agent: "subagent",
      dispatch_agent: "subagent",
      multi_edit: "edit",
      str_replace: "edit",
      notebook_read: "read",
      bash_output: "job_output",
      kill_shell: "job_kill",
      kill_bash: "job_kill",
      slash_command: "skill",
      web_search_tool: "web_search",
      todo_read: "todo_write",
    };

    function canonicalName(name) {
      var raw = String(name || "");
      // MCP 公开名本身就是契约的一部分（mcp__<server>__<tool>），不做任何改写
      if (raw.indexOf("mcp__") === 0) return raw;
      var snake = raw.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[- ]+/g, "_").toLowerCase();
      return NAME_ALIASES[snake] || snake;
    }

    // ---------- MCP 工具（公开名形如 mcp__<server>__<tool>） ----------
    // 命名契约来自 host 的 mcp-client：服务器名与原始工具名用 `__` 分隔，非法字符被
    // 换成 `_`，超长时尾部追加哈希——所以只按第一个 `__` 切一刀，不反解原始名。
    function mcpParts(name) {
      var raw = String(name || "");
      if (raw.indexOf("mcp__") !== 0) return null;
      var rest = raw.slice(5);
      var i = rest.indexOf("__");
      if (i < 0) return { server: rest, tool: rest };
      var tool = rest.slice(i + 2);
      return { server: rest.slice(0, i), tool: tool || rest.slice(0, i) };
    }

    // 行标题去掉与服务器同名的前缀（mcp__dsh__dsh_status → status），服务器名走单独的 chip
    function mcpLabel(parts) {
      var t = parts.tool;
      var dup = parts.server + "_";
      if (t.length > dup.length && t.indexOf(dup) === 0) return t.slice(dup.length);
      return t;
    }

    // 行摘要：MCP 没有统一的参数契约，按常见主参数名取第一个命中的标量，否则退回 k=v
    var MCP_SUMMARY_KEYS = ["url", "query", "q", "keyword", "path", "file_path", "pattern", "selector", "text", "name", "prompt", "command", "id", "session_id", "plugin", "key"];
    function mcpSummary(args) {
      for (var i = 0; i < MCP_SUMMARY_KEYS.length; i++) {
        var k = MCP_SUMMARY_KEYS[i];
        var v = args[k];
        if (v !== undefined && v !== null && typeof v !== "object") {
          var s1 = argStr(args, k);
          if (s1) return s1.length > 90 ? s1.slice(0, 90) + "…" : s1;
        }
      }
      var keys = Object.keys(args);
      for (var j = 0; j < keys.length; j++) {
        var v2 = args[keys[j]];
        if (v2 !== undefined && v2 !== null && typeof v2 !== "object") {
          var s2 = keys[j] + "=" + argStr(args, keys[j]);
          return s2.length > 90 ? s2.slice(0, 90) + "…" : s2;
        }
      }
      return "";
    }

    // str_replace_editor 按 command 子命令映射行元数据
    function metaFor(name, args, display) {
      var mcp = mcpParts(name);
      if (mcp) return { label: mcpLabel(mcp), desc: "MCP 工具", icon: "mcp", mcp: mcp };
      if (name === "str_replace_editor") {
        var cmd = argStr(args, "command");
        if (cmd === "view") return { label: "View", desc: "查看文件", icon: "read" };
        if (cmd === "create") return { label: "Create", desc: "创建文件", icon: "pencil" };
        if (cmd === "str_replace") return { label: "Edit", desc: "替换文本", icon: "pencil" };
        if (cmd === "insert") return { label: "Insert", desc: "插入文本", icon: "pencil" };
        if (cmd === "undo_edit") return { label: "UndoEdit", desc: "撤销编辑", icon: "pencil" };
        return { label: "StrEdit", desc: "编辑文件", icon: "pencil" };
      }
      return TOOL_META[name] || { label: display || name || "工具调用", desc: "工具调用", icon: "box" };
    }

    // ---------- 参数 / 文本工具 ----------
    function parseArgs(raw) {
      var t = String(raw || "").trim();
      if (!t) return {};
      try {
        var v = JSON.parse(t);
        if (v && typeof v === "object" && !Array.isArray(v)) return v;
      } catch (err) { /* 参数流不完整时按空对象处理 */ }
      return {};
    }

    function argStr(args, key) {
      var v = args[key];
      if (v === undefined || v === null) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try { return JSON.stringify(v); } catch (err) { return String(v); }
    }

    function basename(p) {
      var parts = String(p || "").split(/[\\/]/).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1] : String(p || "");
    }

    function relativize(p, cwd) {
      if (!p) return "";
      if (!cwd) return p;
      var w = String(cwd).replace(/\/+$/, "");
      if (p === w) return ".";
      if (p.indexOf(w + "/") === 0) return p.slice(w.length + 1);
      return p;
    }

    function headLines(text, max) {
      var lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
      if (lines.length <= max) return { text: lines.join("\n"), hidden: 0 };
      return { text: lines.slice(0, max).join("\n"), hidden: lines.length - max };
    }

    function tailLines(text, max) {
      var lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
      if (lines.length <= max) return { text: lines.join("\n"), hidden: 0 };
      return { text: lines.slice(lines.length - max).join("\n"), hidden: lines.length - max };
    }

    function prettyJson(raw) {
      var t = String(raw || "").trim();
      if (!t) return "";
      try { return JSON.stringify(JSON.parse(t), null, 2); } catch (err) { return t; }
    }

    // 结果内容拍平成文本：text 块原样，其余块 pretty JSON（对应 DSH resultText 语义）
    function resultText(block) {
      if (!block || block.kind !== "tool-result" || !Array.isArray(block.content)) return "";
      var parts = [];
      for (var bi = 0; bi < block.content.length; bi++) {
        var b = block.content[bi];
        if (b && typeof b === "object") {
          if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
          else {
            try { parts.push(JSON.stringify(b, null, 2)); } catch (err) { parts.push(String(b)); }
          }
        } else if (b !== null && b !== undefined) {
          parts.push(String(b));
        }
      }
      return parts.filter(Boolean).join("\n");
    }

    // ---------- 行级 diff（LCS）+ 前后行号 ----------
    function diffOps(oldText, newText) {
      var a = String(oldText).split("\n");
      var b = String(newText).split("\n");
      var n = a.length;
      var m = b.length;
      if (n * m > 60000) return null;
      var dp = [];
      for (var i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
      for (var ii = n - 1; ii >= 0; ii--) {
        for (var jj = m - 1; jj >= 0; jj--) {
          dp[ii][jj] = a[ii] === b[jj] ? dp[ii + 1][jj + 1] + 1 : Math.max(dp[ii + 1][jj], dp[ii][jj + 1]);
        }
      }
      var ops = [];
      var x = 0;
      var y = 0;
      var before = 1;
      var after = 1;
      while (x < n && y < m) {
        if (a[x] === b[y]) { ops.push({ t: " ", s: a[x], b: before++, a: after++ }); x++; y++; }
        else if (dp[x + 1][y] >= dp[x][y + 1]) { ops.push({ t: "-", s: a[x], b: before++, a: null }); x++; }
        else { ops.push({ t: "+", s: b[y], b: null, a: after++ }); y++; }
      }
      while (x < n) { ops.push({ t: "-", s: a[x], b: before++, a: null }); x++; }
      while (y < m) { ops.push({ t: "+", s: b[y], b: null, a: after++ }); y++; }
      return ops;
    }

    function addOnlyOps(text) {
      return String(text).split("\n").map((s, k) => ({ t: "+", s: s, b: null, a: k + 1 }));
    }

    // GitHub PR 风格代码变更视图：头部（文件名+徽标+±统计）+ 行号槽 + 符号列 + 整行底色
    function codeChangeView(o) {
      var addCount = o.ops.filter((r) => r.t === "+").length;
      var removeCount = o.ops.filter((r) => r.t === "-").length;
      var cap = o.cap || 120;
      var capped = o.ops.length > cap ? { ops: o.ops.slice(0, cap), hidden: o.ops.length - cap } : { ops: o.ops, hidden: 0 };
      var rows = capped.ops.map((r, j) => {
        var kids = [];
        if (o.gutters === 2) kids.push(e("span", { className: "btu-d2g", key: "b" }, r.b === null ? "" : String(r.b)));
        kids.push(e("span", { className: "btu-d2g", key: "a" }, r.a === null ? "" : String(r.a)));
        kids.push(e("span", { className: "btu-d2s", key: "s" }, r.t === " " ? "" : r.t));
        kids.push(e("span", { className: "btu-d2t", key: "t" }, r.s || " "));
        return e("div", { className: "btu-d2l", "data-t": r.t, key: "r" + j }, kids);
      });
      if (capped.hidden > 0) rows.push(e("div", { className: "btu-note", key: "m" }, "… 省略 " + capped.hidden + " 行"));
      var stats = [];
      if (addCount > 0) stats.push(e("span", { className: "btu-d2p", key: "p" }, "+" + addCount));
      if (removeCount > 0) stats.push(e("span", { className: "btu-d2m", key: "m" }, "−" + removeCount));
      return e("div", { className: "btu-diff2", key: "dv" }, [
        e("div", { className: "btu-diff2-head", key: "h" }, [
          e("span", { className: "btu-diff2-path", key: "p" }, basename(o.path) || "文件"),
          e("span", { className: "btu-diff2-badge", key: "b" }, o.actionLabel),
          e("span", { className: "btu-diff2-stats", key: "s" }, stats),
        ]),
        e("div", { className: "btu-diff2-body", key: "bd" }, rows),
      ]);
    }

    function todoSummary(args) {
      var todos = Array.isArray(args.todos) ? args.todos : [];
      if (todos.length === 0) return "";
      var done = todos.filter((t) => t && t.status === "completed").length;
      var act = todos.filter((t) => t && t.status === "in_progress").length;
      var segs = [todos.length + " 项", done + " 完成"];
      if (act > 0) segs.push(act + " 进行中");
      return segs.join(" · ");
    }

    function summaryFor(name, args, cwd) {
      if (name.indexOf("mcp__") === 0) return mcpSummary(args);
      switch (name) {
        case "bash": return argStr(args, "command");
        case "read": {
          var f = argStr(args, "file_path");
          if (!f) return "";
          var off = argStr(args, "offset");
          var lim = argStr(args, "limit");
          var range = off ? (lim ? off + "-" + (Number(off) + Number(lim) - 1) : off + "+") : "";
          return relativize(f, cwd) + (range ? ":#" + range : "");
        }
        case "write":
        case "edit": return basename(argStr(args, "file_path"));
        case "grep":
        case "glob": return argStr(args, "pattern");
        case "web_search": return argStr(args, "query");
        case "web_fetch": return argStr(args, "url");
        case "todo_write": return todoSummary(args);
        case "skill": return argStr(args, "name");
        case "job_output":
        case "job_kill": return argStr(args, "job_id");
        case "subagent":
        case "subagent_fork": return argStr(args, "description");
        case "send_message": return argStr(args, "subagent_id");
        case "ask_user_question": {
          var qs = Array.isArray(args.questions) ? args.questions : [];
          if (qs.length === 0) return "";
          var q0 = qs[0] || {};
          var h = (typeof q0.header === "string" && q0.header) || q0.question || "";
          return qs.length > 1 ? h + "（" + qs.length + " 问）" : h;
        }
        case "str_replace_editor": {
          var p = argStr(args, "path");
          var vr = Array.isArray(args.view_range) ? args.view_range : null;
          return relativize(p, cwd) + (vr && vr.length === 2 ? ":#" + vr[0] + "-" + vr[1] : "");
        }
        default: return argStr(args, "file_path") || argStr(args, "query") || "";
      }
    }

    // ---------- 详情体（按工具分体渲染） ----------
    // bash 终端块右上角的「已过/上限 s」计时：
    // running 时每秒滴答（仅在展开时启动定时器），settled 显示最终用时；
    // DSH bash 参数是 timeoutMs（毫秒），默认 120000ms。
    function BashElapsed(props) {
      var block = props.block || {};
      var nowState = React.useState(0);
      var now = nowState[0];
      var setNow = nowState[1];
      var running = props.running === true;
      React.useEffect(() => {
        if (!running || !props.active) return undefined;
        setNow(Date.now());
        return intervalFn(() => setNow(Date.now()), 1000);
      }, [running, props.active]);
      var hasCallTime = typeof block.callTime === "number";
      if (!running && !hasCallTime) return null;
      var secs = running
        ? Math.max(0, Math.floor(((now === 0 ? Date.now() : now) - block.time) / 1000))
        : Math.max(0, Math.round((block.time - block.callTime) / 1000));
      // 已完成的亚秒命令不显示（避免 0/120s 误导）
      if (!running && secs < 1) return null;
      var near = running && secs >= props.timeoutSecs * 0.8;
      return e("span", { className: "btu-term-elapsed", "data-near": near ? "1" : undefined }, secs + "/" + props.timeoutSecs + "s");
    }

    function termBody(args, cv, rv, running, block, open) {
      var cmd = argStr(args, "command") || (cv && cv.title) || "";
      var out = rv && typeof rv.output === "string" ? rv.output : "";
      if (!out && !running) out = resultText(block);
      var capped = tailLines(out, 60);
      var timeoutMs = typeof args.timeoutMs === "number" && isFinite(args.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : 120000;
      var kids = [];
      kids.push(e(BashElapsed, { key: "elapsed", block: block, running: running, active: open === true, timeoutSecs: Math.round(timeoutMs / 1000) }));
      if (cmd) kids.push(e("div", { className: "btu-term-cmd", key: "cmd" }, "$ " + cmd));
      kids.push(e("pre", { className: "btu-term-out", key: "out" },
        (capped.hidden > 0 ? "… 前略 " + capped.hidden + " 行\n" : "") +
        (capped.text || (running ? "等待输出…" : "（无输出）")) +
        (running ? "\n▍" : "")));
      if (rv && (typeof rv.exitCode === "number" || rv.signal)) {
        var failed = (typeof rv.exitCode === "number" && rv.exitCode !== 0) || !!rv.signal;
        kids.push(e("div", { className: "btu-term-status", "data-failed": failed ? "1" : undefined, key: "st" },
          rv.signal ? "被信号终止 " + rv.signal : "退出码 " + rv.exitCode));
      }
      return e("div", { className: "btu-term", key: "term" }, kids);
    }

    // job_output / job_list / job_kill：bash 同款终端块，尾部 [status: xxx] 解析成彩色状态条
    function jobBody(name, block, running) {
      var text = running ? "" : resultText(block);
      var status = "";
      var bodyText = text;
      if (name === "job_output") {
        var m = /\[status:\s*([a-z_]+)\]\s*$/m.exec(text);
        if (m) {
          status = m[1];
          bodyText = text.slice(0, m.index).replace(/\n+$/, "");
        }
      }
      var capped = tailLines(bodyText, 60);
      var kids = [
        e("pre", { className: "btu-term-out", key: "out" },
          (capped.hidden > 0 ? "… 前略 " + capped.hidden + " 行\n" : "") +
          (capped.text || (running ? "读取中…" : "（无输出）"))),
      ];
      if (status) {
        var tone = status === "running" ? "run" : (status === "completed" ? "ok" : "err");
        kids.push(e("div", { className: "btu-term-status", "data-tone": tone, key: "st" }, "status: " + status));
      }
      return e("div", { className: "btu-term", key: "job" }, kids);
    }

    function readBody(rv, block) {
      var lines = rv && Array.isArray(rv.lines) ? rv.lines : [];
      if (lines.length === 0) {
        return e("pre", { className: "btu-pre", key: "read" }, headLines(resultText(block), 60).text || "（空内容）");
      }
      var shown = lines.slice(0, 12);
      var kids = shown.map((l) => e("div", { className: "btu-code-line", key: "l" + l.number },
        e("span", { className: "btu-ln" }, String(l.number)),
        e("span", { className: "btu-ltxt" }, l.text)));
      var total = typeof rv.totalLines === "number" ? rv.totalLines : lines.length;
      if (lines.length > shown.length || total > shown[shown.length - 1].number) {
        kids.push(e("div", { className: "btu-note", key: "more" }, "… 共 " + total + " 行"));
      }
      return e("div", { className: "btu-code", key: "read" }, kids);
    }

    // write / edit（DSH diff 视图）：oldText null = 创建文件（纯新增单栏），否则行级 diff（双行号槽）
    function diffBody(diffs, cwd) {
      if (!Array.isArray(diffs) || diffs.length === 0) return null;
      return diffs.slice(0, 4).map((d, i) => {
        if (d.oldText === null || d.oldText === undefined) {
          return e("div", { key: "d" + (d.path || i) + i }, codeChangeView({ path: d.path, actionLabel: "创建文件", ops: addOnlyOps(String(d.newText || "")), cwd: cwd, gutters: 1 }));
        }
        var ops = diffOps(String(d.oldText), String(d.newText === null || d.newText === undefined ? "" : d.newText));
        if (!ops) return e("pre", { className: "btu-pre", key: "d" + i }, headLines(String(d.newText || ""), 60).text);
        return e("div", { key: "d" + (d.path || i) + i }, codeChangeView({ path: d.path, actionLabel: "修改文件", ops: ops, cwd: cwd, gutters: 2 }));
      });
    }

    function searchBody(rv) {
      if (rv.shape === "paths") {
        var paths = Array.isArray(rv.paths) ? rv.paths : [];
        var kids = paths.slice(0, 40).map((p) => e("div", { className: "btu-file", key: "p" + p }, p));
        if (rv.truncated || paths.length > 40) {
          kids.push(e("div", { className: "btu-note", key: "m" }, "… 共 " + (typeof rv.total === "number" ? rv.total : paths.length) + " 个路径"));
        }
        return e("div", { key: "search" }, kids);
      }
      var files = Array.isArray(rv.files) ? rv.files : [];
      var kids2 = [];
      files.slice(0, 20).forEach((f) => {
        kids2.push(e("div", { className: "btu-file", key: "f" + f.path }, f.path));
        var matches = Array.isArray(f.matches) ? f.matches : [];
        matches.slice(0, 20).forEach((mm, j) => {
          kids2.push(e("div", { className: "btu-ml", key: "f" + f.path + "m" + j },
            e("span", { className: "btu-ln" }, String(mm.lineNumber)),
            e("span", { className: "btu-ltxt" }, mm.line)));
        });
      });
      if (rv.truncated) kids2.push(e("div", { className: "btu-note", key: "m" }, "… 共 " + rv.total + " 条匹配，结果已截断"));
      return e("div", { key: "search" }, kids2);
    }

    function webBody(rv, block) {
      var kids = [];
      if (rv.kind === "search") {
        if (rv.answer) kids.push(e("div", { className: "btu-web-answer", key: "a" }, headLines(rv.answer, 12).text));
        var srcs = Array.isArray(rv.sources) ? rv.sources : [];
        srcs.slice(0, 8).forEach((s, j) => {
          kids.push(e("a", { className: "btu-web-src", href: s.url, target: "_blank", rel: "noreferrer", key: "s" + j }, s.title || s.url));
          if (s.snippet) kids.push(e("div", { className: "btu-web-snip", key: "sn" + j }, s.snippet));
        });
        if (rv.truncated) kids.push(e("div", { className: "btu-note", key: "m" }, "… 来源列表已截断"));
      } else {
        kids.push(e("div", { className: "btu-file", key: "u" },
          (rv.url || "") + (typeof rv.statusCode === "number" ? " · HTTP " + rv.statusCode : "")));
        var text = resultText(block);
        if (text) kids.push(e("pre", { className: "btu-pre", key: "c" }, headLines(text, 60).text));
      }
      return e("div", { key: "web" }, kids);
    }

    function todoBody(args) {
      var todos = Array.isArray(args.todos) ? args.todos : [];
      if (todos.length === 0) return e("div", { className: "btu-note", key: "todo" }, "空任务列表");
      return e("div", { key: "todo" }, todos.slice(0, 30).map((t, j) => {
        var s = t && t.status === "completed" ? "completed" : (t && t.status === "in_progress" ? "in_progress" : "pending");
        var mark = s === "completed" ? "✓" : (s === "in_progress" ? "◐" : "○");
        var text = String((t && (s === "in_progress" && t.activeForm ? t.activeForm : t.content)) || "");
        return e("div", { className: "btu-todo", "data-s": s, key: "t" + j },
          e("span", { className: "btu-todo-mark" }, mark),
          e("span", null, text));
      }));
    }

    // str_replace_editor：str_replace 走 GitHub 风 diff 视图，insert/create 走纯新增视图（不附结果文本）
    function sreBody(args, block, running, cwd) {
      var cmd = argStr(args, "command");
      var kids = [];
      if (cmd === "str_replace") {
        var ops = diffOps(argStr(args, "old_str"), argStr(args, "new_str"));
        if (ops) {
          kids.push(codeChangeView({ path: argStr(args, "path"), actionLabel: "修改文件", ops: ops, cwd: cwd, gutters: 2 }));
          return e("div", { key: "sre" }, kids);
        }
      } else if (cmd === "insert") {
        kids.push(codeChangeView({ path: argStr(args, "path"), actionLabel: "插入文本（第 " + (argStr(args, "insert_line") || "?") + " 行）", ops: addOnlyOps(argStr(args, "new_str")), cwd: cwd, gutters: 1 }));
        return e("div", { key: "sre" }, kids);
      } else if (cmd === "create") {
        kids.push(codeChangeView({ path: argStr(args, "path"), actionLabel: "创建文件", ops: addOnlyOps(argStr(args, "file_text")), cwd: cwd, gutters: 1 }));
        return e("div", { key: "sre" }, kids);
      }
      var out = running ? "" : resultText(block);
      if (out) kids.push(e("pre", { className: "btu-pre", key: "out" }, headLines(out, cmd === "view" ? 60 : 30).text));
      if (running) kids.push(e("div", { className: "btu-note", key: "r" }, "运行中…"));
      return e("div", { key: "sre" }, kids);
    }

    // ---------- MCP 详情体 ----------
    // MCP 结果到了 web 端只剩文本块（host 端把 content 数组拍平成一段 text，
    // 图片/音频/资源字节在那一步就被丢弃并换成 [image: …] 之类的占位行），
    // 所以这里能做的美化是两件事：参数排成 key/value，结果按 JSON / 占位 / 纯文本分流。
    function mcpArgsRows(args) {
      var keys = Object.keys(args || {});
      if (keys.length === 0) return [e("div", { className: "btu-note", key: "empty" }, "无参数")];
      var rows = keys.slice(0, 16).map((k, i) => {
        var v = args[k];
        if (v !== null && typeof v === "object") {
          var pretty = "";
          try { pretty = JSON.stringify(v, null, 2); } catch (err) { pretty = String(v); }
          var capped = headLines(pretty, 20);
          return e("div", { className: "btu-kv", "data-block": "1", key: "a" + i },
            e("span", { className: "btu-kv-k" }, k),
            e("pre", { className: "btu-kv-json" }, capped.text + (capped.hidden > 0 ? "\n… 省略 " + capped.hidden + " 行" : "")));
        }
        var text = argStr(args, k);
        if (text.length > 400) text = text.slice(0, 400) + "…";
        return e("div", { className: "btu-kv", key: "a" + i },
          e("span", { className: "btu-kv-k" }, k),
          e("span", { className: "btu-kv-v" }, text === "" ? "（空）" : text));
      });
      if (keys.length > 16) rows.push(e("div", { className: "btu-note", key: "more" }, "… 另有 " + (keys.length - 16) + " 个参数"));
      return rows;
    }

    // JSON 轻着色：字符串键 / 字符串值 / 数字 / 字面量各着一色，其余原样。
    // 只在结果确实 parse 成功后作用于 pretty 输出，所以不必处理非法 JSON。
    var JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
    var JSON_HIGHLIGHT_MAX = 40000;
    function jsonNodes(text) {
      var out = [];
      var last = 0;
      var n = 0;
      var m;
      JSON_TOKEN.lastIndex = 0;
      while ((m = JSON_TOKEN.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index));
        if (m[1] !== undefined) out.push(e("span", { className: m[2] ? "btu-jk" : "btu-js", key: "t" + (n++) }, m[1] + (m[2] || "")));
        else if (m[3] !== undefined) out.push(e("span", { className: "btu-jn", key: "t" + (n++) }, m[3]));
        else out.push(e("span", { className: "btu-jb", key: "t" + (n++) }, m[4]));
        last = m.index + m[0].length;
      }
      if (last < text.length) out.push(text.slice(last));
      return out;
    }

    // host 端 extractText 对非文本块写下的占位行
    var MCP_MEDIA_LINE = /^\[(image|audio|resource|unsupported content type)[^\]]*\]$/;

    function mcpResultNodes(block) {
      var trimmed = String(resultText(block) || "").trim();
      if (trimmed === "") return [e("div", { className: "btu-note", key: "e" }, "（无输出）")];
      var lines = trimmed.split("\n");
      if (lines.every((l) => MCP_MEDIA_LINE.test(l.trim()))) {
        return lines.map((l, i) => e("div", { className: "btu-media", key: "m" + i }, l.trim()));
      }
      var first = trimmed.charAt(0);
      if (first === "{" || first === "[") {
        try {
          var pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
          var capped = headLines(pretty, 200);
          var out = [e("pre", { className: "btu-pre btu-json", key: "j" },
            capped.text.length <= JSON_HIGHLIGHT_MAX ? jsonNodes(capped.text) : capped.text)];
          if (capped.hidden > 0) out.push(e("div", { className: "btu-note", key: "n" }, "… 省略 " + capped.hidden + " 行"));
          return out;
        } catch (err) { /* 不是合法 JSON，按纯文本渲染 */ }
      }
      var t = headLines(trimmed, 80);
      var res = [e("pre", { className: "btu-pre", key: "p" }, t.text)];
      if (t.hidden > 0) res.push(e("div", { className: "btu-note", key: "n" }, "… 省略 " + t.hidden + " 行"));
      return res;
    }

    function mcpBody(args, block, running) {
      var kids = [
        e("div", { className: "btu-sec", key: "as" }, "参数"),
        e("div", { className: "btu-kvs", key: "a" }, mcpArgsRows(args)),
      ];
      // 失败时结果文本就是错误正文，交给行尾统一的错误块渲染，避免同一段文字出现两遍
      if (running) kids.push(e("div", { className: "btu-note", key: "r" }, "调用中…"));
      else if (block.isError !== true) {
        kids.push(e("div", { className: "btu-sec", key: "rs" }, "结果"));
        kids.push(e("div", { key: "r" }, mcpResultNodes(block)));
      }
      return e("div", { key: "mcp" }, kids);
    }

    function genericBody(argsRaw, block, running) {
      var kids = [];
      var pretty = prettyJson(argsRaw);
      if (pretty) {
        kids.push(e("div", { key: "i" },
          e("div", { className: "btu-sec" }, "输入"),
          e("pre", { className: "btu-pre" }, headLines(pretty, 40).text)));
      }
      if (!running) {
        var out = resultText(block);
        if (out) {
          kids.push(e("div", { key: "o" },
            e("div", { className: "btu-sec" }, "输出"),
            e("pre", { className: "btu-pre" }, headLines(out, 60).text)));
        }
      } else {
        kids.push(e("div", { className: "btu-note", key: "r" }, "运行中…"));
      }
      return e("div", { key: "gen" }, kids);
    }

    // ---------- ask_user_question：分页面板渲染问题与答案 ----------
    // 参数是 questions[]（id/question/header/options/multi_select），结果是
    // { answers: [{ id, selected: string[], custom? }] }（output.render 拍成 JSON 文本）。
    // 按 id 把答案对回问题；多个问题在同一面板内翻页，每页一个问题。

    function parseAskAnswers(block) {
      var text = String(resultText(block) || "").trim();
      if (!text) return {};
      try {
        var v = JSON.parse(text);
        if (!v || !Array.isArray(v.answers)) return {};
        var map = {};
        for (var i = 0; i < v.answers.length; i++) {
          var a = v.answers[i];
          if (a && typeof a.id === "string") map[a.id] = a;
        }
        return map;
      } catch (err) { /* 结果流不完整或非 JSON：按无答案处理 */ }
      return {};
    }

    function askQuestions(args) {
      var qs = args && Array.isArray(args.questions) ? args.questions : [];
      var out = [];
      for (var i = 0; i < qs.length; i++) {
        var q = qs[i];
        if (q && typeof q === "object" && typeof q.question === "string") out.push(q);
      }
      return out;
    }

    function AskPanel(props) {
      var questions = props.questions || [];
      var answers = props.answers || {};
      var running = props.running === true;
      var count = questions.length;
      var st = React.useState(0);
      var page = st[0];
      var setPage = st[1];
      if (count === 0) {
        return e("div", { className: "btu-note", key: "ask" }, running ? "等待回答…" : "（无问题数据）");
      }
      // 流式期间问题数组会增长，页码可能越界；越界时落到最后一页
      var idx = page >= count ? count - 1 : page;
      var q = questions[idx];
      var ans = answers[q.id] || null;
      var selected = ans && Array.isArray(ans.selected) ? ans.selected : [];
      var multi = q.multi_select === true || q.multiSelect === true;

      var headKids = [];
      if (typeof q.header === "string" && q.header) headKids.push(e("span", { className: "btu-ask-qtitle", key: "h" }, q.header));
      if (multi) headKids.push(e("span", { className: "btu-ask-tag", key: "m" }, "可多选"));

      var body = [];
      body.push(e("div", { className: "btu-ask-qbody", key: "q" }, q.question));
      if (typeof q.detail === "string" && q.detail) body.push(e("div", { className: "btu-ask-qdetail", key: "d" }, q.detail));

      var opts = Array.isArray(q.options) ? q.options : [];
      if (opts.length > 0) {
        body.push(e("div", { className: "btu-ask-opts", key: "opts" }, opts.map(function (opt, j) {
          var label = opt && typeof opt.label === "string" ? opt.label : String(opt && opt.label !== undefined ? opt.label : "");
          var isSel = selected.indexOf(label) >= 0;
          var mark = isSel ? (multi ? "✓" : "●") : "○";
          var kids = [e("span", { className: "btu-ask-opt-mark", key: "m" }, mark),
            e("span", { className: "btu-ask-opt-label", key: "l" }, label)];
          if (opt && typeof opt.description === "string" && opt.description) {
            kids.push(e("span", { className: "btu-ask-opt-desc", key: "d" }, opt.description));
          }
          return e("div", { className: "btu-ask-opt", "data-sel": isSel ? "1" : "0", key: "o" + j }, kids);
        })));
      }

      if (ans && typeof ans.custom === "string" && ans.custom !== "") {
        body.push(e("div", { className: "btu-ask-custom", key: "c" },
          e("span", { className: "btu-ask-custom-k", key: "k" }, "自定义"),
          e("span", { className: "btu-ask-custom-v", key: "v" }, ans.custom)));
      }

      if (running) body.push(e("div", { className: "btu-note", key: "w" }, "等待回答…"));
      else if (!ans) body.push(e("div", { className: "btu-note", key: "na" }, "（未回答）"));

      var pager = null;
      if (count > 1) {
        pager = e("div", { className: "btu-ask-pager", key: "pager" },
          e("button", { type: "button", className: "btu-ask-pager-btn", key: "prev", "aria-label": "上一个问题", disabled: idx <= 0 ? true : undefined, onClick: function () { setPage(function (p) { return p <= 0 ? 0 : p - 1; }); } }, "‹"),
          e("span", { className: "btu-ask-pager-label", key: "label" }, (idx + 1) + " / " + count),
          e("button", { type: "button", className: "btu-ask-pager-btn", key: "next", "aria-label": "下一个问题", disabled: idx >= count - 1 ? true : undefined, onClick: function () { setPage(function (p) { return p >= count - 1 ? count - 1 : p + 1; }); } }, "›"));
      }

      return e("div", { className: "btu-ask", key: "ask" },
        pager,
        headKids.length > 0 ? e("div", { className: "btu-ask-qhead", key: "qhead" }, headKids) : null,
        body);
    }

    function renderDetail(o) {
      var rv = o.rv;
      var cv = o.cv;
      var kids = [];
      if (o.mcp) kids.push(mcpBody(o.args, o.block, o.running));
      else if (rv && rv.card === "terminal") kids.push(termBody(o.args, cv, rv, o.running, o.block, o.open));
      else if (rv && rv.card === "read") kids.push(readBody(rv, o.block));
      else if (rv && rv.card === "diff") kids.push(diffBody(rv.diffs, o.cwd));
      else if (rv && rv.card === "search") kids.push(searchBody(rv));
      else if (rv && rv.card === "web") kids.push(webBody(rv, o.block));
      else if (cv && cv.card === "terminal") kids.push(termBody(o.args, cv, null, o.running, o.block, o.open));
      else if (cv && cv.card === "diff") kids.push(diffBody(cv.diffs, o.cwd));
      else if (o.name === "bash") kids.push(termBody(o.args, null, null, o.running, o.block, o.open));
      else if (o.name === "job_output" || o.name === "job_list" || o.name === "job_kill") kids.push(jobBody(o.name, o.block, o.running));
      else if (o.name === "str_replace_editor") kids.push(sreBody(o.args, o.block, o.running, o.cwd));
      else if (o.name === "todo_write") kids.push(todoBody(o.args));
      else if (o.name === "ask_user_question") kids.push(e(AskPanel, { questions: askQuestions(o.args), answers: parseAskAnswers(o.block), running: o.running }));
      else kids.push(genericBody(o.argsRaw, o.block, o.running));
      if (!o.running && o.block.isError === true) {
        var err = o.block.error;
        var line = err ? (err.name + (err.code ? " · " + err.code : "")) : "";
        var text = resultText(o.block);
        kids.push(e("div", { className: "btu-error", key: "err" }, [line, text].filter(Boolean).join("\n") || "调用失败"));
      }
      return kids;
    }

    // running 的 bash 自动展开看实时输出，settled 后自动收回。亚秒命令会让这一展一收
    // 变成一次闪烁，所以自动展开至少停留 AUTO_OPEN_HOLD_MS 再收——注意这只推迟折叠，
    // 色轨的 running(蓝)→ok(绿) 仍按真实完成时刻变，两者是各自独立的状态。
    //
    // 起始时刻按 callId 记在组件外：running→settled 之间这一行若被重建，停留时长
    // 不会跟着重新计时，重建后也能接着把剩下的时间撑完。
    var AUTO_OPEN_HOLD_MS = 2000;
    var AUTO_OPEN_MAX = 200;
    var autoOpenAt = new Map();

    function autoOpenStart(id) {
      var at = autoOpenAt.get(id);
      if (at !== undefined) return at;
      // 组件卸载会取消收回的定时器，条目就留在表里了；按插入序淘汰最老的封住增长
      if (autoOpenAt.size >= AUTO_OPEN_MAX) autoOpenAt.delete(autoOpenAt.keys().next().value);
      at = Date.now();
      autoOpenAt.set(id, at);
      return at;
    }

    function useAutoOpenHold(wantOpen, id) {
      var st = React.useState(function () {
        if (wantOpen) return true;
        var at = id ? autoOpenAt.get(id) : undefined;
        return at !== undefined && Date.now() - at < AUTO_OPEN_HOLD_MS;
      });
      var held = st[0];
      var setHeld = st[1];
      React.useEffect(function () {
        if (wantOpen) {
          if (id) autoOpenStart(id);
          setHeld(true);
          return undefined;
        }
        var at = id ? autoOpenAt.get(id) : undefined;
        if (at === undefined) return undefined; // 从没自动展开过：本来就该是折叠的
        var left = AUTO_OPEN_HOLD_MS - (Date.now() - at);
        if (left <= 0) {
          autoOpenAt.delete(id);
          setHeld(false);
          return undefined;
        }
        setHeld(true);
        return timeoutFn(function () {
          autoOpenAt.delete(id);
          setHeld(false);
        }, left);
      }, [wantOpen, id]);
      return held;
    }

    // ---------- 工具行：左贯通色轨 + 行内容 ----------
    function ToolRow(props) {
      var block = props.block || {};
      var settled = block.kind === "tool-result";
      var running = !settled;
      var wireName = props.toolName || (running ? block.name : (block.call && block.call.name) || "");
      // 归一后的名字只用于渲染分派；行标题仍走 metaFor（未知名字回落到原始 wireName）
      var toolKey = canonicalName(wireName);
      var argsRaw = running ? (block.argsRaw || "") : ((block.call && block.call.argsRaw) || "");
      var args = parseArgs(argsRaw);
      var meta = metaFor(toolKey, args, wireName);
      var rv = settled ? (block.resultView || null) : null;
      var cv = block.callView || null;
      var isError = settled && block.isError === true;
      var failedExit = !!(rv && rv.card === "terminal" && ((typeof rv.exitCode === "number" && rv.exitCode !== 0) || rv.signal));
      var state = running ? "running" : (isError || failedExit ? "error" : "ok");

      // running 的 bash 默认展开看实时输出，其余默认折叠；点击相对默认值取反。
      // 折叠回默认值这一步过 useAutoOpenHold，短命令的展开不至于只闪一下。
      var defaultOpen = useAutoOpenHold(running && toolKey === "bash", block.callId || "");
      var st = React.useState(false);
      var toggled = st[0];
      var setToggled = st[1];
      var open = toggled ? !defaultOpen : defaultOpen;
      var toggle = () => setToggled((v) => !v);

      // MCP 工具的参数里 description 可能是业务字段，不能当行描述；服务器名走 chip
      var mcp = meta.mcp || null;
      var desc = mcp ? "" : (argStr(args, "description") || meta.desc);
      var summary = summaryFor(toolKey, args, props.cwd);

      // 文件类工具：行内「打开」小按钮（不打断折叠交互）；兼容 file_path / path 两种参数名
      var filePath = argStr(args, "file_path") || argStr(args, "path");
      var openable = filePath && typeof props.openFile === "function";
      var openTarget = openable
        ? (filePath.charAt(0) === "/" || !props.cwd ? filePath : String(props.cwd).replace(/\/+$/, "") + "/" + filePath)
        : "";

      var headKids = [
        e("span", { className: "btu-icon", key: "i" }, svgIcon(meta.icon)),
        e("span", { className: "btu-name", key: "n" }, meta.label),
      ];
      if (mcp) headKids.push(e("span", { className: "btu-chip", key: "srv", title: "MCP 服务器：" + mcp.server }, mcp.server));
      if (desc) headKids.push(e("span", { className: "btu-desc", key: "d" }, desc));
      if (summary) headKids.push(e("code", { className: "btu-sum", key: "s" }, summary));
      if (failedExit) {
        headKids.push(e("span", { className: "btu-exit", key: "x" }, rv.signal ? "signal " + rv.signal : "exit " + rv.exitCode));
      }
      if (openable) {
        headKids.push(e("span", {
          className: "btu-open", key: "o", title: "打开文件", role: "button", tabIndex: 0,
          onClick: (ev) => { ev.stopPropagation(); props.openFile(openTarget); },
          onKeyDown: (ev) => { if (ev.key === "Enter") { ev.stopPropagation(); props.openFile(openTarget); } },
        }, "↗"));
      }

      var bodyKids = renderDetail({ name: toolKey, block: block, running: running, args: args, argsRaw: argsRaw, rv: rv, cv: cv, cwd: props.cwd, open: open, mcp: mcp });

      // 子调用（subagent / workflow / code-dispatch）不在这里画：dsh 的 ToolCallTree 已经
      // 把 block.subCalls 递归展开成本行的兄弟节点，每个子调用都单独过一次 tool.call.toolview
      // 派发——也就是说它们本来就会落到本组件上。插件再自绘一遍就是同一棵树渲染两次，
      // 所以这里只负责本行，子树的外观交给样式表里的 [data-subcalls] 规则。

      return e("div", { className: "btu-row", "data-state": state },
        e("button", { type: "button", className: "btu-rail", onClick: toggle, title: open ? "折叠" : "展开", "aria-label": open ? "折叠工具调用" : "展开工具调用" }),
        e("div", { className: "btu-card", "data-open": open ? "1" : "0" },
          e("button", { type: "button", className: "btu-head", onClick: toggle, "aria-expanded": open ? "true" : "false" }, headKids),
          e("div", { className: "btu-detail" },
            e("div", { className: "btu-detail-in" },
              e("div", { className: "btu-body" }, bodyKids)))));
    }

    // ---------- goal 系列：结构化状态块，未完成淡橙黄 / 完成淡绿 / 受阻淡红 ----------
    // create_goal / get_goal / update_goal 的工具结果都是 { goal: { id, revision, objective,
    // phase, roundsStarted, maxGoalRounds, blockedReason? }, activation }，解析成字段行展示。

    function parseGoalValue(raw) {
      var t = String(raw || "").trim();
      if (!t) return null;
      try {
        var v = JSON.parse(t);
        if (v && typeof v === "object" && !Array.isArray(v)) return v;
      } catch (err) { /* 参数流不完整时按 null 处理 */ }
      return null;
    }

    function shortId(id) {
      var s = String(id || "");
      return s.length > 16 ? s.slice(0, 8) + "…" + s.slice(-6) : s;
    }

    // 未完成（active/paused/新建/更新）一律淡橙黄，完成淡绿，受阻淡红
    function goalTone(phase) {
      if (phase === "complete") return "success";
      if (phase === "blocked") return "error";
      return "amber";
    }

    function GoalCard(props) {
      var block = props.block || {};
      var settled = block.kind === "tool-result";
      var argsRaw = settled ? ((block.call && block.call.argsRaw) || "") : (block.argsRaw || "");
      var args = parseArgs(argsRaw);
      var name = props.toolName || "";
      var result = settled ? parseGoalValue(resultText(block)) : null;
      var goal = result && result.goal ? result.goal : null;
      var phase = goal ? String(goal.phase || "") : "";
      var action = argStr(args, "action") || "";

      var title = "目标";
      if (name === "create_goal") title = "设定目标";
      else if (name === "get_goal") title = phase === "blocked" ? "目标受阻" : "当前目标";
      else if (action === "complete") title = "目标完成";
      else if (action === "blocked") title = "目标受阻";
      else if (action === "pause") title = "目标暂停";
      else if (action === "resume") title = "目标恢复";
      else title = "目标已更新";
      var tone = goalTone(phase || (action === "complete" ? "complete" : (action === "blocked" ? "blocked" : "")));

      var headKids = [
        e("span", { className: "btu-callout-dot", key: "dot" }),
        e("span", { className: "btu-callout-title", key: "title" }, title),
      ];
      if (phase) headKids.push(e("span", { className: "btu-goal-phase", key: "ph" }, phase));

      var kids = [e("div", { className: "btu-callout-head", key: "head" }, headKids)];
      if (goal) {
        var rows = [];
        if (goal.id) rows.push(["ID", shortId(goal.id)]);
        if (typeof goal.revision === "number") rows.push(["Revision", String(goal.revision)]);
        rows.push(["Phase", String(goal.phase || "")]);
        if (result && result.activation !== undefined && result.activation !== null && result.activation !== "") {
          rows.push(["Activation", String(result.activation)]);
        }
        if (typeof goal.roundsStarted === "number" && typeof goal.maxGoalRounds === "number") {
          rows.push(["Rounds", goal.roundsStarted + "/" + goal.maxGoalRounds]);
        }
        if (goal.objective) rows.push(["Objective", goal.objective]);
        if (goal.blockedReason && goal.blockedReason.message) rows.push(["Blocked", goal.blockedReason.message]);
        kids.push(e("div", { className: "btu-goal-kv", key: "kv" }, rows.map(function (row, j) {
          return e("div", { className: "btu-goal-kv-row", key: "k" + j },
            e("span", { className: "btu-goal-k", key: "k" }, row[0]),
            e("span", { className: "btu-goal-v", key: "v" }, row[1]));
        })));
      } else {
        var body = argStr(args, "blocked_reason") || argStr(args, "objective") || (settled ? resultText(block) : "更新中…");
        if (body) kids.push(e("div", { className: "btu-callout-body", key: "body" }, body));
      }
      var rounds = typeof args.max_goal_rounds === "number"
        ? args.max_goal_rounds
        : (goal && typeof goal.maxGoalRounds === "number" ? goal.maxGoalRounds : null);
      if (rounds !== null) kids.push(e("div", { className: "btu-callout-rounds", key: "rounds" }, "最多 " + rounds + " 轮"));
      return e("div", { className: "btu-callout btu-goal", "data-tone": tone }, kids);
    }

    // ---------- goal 上下文注入：把内置「上下文注入 · goal」纯文本面板替换成状态块 ----------
    // goal 轮次注入（source.kind='goal'，每轮 <goal_round> 提示，恒为未完成态）渲染成淡橙黄
    // 「当前目标」块；tool-goal 收尾注入（source.plugin='tool-goal'，complete/blocked 后的
    // 提示）渲染成绿/红块；其余上下文注入回退为内置样式的折叠行（标题 + 来源 + 可展开正文）。

    function contentText(content) {
      var parts = [];
      var list = Array.isArray(content) ? content : [];
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (b && typeof b === "object" && b.type === "text" && typeof b.text === "string") parts.push(b.text);
      }
      return parts.join("\n");
    }

    function extractQuoted(marker, text) {
      var re = new RegExp(marker + "\\s*:\\s*(\"(?:[^\"\\\\]|\\\\.)*\"|\\S+)");
      var m = re.exec(String(text || ""));
      if (!m) return "";
      var v = m[1];
      if (v.charAt(0) === '"') {
        try { return JSON.parse(v); } catch (err) { return v.slice(1, -1); }
      }
      return v;
    }

    function goalRoundBlock(data) {
      var text = contentText(data.content);
      var objective = extractQuoted("Objective", text);
      var roundM = /Round:\s*(\d+)\s*\/\s*(\d+)/.exec(text);
      var rows = [
        e("div", { className: "btu-goal-kv-row", key: "o" },
          e("span", { className: "btu-goal-k", key: "k" }, "Objective"),
          e("span", { className: "btu-goal-v", key: "v" }, objective || text || "（空）")),
      ];
      if (roundM) rows.push(e("div", { className: "btu-goal-kv-row", key: "r" },
        e("span", { className: "btu-goal-k", key: "k" }, "Round"),
        e("span", { className: "btu-goal-v", key: "v" }, roundM[1] + "/" + roundM[2])));
      return e("div", { className: "btu-callout btu-goal", "data-tone": "amber", key: "g" },
        e("div", { className: "btu-callout-head", key: "head" },
          e("span", { className: "btu-callout-dot", key: "dot" }),
          e("span", { className: "btu-callout-title", key: "title" }, "当前目标"),
          e("span", { className: "btu-goal-phase", key: "ph" }, "active")),
        e("div", { className: "btu-goal-kv", key: "kv" }, rows));
    }

    function toolGoalBlock(data) {
      var source = data.source || {};
      var summary = typeof source.summary === "string" ? source.summary : "";
      var text = contentText(data.content);
      var tone = "amber";
      var title = "目标更新";
      if (summary.indexOf("complete") === 0) { tone = "success"; title = "目标完成"; }
      else if (summary.indexOf("blocked") === 0) { tone = "error"; title = "目标受阻"; }
      return e("div", { className: "btu-callout btu-goal", "data-tone": tone, key: "tg" },
        e("div", { className: "btu-callout-head", key: "head" },
          e("span", { className: "btu-callout-dot", key: "dot" }),
          e("span", { className: "btu-callout-title", key: "title" }, title)),
        e("div", { className: "btu-callout-body", key: "body" }, text || summary || "（空内容）"));
    }

    // 非 goal 上下文注入的回退折叠行：复刻内置 ContextInjectionRow（DisclosureRow）观感
    function FallbackContextRow(props) {
      var data = props.node && props.node.data ? props.node.data : (props.data || {});
      var st = React.useState(false);
      var open = st[0];
      var setOpen = st[1];
      var provenance = data.provenance || {};
      var title = provenance.role === "recall" ? "上下文召回" : "上下文注入";
      var label = provenance.label;
      var summary = (data.source && typeof data.source.summary === "string") ? data.source.summary : null;
      var text = contentText(data.content);
      var headKids = [
        e("span", { className: "btu-ctx-chevron", "data-open": open ? "1" : "0", key: "cv" }, "▸"),
        e("span", { className: "btu-ctx-title", key: "t" }, title),
      ];
      if (label) {
        headKids.push(e("span", { className: "btu-ctx-sep", key: "s1", "aria-hidden": true }));
        headKids.push(e("span", { className: "btu-ctx-source", key: "s" }, label));
      }
      if (summary) {
        headKids.push(e("span", { className: "btu-ctx-sep", key: "s2", "aria-hidden": true }));
        headKids.push(e("span", { className: "btu-ctx-summary", key: "su" }, summary));
      }
      return e("div", { className: "btu-ctx", key: "ctx" },
        e("button", {
          type: "button", className: "btu-ctx-head",
          onClick: function () { setOpen(function (v) { return !v; }); },
          "aria-expanded": open ? "true" : "false",
        }, headKids),
        open ? e("pre", { className: "btu-ctx-body", key: "b" }, text || "（空内容）") : null);
    }

    // 遮蔽 conversation.chat.node 的 context key：goal 相关注入渲染成状态块，其余回退折叠行
    function ContextRow(props) {
      var node = props.node || {};
      var data = node.data || {};
      var source = data.source || {};
      if (source && source.kind === "goal") return goalRoundBlock(data);
      if (source && source.kind === "plugin" && source.plugin === "tool-goal") return toolGoalBlock(data);
      return e(FallbackContextRow, { node: node });
    }

    // ---------- 样式：时间线视觉 × DSH 主题 token ----------
    // 轨道色固定值：done #34d59a / running #3dbbf5 / reasoning #8c93f8 / error #ee5858
    var CSS_TEXT = `
.btu-row { position: relative; margin: 2px 0; font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-secondary); }
.btu-rail { position: absolute; left: 2px; top: 3px; bottom: 3px; width: 3px; border-radius: 999px; border: 0; padding: 0; cursor: pointer; background: #34d59a; }
.btu-row[data-state="running"] > .btu-rail { background: #3dbbf5; animation: btu-breathe 1.6s ease-in-out infinite; }
.btu-row[data-state="error"] > .btu-rail { background: #ee5858; }
@keyframes btu-breathe { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
.btu-card { margin-left: 11px; border-radius: 6px; }
.btu-card[data-open="1"] { background: var(--dsw-alias-bg-layer-1); box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1); }
.btu-head { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; padding: 3px 6px 3px 4px; border: 0; background: transparent; cursor: pointer; text-align: left; font: inherit; color: inherit; border-radius: 6px; }
.btu-head:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.btu-icon { display: inline-flex; width: 14px; height: 14px; flex: none; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary); opacity: .8; }
.btu-name { font-weight: 600; color: var(--dsw-alias-label-primary); flex: none; }
.btu-row[data-state="running"] .btu-name { background: linear-gradient(90deg, var(--dsw-alias-label-primary) 30%, #3dbbf5 50%, var(--dsw-alias-label-primary) 70%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: btu-shimmer 2.2s linear infinite; }
@keyframes btu-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.btu-desc { color: var(--dsw-alias-label-secondary); opacity: .85; flex: none; }
.btu-sum { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-primary); opacity: .85; }
.btu-exit { flex: none; margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; padding: 1px 7px; border-radius: 999px; background: rgba(238,88,88,.14); color: #ee5858; }
.btu-open { flex: none; margin-left: auto; color: var(--dsw-alias-label-secondary); opacity: 0; padding: 0 4px; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btu-head:hover .btu-open { opacity: .8; }
.btu-open:hover { color: var(--dsw-alias-brand-primary); }
.btu-exit + .btu-open { margin-left: 0; }
.btu-detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s ease-out; }
.btu-card[data-open="1"] > .btu-detail { grid-template-rows: 1fr; }
.btu-detail-in { overflow: hidden; min-height: 0; }
.btu-body { margin: 2px 6px 6px; padding-top: 5px; border-top: 1px solid var(--dsw-alias-border-l1); }
.btu-term { position: relative; border-radius: 6px; overflow: hidden; background: #0d1117; color: #d6e0ea; }
.btu-term-elapsed { position: absolute; top: 5px; right: 9px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; font-variant-numeric: tabular-nums; color: #8b949e; user-select: none; pointer-events: none; }
.btu-term-elapsed[data-near="1"] { color: #e3b341; }
.btu-term-cmd { padding: 6px 84px 6px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #7ee787; border-bottom: 1px solid rgba(255,255,255,.08); white-space: pre-wrap; word-break: break-all; }
.btu-term-out { margin: 0; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto; }
.btu-term-status { padding: 3px 10px; font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; border-top: 1px solid rgba(255,255,255,.08); color: #8b949e; }
.btu-term-status[data-failed="1"] { color: #ff7b72; }
.btu-term-status[data-tone="run"] { color: #58a6ff; }
.btu-term-status[data-tone="ok"] { color: #7ee787; }
.btu-term-status[data-tone="err"] { color: #ff7b72; }
.btu-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.55; background: var(--dsw-alias-bg-layer-2); border-radius: 6px; padding: 6px 0; max-height: 340px; overflow: auto; }
.btu-code-line { display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 8px; padding: 0 10px 0 0; white-space: pre; }
.btu-ln { text-align: right; color: var(--dsw-alias-label-secondary); opacity: .55; user-select: none; flex: none; }
.btu-ltxt { overflow: hidden; text-overflow: ellipsis; }
.btu-diff2 { border-radius: 6px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 4px; }
.btu-diff2-head { display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.btu-diff2-path { font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btu-diff2-badge { flex: none; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1); }
.btu-diff2-stats { display: inline-flex; gap: 6px; font-size: 10px; font-variant-numeric: tabular-nums; }
.btu-d2p { color: var(--dsw-alias-state-success-primary); }
.btu-d2m { color: var(--dsw-alias-state-error-primary); }
.btu-diff2-body { max-height: 240px; overflow: auto; padding: 6px 0; font-size: 11px; line-height: 1.55; }
.btu-d2l { display: flex; align-items: flex-start; min-height: 1.4em; padding: 0 6px; }
.btu-d2l[data-t="+"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); }
.btu-d2l[data-t="+"] .btu-d2t, .btu-d2l[data-t="+"] .btu-d2s { color: var(--dsw-alias-state-success-primary); }
.btu-d2l[data-t="-"] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.btu-d2l[data-t="-"] .btu-d2t, .btu-d2l[data-t="-"] .btu-d2s { color: var(--dsw-alias-state-error-primary); }
.btu-d2g { flex: none; width: 32px; margin-right: 4px; text-align: right; font-size: 9px; line-height: 1.7; color: var(--dsw-alias-label-secondary); opacity: .55; user-select: none; font-variant-numeric: tabular-nums; }
.btu-d2s { flex: none; width: 12px; margin-right: 4px; text-align: center; font-size: 12px; user-select: none; }
.btu-d2t { min-width: 0; flex: 1; white-space: pre-wrap; word-break: break-all; color: var(--dsw-alias-label-primary); }
.btu-d2l[data-t=" "] .btu-d2t { color: var(--dsw-alias-label-secondary); opacity: .8; }
.btu-sec { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--dsw-alias-label-secondary); opacity: .8; margin: 6px 2px 2px; }
.btu-pre { margin: 2px 0; padding: 6px 10px; background: var(--dsw-alias-bg-layer-2); border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; }
.btu-note { padding: 2px 10px 4px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); opacity: .8; }
.btu-file { padding: 3px 2px 1px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-primary); }
.btu-ml { display: grid; grid-template-columns: 40px minmax(0,1fr); gap: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; padding: 0 10px 0 0; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
.btu-web-answer { font-size: 12px; color: var(--dsw-alias-label-primary); padding: 2px 2px 6px; white-space: pre-wrap; }
.btu-web-src { display: block; padding: 2px 0; color: var(--dsw-alias-brand-primary); text-decoration: none; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btu-web-src:hover { text-decoration: underline; }
.btu-web-snip { font-size: 11.5px; color: var(--dsw-alias-label-secondary); padding: 0 0 4px; }
.btu-todo { display: flex; gap: 6px; align-items: baseline; padding: 1.5px 4px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.btu-todo[data-s="completed"] { color: var(--dsw-alias-label-secondary); text-decoration: line-through; }
.btu-todo[data-s="in_progress"] .btu-todo-mark { color: var(--dsw-alias-brand-primary); }
.btu-todo-mark { flex: none; width: 12px; text-align: center; }
.btu-error { color: var(--dsw-alias-state-error-primary); font-size: 11.5px; white-space: pre-wrap; word-break: break-word; padding: 4px 2px; }
.btu-chip { flex: none; padding: 0 6px; border-radius: 999px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; line-height: 16px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); color: var(--dsw-alias-brand-primary); }
.btu-kvs { display: flex; flex-direction: column; gap: 1px; margin: 2px 0 4px; }
.btu-kv { display: grid; grid-template-columns: minmax(56px, 20%) minmax(0, 1fr); gap: 10px; align-items: baseline; padding: 2px 4px; border-radius: 4px; }
.btu-kv[data-block="1"] { align-items: start; }
.btu-kv:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.btu-kv-k { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.btu-kv-v { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; color: var(--dsw-alias-label-primary); white-space: pre-wrap; word-break: break-word; }
.btu-kv-json { margin: 0; padding: 4px 8px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow: auto; }
.btu-json { max-height: 340px; }
.btu-jk { color: var(--dsw-alias-brand-primary); }
.btu-js { color: var(--dsw-alias-state-success-primary); }
.btu-jn { color: #d19a66; }
.btu-jb { color: #c678dd; }
.btu-media { display: inline-flex; margin: 2px 4px 2px 0; padding: 1px 8px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary); }
/* ask_user_question：分页问题面板（每页一个问题，选项标注用户的选择） */
.btu-ask { padding: 2px 0; }
.btu-ask-pager { display: flex; align-items: center; gap: 6px; margin: 2px 0 6px; }
.btu-ask-pager-btn { flex: none; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 14px; line-height: 1; }
.btu-ask-pager-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.btu-ask-pager-btn:disabled { opacity: .35; cursor: default; }
.btu-ask-pager-label { flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.btu-ask-qhead { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.btu-ask-qtitle { font-size: 11px; font-weight: 600; color: var(--dsw-alias-brand-primary); }
.btu-ask-tag { flex: none; font-size: 10px; padding: 0 6px; border-radius: 999px; line-height: 16px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-brand-primary); }
.btu-ask-qbody { font-size: 12.5px; line-height: 1.5; color: var(--dsw-alias-label-primary); white-space: pre-wrap; word-break: break-word; }
.btu-ask-qdetail { margin-top: 3px; font-size: 11.5px; line-height: 1.5; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; word-break: break-word; }
.btu-ask-opts { display: flex; flex-direction: column; gap: 3px; margin: 7px 0 2px; }
.btu-ask-opt { display: flex; align-items: baseline; gap: 8px; padding: 4px 8px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); }
.btu-ask-opt[data-sel="1"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent); }
.btu-ask-opt-mark { flex: none; width: 14px; text-align: center; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.btu-ask-opt[data-sel="1"] .btu-ask-opt-mark { color: var(--dsw-alias-brand-primary); }
.btu-ask-opt-label { font-size: 12px; color: var(--dsw-alias-label-primary); }
.btu-ask-opt[data-sel="1"] .btu-ask-opt-label { font-weight: 600; }
.btu-ask-opt-desc { flex: 1; min-width: 0; font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .9; }
.btu-ask-custom { display: flex; gap: 8px; align-items: baseline; margin-top: 5px; padding: 4px 8px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); }
.btu-ask-custom-k { flex: none; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.btu-ask-custom-v { font-size: 12px; color: var(--dsw-alias-label-primary); white-space: pre-wrap; word-break: break-word; }
.btu-callout { border-radius: 10px; padding: 10px 14px 12px; margin: 2px 0; }
.btu-callout[data-tone="error"] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent); }
.btu-callout[data-tone="success"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 9%, transparent); }
.btu-callout[data-tone="warn"] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent); }
.btu-callout[data-tone="info"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.btu-callout[data-tone="neutral"] { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 10%, transparent); }
.btu-callout-head { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
.btu-callout-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; flex: none; }
.btu-callout-title { font-weight: 600; font-size: 13px; }
.btu-callout[data-tone="error"] .btu-callout-head { color: var(--dsw-alias-state-error-primary); }
.btu-callout[data-tone="success"] .btu-callout-head { color: var(--dsw-alias-state-success-primary); }
.btu-callout[data-tone="warn"] .btu-callout-head { color: var(--dsw-alias-state-warn-primary); }
.btu-callout[data-tone="info"] .btu-callout-head { color: var(--dsw-alias-brand-primary); }
.btu-callout[data-tone="neutral"] .btu-callout-head { color: var(--dsw-alias-label-secondary); }
/* goal 状态块：未完成淡橙黄（amber）/ 完成淡绿（success）/ 受阻淡红（error），字段行结构 */
.btu-callout[data-tone="amber"] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 11%, transparent); }
.btu-callout[data-tone="amber"] .btu-callout-head { color: var(--dsw-alias-state-warn-primary); }
.btu-goal-phase { flex: none; margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; padding: 1px 7px; border-radius: 999px; background: color-mix(in srgb, currentColor 13%, transparent); color: currentColor; }
.btu-goal-kv { margin-top: 7px; display: grid; gap: 3px; }
.btu-goal-kv-row { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 8px; font-size: 12px; line-height: 1.6; }
.btu-goal-k { color: var(--dsw-alias-label-secondary); opacity: .75; flex: none; }
.btu-goal-v { min-width: 0; color: var(--dsw-alias-label-primary); white-space: pre-wrap; word-break: break-word; }
/* 非 goal 上下文注入的回退折叠行：内置 ContextInjectionRow 观感复刻 */
.btu-ctx { margin: 2px 0; }
.btu-ctx-head { display: flex; align-items: center; gap: 7px; width: 100%; min-width: 0; padding: 2px 4px; border: 0; background: transparent; cursor: pointer; text-align: left; font: inherit; color: inherit; border-radius: 6px; }
.btu-ctx-head:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.btu-ctx-chevron { flex: none; color: var(--dsw-alias-label-secondary); font-size: 10px; transition: transform .18s ease; }
.btu-ctx-chevron[data-open="1"] { transform: rotate(90deg); }
.btu-ctx-title { flex: none; font-weight: 500; font-size: 13px; color: var(--dsw-alias-label-primary); }
.btu-ctx-sep { flex: none; width: 2px; height: 2px; border-radius: 1px; background: var(--dsw-alias-label-caption); }
.btu-ctx-source { flex: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--dsw-alias-label-tertiary); }
.btu-ctx-summary { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--dsw-alias-label-tertiary); }
.btu-ctx-body { box-sizing: border-box; width: calc(100% - 22px); max-height: 141px; margin: 4px 0 4px 22px; overflow: auto; padding: 10px 16px 12px 12px; border: none; border-radius: 8px; background: var(--dsw-alias-markdown-code-block); color: var(--dsw-alias-label-tertiary); font: 400 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
.btu-callout-body { font-size: 13.5px; line-height: 1.65; color: var(--dsw-alias-label-primary); white-space: pre-wrap; word-break: break-word; }
.btu-callout-rounds { margin-top: 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .8; }
/* 活动行相邻统一贴合到 2px：工具行、含 think 行的步骤（负 margin 抵消 column 16px gap；不看有无正文段落——空文本块会渲染空 p，:not(:has(p)) 会误判） */
[class*="_flowItem"][data-chat-flow-kind="tool-call"] + [class*="_flowItem"][data-chat-flow-kind="tool-call"],
[class*="_flowItem"][data-chat-flow-kind="tool-call"] + [class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]),
[class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [class*="_flowItem"][data-chat-flow-kind="tool-call"],
[class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) { margin-top: -14px; }
/* dsh 的子调用容器（ToolCallTree 的 [data-subcalls]）：出厂样式是一条左边框 + 缩进，
   这里把缩进收到与本插件行的色轨对齐，并让相邻子行保持同一套 2px 贴合。 */
[data-subcalls] { margin: 2px 0 2px 13px; padding-left: 9px; border-left: 1px solid var(--dsw-alias-border-l1); }
[data-subcalls] .btu-row + .btu-row { margin-top: 2px; }
/* 回退形态的 dock 行：套用聊天列几何，与消息流里的工具行左右对齐 */
.btu-dock { box-sizing: border-box; width: 100%; max-width: var(--dsh-chat-content-width); margin: 0 auto; padding: 2px 0 0; }
.btu-stream-body { margin: 2px 6px 6px; padding-top: 5px; border-top: 1px solid var(--dsw-alias-border-l1); }
.btu-stream-max { max-height: 140px; }
.btu-head--static { cursor: default; }
.btu-stream-size { flex: none; margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: var(--dsw-alias-label-secondary); opacity: .8; }
/* thinking 行与工具行统一网格（DisclosureRow 的 CSS module 是空桩，行盒只有 QWLzlG_row 一个类；轨条用 ::before 精确控制，避免圆角盒阴影变弯钩） */
[data-variant="think"] [class*="_row"] { position: relative; padding-left: 15px; min-height: 22px; font-size: 12px; line-height: 20px; }
[data-variant="think"] [class*="_row"]::before { content: ""; position: absolute; left: 2px; top: 50%; transform: translateY(-50%); width: 3px; height: 16px; border-radius: 999px; background: rgba(140,147,248,.85); }
[data-variant="think"] [class*="_leading"] { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; vertical-align: -2px; flex: none; }
[data-variant="think"] [class*="_leading"] svg { width: 13px; height: 13px; color: #8c93f8; }
[data-variant="think"] [class*="_title"] { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
[data-variant="think"] [class*="_summary"] { font-size: 12px; line-height: 20px; }
[data-variant="think"] [class*="_thinkBody"] { margin: 2px 0 6px 2px; padding: 4px 0 4px 13px; border-left: 2px solid rgba(140,147,248,.35); font-size: 12px; line-height: 1.65; }
`;

    // ---------- 流式工具行（conversation.chat.streamingCall） ----------
    // DSH 在消息流里声明了 streamingCall 座位：参数还在流式生成时，把在途调用
    // （toolName / argsRaw / callId）按工具名分派给这个插槽，位置正是参数流完后
    // 正式卡片落地的地方。本组件接管该座位，物化后 dsh 自动收起这一行。
    function looseArg(raw, key) {
      var m = new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)').exec(raw);
      if (!m) return "";
      return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    // 每个参数增量都会重渲染这一行，所以扫描量必须与已生成长度无关：
    // write 一个大文件时 argsRaw 会长到文件本身那么大，扫全量就是 O(n²)。
    // 目标参数（file_path/command…）只出现在 JSON 头部，展开区只显示尾部若干行，
    // 两端各取一个定长窗口就够。
    var SCAN_HEAD = 4096;
    var SCAN_TAIL = 4096;

    // 尾窗可能把 \ 和它转义的字符切开，丢掉行首这个落单的反斜杠；若流式的值已经收尾、
    // 后面又跟了别的键，从那个未转义的引号处截断，免得把 JSON 结构当正文显示。
    function streamTail(argsRaw) {
      return argsRaw.slice(-SCAN_TAIL)
        .replace(/^\\(?![\\/bfnrtu"])/, "")
        .replace(/(?<!\\)"\s*[,}][\s\S]*$/, "")
        .replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    // 两种座位共用的一行渲染：入参只有工具名和在途的 argsRaw。
    function streamingRow(wireName, argsRaw) {
      var name = canonicalName(wireName);
      var meta = metaFor(name, {}, wireName);
      var head = argsRaw.length > SCAN_HEAD ? argsRaw.slice(0, SCAN_HEAD) : argsRaw;
      var target = looseArg(head, "file_path") || looseArg(head, "path") || looseArg(head, "command") || looseArg(head, "pattern") || looseArg(head, "query") || looseArg(head, "url") || "";
      if (target.length > 90) target = target.slice(0, 90) + "…";
      // 展开的流式内容：bash 显示命令流，write/edit/create 显示内容尾部 6 行，其余显示参数尾部。
      // 超过两个窗口之后，头部的 {"content":" 早已滚出视野，尾窗本身就是纯内容。
      var windowed = argsRaw.length > SCAN_HEAD + SCAN_TAIL;
      var stream = windowed
        ? streamTail(argsRaw)
        : (name === "bash"
          ? looseArg(argsRaw, "command")
          : (looseArg(argsRaw, "content") || looseArg(argsRaw, "file_text") || looseArg(argsRaw, "new_str") || looseArg(argsRaw, "old_str") || looseArg(argsRaw, "prompt") || ""));
      var body = null;
      if (stream) {
        if (name === "bash") {
          body = e("div", { className: "btu-stream-body", key: "body" },
            e("div", { className: "btu-term" },
              e("pre", { className: "btu-term-out btu-stream-max" }, "$ " + stream + "\n▍")));
        } else {
          var t = tailLines(stream, 6);
          // 走了尾窗分支时 stream 只是尾部，行数不再是全量真值，所以不报数字。
          var elided = windowed ? "… 前略\n" : (t.hidden > 0 ? "… 前略 " + t.hidden + " 行\n" : "");
          body = e("div", { className: "btu-stream-body", key: "body" },
            e("pre", { className: "btu-pre btu-stream-max" }, elided + t.text + "\n▍"));
        }
      }
      return e("div", { className: "btu-row", "data-state": "running" },
        e("span", { className: "btu-rail" }),
        e("div", { className: "btu-card", "data-open": stream ? "1" : "0" },
          e("div", { className: "btu-head btu-head--static" },
            e("span", { className: "btu-icon" }, svgIcon(meta.icon)),
            e("span", { className: "btu-name" }, meta.label),
            meta.mcp ? e("span", { className: "btu-chip", title: "MCP 服务器：" + meta.mcp.server }, meta.mcp.server) : null,
            e("span", { className: "btu-desc" }, "生成中…"),
            target ? e("code", { className: "btu-sum" }, target) : null,
            e("span", { className: "btu-stream-size" }, argsRaw.length > 0 ? String(argsRaw.length) + " 字符" : "")),
          body));
    }

    // 原生座位：在途调用由 dsh 按工具名分派过来，props 直接带 toolName / argsRaw。
    function StreamingToolRow(props) {
      return streamingRow(
        typeof props.toolName === "string" ? props.toolName : "",
        typeof props.argsRaw === "string" ? props.argsRaw : "");
    }

    // ---------- 老版 dsh 的回退座位（conversation.input.dock） ----------
    // conversation.chat.streamingCall 是较新的 dsh 才声明的座位；在没有它的版本上
    // slots.inject 只会静默等待，流式预览会整个消失。所以保留 v1.3 的 dock 形态作回退：
    // 组件自己从 snapshot.partial.blocks 里捞在途调用（流式期间参数只在那里累积），
    // 渲染在编辑器上方。两种形态由座位是否声明仲裁——座位在，dock 渲染 null 让位；
    // 座位不在，dock 顶上。所以任何一个版本上都只有一行预览。
    var seatLive = false;
    var seatListeners = new Set();

    function setSeatLive(next) {
      if (seatLive === next) return;
      seatLive = next;
      seatListeners.forEach(function (fn) {
        try { fn(); } catch (err) { console.error("dsh-better-tool-ui: seat notify failed", err); }
      });
    }

    function useSeatLive() {
      var st = React.useState(seatLive);
      var setValue = st[1];
      React.useEffect(function () {
        var sync = function () { setValue(seatLive); };
        seatListeners.add(sync);
        sync();
        return function () { seatListeners.delete(sync); };
      }, []);
      return st[0];
    }

    function StreamingToolDock(props) {
      // hooks 必须无条件跑完再谈提前返回
      var live = useSeatLive();
      var partial = typeof props.useSession === "function" ? props.useSession((s) => s.partial) : null;
      if (live) return null;
      if (!partial || !Array.isArray(partial.blocks)) return null;
      var tc = null;
      for (var i = partial.blocks.length - 1; i >= 0; i--) {
        var b = partial.blocks[i];
        if (b && b.kind === "tool-call") { tc = b; break; }
      }
      if (!tc) return null;
      return e("div", { className: "btu-dock" }, streamingRow(
        typeof tc.name === "string" ? tc.name : "",
        typeof tc.argsRaw === "string" ? tc.argsRaw : ""));
    }

    // ---------- 运行期工具名的动态认领 ----------
    // keyed 槽位按精确 key 派发，而"会出现哪些工具名"不是插件能枚举的：MCP 的公开名
    // （mcp__<server>__<tool>）取决于用户装了哪些服务器；subagent / workflow 内层派发出来的
    // 子调用带的是驱动那一侧的名字（claude-in-dsh 驱动时是 Bash / Read / Task 这种大驼峰）。
    // 所以从 ctx.sessions 的会话快照里扫出**所有**出现过的调用名，见一个认领一个；认领过的
    // 名字落 localStorage，下次启动先行注册，省掉首帧的出厂卡片闪烁。
    //
    // 静态注册过的 key 要跳过：keyed 槽位里同 key 同 priority 会直接抛错。
    var TOOL_CACHE_KEY = "dsh-better-tool-ui:claimed-tools";
    var TOOL_CACHE_MAX = 400;
    var toolKnown = new Set();
    var toolListeners = new Set();
    var staticKeys = new Set();

    function loadToolCache() {
      try {
        var list = JSON.parse(window.localStorage.getItem(TOOL_CACHE_KEY) || "[]");
        if (!Array.isArray(list)) return;
        for (var i = 0; i < list.length && toolKnown.size < TOOL_CACHE_MAX; i++) {
          if (typeof list[i] === "string" && list[i] !== "") toolKnown.add(list[i]);
        }
      } catch (err) { /* 隐私模式或缓存损坏：当作没有缓存 */ }
    }

    function saveToolCache() {
      try { window.localStorage.setItem(TOOL_CACHE_KEY, JSON.stringify(Array.from(toolKnown))); } catch (err) { /* 写不进去不影响本次会话 */ }
    }

    function noteToolName(name) {
      if (typeof name !== "string" || name === "") return;
      if (toolKnown.has(name) || toolKnown.size >= TOOL_CACHE_MAX) return;
      toolKnown.add(name);
      saveToolCache();
      toolListeners.forEach((fn) => {
        try { fn(name); } catch (err) { console.error("dsh-better-tool-ui: claim failed", err); }
      });
    }

    // 认领是**补位**而不是抢占：注册用正的 priority（见 FALLBACK_PRIORITY），
    // 所以只有当这个 key 没有别人注册时本插件的行才渲染。dsh 出厂的通用卡片是槽位的
    // fallback、不占 key，所以无主的名字仍然归本插件；而 dsh 的专用视图、以及别的插件
    // （例如 claude-in-dsh 给 Task/Agent/Workflow 注册的行）都在 priority 0，照旧胜出。
    // 这样"补上没人管的工具名"和"不动别人已经做好的渲染"两件事同时成立。
    //
    // 静态注册已经占住的 key 直接跳过，交给那边的 SHADOW_PRIORITY 注册。
    var FALLBACK_PRIORITY = 1;

    function claimDiscoveredKeys(register) {
      var disposers = new Map();
      var claim = function (name) {
        if (disposers.has(name) || staticKeys.has(name)) return;
        try { disposers.set(name, register(name)); } catch (err) { console.error("dsh-better-tool-ui: register failed", err); }
      };
      toolKnown.forEach(claim);
      toolListeners.add(claim);
      return function () {
        toolListeners.delete(claim);
        disposers.forEach((d) => {
          try { if (typeof d === "function") d(); } catch (err) { console.error("dsh-better-tool-ui: unregister failed", err); }
        });
        disposers.clear();
      };
    }

    function startToolDiscovery(ctx) {
      var sessions = ctx.sessions;
      if (!sessions || typeof sessions.binding !== "function" || !sessions.list || typeof sessions.list.subscribe !== "function") {
        return function () {};
      }
      var stopped = false;
      var boundId = null;
      var unbind = null;
      var pending = null;

      function walk(blocks, depth) {
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i];
          if (!b) continue;
          var n = b.kind === "tool-result" ? (b.call && b.call.name) : b.name;
          noteToolName(n);
          if (depth < 3 && Array.isArray(b.subCalls) && b.subCalls.length > 0) walk(b.subCalls, depth + 1);
        }
      }

      function scan(session) {
        var snap = null;
        try { snap = session.getSnapshot(); } catch (err) { return; }
        if (!snap) return;
        if (Array.isArray(snap.runningCalls)) walk(snap.runningCalls, 0);
        // 参数还在流式生成时，调用名只在 partial 里，扫到它流式行才能被认领
        var partial = snap.partial && Array.isArray(snap.partial.blocks) ? snap.partial.blocks : [];
        for (var i = 0; i < partial.length; i++) {
          var b = partial[i];
          if (b && b.kind === "tool-call") noteToolName(b.name);
        }
        var nodes = Array.isArray(snap.nodes) ? snap.nodes : [];
        var start = nodes.length > 400 ? nodes.length - 400 : 0;
        var tail = [];
        for (var j = start; j < nodes.length; j++) {
          if (nodes[j] && nodes[j].kind === "tool-result") tail.push(nodes[j]);
        }
        if (tail.length > 0) walk(tail, 0);
      }

      // 每个 token 增量都会推一次快照，所以扫描节流到 500ms 一次
      function schedule(session) {
        if (stopped || pending !== null) return;
        pending = timeoutFn(function () {
          pending = null;
          if (!stopped) scan(session);
        }, 500);
      }

      function bind() {
        if (stopped) return;
        var id;
        try { id = sessions.list.getSnapshot().current; } catch (err) { return; }
        if (id === boundId) return;
        if (unbind) { try { unbind(); } catch (err) { /* 已失效的订阅 */ } unbind = null; }
        boundId = id === undefined ? null : id;
        if (!id) return;
        var binding = null;
        try { binding = sessions.binding(id); } catch (err) { binding = null; }
        var session = binding && binding.session;
        if (!session || typeof session.subscribe !== "function") { boundId = null; return; }
        scan(session);
        unbind = session.subscribe(function () { schedule(session); });
      }

      var unlist = sessions.list.subscribe(bind);
      bind();
      return function () {
        stopped = true;
        if (pending !== null) { try { pending(); } catch (err) { /* 已触发的定时器 */ } }
        if (unbind) { try { unbind(); } catch (err) { /* 已失效的订阅 */ } }
        try { unlist(); } catch (err) { /* 已失效的订阅 */ }
      };
    }

    var STYLE_ID = "dsh-better-tool-ui-style";

    function apply(ctx) {
      loadToolCache();
      if (document.getElementById(STYLE_ID) === null) {
        var style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS_TEXT;
        document.head.appendChild(style);
      }
      ctx.slots.inject("tool.call.toolview", function () {
        // dsh 内置 toolview（bash/read/write/edit/grep/glob/web_*/todo_write 等）以默认
        // priority 0 占用同名 key；keyed slot 中同 key 同 priority 会直接抛错导致插件加载失败。
        // 统一用 -1 注册：priority 数值最小者渲染，本插件的行由此遮蔽内置行。
        var SHADOW_PRIORITY = -1;
        var rowKeys = ["bash", "read", "write", "edit", "grep", "glob", "web_search", "web_fetch", "todo_write", "skill", "job_output", "job_list", "job_kill", "subagent", "subagent_fork", "list_agents", "send_message", "validate_dsh_ui", "str_replace_editor", "workflow", "interrupt_agent", "report", "pwsh", "ralph", "read_image", "notebook_edit", "exit_plan_mode", "ask_user_question"];
        var goalKeys = ["create_goal", "get_goal", "update_goal"];
        // 运行期认领要避开这些 key：同 key 同 priority 会抛错（goal 系列还得留给 GoalCard）
        rowKeys.forEach((k) => staticKeys.add(k));
        goalKeys.forEach((k) => staticKeys.add(k));
        var disposers = [];
        for (var i = 0; i < rowKeys.length; i++) {
          disposers.push(ctx.slots.register({ name: "tool.call.toolview", key: rowKeys[i], priority: SHADOW_PRIORITY }, (props) => e(ToolRow, props)));
        }
        for (var j = 0; j < goalKeys.length; j++) {
          disposers.push(ctx.slots.register({ name: "tool.call.toolview", key: goalKeys[j], priority: SHADOW_PRIORITY }, (props) => e(GoalCard, props)));
        }
        // 其余工具名（MCP 名、子调用里的驱动侧名字…）运行期才知道：先按缓存注册，
        // 再随发现增量补注册，用 FALLBACK_PRIORITY 补位（见 claimDiscoveredKeys）。
        disposers.push(claimDiscoveredKeys((name) => ctx.slots.register(
          { name: "tool.call.toolview", key: name, priority: FALLBACK_PRIORITY },
          (props) => e(ToolRow, props),
        )));
        disposers.push(startToolDiscovery(ctx));
        return function () {
          for (var k = 0; k < disposers.length; k++) {
            try { if (typeof disposers[k] === "function") disposers[k](); } catch (err) { console.error("dsh-better-tool-ui: unregister failed", err); }
          }
        };
      });
      ctx.slots.inject("conversation.chat.streamingCall", function () {
        // 座位存在即接管，并让 dock 回退让位（见 StreamingToolDock）。
        setSeatLive(true);
        // 按工具名分派，键域与 tool.call.toolview 相同；未注册的工具名落到 dsh
        // 自带的原生流式行，所以这里只认领本插件已经接管卡片的那些工具。
        var streamKeys = ["bash", "read", "write", "edit", "grep", "glob", "web_search", "web_fetch", "todo_write", "skill", "job_output", "job_list", "job_kill", "subagent", "subagent_fork", "list_agents", "send_message", "validate_dsh_ui", "str_replace_editor", "workflow", "interrupt_agent", "report", "pwsh", "ralph", "read_image", "notebook_edit", "exit_plan_mode", "create_goal", "get_goal", "update_goal", "ask_user_question"];
        var disposers = [];
        var claimed = new Set(streamKeys);
        for (var i = 0; i < streamKeys.length; i++) {
          disposers.push(ctx.slots.register(
            { name: "conversation.chat.streamingCall", key: streamKeys[i] },
            (props) => e(StreamingToolRow, props),
          ));
        }
        disposers.push(claimDiscoveredKeys((name) => {
          if (claimed.has(name)) return function () {};
          return ctx.slots.register(
            { name: "conversation.chat.streamingCall", key: name, priority: FALLBACK_PRIORITY },
            (props) => e(StreamingToolRow, props),
          );
        }));
        return function () {
          setSeatLive(false);
          for (var k = 0; k < disposers.length; k++) {
            try { if (typeof disposers[k] === "function") disposers[k](); } catch (err) { console.error("dsh-better-tool-ui: unregister failed", err); }
          }
        };
      });
      // 回退座位常驻注册：座位声明与否是运行期才知道的，注册时机没法仲裁，
      // 所以交给组件在 render 时按 seatLive 让位（新版 dsh 上它只是渲染 null）。
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register(
          { name: "conversation.input.dock", id: "btu-streaming-tool", order: 50, label: "流式工具预览（旧版回退）" },
          (props) => e(StreamingToolDock, props),
        );
      });
      // 遮蔽 conversation.chat.node 的 context key：goal 相关上下文注入渲染成状态块
      // （轮次注入 → 淡橙黄「当前目标」；tool-goal 收尾注入 → 绿/红「目标完成/受阻」），
      // 其余上下文注入回退为内置样式的折叠行。DSH 内置的 context 注入以默认 priority 0
      // 占用同名 key，keyed slot 同 key 同 priority 会直接抛错；用 -1 遮蔽（数值最小者渲染）。
      ctx.slots.inject("conversation.chat.node", function () {
        return ctx.slots.register(
          { name: "conversation.chat.node", key: "context", priority: -1 },
          (props) => e(ContextRow, props),
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
