# 技术方案（DSH 0.2.1-rc.2）

## 结论

采用**浏览器端计时 + DSH 全局 overlay + DSH 原生插件配置**。不修改 DSH 本体，不启动额外服务，不把计时状态放到模型会话或 TODO 板中。周期配置由 Host ConfigForm 持久化，运行状态才放浏览器 localStorage。

## 接口证据

1. **客户端打包格式**：DSH client bundle 通过 `window.__ModuleLoader__.load({ id, factory })` 注册；`require('react')` 由宿主提供。现有插件 `dsh-todo-board/client/client.js:1-2,18-19` 使用该格式。
2. **全局 UI 挂载点**：`ctx.slots.inject('shell.overlay', ...)` 后调用 `ctx.slots.register(...)`；现有插件 `dsh-todo-board/client/client.js:3644-3649` 是直接范例。
3. **原生配置与设置页**：Host 用 Schemastery 声明七个 `.volatile()` 字段（一个字体、两个时长、两个颜色、两个不透明度）；客户端以 `ctx.configForms.get('pomodoro-overlay')` 读取/订阅，`mutate` 一次原子保存七个字段并携带 revision。设置 UI 注册到 `settings.section`，`id: 'pomodoro'`、`order: 30`、`label: '番茄钟'`。依据：`dsh-settings/README.zh.md:10-13,28-40`、`dsh-client-ui-settings/lib/types/client/config-form-types.d.ts:5-70`、`dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:62-77`，以及 `dsh-client-ui-agent-preset/lib/client.js:2455-2462` 的原生注册范例。配置 ready 前不得启动计时。
4. **视口几何**：倒计时铺满整个浏览器视口（`left: 0; top: 0; width: 100vw; height: 100vh` 等价的像素矩形），与当前视图无关；不再依赖聊天 DOM 锚点。
5. **样式生命周期**：样式标签标 `data-plugin="@tom2012/dsh-pomodoro-overlay"`，在 `ctx.effect` 内挂载并返回清理函数，避免 HMR 时误删或被误删；参考 `dsh-todo-board/client/client.js:3607-3619`。
6. **包激活**：包的 `cordis.patch.yml` 使用 `insert` 增加一个插件服务；`package.json` 的 `dsh.bundle.patch` 指向它。`dsh.client` 声明 `platform: 'web'`、`immediately: true`，并通过 `dsh.client.inject` 注入 layout 与 settings 客户端依赖；`shell.overlay` 和 `settings.section` 则在运行时通过 `ctx.slots.register` 注册。

## 布局算法

- 在 `shell.overlay` 渲染一个 `position: fixed` 根节点，矩形始终等于整个浏览器视口。
- 配置 ready 且视口尺寸有效（宽高为正）即显示；任何 DSH 视图（对话、设置页、TODO 板等）都显示，右侧边栏展开或收起不影响尺寸。
- 半透明数字覆盖在侧栏、顶栏、输入框与弹窗之上，overlay 整体保持 `pointer-events: none`，可看穿、可点穿。
- 只用 `window.innerWidth` / `window.innerHeight`（无则回退 `document.documentElement.clientWidth/Height`）；窗口 resize 时按动画帧重算，数字重新适配。
- 整个 overlay 不渲染可见阶段标签、工具条或控制按钮；仅显示大数字，屏幕阅读器状态保留，设置页表单保持正常交互。
- 不再读取 DSH 内部 DOM 标记，因此不受 DSH 版本 DOM 变化影响。

## 文件结构

