// lib/client.js（bundle 形态）→ 动态 Cordis 插件的 client 半边源码。
//
// 两种形态的差异只有三处环境接线，全部在这里做，渲染逻辑一字不改：
//   require("react")     → React 闭包符号（evaluator 以参数注入）
//   window 定时器        → ctx.interval / ctx.timeout（随插件卸载自动清理）
//   document.head <style> → styles.insert（同上）
//
// 用法：node scripts/build-dynamic.mjs   （写出 lib/client.dynamic.js）
//
// 动态插件本体是个薄加载器：host 半用 ctx.fs 读这个产物，client 半 new Function 求值。
// 所以改完 lib/client.js 只要重跑本脚本 + 重跑一次插件，不用把源码搬进工具调用。

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = readFileSync(join(root, 'lib/client.js'), 'utf8')

const start = src.indexOf('    var inject = ')
const end = src.indexOf('    exports.apply = apply;')
if (start < 0 || end < 0) throw new Error('lib/client.js 的 factory 边界变了，转换脚本要跟着改')

let body = src.slice(start, end)

const swap = (from, to) => {
  if (!body.includes(from)) throw new Error(`转换锚点丢失：${from.slice(0, 60)}`)
  body = body.replace(from, to)
}

// 1) 定时器：ctx 版本（apply 里把 ctx 存进 pluginCtx）
swap(
  `    var intervalFn = function (cb, ms) {
      var id = window.setInterval(cb, ms);
      return function () { window.clearInterval(id); };
    };
    var timeoutFn = function (cb, ms) {
      var id = window.setTimeout(cb, ms);
      return function () { window.clearTimeout(id); };
    };`,
  `    var pluginCtx = null;
    var intervalFn = function (cb, ms) {
      if (pluginCtx === null || typeof pluginCtx.interval !== "function") return function () {};
      return pluginCtx.interval(cb, ms);
    };
    var timeoutFn = function (cb, ms) {
      if (pluginCtx === null || typeof pluginCtx.timeout !== "function") return function () {};
      return pluginCtx.timeout(cb, ms);
    };`,
)

// 2) inject 里补 timer（ctx.interval / ctx.timeout 的服务）
swap('var inject = ["slots", "sessions"];', 'var inject = ["slots", "sessions", "timer"];')

// 3) 样式：styles.insert 取代 document.head 里的常驻 <style>
swap(
  `      loadMcpCache();
      if (document.getElementById(STYLE_ID) === null) {
        var style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS_TEXT;
        document.head.appendChild(style);
      }`,
  `      pluginCtx = ctx;
      loadMcpCache();
      styles.insert(CSS_TEXT);`,
)

const header = `// dsh-better-tool-ui — 动态 Cordis 插件形态（由 scripts/build-dynamic.mjs 从 lib/client.js 生成，勿手改）
// 与固化版的差异只有环境接线：React 闭包符号 / ctx 定时器 / styles.insert。
`
const out = header + body + '\n    return { name: "dsh-better-tool-ui", inject: inject, apply: apply };\n'
writeFileSync(join(root, 'lib/client.dynamic.js'), out)
process.stdout.write(`lib/client.dynamic.js 已生成（${out.length} 字符）\n`)
