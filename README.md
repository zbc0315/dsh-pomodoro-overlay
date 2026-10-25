# @tom2012/dsh-pomodoro-overlay

为 DeepSeek Harness Web 设计的自动循环番茄钟。新计时或已运行的计时无需点击，自动进行「专注 → 休息 → 专注」循环；一个尽量铺满聊天消息区的半透明大倒计时，不覆盖侧栏和底部输入框。旧版暂停快照的兼容行为见下文。

## 功能

- **自动循环**：默认专注 25 分钟、休息 5 分钟；没有有效快照时，原生配置读取完成后自动开始。已运行快照继续按时间线推进，旧版暂停快照保持暂停。
- **聊天区大倒计时**：按消息区实际宽高和文字宽度自适应，保持数字比例，不裁切。
- **可配置阶段外观**：默认专注浅灰 `#9ca3af` / 10% 不透明度，休息红 `#ef4444` / 30% 不透明度；颜色和不透明度均可调整。
- **可配置时钟字体**：专注与休息共用，默认等线（DengXian）；可输入本机已安装字体，未安装时回退到本机无衬线字体，不下载字体。
- **DSH 原生设置页**：在 DSH 设置窗口的「番茄钟」页修改字体及两种阶段的时长、颜色和不透明度；七个字段一次原子保存，revision 防止并发覆盖。
- **纯展示聊天层**：聊天区只有大倒计时，没有“专注 / 休息”可见标签，也没有暂停、跳过、重置等控制按钮。
- **刷新恢复**：运行状态保存绝对截止时间；刷新、切标签页、休眠或重开页面后，运行中的计时按原时间线恢复，暂停快照保持暂停，不通过 interval 递减计时。
- **低干扰**：数字层鼠标穿透；没有声音、系统通知、网络请求、模型工具或额外后台服务。

## 安装

从 npm 安装并注册到 DSH Web profile：

```bash
dsh plugin --profile web add @tom2012/dsh-pomodoro-overlay
```

不要同时启用旧无作用域包 `dsh-pomodoro-overlay` 与 scoped 新包，以免两个实例读写同一运行状态。普通 `npm install` 只安装 Node 依赖，不会向 DSH profile 注册插件。

从源码安装到 DSH 时，在本目录执行：

```bash
npm run build
dsh plugin --profile web add "$(pwd)"
```

按 `dsh plugin` 返回的应用结果操作：若 Host schema 变更要求重启，请在**外部 Terminal** 重载现有 DSH Web 服务并刷新原 GUI，不要从 DSH 会话内部终止自己的宿主；若支持客户端 HMR，则确认浏览器已收到新 bundle 后再刷新。不要把“Host 已应用”直接当作浏览器已加载成功。

安装会修改 `~/.dsh/profiles/web`，请通过正常的 DSH 安装命令完成，不要手改 profile 的 package/patch 文件。

## 设置与使用

1. 打开 DSH 左下角的「设置」窗口。
2. 在设置导航中选择 **番茄钟**。
3. 在「时钟字体」中保留默认**等线**，或输入其他本机已安装字体；也可从常用候选中选择。
4. 分别调整专注和休息：
   - **时长**：整数 1–240 分钟，默认 25 / 5。
   - **数字颜色**：原生颜色选择器，使用 `#RRGGBB`。
   - **数字不透明度**：0–100%，默认 10% / 30%。
5. 查看使用所选字体的草稿预览，点击「保存设置」；如需还原未保存草稿，点击「放弃修改」。

**配置生效规则：不打断当前计时。** 字体、颜色和不透明度保存后立即应用；当前阶段的时长与截止时间不变，新时长从下一阶段开始生效。聊天区不提供控制按钮，运行中的计时会按配置自动循环；旧版暂停快照见下文。

## 恢复与多标签语义

- 页面关闭时没有浏览器计时器或通知在运行；运行中的绝对时间线仍有效，重开后会落到当前应有阶段，暂停快照则继续保持暂停。
- 运行中的计时长时间离线后按完整周期做算术跳跃，不逐分钟循环，也不补发历史提醒。
- **旧版暂停快照**：旧版本留下的 `running: false` 状态会原样恢复，当前聊天区又没有“继续”按钮，因此不会自行恢复自动循环。若要放弃旧暂停状态并重新开始，可在浏览器开发者工具控制台执行以下命令；这会重置当前计时，但不会修改 DSH 设置，也不要清空整个 localStorage：

  ```js
  localStorage.removeItem('dsh-pomodoro-overlay:state:v1')
  location.reload()
  ```

