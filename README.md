# pi-hud-footer

[English](README.en.md) | 简体中文

一个给 [pi coding agent](https://github.com/earendil-works/pi) 使用的 Claude HUD 风格自定义 footer/statusline 插件。

它把模型、上下文、词元、缓存、费用、工具调用和运行状态集中显示在 TUI 底部。默认的 `border` 样式会把稳定信息嵌入输入框边框，只把会动态增长的工具统计保留在 footer 中，避免 agent 思考输出时 footer 高度变化导致输入区重排。

## 功能亮点

- 显示当前模型、思考等级、项目名和 git 分支
- 显示上下文使用进度、词元用量、缓存读写和缓存命中率
- 显示 running / ready 状态、会话耗时、费用估算和每轮用时
- 显示工具调用统计，并保持 footer 高度稳定
- 支持两套 HUD 样式：`border` 输入框边框样式和 `classic` 经典 footer 样式
- 支持中文/英文界面，默认根据系统语言自动选择
- 支持全局和项目级 JSON 配置

## 主题 / 样式

| 样式 | 别名 | 适合场景 | 说明 |
|---|---|---|---|
| `border` | `2` | 默认推荐 | 将模型、耗时、费用、上下文、词元和状态嵌入输入框上下边框；工具统计保留在 footer 行，布局更稳定。 |
| `classic` | `1` | 旧版体验 | 将 HUD 信息集中显示在输入框下方，适合喜欢旧版三行 footer 的用户。 |

在 TUI 中临时切换当前会话样式：

```text
/hud-footer-theme
```

持久化样式请写入配置文件：

```json
{
  "style": "border"
}
```

### `border` / `2`：输入框边框样式

![输入框边框样式示例](docs/assets/hud-footer-border.png)

### `classic` / `1`：经典 footer 样式

![经典 footer 样式示例](docs/assets/hud-footer-classic.png)

## 安装

推荐从 npm 安装：

```bash
pi install npm:pi-hud-footer
```

也可以从 GitHub 安装，不需要指定版本号：

```bash
pi install git:github.com/liao666brant/pi-hud-footer
```

本地开发或调试时，可以从本地路径安装：

```bash
pi install /path/to/pi-hud-footer
```

## 命令

| 命令 | 说明 |
|---|---|
| `/hud-footer` | 切换当前会话的 HUD footer 开/关。 |
| `/hud-footer-reload` | 重新读取配置并刷新 HUD footer。 |
| `/hud-footer-theme` | 打开 TUI 选择器，临时切换当前会话样式。 |

## 配置

完整配置说明见：[docs/CONFIG.md](docs/CONFIG.md) / [English](docs/CONFIG.en.md)

示例配置：[examples/hud-footer.json](examples/hud-footer.json)

| 配置层级 | 路径 | 说明 |
|---|---|---|
| 全局配置 | `~/.pi/agent/hud-footer.json` | 对所有会话生效。 |
| 项目配置 | `.pi/hud-footer.json` | 仅在项目受信任时读取，并覆盖全局配置。 |

修改配置后，在 pi 中执行：

```text
/hud-footer-reload
```

或：

```text
/reload
```

## 指标说明

词元指标使用以下图标：

| 图标 | 含义 |
|---|---|
| `↑` | 输入词元 |
| `↓` | 输出词元 |
| `⇣` | 缓存读取词元 |
| `⇡` | 缓存写入词元 |
| `⚡` | 缓存命中率 |

缓存命中率计算方式：

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

即：缓存命中的输入词元 / 输入侧总词元。

## 开发 / 临时运行

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

## 发布给其他人

详见：[docs/PUBLISH.md](docs/PUBLISH.md) / [English](docs/PUBLISH.en.md)

## 安全说明

pi 扩展会以你的系统权限运行。本扩展只读取 pi 扩展 API 暴露的会话元数据，以及 pi footer API 暴露的 git 分支信息；不访问网络。

## 许可证

MIT
