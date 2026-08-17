// dsh-hebbian-rows — host face
//
// 本插件的全部能力在 web client（工具行渲染 + 样式注入），host 侧无服务、
// 无事件、无工具，仅作为 cordis.patch.yml 插入行的挂载点存在。
// 保持空实现：任何 host 侧能力（如读文件求真实行号）未来从这里进。

const inject = [];

function apply() {}

export { apply, inject };