- localStorage 不可用时自动退化为当前页面内存计时，运行中的阶段切换仍继续；刷新后可能重置。
- 多个同源标签页通过 `storage` 事件尽力同步，暂停快照也按同一机制同步。没有 Web Locks，不承诺并发操作下的严格 exactly-once；本插件也不发送完成通知，因此不存在通知风暴。
- 原生周期与外观配置保存在 DSH profile；运行状态保存在当前浏览器同源 localStorage，二者用途不同。

## 兼容性边界

开发与历史 GUI 基线版本为 **DSH 0.2.1-rc.2**。历史真实 GUI 结果、当前自动化验证范围及尚未完成的 GUI 验收项均见 [验证记录](docs/verification.md)，不将历史结果视为当前版本的完整验收。

当前 DSH 没有公开的“聊天消息区 additive overlay”slot，因此插件使用公开的 `shell.overlay`，再只读测量以下 Conversation DOM 标记，将实际覆盖范围限制在消息区：

- `[data-conversation-content][data-conversation-region="chat"]`
- `[data-composer-seat]`
- `[data-chat-flow]`

这些标记是内部 DOM，不是稳定 API。找不到活动消息流、切到其他视图、区域异常或过小时，插件会**隐藏而不是全屏遮挡**。升级 DSH 后必须重跑布局验证。

## 开发

运行时没有 npm React 依赖，React 由 DSH 宿主提供；`@deepseek-ai/schemastery` 用于 Host 配置。`esbuild` 仅是开发依赖。

```bash
npm install --legacy-peer-deps
npm run verify
```

在文件写入沙箱中，如全局 npm 缓存不可写，可使用项目缓存：

```bash
npm install --legacy-peer-deps --cache .npm-cache
```

单独执行：

```bash
npm run build       # src/ → client/client.js（DSH ModuleLoader 格式）
npm run check       # 语法、manifest、patch、schema 声明与 bundle 静态检查
npm test            # node:test
node tools/build.mjs --check  # 检查构建产物是否过时
```

测试覆盖：自动循环、精确边界、跨多个离线周期、旧/新配置语义、颜色、不透明度与字体校验、字体栈、store 层外观即时更新语义、暂停继续、跳过/重置、损坏快照、存储失败、多标签旧事件、dispose、聊天区几何、Host schema、原生设置 slot，以及构建后客户端加载、store 启动、slots 注册和 style / store 监听 / interval 清理冒烟。客户端冒烟不挂载 `ActiveOverlay`，不等同于完整 overlay DOM 与观察器清理测试。

## 验证结果

- 当前发布基线为 `@tom2012/dsh-pomodoro-overlay@0.1.2`；`npm run verify` 通过，**38/38 自动化测试通过**。
- 当前七字段设置、字体配置和移除可见阶段标签均有 store 级自动化测试或构建产物静态检查；新设置窗口、DOM 外观与字体重排的真实 GUI 验收状态以验证记录为准。
- **历史真实 GUI 基线**曾验证自动启动、1/1 分钟自动双向循环、刷新恢复、灰/红配色、旧版两字段设置保存与当前截止时间不变；这些结果不等同于当前版本的完整 GUI 验收。
- 历史桌面与 380px 窄窗口测试曾验证聊天区几何、输入框扣除、数字适配和非聊天视图隐藏；当时测试的 1/1 配置已恢复为 **25/5**。
- 历史 GUI 环境的 `file-tree` / 内置 `sidebar-files` 冲突与隔离方式见 [docs/verification.md](docs/verification.md)，不表示该既有冲突已在日常 GUI 中解决。

## 文件

- `lib/index.js`：Host 配置 schema 与自定义设置策略。
- `src/timer-core.js`：纯计时状态机。
- `src/browser-store.js`：运行持久化、跨标签同步与订阅。
- `src/chat-geometry.js`：聊天区识别及 composer 扣除。
- `src/font.js`：本机字体候选与安全 CSS 字体栈。
- `src/client.js`：React overlay、slots 注册与生命周期。
- `src/settings.js`：DSH 设置窗口中的七字段表单与草稿预览。
- `src/styles.js`：主题令牌、响应式与 reduced-motion 样式。
- `client/client.js`：构建产物，请勿直接编辑。
- `docs/design.md`：交互和视觉验收标准。
- `docs/architecture.md`：接口证据与实现决策。
- `docs/verification.md`：当前自动化结果、历史真实 GUI 基线、验收边界与环境限制。

## License

MIT
