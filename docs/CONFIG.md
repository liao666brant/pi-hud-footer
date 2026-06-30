# 配置说明

[English](CONFIG.en.md) | 简体中文

`pi-hud-footer` 开箱即用，也支持通过 JSON 文件配置显示项。

## 配置文件位置

全局配置：

```txt
~/.pi/agent/hud-footer.json
```

项目配置：

```txt
.pi/hud-footer.json
```

项目配置只会在项目受信任时读取，并覆盖全局配置。

修改配置后，在 pi 中执行：

```text
/hud-footer-reload
```

或：

```text
/reload
```

## 配置示例

带注释的完整示例见：[examples/hud-footer.jsonc](../examples/hud-footer.jsonc)。

```json
{
  "enabled": true,
  "language": "auto",
  "style": "classic",
  "display": {
    "all": {
      "toolsLine": false,
      "modelName": true,
      "tokenRate": true,
      "turnDuration": true
    },
    "border": {
      "toolsLine": true
    }
  },
  "barWidth": 18,
  "maxTools": 7
}
```

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|---|---:|---:|---|
| `enabled` | boolean | `true` | 是否在会话启动时启用 HUD footer。 |
| `language` | string | `"auto"` | 界面语言。可选 `"auto"`、`"zh"`、`"en"`；`"auto"` 会根据系统语言选择中文或英文，其他系统语言或无效配置回退英文。 |
| `style` | string | `"classic"` | HUD 样式。`"classic"`/`1` 为默认经典 footer 三行样式；`"border"`/`2` 为输入框边框样式。TUI 中也可用 `/hud-footer-theme` 打开选择器切换并保存。 |
| `display` | object | `{}` | 控件显示规则。`all` 对所有样式生效，`classic` / `border` 会覆盖 `all`。 |
| `barWidth` | number | `18` | 上下文进度条宽度，会限制在 `6..40`。 |
| `maxTools` | number | `7` | 工具统计最多显示多少个工具，会限制在 `1..20`。 |

## `display` 显示规则

支持 `all`、`classic`、`border` 三个分组；优先级：`display.all` < `display.<当前样式>`。未配置的字段默认显示。

| 字段 | 说明 |
|---|---|
| `toolsLine` | 工具调用统计行 |
| `modelName` | 模型名 |
| `thinkingLevel` | 思考等级 |
| `projectName` | 项目名 |
| `gitBranch` | Git 分支 |
| `context` | 上下文进度 |
| `tokens` | 词元总数 |
| `tokenBreakdown` | 输入 / 输出 / 缓存 R/W 细分 |
| `tokenRate` | 上一轮输出词元每秒速率 |
| `cacheRate` | 缓存命中率 |
| `elapsed` | 会话耗时 |
| `cost` | 费用估算 |
| `state` | running / ready 状态 |
| `turnDuration` | 每轮对话用时通知 |

## 样式取值

| 值 | 说明 |
|---|---|
| `classic` / `1` | 默认主题。经典三行 footer 样式，适合保留旧版显示习惯。 |
| `border` / `2` | 输入框边框样式。将稳定 HUD 信息嵌入输入框上下边框，工具统计保留在 footer 行，避免 footer 高度动态变化。 |

`/hud-footer-theme` 会切换并保存样式：如果当前受信任项目已存在 `.pi/hud-footer.json`，则写入项目配置；否则写入全局配置 `~/.pi/agent/hud-footer.json`。

## 词元指标图标

| 图标 | 含义 |
|---|---|
| `↑` | 输入词元 |
| `↓` | 输出词元 |
| `R` | 缓存读取词元 |
| `W` | 缓存写入词元 |
| `⚡` | 缓存命中率 |

`R` / `W` 在对应数值为 `0` 时会分别隐藏。

`tokenRate` 显示上一轮 assistant 输出词元数 / 本轮耗时。

## 缓存率计算方式

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

含义是：缓存命中的输入词元 / 输入侧总词元。
