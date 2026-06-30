# pi-hud-footer

[English](README.en.md) | 简体中文

一个给 [pi coding agent](https://github.com/earendil-works/pi) 使用的 Claude HUD 风格自定义 footer/statusline 插件。

它把模型、上下文、词元、缓存、费用、工具调用和运行状态集中显示在 TUI 底部。默认使用 `classic` 经典 footer 样式；也可以切换到 `border` 输入框边框样式，把稳定信息嵌入输入框边框，只把会动态增长的工具统计保留在 footer 中。

## 功能亮点

- 显示当前模型、思考等级、项目名和 git 分支
- 显示上下文使用进度、词元用量、输出速率、缓存读写和缓存命中率
- 显示 running / ready 状态、会话耗时、费用估算和每轮用时
- 显示工具调用统计，并保持 footer 高度稳定
- 支持两套 HUD 样式：`classic` 经典 footer 样式和 `border` 输入框边框样式
- 支持中文/英文界面，默认根据系统语言自动选择
- 支持全局和项目级 JSON 配置

## 主题 / 样式

| 样式 | 别名 | 适合场景 | 说明 |
|---|---|---|---|
| `classic` | `1` | 默认主题 | 将 HUD 信息集中显示在输入框下方，保留经典三行 footer 体验。 |
| `border` | `2` | 边框布局 | 将模型、耗时、费用、上下文、词元和状态嵌入输入框上下边框；工具统计保留在 footer 行，布局更稳定。 |

在 TUI 中切换并保存样式：

```text
/hud-footer-theme
```

命令会写入配置文件：如果当前受信任项目已存在 `.pi/hud-footer.json`，则保存到项目配置；否则保存到全局配置 `~/.pi/agent/hud-footer.json`。也可以手动设置：

```json
{
  "style": "classic"
}
```

### `classic` / `1`：经典 footer 样式

![经典 footer 样式示例](docs/assets/hud-footer-classic.png)

### `border` / `2`：输入框边框样式

![输入框边框样式示例](docs/assets/hud-footer-border.png)

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
| `/hud-footer-theme` | 打开 TUI 选择器，切换并保存 HUD 样式。 |

## 配置

完整配置说明见：[docs/CONFIG.md](docs/CONFIG.md) / [English](docs/CONFIG.en.md)

示例配置：[examples/hud-footer.json](examples/hud-footer.json) / 带注释版：[examples/hud-footer.jsonc](examples/hud-footer.jsonc)

| 配置层级 | 路径 | 说明 |
|---|---|---|
| 全局配置 | `~/.pi/agent/hud-footer.json` | 对所有会话生效。 |
| 项目配置 | `.pi/hud-footer.json` | 仅在项目受信任时读取，并覆盖全局配置。 |

### 配置项

| 配置项 | 说明 |
|---|---|
| `enabled` | 是否启用 HUD footer。 |
| `language` | 界面语言：`auto` / `zh` / `en`。 |
| `style` | HUD 样式：`classic` / `border`。 |
| `display` | 控件显示规则，支持全局和按样式覆盖。 |
| `barWidth` | 上下文进度条宽度。 |
| `maxTools` | 工具统计最多显示数量。 |

`display` 支持 `all`、`classic`、`border` 分组，可配置：`toolsLine`、`modelName`、`thinkingLevel`、`projectName`、`gitBranch`、`context`、`tokens`、`tokenBreakdown`、`tokenRate`、`cacheRate`、`elapsed`、`cost`、`state`、`turnDuration`。

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
| `R` | 缓存读取词元 |
| `W` | 缓存写入词元 |
| `⚡` | 缓存命中率 |

`R` / `W` 在对应数值为 `0` 时会分别隐藏。

`tokenRate` 显示上一轮 assistant 输出词元数 / 本轮耗时。

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
