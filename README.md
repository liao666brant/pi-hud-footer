# pi-hud-footer

[English](README.en.md) | 简体中文

一个给 [pi coding agent](https://github.com/earendil-works/pi) 使用的 Claude HUD 风格自定义 footer/statusline 插件。

它会替换 pi 默认 footer，显示一个紧凑的多行 HUD，方便查看模型、上下文、词元、缓存率、费用和工具调用统计。

## 功能

- 显示当前模型和思考等级
- 显示上下文使用进度条
- 显示当前项目名和 git 分支
- 显示 running / ready 状态
- 显示词元使用摘要
- 显示缓存读写词元
- 显示词元缓存命中率
- 显示费用估算
- 显示工具调用统计（保持固定 footer 高度）
- 每轮对话结束后显示本轮用时
- 支持两套 HUD 样式：经典 footer 样式与输入框边框样式
- 支持中文/英文界面，默认根据系统语言自动选择，其他语言或无效配置回退英文
- 支持全局/项目级 JSON 配置

## 安装

从本地路径安装：

```bash
pi install /path/to/pi-hud-footer
```

从 GitHub 安装：

```bash
pi install git:github.com:USER/pi-hud-footer@v0.2.0
```

如果发布到了 npm，也可以：

```bash
pi install npm:pi-hud-footer
```

## 开发/临时运行

不安装，临时加载：

```bash
pi -e ./pi-hud-footer
```

在仓库目录内：

```bash
pi -e .
```

修改后在 pi 中执行：

```text
/reload
```

## 命令

```text
/hud-footer
```

切换当前会话的 HUD footer 开/关。

```text
/hud-footer-reload
```

重新读取配置并刷新 HUD footer。

```text
/hud-footer-theme
```

进入 TUI 选择器并临时切换 HUD 样式。

## 配置

详见：[docs/CONFIG.md](docs/CONFIG.md) / [English](docs/CONFIG.en.md)

示例配置：[examples/hud-footer.json](examples/hud-footer.json)

全局配置：

```txt
~/.pi/agent/hud-footer.json
```

项目配置：

```txt
.pi/hud-footer.json
```

项目配置只会在项目受信任时读取，并覆盖全局配置。

## 缓存率计算方式

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

即：缓存命中的输入词元 / 输入侧总词元。

## 发布给其他人

详见：[docs/PUBLISH.md](docs/PUBLISH.md) / [English](docs/PUBLISH.en.md)

## 安全说明

pi 扩展会以你的系统权限运行。本扩展只读取 pi 扩展 API 暴露的会话元数据，以及 pi footer API 暴露的 git 分支信息；不访问网络。

## 许可证

MIT