```text
dsh-pomodoro-overlay/
├── .gitignore
├── package.json
├── package-lock.json
├── pnpm-workspace.yaml
├── cordis.patch.yml
├── LICENSE
├── lib/
│   └── index.js             # 原生配置 schema 与设置策略
├── src/
│   ├── timer-core.js        # 纯计时状态机
│   ├── browser-store.js     # localStorage、跨标签页与订阅
│   ├── chat-geometry.js     # 视口矩形计算（innerWidth/innerHeight）
│   ├── font.js              # 本机字体候选与安全 CSS 字体栈
│   ├── client.js            # React overlay、slots 与 DOM 锚定
│   ├── settings.js          # DSH 设置窗口中的七字段表单与草稿预览
│   └── styles.js            # 主题令牌与响应式样式
├── client/
│   └── client.js            # 构建后的 DSH 浏览器 bundle
├── tests/
│   ├── timer-core.test.js
│   ├── browser-store.test.js
│   ├── chat-geometry.test.js
│   ├── client-bundle.test.js
│   ├── font.test.js
│   └── host-config.test.js
├── tools/
│   ├── build.mjs
│   └── check-package.mjs
├── docs/
│   ├── design.md
│   ├── architecture.md
│   └── verification.md
└── README.md
```

## 状态与配置

- npm 包、Host 插件服务、浏览器 ModuleLoader 与样式生命周期标识均为 `@tom2012/dsh-pomodoro-overlay`；Cordis patch ID 和 ConfigForm ID 保持为 `pomodoro-overlay`，浏览器存储键保持为 `dsh-pomodoro-overlay:state:v1`，因此作用域迁移不改变既有配置与时间线的读取键。
- DSH 原生配置：`{ fontFamily, focusMinutes, breakMinutes, focusColor, breakColor, focusOpacity, breakOpacity }`，由 ConfigForm 读取、跨页面订阅和原子写入。字体默认等线；不透明度在 profile 中为 0–1，在设置 UI 中为 0–100%。
- `dsh-pomodoro-overlay:state:v1`：当前阶段、是否运行、阶段开始时间、绝对截止时间、阶段时长、暂停剩余时间和更新时间。
- 客户端收到 `status === 'ready'` 的有效配置后才初始化 store；之后配置变更通过订阅送入同一 store。
- 显示 tick 不写入 localStorage；只有初始化、内部状态机操作、自然阶段切换和外部状态同步才写入。
- 所有运行显示都读取当前时间，不在 tick 中做 `remaining -= 1`。
- 配置修改不重建当前阶段；状态机在下一次阶段切换时读取新时长，overlay 则在保存后立即读取新字体、颜色与不透明度。
- 旧版 `running: false` 快照会原样恢复并保持暂停；时钟没有继续按钮。需要重新开始时，删除该插件的 localStorage 运行状态键并刷新，即可按当前配置新建运行中的专注阶段；DSH 配置不受影响。
- 阶段过期追赶先最多进行两次逐边界切换；若仍然过期且存在完整过去周期，则按完整「专注 + 休息」周期做算术跳跃，必要时再逐边界切换一次以落到当前阶段，避免长时间关闭后逐分钟循环。

## 构建与测试

- 浏览器客户端零 npm 运行时依赖，React 由 DSH 宿主提供；Host 使用 `@deepseek-ai/schemastery` 声明配置。
- `esbuild` 仅作开发依赖，把 `src/` 打成单个 client bundle，React 保持 external。
- Node 内置 `node:test` 的六个测试文件共 37 项测试，覆盖计时核心、浏览器存储、视口几何、Host 配置、字体栈，以及构建后客户端加载、store / slots 和部分清理的有限冒烟；完整范围见 `docs/verification.md`。
- `tools/check-package.mjs` 验证入口、patch 与 bundle 的静态约束，不做逐字新鲜度比较；`npm run build` 负责重建产物，另可运行 `node tools/build.mjs --check` 逐字检查产物是否过时。`npm run verify` 先构建再执行静态检查和测试。
- 通过 `dsh plugin --profile web add @tom2012/dsh-pomodoro-overlay` 从 npm 安装，或通过 `dsh plugin --profile web add <本地目录>` 从源码安装。Host schema 变更后必须由用户在**外部 Terminal** 重载同一 DSH Web 服务，再在既有 URL 做 GUI 验证；禁止从 DSH 会话内部终止自己的宿主进程。
