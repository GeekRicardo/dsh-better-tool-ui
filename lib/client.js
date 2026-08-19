// dsh-hebbian-rows — web client face
//
// 把模型输出的工具调用卡片 / thinking 行渲染成 hebbian desktop 的时间线风格：
// 左侧贯通色轨（done #34d59a / running #3dbbf5 / error #ee5858 / reasoning #8c93f8），
// 行内图标 + 工具名 + 中文描述 + 参数摘要，展开详情按工具分体（终端 / 行号代码 /
// GitHub 风 diff / 搜索结果 / web 引用 / todo 清单），goal 工具渲染成 callout 色块。
//
// 本文件是会话内动态插件 hebrow-2（v9）的固化版，两者行为一致。
window.__ModuleLoader__.load({
  id: "dsh-hebbian-rows",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    var inject = ["slots"];
    var e = React.createElement;

    // 秒级滴答（BashElapsed 用；bundle 环境直接用 window 定时器，返回 disposer）
    var intervalFn = function (cb, ms) {
      var id = window.setInterval(cb, ms);
      return function () { window.clearInterval(id); };
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
        case "terminal": return e("svg", common, PL("4 17 10 11 4 5"), L(12, 19, 20, 19));
        case "read": return e("svg", common, P("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"), PL("14 2 14 8 20 8"), L(16, 13, 8, 13), L(16, 17, 8, 17));
        case "pencil": return e("svg", common, P("M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"));
        case "search": return e("svg", common, C(11, 11, 8), L(21, 21, 16.65, 16.65));
        case "globe": return e("svg", common, C(12, 12, 10), L(2, 12, 22, 12), P("M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"));
        case "todo": return e("svg", common, PL("9 11 12 14 22 4"), P("M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"));
        case "sparkles": return e("svg", common, P("M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"));
        case "flag": return e("svg", common, P("M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"), L(4, 22, 4, 15));
        case "bot": return e("svg", common, P("M12 8V4H8"), R(4, 8, 16, 12, 2), P("M2 14h2"), P("M20 14h2"), P("M15 13v2"), P("M9 13v2"));
        case "send": return e("svg", common, P("m22 2-7 20-4-9-9-4Z"), P("M22 2 11 13"));
        case "check": return e("svg", common, P("M22 11.08V12a10 10 0 1 1-5.93-9.14"), PL("22 4 12 14.01 9 11.01"));
        case "stop": return e("svg", common, C(12, 12, 9), R(9, 9, 6, 6, 1));
        default: return e("svg", common, P("M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"), PL("3.3 7 12 12 20.7 7"), L(12, 22, 12, 12));
      }
    }

    // ---------- hebbian MessageBubble 的工具元数据映射 ----------
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
    };

    // str_replace_editor 按 command 子命令映射行元数据
    function metaFor(name, args) {
      if (name === "str_replace_editor") {
        var cmd = argStr(args, "command");
        if (cmd === "view") return { label: "View", desc: "查看文件", icon: "read" };
        if (cmd === "create") return { label: "Create", desc: "创建文件", icon: "pencil" };
        if (cmd === "str_replace") return { label: "Edit", desc: "替换文本", icon: "pencil" };
        if (cmd === "insert") return { label: "Insert", desc: "插入文本", icon: "pencil" };
        if (cmd === "undo_edit") return { label: "UndoEdit", desc: "撤销编辑", icon: "pencil" };
        return { label: "StrEdit", desc: "编辑文件", icon: "pencil" };
      }
      return TOOL_META[name] || { label: name || "工具调用", desc: "工具调用", icon: "box" };
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

    // ---------- hebbian DiffViewer 的行级 diff（LCS）+ 前后行号 ----------
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

    // hebbian DiffViewer 的 GitHub PR 风格代码变更视图：头部（文件名+徽标+±统计）+ 行号槽 + 符号列 + 整行底色
    function codeChangeView(o) {
      var addCount = o.ops.filter((r) => r.t === "+").length;
      var removeCount = o.ops.filter((r) => r.t === "-").length;
      var cap = o.cap || 120;
      var capped = o.ops.length > cap ? { ops: o.ops.slice(0, cap), hidden: o.ops.length - cap } : { ops: o.ops, hidden: 0 };
      var rows = capped.ops.map((r, j) => {
        var kids = [];
        if (o.gutters === 2) kids.push(e("span", { className: "hbt-d2g", key: "b" }, r.b === null ? "" : String(r.b)));
        kids.push(e("span", { className: "hbt-d2g", key: "a" }, r.a === null ? "" : String(r.a)));
        kids.push(e("span", { className: "hbt-d2s", key: "s" }, r.t === " " ? "" : r.t));
        kids.push(e("span", { className: "hbt-d2t", key: "t" }, r.s || " "));
        return e("div", { className: "hbt-d2l", "data-t": r.t, key: "r" + j }, kids);
      });
      if (capped.hidden > 0) rows.push(e("div", { className: "hbt-note", key: "m" }, "… 省略 " + capped.hidden + " 行"));
      var stats = [];
      if (addCount > 0) stats.push(e("span", { className: "hbt-d2p", key: "p" }, "+" + addCount));
      if (removeCount > 0) stats.push(e("span", { className: "hbt-d2m", key: "m" }, "−" + removeCount));
      return e("div", { className: "hbt-diff2", key: "dv" }, [
        e("div", { className: "hbt-diff2-head", key: "h" }, [
          e("span", { className: "hbt-diff2-path", key: "p" }, basename(o.path) || "文件"),
          e("span", { className: "hbt-diff2-badge", key: "b" }, o.actionLabel),
          e("span", { className: "hbt-diff2-stats", key: "s" }, stats),
        ]),
        e("div", { className: "hbt-diff2-body", key: "bd" }, rows),
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
        case "str_replace_editor": {
          var p = argStr(args, "path");
          var vr = Array.isArray(args.view_range) ? args.view_range : null;
          return relativize(p, cwd) + (vr && vr.length === 2 ? ":#" + vr[0] + "-" + vr[1] : "");
        }
        default: return argStr(args, "file_path") || argStr(args, "query") || "";
      }
    }

    // ---------- 详情体（hebbian ToolCallDetail 的 DSH 移植） ----------
    // bash 终端块右上角的「已过/上限 s」计时（hebbian 的 {elapsed}s / {timeoutSecs}s）：
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
      return e("span", { className: "hbt-term-elapsed", "data-near": near ? "1" : undefined }, secs + "/" + props.timeoutSecs + "s");
    }

    function termBody(args, cv, rv, running, block, open) {
      var cmd = argStr(args, "command") || (cv && cv.title) || "";
      var out = rv && typeof rv.output === "string" ? rv.output : "";
      if (!out && !running) out = resultText(block);
      var capped = tailLines(out, 60);
      var timeoutMs = typeof args.timeoutMs === "number" && isFinite(args.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : 120000;
      var kids = [];
      kids.push(e(BashElapsed, { key: "elapsed", block: block, running: running, active: open === true, timeoutSecs: Math.round(timeoutMs / 1000) }));
      if (cmd) kids.push(e("div", { className: "hbt-term-cmd", key: "cmd" }, "$ " + cmd));
      kids.push(e("pre", { className: "hbt-term-out", key: "out" },
        (capped.hidden > 0 ? "… 前略 " + capped.hidden + " 行\n" : "") +
        (capped.text || (running ? "等待输出…" : "（无输出）")) +
        (running ? "\n▍" : "")));
      if (rv && (typeof rv.exitCode === "number" || rv.signal)) {
        var failed = (typeof rv.exitCode === "number" && rv.exitCode !== 0) || !!rv.signal;
        kids.push(e("div", { className: "hbt-term-status", "data-failed": failed ? "1" : undefined, key: "st" },
          rv.signal ? "被信号终止 " + rv.signal : "退出码 " + rv.exitCode));
      }
      return e("div", { className: "hbt-term", key: "term" }, kids);
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
        e("pre", { className: "hbt-term-out", key: "out" },
          (capped.hidden > 0 ? "… 前略 " + capped.hidden + " 行\n" : "") +
          (capped.text || (running ? "读取中…" : "（无输出）"))),
      ];
      if (status) {
        var tone = status === "running" ? "run" : (status === "completed" ? "ok" : "err");
        kids.push(e("div", { className: "hbt-term-status", "data-tone": tone, key: "st" }, "status: " + status));
      }
      return e("div", { className: "hbt-term", key: "job" }, kids);
    }

    function readBody(rv, block) {
      var lines = rv && Array.isArray(rv.lines) ? rv.lines : [];
      if (lines.length === 0) {
        return e("pre", { className: "hbt-pre", key: "read" }, headLines(resultText(block), 60).text || "（空内容）");
      }
      var shown = lines.slice(0, 12);
      var kids = shown.map((l) => e("div", { className: "hbt-code-line", key: "l" + l.number },
        e("span", { className: "hbt-ln" }, String(l.number)),
        e("span", { className: "hbt-ltxt" }, l.text)));
      var total = typeof rv.totalLines === "number" ? rv.totalLines : lines.length;
      if (lines.length > shown.length || total > shown[shown.length - 1].number) {
        kids.push(e("div", { className: "hbt-note", key: "more" }, "… 共 " + total + " 行"));
      }
      return e("div", { className: "hbt-code", key: "read" }, kids);
    }

    // write / edit（DSH diff 视图）：oldText null = 创建文件（纯新增单栏），否则行级 diff（双行号槽）
    function diffBody(diffs, cwd) {
      if (!Array.isArray(diffs) || diffs.length === 0) return null;
      return diffs.slice(0, 4).map((d, i) => {
        if (d.oldText === null || d.oldText === undefined) {
          return e("div", { key: "d" + (d.path || i) + i }, codeChangeView({ path: d.path, actionLabel: "创建文件", ops: addOnlyOps(String(d.newText || "")), cwd: cwd, gutters: 1 }));
        }
        var ops = diffOps(String(d.oldText), String(d.newText === null || d.newText === undefined ? "" : d.newText));
        if (!ops) return e("pre", { className: "hbt-pre", key: "d" + i }, headLines(String(d.newText || ""), 60).text);
        return e("div", { key: "d" + (d.path || i) + i }, codeChangeView({ path: d.path, actionLabel: "修改文件", ops: ops, cwd: cwd, gutters: 2 }));
      });
    }

    function searchBody(rv) {
      if (rv.shape === "paths") {
        var paths = Array.isArray(rv.paths) ? rv.paths : [];
        var kids = paths.slice(0, 40).map((p) => e("div", { className: "hbt-file", key: "p" + p }, p));
        if (rv.truncated || paths.length > 40) {
          kids.push(e("div", { className: "hbt-note", key: "m" }, "… 共 " + (typeof rv.total === "number" ? rv.total : paths.length) + " 个路径"));
        }
        return e("div", { key: "search" }, kids);
      }
      var files = Array.isArray(rv.files) ? rv.files : [];
      var kids2 = [];
      files.slice(0, 20).forEach((f) => {
        kids2.push(e("div", { className: "hbt-file", key: "f" + f.path }, f.path));
        var matches = Array.isArray(f.matches) ? f.matches : [];
        matches.slice(0, 20).forEach((mm, j) => {
          kids2.push(e("div", { className: "hbt-ml", key: "f" + f.path + "m" + j },
            e("span", { className: "hbt-ln" }, String(mm.lineNumber)),
            e("span", { className: "hbt-ltxt" }, mm.line)));
        });
      });
      if (rv.truncated) kids2.push(e("div", { className: "hbt-note", key: "m" }, "… 共 " + rv.total + " 条匹配，结果已截断"));
      return e("div", { key: "search" }, kids2);
    }

    function webBody(rv, block) {
      var kids = [];
      if (rv.kind === "search") {
        if (rv.answer) kids.push(e("div", { className: "hbt-web-answer", key: "a" }, headLines(rv.answer, 12).text));
        var srcs = Array.isArray(rv.sources) ? rv.sources : [];
        srcs.slice(0, 8).forEach((s, j) => {
          kids.push(e("a", { className: "hbt-web-src", href: s.url, target: "_blank", rel: "noreferrer", key: "s" + j }, s.title || s.url));
          if (s.snippet) kids.push(e("div", { className: "hbt-web-snip", key: "sn" + j }, s.snippet));
        });
        if (rv.truncated) kids.push(e("div", { className: "hbt-note", key: "m" }, "… 来源列表已截断"));
      } else {
        kids.push(e("div", { className: "hbt-file", key: "u" },
          (rv.url || "") + (typeof rv.statusCode === "number" ? " · HTTP " + rv.statusCode : "")));
        var text = resultText(block);
        if (text) kids.push(e("pre", { className: "hbt-pre", key: "c" }, headLines(text, 60).text));
      }
      return e("div", { key: "web" }, kids);
    }

    function todoBody(args) {
      var todos = Array.isArray(args.todos) ? args.todos : [];
      if (todos.length === 0) return e("div", { className: "hbt-note", key: "todo" }, "空任务列表");
      return e("div", { key: "todo" }, todos.slice(0, 30).map((t, j) => {
        var s = t && t.status === "completed" ? "completed" : (t && t.status === "in_progress" ? "in_progress" : "pending");
        var mark = s === "completed" ? "✓" : (s === "in_progress" ? "◐" : "○");
        var text = String((t && (s === "in_progress" && t.activeForm ? t.activeForm : t.content)) || "");
        return e("div", { className: "hbt-todo", "data-s": s, key: "t" + j },
          e("span", { className: "hbt-todo-mark" }, mark),
          e("span", null, text));
      }));
    }

    // str_replace_editor：str_replace 走 GitHub 风 diff 视图，insert/create 走纯新增视图（hebbian 不附结果文本）
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
      if (out) kids.push(e("pre", { className: "hbt-pre", key: "out" }, headLines(out, cmd === "view" ? 60 : 30).text));
      if (running) kids.push(e("div", { className: "hbt-note", key: "r" }, "运行中…"));
      return e("div", { key: "sre" }, kids);
    }

    function genericBody(argsRaw, block, running) {
      var kids = [];
      var pretty = prettyJson(argsRaw);
      if (pretty) {
        kids.push(e("div", { key: "i" },
          e("div", { className: "hbt-sec" }, "输入"),
          e("pre", { className: "hbt-pre" }, headLines(pretty, 40).text)));
      }
      if (!running) {
        var out = resultText(block);
        if (out) {
          kids.push(e("div", { key: "o" },
            e("div", { className: "hbt-sec" }, "输出"),
            e("pre", { className: "hbt-pre" }, headLines(out, 60).text)));
        }
      } else {
        kids.push(e("div", { className: "hbt-note", key: "r" }, "运行中…"));
      }
      return e("div", { key: "gen" }, kids);
    }

    function renderDetail(o) {
      var rv = o.rv;
      var cv = o.cv;
      var kids = [];
      if (rv && rv.card === "terminal") kids.push(termBody(o.args, cv, rv, o.running, o.block, o.open));
      else if (rv && rv.card === "read") kids.push(readBody(rv, o.block));
      else if (rv && rv.card === "diff") kids.push(diffBody(rv.diffs, o.cwd));
      else if (rv && rv.card === "search") kids.push(searchBody(rv));
      else if (rv && rv.card === "web") kids.push(webBody(rv, o.block));
      else if (cv && cv.card === "terminal") kids.push(termBody(o.args, cv, null, o.running, o.block, o.open));
      else if (cv && cv.card === "diff") kids.push(diffBody(cv.diffs, o.cwd));
      else if (o.name === "job_output" || o.name === "job_list" || o.name === "job_kill") kids.push(jobBody(o.name, o.block, o.running));
      else if (o.name === "str_replace_editor") kids.push(sreBody(o.args, o.block, o.running, o.cwd));
      else if (o.name === "todo_write") kids.push(todoBody(o.args));
      else kids.push(genericBody(o.argsRaw, o.block, o.running));
      if (!o.running && o.block.isError === true) {
        var err = o.block.error;
        var line = err ? (err.name + (err.code ? " · " + err.code : "")) : "";
        var text = resultText(o.block);
        kids.push(e("div", { className: "hbt-error", key: "err" }, [line, text].filter(Boolean).join("\n") || "调用失败"));
      }
      return kids;
    }

    // ---------- hebbian RunningActivityBlock 行：左贯通色轨 + 行内容 ----------
    function ToolRow(props) {
      var block = props.block || {};
      var settled = block.kind === "tool-result";
      var running = !settled;
      var depth = typeof props.depth === "number" ? props.depth : 0;
      var wireName = props.toolName || (running ? block.name : (block.call && block.call.name) || "");
      var argsRaw = running ? (block.argsRaw || "") : ((block.call && block.call.argsRaw) || "");
      var args = parseArgs(argsRaw);
      var meta = metaFor(wireName, args);
      var rv = settled ? (block.resultView || null) : null;
      var cv = block.callView || null;
      var isError = settled && block.isError === true;
      var failedExit = !!(rv && rv.card === "terminal" && ((typeof rv.exitCode === "number" && rv.exitCode !== 0) || rv.signal));
      var state = running ? "running" : (isError || failedExit ? "error" : "ok");

      // hebbian：running 的 bash 默认展开看实时输出，其余默认折叠；点击相对默认值取反
      var defaultOpen = running && wireName === "bash";
      var st = React.useState(false);
      var toggled = st[0];
      var setToggled = st[1];
      var open = toggled ? !defaultOpen : defaultOpen;
      var toggle = () => setToggled((v) => !v);

      var desc = argStr(args, "description") || meta.desc;
      var summary = summaryFor(wireName, args, props.cwd);

      // 文件类工具：行内「打开」小按钮（不打断折叠交互）；兼容 file_path / path 两种参数名
      var filePath = argStr(args, "file_path") || argStr(args, "path");
      var openable = filePath && typeof props.openFile === "function";
      var openTarget = openable
        ? (filePath.charAt(0) === "/" || !props.cwd ? filePath : String(props.cwd).replace(/\/+$/, "") + "/" + filePath)
        : "";

      var headKids = [
        e("span", { className: "hbt-icon", key: "i" }, svgIcon(meta.icon)),
        e("span", { className: "hbt-name", key: "n" }, meta.label),
        e("span", { className: "hbt-desc", key: "d" }, desc),
      ];
      if (summary) headKids.push(e("code", { className: "hbt-sum", key: "s" }, summary));
      if (failedExit) {
        headKids.push(e("span", { className: "hbt-exit", key: "x" }, rv.signal ? "signal " + rv.signal : "exit " + rv.exitCode));
      }
      if (openable) {
        headKids.push(e("span", {
          className: "hbt-open", key: "o", title: "打开文件", role: "button", tabIndex: 0,
          onClick: (ev) => { ev.stopPropagation(); props.openFile(openTarget); },
          onKeyDown: (ev) => { if (ev.key === "Enter") { ev.stopPropagation(); props.openFile(openTarget); } },
        }, "↗"));
      }

      var bodyKids = renderDetail({ name: wireName, block: block, running: running, args: args, argsRaw: argsRaw, rv: rv, cv: cv, cwd: props.cwd, open: open });

      // 子调用（subagent 等）递归成行，hebbian NestedTaskContent 的左竖线结构
      var subs = Array.isArray(block.subCalls) ? block.subCalls : [];
      if (subs.length > 0 && depth < 2) {
        bodyKids.push(e("div", { className: "hbt-subs", key: "subs" }, subs.slice(0, 20).map((sub, j) => {
          var subName = sub && sub.kind === "tool-result" ? ((sub.call && sub.call.name) || "") : ((sub && sub.name) || "");
          return e(ToolRow, { key: (sub && sub.callId) || ("sub" + j), block: sub, toolName: subName, cwd: props.cwd, openFile: props.openFile, depth: depth + 1 });
        })));
      }

      return e("div", { className: "hbt-row", "data-state": state },
        e("button", { type: "button", className: "hbt-rail", onClick: toggle, title: open ? "折叠" : "展开", "aria-label": open ? "折叠工具调用" : "展开工具调用" }),
        e("div", { className: "hbt-card", "data-open": open ? "1" : "0" },
          e("button", { type: "button", className: "hbt-head", onClick: toggle, "aria-expanded": open ? "true" : "false" }, headKids),
          e("div", { className: "hbt-detail" },
            e("div", { className: "hbt-detail-in" },
              e("div", { className: "hbt-body" }, bodyKids)))));
    }

    // ---------- goal 系列：genui callout 风格色块（无行铬，直接嵌入消息流） ----------
    function GoalCard(props) {
      var block = props.block || {};
      var settled = block.kind === "tool-result";
      var argsRaw = settled ? ((block.call && block.call.argsRaw) || "") : (block.argsRaw || "");
      var args = parseArgs(argsRaw);
      var name = props.toolName || "";
      var tone = "info";
      var title = "目标";
      var body = "";
      if (name === "create_goal") {
        tone = "info";
        title = "设定目标";
        body = argStr(args, "objective");
      } else if (name === "get_goal") {
        tone = "neutral";
        title = "当前目标";
        body = settled ? resultText(block) : "读取中…";
      } else {
        var action = argStr(args, "action") || "edit";
        if (action === "complete") { tone = "success"; title = "目标完成"; }
        else if (action === "blocked") { tone = "error"; title = "目标受阻"; }
        else if (action === "pause") { tone = "warn"; title = "目标暂停"; }
        else if (action === "resume") { tone = "info"; title = "目标恢复"; }
        else { tone = "info"; title = "目标已更新"; }
        body = argStr(args, "blocked_reason") || argStr(args, "objective") || (settled ? resultText(block) : "更新中…");
      }
      var rounds = typeof args.max_goal_rounds === "number" ? args.max_goal_rounds : null;
      return e("div", { className: "hbt-callout", "data-tone": tone },
        e("div", { className: "hbt-callout-head" },
          e("span", { className: "hbt-callout-dot" }),
          e("span", { className: "hbt-callout-title" }, title)),
        e("div", { className: "hbt-callout-body" }, body || "（无内容）"),
        rounds !== null ? e("div", { className: "hbt-callout-rounds" }, "最多 " + rounds + " 轮") : null);
    }

    // ---------- 样式：hebbian RunningActivityBlock 视觉 × DSH 主题 token ----------
    // 轨道色沿用 hebbian runningRailColor 的固定值：done #34d59a / running #3dbbf5 / reasoning #8c93f8 / error #ee5858
    var CSS_TEXT = `
.hbt-row { position: relative; margin: 2px 0; font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-secondary); }
.hbt-rail { position: absolute; left: 2px; top: 3px; bottom: 3px; width: 3px; border-radius: 999px; border: 0; padding: 0; cursor: pointer; background: #34d59a; }
.hbt-row[data-state="running"] > .hbt-rail { background: #3dbbf5; animation: hbt-breathe 1.6s ease-in-out infinite; }
.hbt-row[data-state="error"] > .hbt-rail { background: #ee5858; }
@keyframes hbt-breathe { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
.hbt-card { margin-left: 11px; border-radius: 6px; }
.hbt-card[data-open="1"] { background: var(--dsw-alias-bg-layer-1); box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1); }
.hbt-head { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; padding: 3px 6px 3px 4px; border: 0; background: transparent; cursor: pointer; text-align: left; font: inherit; color: inherit; border-radius: 6px; }
.hbt-head:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.hbt-icon { display: inline-flex; width: 14px; height: 14px; flex: none; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary); opacity: .8; }
.hbt-name { font-weight: 600; color: var(--dsw-alias-label-primary); flex: none; }
.hbt-row[data-state="running"] .hbt-name { background: linear-gradient(90deg, var(--dsw-alias-label-primary) 30%, #3dbbf5 50%, var(--dsw-alias-label-primary) 70%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: hbt-shimmer 2.2s linear infinite; }
@keyframes hbt-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.hbt-desc { color: var(--dsw-alias-label-secondary); opacity: .85; flex: none; }
.hbt-sum { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-primary); opacity: .85; }
.hbt-exit { flex: none; margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; padding: 1px 7px; border-radius: 999px; background: rgba(238,88,88,.14); color: #ee5858; }
.hbt-open { flex: none; margin-left: auto; color: var(--dsw-alias-label-secondary); opacity: 0; padding: 0 4px; border-radius: 4px; cursor: pointer; font-size: 11px; }
.hbt-head:hover .hbt-open { opacity: .8; }
.hbt-open:hover { color: var(--dsw-alias-brand-primary); }
.hbt-exit + .hbt-open { margin-left: 0; }
.hbt-detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s ease-out; }
.hbt-card[data-open="1"] > .hbt-detail { grid-template-rows: 1fr; }
.hbt-detail-in { overflow: hidden; min-height: 0; }
.hbt-body { margin: 2px 6px 6px; padding-top: 5px; border-top: 1px solid var(--dsw-alias-border-l1); }
.hbt-term { position: relative; border-radius: 6px; overflow: hidden; background: #0d1117; color: #d6e0ea; }
.hbt-term-elapsed { position: absolute; top: 5px; right: 9px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; font-variant-numeric: tabular-nums; color: #8b949e; user-select: none; pointer-events: none; }
.hbt-term-elapsed[data-near="1"] { color: #e3b341; }
.hbt-term-cmd { padding: 6px 84px 6px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #7ee787; border-bottom: 1px solid rgba(255,255,255,.08); white-space: pre-wrap; word-break: break-all; }
.hbt-term-out { margin: 0; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto; }
.hbt-term-status { padding: 3px 10px; font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; border-top: 1px solid rgba(255,255,255,.08); color: #8b949e; }
.hbt-term-status[data-failed="1"] { color: #ff7b72; }
.hbt-term-status[data-tone="run"] { color: #58a6ff; }
.hbt-term-status[data-tone="ok"] { color: #7ee787; }
.hbt-term-status[data-tone="err"] { color: #ff7b72; }
.hbt-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.55; background: var(--dsw-alias-bg-layer-2); border-radius: 6px; padding: 6px 0; max-height: 340px; overflow: auto; }
.hbt-code-line { display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 8px; padding: 0 10px 0 0; white-space: pre; }
.hbt-ln { text-align: right; color: var(--dsw-alias-label-secondary); opacity: .55; user-select: none; flex: none; }
.hbt-ltxt { overflow: hidden; text-overflow: ellipsis; }
.hbt-diff2 { border-radius: 6px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 4px; }
.hbt-diff2-head { display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.hbt-diff2-path { font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hbt-diff2-badge { flex: none; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1); }
.hbt-diff2-stats { display: inline-flex; gap: 6px; font-size: 10px; font-variant-numeric: tabular-nums; }
.hbt-d2p { color: var(--dsw-alias-state-success-primary); }
.hbt-d2m { color: var(--dsw-alias-state-error-primary); }
.hbt-diff2-body { max-height: 240px; overflow: auto; padding: 6px 0; font-size: 11px; line-height: 1.55; }
.hbt-d2l { display: flex; align-items: flex-start; min-height: 1.4em; padding: 0 6px; }
.hbt-d2l[data-t="+"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); }
.hbt-d2l[data-t="+"] .hbt-d2t, .hbt-d2l[data-t="+"] .hbt-d2s { color: var(--dsw-alias-state-success-primary); }
.hbt-d2l[data-t="-"] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.hbt-d2l[data-t="-"] .hbt-d2t, .hbt-d2l[data-t="-"] .hbt-d2s { color: var(--dsw-alias-state-error-primary); }
.hbt-d2g { flex: none; width: 32px; margin-right: 4px; text-align: right; font-size: 9px; line-height: 1.7; color: var(--dsw-alias-label-secondary); opacity: .55; user-select: none; font-variant-numeric: tabular-nums; }
.hbt-d2s { flex: none; width: 12px; margin-right: 4px; text-align: center; font-size: 12px; user-select: none; }
.hbt-d2t { min-width: 0; flex: 1; white-space: pre-wrap; word-break: break-all; color: var(--dsw-alias-label-primary); }
.hbt-d2l[data-t=" "] .hbt-d2t { color: var(--dsw-alias-label-secondary); opacity: .8; }
.hbt-sec { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--dsw-alias-label-secondary); opacity: .8; margin: 6px 2px 2px; }
.hbt-pre { margin: 2px 0; padding: 6px 10px; background: var(--dsw-alias-bg-layer-2); border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; }
.hbt-note { padding: 2px 10px 4px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); opacity: .8; }
.hbt-file { padding: 3px 2px 1px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-primary); }
.hbt-ml { display: grid; grid-template-columns: 40px minmax(0,1fr); gap: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; padding: 0 10px 0 0; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
.hbt-web-answer { font-size: 12px; color: var(--dsw-alias-label-primary); padding: 2px 2px 6px; white-space: pre-wrap; }
.hbt-web-src { display: block; padding: 2px 0; color: var(--dsw-alias-brand-primary); text-decoration: none; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hbt-web-src:hover { text-decoration: underline; }
.hbt-web-snip { font-size: 11.5px; color: var(--dsw-alias-label-secondary); padding: 0 0 4px; }
.hbt-todo { display: flex; gap: 6px; align-items: baseline; padding: 1.5px 4px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.hbt-todo[data-s="completed"] { color: var(--dsw-alias-label-secondary); text-decoration: line-through; }
.hbt-todo[data-s="in_progress"] .hbt-todo-mark { color: var(--dsw-alias-brand-primary); }
.hbt-todo-mark { flex: none; width: 12px; text-align: center; }
.hbt-error { color: var(--dsw-alias-state-error-primary); font-size: 11.5px; white-space: pre-wrap; word-break: break-word; padding: 4px 2px; }
.hbt-subs { margin: 4px 2px 4px 6px; padding-left: 10px; border-left: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); }
.hbt-callout { border-radius: 10px; padding: 10px 14px 12px; margin: 2px 0; }
.hbt-callout[data-tone="error"] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent); }
.hbt-callout[data-tone="success"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 9%, transparent); }
.hbt-callout[data-tone="warn"] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent); }
.hbt-callout[data-tone="info"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.hbt-callout[data-tone="neutral"] { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 10%, transparent); }
.hbt-callout-head { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
.hbt-callout-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; flex: none; }
.hbt-callout-title { font-weight: 600; font-size: 13px; }
.hbt-callout[data-tone="error"] .hbt-callout-head { color: var(--dsw-alias-state-error-primary); }
.hbt-callout[data-tone="success"] .hbt-callout-head { color: var(--dsw-alias-state-success-primary); }
.hbt-callout[data-tone="warn"] .hbt-callout-head { color: var(--dsw-alias-state-warn-primary); }
.hbt-callout[data-tone="info"] .hbt-callout-head { color: var(--dsw-alias-brand-primary); }
.hbt-callout[data-tone="neutral"] .hbt-callout-head { color: var(--dsw-alias-label-secondary); }
.hbt-callout-body { font-size: 13.5px; line-height: 1.65; color: var(--dsw-alias-label-primary); white-space: pre-wrap; word-break: break-word; }
.hbt-callout-rounds { margin-top: 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .8; }
/* 活动行相邻统一贴合到 2px：工具行、含 think 行的步骤（负 margin 抵消 column 16px gap；不看有无正文段落——空文本块会渲染空 p，:not(:has(p)) 会误判） */
[class*="_flowItem"][data-chat-flow-kind="tool-call"] + [class*="_flowItem"][data-chat-flow-kind="tool-call"],
[class*="_flowItem"][data-chat-flow-kind="tool-call"] + [class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]),
[class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [class*="_flowItem"][data-chat-flow-kind="tool-call"],
[class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [class*="_flowItem"][data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) { margin-top: -14px; }
.hbt-stream-body { margin: 2px 6px 6px; padding-top: 5px; border-top: 1px solid var(--dsw-alias-border-l1); }
.hbt-stream-max { max-height: 140px; }
.hbt-head--static { cursor: default; }
.hbt-stream-size { flex: none; margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: var(--dsw-alias-label-secondary); opacity: .8; }
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

    function StreamingToolRow(props) {
      var name = typeof props.toolName === "string" ? props.toolName : "";
      var argsRaw = typeof props.argsRaw === "string" ? props.argsRaw : "";
      var meta = metaFor(name, {});
      var head = argsRaw.length > SCAN_HEAD ? argsRaw.slice(0, SCAN_HEAD) : argsRaw;
      var target = looseArg(head, "file_path") || looseArg(head, "path") || looseArg(head, "command") || looseArg(head, "pattern") || looseArg(head, "query") || "";
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
          body = e("div", { className: "hbt-stream-body", key: "body" },
            e("div", { className: "hbt-term" },
              e("pre", { className: "hbt-term-out hbt-stream-max" }, "$ " + stream + "\n▍")));
        } else {
          var t = tailLines(stream, 6);
          // 走了尾窗分支时 stream 只是尾部，行数不再是全量真值，所以不报数字。
          var elided = windowed ? "… 前略\n" : (t.hidden > 0 ? "… 前略 " + t.hidden + " 行\n" : "");
          body = e("div", { className: "hbt-stream-body", key: "body" },
            e("pre", { className: "hbt-pre hbt-stream-max" }, elided + t.text + "\n▍"));
        }
      }
      return e("div", { className: "hbt-row", "data-state": "running" },
        e("span", { className: "hbt-rail" }),
        e("div", { className: "hbt-card", "data-open": stream ? "1" : "0" },
          e("div", { className: "hbt-head hbt-head--static" },
            e("span", { className: "hbt-icon" }, svgIcon(meta.icon)),
            e("span", { className: "hbt-name" }, meta.label),
            e("span", { className: "hbt-desc" }, "生成中…"),
            target ? e("code", { className: "hbt-sum" }, target) : null,
            e("span", { className: "hbt-stream-size" }, argsRaw.length > 0 ? String(argsRaw.length) + " 字符" : "")),
          body));
    }

    var STYLE_ID = "dsh-hebbian-rows-style";

    function apply(ctx) {
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
        var rowKeys = ["bash", "read", "write", "edit", "grep", "glob", "web_search", "web_fetch", "todo_write", "skill", "job_output", "job_list", "job_kill", "subagent", "subagent_fork", "list_agents", "send_message", "validate_dsh_ui", "str_replace_editor"];
        var goalKeys = ["create_goal", "get_goal", "update_goal"];
        var disposers = [];
        for (var i = 0; i < rowKeys.length; i++) {
          disposers.push(ctx.slots.register({ name: "tool.call.toolview", key: rowKeys[i], priority: SHADOW_PRIORITY }, (props) => e(ToolRow, props)));
        }
        for (var j = 0; j < goalKeys.length; j++) {
          disposers.push(ctx.slots.register({ name: "tool.call.toolview", key: goalKeys[j], priority: SHADOW_PRIORITY }, (props) => e(GoalCard, props)));
        }
        return function () {
          for (var k = 0; k < disposers.length; k++) {
            try { if (typeof disposers[k] === "function") disposers[k](); } catch (err) { console.error("dsh-hebbian-rows: unregister failed", err); }
          }
        };
      });
      ctx.slots.inject("conversation.chat.streamingCall", function () {
        // 按工具名分派，键域与 tool.call.toolview 相同；未注册的工具名落到 dsh
        // 自带的原生流式行，所以这里只认领本插件已经接管卡片的那些工具。
        var streamKeys = ["bash", "read", "write", "edit", "grep", "glob", "web_search", "web_fetch", "todo_write", "skill", "job_output", "job_list", "job_kill", "subagent", "subagent_fork", "list_agents", "send_message", "validate_dsh_ui", "str_replace_editor", "create_goal", "get_goal", "update_goal"];
        var disposers = [];
        for (var i = 0; i < streamKeys.length; i++) {
          disposers.push(ctx.slots.register(
            { name: "conversation.chat.streamingCall", key: streamKeys[i] },
            (props) => e(StreamingToolRow, props),
          ));
        }
        return function () {
          for (var k = 0; k < disposers.length; k++) {
            try { if (typeof disposers[k] === "function") disposers[k](); } catch (err) { console.error("dsh-hebbian-rows: unregister failed", err); }
          }
        };
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
