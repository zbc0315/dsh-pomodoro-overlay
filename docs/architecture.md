# 技术方案（DSH 0.2.1-rc.2）

## 结论

采用**浏览器端计时 + DSH 全局 overlay + DSH 原生插件配置**。不修改 DSH 本体，不启动额外服务，不把计时状态放到模型会话或 TODO 板中。周期配置由 Host ConfigForm 持久化，运行状态才放浏览器 localStorage。

## 接口证据

1. **客户端打包格式**：DSH client bundle 通过 `window.__ModuleLoader__.load({ id, factory })` 注册；`require('react')` 由宿主提供。现有插件 `dsh-todo-board/client/client.js:1-2,18-19` 使用该格式。
2. **全局 UI 挂载点**：`ctx.slots.inject('shell.overlay', ...)` 后调用 `ctx.slots.register(...)`；现有插件 `dsh-todo-board/client/client.js:3644-3649` 是直接范例。
3. **原生配置与设置页**：Host 用 Schemastery 声明七个 `.volatile()` 字段（一个字体、两个时长、两个颜色、两个不透明度）；客户端以 `ctx.configForms.get('pomodoro-overlay')` 读取/订阅，`mutate` 一次原子保存七个字段并携带 revision。设置 UI 注册到 `settings.section`，`id: 'pomodoro'`、`order: 30`、`label: '番茄钟'`。依据：`dsh-settings/README.zh.md:10-13,28-40`、`dsh-client-ui-settings/lib/types/client/config-form-types.d.ts:5-70`、`dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:62-77`，以及 `dsh-client-ui-agent-preset/lib/client.js:2455-2462` 的原生注册范例。配置 ready 前不得启动计时。
4. **聊天区域锚点**：Conversation 根节点带 `data-conversation-content`、`data-conversation-region="chat"`，输入区带 `data-composer-seat`、`data-conversation-region="composer"`。DOM 结构见 `dsh-client-ui-conversation/lib/client.js:17855-17876`。
5. **样式生命周期**：样式标签标 `data-plugin="@tom2012/dsh-pomodoro-overlay"`，在 `ctx.effect` 内挂载并返回清理函数，避免 HMR 时误删或被误删；参考 `dsh-todo-board/client/client.js:3607-3619`。
6. **包激活**：包的 `cordis.patch.yml` 使用 `insert` 增加一个插件服务；`package.json` 的 `dsh.bundle.patch` 指向它，`dsh.client` 声明 Web 客户端和 `slots` 注入。

## 布局算法

- 在 `shell.overlay` 渲染一个 `position: fixed` 根节点。
- 从可见的 `[data-conversation-content][data-conversation-region="chat"]` 中选择面积最大的主聊天区，避免误选嵌入式小聊天区。
- 读取聊天区矩形；若内部存在 `[data-composer-seat]`，倒计时区域底边取 `min(聊天区底边, 输入区顶边)`，因此不覆盖输入框。
- 侧栏和顶部导航不在聊天区矩形内，自然不会被覆盖。
- 仅在聊天区内存在 `[data-chat-flow]` 时显示；selector 缺失、Chat 非活动或矩形异常时 fail-closed 隐藏，绝不退化成全屏遮挡。
- 用 `ResizeObserver`、窗口 resize、捕获阶段 scroll 和受节流的 MutationObserver 保持位置准确；字体配置变化时也重新测量数字宽度，避免字宽差异导致裁切。
- 整个聊天 overlay 均为 `pointer-events: none`，不渲染可见阶段标签、工具条或控制按钮；仅显示大数字，屏幕阅读器状态保留，设置页表单保持正常交互。
- `data-*` 标记属于当前 DSH 内部 DOM，并非稳定选择器 API；本方案绑定已验证版本，升级后必须重跑布局冒烟测试。

## 文件结构

```text
dsh-pomodoro-overlay/
├── package.json
├── cordis.patch.yml
├── lib/
│   └── index.js             # 原生配置 schema 与设置策略
├── src/
│   ├── timer-core.js        # 纯计时状态机
│   ├── browser-store.js     # localStorage、跨标签页与订阅
│   ├── chat-geometry.js     # 聊天区识别与 composer 扣除
│   ├── font.js              # 本机字体候选与安全 CSS 字体栈
│   ├── client.js            # React overlay、slots 与 DOM 锚定
│   ├── settings.js          # DSH 设置窗口中的七字段表单与草稿预览
│   └── styles.js            # 主题令牌与响应式样式
├── client/
│   └── client.js            # 构建后的 DSH 浏览器 bundle
├── tests/
│   ├── timer-core.test.js
│   └── browser-store.test.js
├── tools/
│   ├── build.mjs
│   └── check-package.mjs
├── docs/
│   ├── design.md
│   └── architecture.md
└── README.md
```

## 状态与配置

- DSH 原生配置：`{ fontFamily, focusMinutes, breakMinutes, focusColor, breakColor, focusOpacity, breakOpacity }`，由 ConfigForm 读取、跨页面订阅和原子写入。字体默认等线；不透明度在 profile 中为 0–1，在设置 UI 中为 0–100%。
- `dsh-pomodoro-overlay:state:v1`：当前阶段、是否运行、阶段开始时间、绝对截止时间、阶段时长、暂停剩余时间和更新时间。
- 客户端收到 `status === 'ready'` 的有效配置后才启动；之后配置变更通过订阅送入同一 store。
- 显示 tick 不写入 localStorage；只有初始化、用户操作、自然阶段切换和外部状态同步才写入。
- 所有运行显示都读取当前时间，不在 tick 中做 `remaining -= 1`。
- 配置修改不重建当前阶段；状态机在下一次阶段切换时读取新时长，overlay 则在保存后立即读取新字体、颜色与不透明度。
- 阶段过期追赶最多先走两次切换，之后按完整「专注 + 休息」周期做算术跳跃，避免长时间关闭后逐分钟循环。

## 构建与测试

- 浏览器客户端零 npm 运行时依赖，React 由 DSH 宿主提供；Host 使用 `@deepseek-ai/schemastery` 声明配置。
- `esbuild` 仅作开发依赖，把 `src/` 打成单个 client bundle，React 保持 external。
- Node 内置 `node:test` 覆盖计时核心与浏览器存储逻辑。
- 包检查验证入口、patch、bundle 声明和构建产物一致。
- 最终通过 `dsh plugin --profile web add <本地目录>` 安装。Host schema 变更后必须由用户在**外部 Terminal** 重载同一 DSH Web 服务，再在既有 URL 做 GUI 验证；禁止从 DSH 会话内部终止自己的宿主进程。
