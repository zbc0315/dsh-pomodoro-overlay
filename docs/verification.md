# 验证记录

验证日期：2026-10-25  
目标版本：DSH `0.2.1-rc.2`  
GUI：`https://dsh.zhbc.bid:3003/`（不记录认证参数）  
方式：正式 `dsh plugin --profile web add` 本地 link 安装，重启原部署，在隔离 Chrome 中运行真实 Host/Client bundle。

## 自动化

- `npm run verify`：通过。
- `node:test`：**38/38 通过**（覆盖原生设置 slot、外观与字体校验、字体栈及即时外观更新）。
- 独立只读审查：无阻断、高、中严重度问题；额外以逐步推进 oracle 对拍 `settleState` 的 896 组边界，全部一致。
- 构建后客户端冒烟：ModuleLoader 加载、配置 ready 后自动启动、slots 注册、样式/监听器/计时器清理通过。
- `npm pack --dry-run`：包内容检查通过。

## 当前开发修订：原生设置窗口与外观配置（2026-10-25）

- 设置入口已从 `plugins.bundle.config` 迁移到 DSH 设置窗口的 `settings.section`，导航 ID 为 `pomodoro`。
- Host schema 和 ConfigForm 已扩展为七字段：全局字体、专注/休息时长、`#RRGGBB` 颜色和 0–1 不透明度；设置 UI 显示 0–100%。
- 字体默认等线（DengXian），支持本机字体名称和常用候选；只解析本地字体栈，不下载字体，切换后重新测量数字宽度。
- 两阶段草稿预览共用所选字体；七个字段使用同一 revision 一次原子保存。
- `npm run verify` 通过，**38/38 测试通过**；旧配置自动补齐默认字体与外观，不改变运行时间线。
- Host schema 变更需要在**外部 Terminal** 重载 DSH；禁止从 DSH 会话内部杀掉自己的宿主。真实窗口保存验收将在外部重载后补记。

## 当前修订：移除可见阶段标签（2026-10-25）

- 应用户要求，聊天区不再显示「专注 / 休息」阶段标签及其胶囊样式，只保留大倒计时。
- 屏幕阅读器的阶段与剩余时间文本保留；颜色、透明度、字体和计时行为不变。
- 包检查新增约束：客户端不得重新出现 `dpo-phase` 可见标签或对应 `data-dpo-phase` 标记。
- `npm run verify` 通过，**38/38 测试通过**。

## 历史修订：聊天区纯展示（2026-10-25）

应用户要求，已移除聊天区右下角的「暂停 / 跳过 / 重置」及整个工具条。该版本 overlay 保留阶段标签、大倒计时和屏幕阅读器时间文本；设置页的保存/放弃按钮不受影响。

- `npm run verify` 再次通过，**34/34 测试通过**。
- 包检查新增约束：构建产物不得包含 `data-dpo-action`、`dpo-toolbar` 或「番茄钟控制」。
- 真实客户端 DOM 检查：`overlayButtons: 0`、`actionControls: 0`、`toolbarNodes: 0`、`toolbarStyles: false`。
- 阶段标签与根 overlay 的 `pointer-events` 均为 `none`，继续不阻断聊天操作。

## 历史真实 GUI 基线（含已移除的控制按钮）

下表是此前带控制按钮版本的完整回归记录；其中暂停/继续、跳过/重置、工具栏和 44px 聊天按钮行仅作历史证据，不再描述当前聊天区 UI。底层状态机及自动循环行为未改变。

| 项目 | 结果 |
| --- | --- |
| 插件加载 | 插件详情显示 `v0.1.0`，包含的组件共 1 个、运行中 |
| 自动启动 | 原生配置 ready 后无需点击即开始专注倒计时 |
| 设置读取 | 设置页显示默认专注 25、休息 5，两个输入框均可编辑 |
| 非法输入 | 专注设为 0 后显示「请输入 1–240 之间的整数分钟」，未保存 |
| 原子保存 | 改为 1/1 后一次保存成功，出现新时长从下一阶段生效的提示 |
| 当前阶段不变 | 保存 1/1 前后，当前 25 分钟专注的 `endsAt` 完全相等，仍显示约 24 分钟 |
| 下一阶段生效 | 跳过后休息显示 `01:00`；保存 1/1 后的自动循环均为 60 秒 |
| 专注配色 | 计算样式为主题灰色，alpha `0.2` |
| 休息配色 | 计算样式为主题红色，alpha `0.3` |
| 暂停/继续 | 暂停后连续 1.3 秒文字不变并显示「已暂停」；继续后文字随时间减少 |
| 跳过/重置 | 专注→休息→专注正确；重置回到运行中的 `25:00` 专注 |
| 桌面几何 | overlay 的 left/top/width 与聊天区一致，bottom 等于 composer 顶部 |
| 数字适配 | 桌面示例中 322px 数字完整位于 920×584 的 overlay 内 |
| 鼠标穿透 | overlay 与数字均为 `pointer-events: none`，中心命中元素不属于插件；工具栏为 `auto` |
| 触控目标 | 暂停/继续、跳过、重置按钮高度均为 44px |
| 自动休息→专注 | 在原休息边界准确进入专注，新 `startedAt` 等于旧 `endsAt`，时长 60000ms |
| 自动专注→休息 | 在原专注边界准确进入休息，新 `startedAt` 等于旧 `endsAt`，时长 60000ms |
| 刷新恢复 | 刷新前后运行状态 `endsAt` 完全相等，并继续原时间线 |
| 非聊天视图 | 空白新会话没有消息流时隐藏；插件设置页中也隐藏 |
| 窄窗口 | 380px viewport 下 overlay 为 324×523，数字缩至 106px，无裁切，仍扣除 composer |

自动边界测试只在隔离浏览器的 localStorage 中构造合法、即将到期的运行状态，以缩短等待；执行的是实际刷新、原生配置加载和正式客户端计时逻辑，没有 mock 定时器或替换组件。

测试结束后：

- 原生配置已恢复为 **25/5**。
- 隔离浏览器中的运行状态已重置为运行中的 25 分钟专注。
- 测试 Chrome 已关闭，临时 profile、重启脚本和临时日志已删除。

## 本次 GUI 环境备注（既有冲突）

未隔离的首次启动出现：

```text
Failed to load plugins
@deepseek-ai/dsh-client-ui-sidebar-files
web boot: 1 entry did not activate
```

捕获到的原始异常是：

```text
slot "sidebar.right.tab.files.actions" is already declared
```

只读检查确认，既有 `@tom/dsh-file-tree` 与 DSH 内置 `@deepseek-ai/dsh-client-ui-sidebar-files` 同时声明了这个 slot；番茄钟没有声明或修改该 slot。为让本次番茄钟自测能够进入真实聊天区，仅在隔离 Chrome 的 boot 清单中临时跳过了重复的内置 sidebar-files 客户端，并关闭该测试页的 HMR 以防完整清单再次注入。没有因此修改 DSH、file-tree 或 profile。

因此：**番茄钟本身的真实 GUI 检查全部通过，但这不表示当前未隔离的日常 GUI 已解决上述既有冲突。** 日常 GUI 若要正常启动，需要另行处理 file-tree 与内置 sidebar-files 的重复声明；本次任务没有擅自卸载或改写它们。
