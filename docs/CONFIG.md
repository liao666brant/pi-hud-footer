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
  "cacheRateMode": "total",
  "currency": "USD",
  "exchangeRate": 6.8,
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
  "maxTools": 7,
  "usageScope": "branch"
}
```

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|---|---:|---:|---|
| `enabled` | boolean | `true` | 是否在会话启动时启用 HUD footer。 |
| `language` | string | `"auto"` | 界面语言。可选 `"auto"`、`"zh"`、`"en"`；`"auto"` 会根据系统语言选择中文或英文，其他系统语言或无效配置回退英文。也可用 `/hud-footer-language` 打开 TUI 选择器。 |
| `style` | string | `"classic"` | HUD 样式。`"classic"`/`1` 为默认经典 footer 三行样式；`"border"`/`2` 为输入框边框样式。TUI 中也可用 `/hud-footer-theme` 打开选择器切换并保存。 |
| `display` | object | `{}` | 控件显示规则。`all` 对所有样式生效，`classic` / `border` 会覆盖 `all`。 |
| `cacheRateMode` | string | `"total"` | 缓存命中率模式。`"total"` 按当前分支累计用量计算，`"latest"` 取当前分支最近一次 assistant 请求；不区分大小写。 |
| `currency` | string | `"USD"` | 费用显示货币。可选 `"USD"`、`"CNY"`，不区分大小写。 |
| `exchangeRate` | number | `6.8` | 美元兑人民币汇率，即 1 USD 可兑换多少 CNY。必须为大于 `0` 的有限数，仅在 `currency` 为 `"CNY"` 时用于换算。 |
| `barWidth` | number | `18` | 上下文进度条宽度，会限制在 `6..40`。 |
| `maxTools` | number | `7` | 工具统计最多显示多少个工具，会限制在 `1..20`。 |
| `usageScope` | string | `"branch"` | 累计 API 用量与费用的统计范围。`"branch"` 仅统计当前活动分支，`"session"` 统计完整会话树；不区分大小写。 |

## 累计用量与费用

`usageScope` 同时控制输入、输出、缓存 R/W 和费用的累计范围：

- `"branch"`：仅累计从根到当前 leaf 的活动分支，为保持既有统计行为的默认值。
- `"session"`：遍历完整会话树，累计 assistant、带 usage 的 toolResult、compaction 和 branch summary 产生的用量及费用。

这些词元是已经发生的累计 API 用量，不等同于当前仍保留的上下文。上下文进度始终由 pi 的当前有效上下文计算；工具调用统计也始终只统计当前分支，不受 `usageScope` 影响。

## 缓存命中率

`cacheRateMode` 控制缓存命中率的取值：

- `"total"`：使用 `usageScope` 范围内的累计输入和缓存用量计算总体命中率，为保持既有显示行为的默认值。
- `"latest"`：使用当前活动分支最近一次 assistant 请求的缓存命中率。

两种模式都使用 `cacheRead / (input + cacheRead + cacheWrite)` 公式。`"latest"` 没有可用 assistant 请求时显示 `0%`。

## 费用货币与汇率

pi 提供的费用统计以 USD 计价。费用的累计范围由 `usageScope` 控制。`currency` 为 `"USD"` 时直接显示美元；为 `"CNY"` 时，插件按 `USD 费用 × exchangeRate` 换算并显示人民币。例如：

```json
{
  "currency": "CNY",
  "exchangeRate": 7.2
}
```

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
| `tokenRate` | 主 agent 当前流式输出速率 |
| `cacheRate` | 缓存命中率 |
| `elapsed` | 会话耗时 |
| `cost` | 费用估算 |
| `state` | running / ready 状态 |
| `turnDuration` | 每轮对话用时通知，默认关闭以避免与其他插件重复 |

`turnDuration` 默认关闭。如需启用每轮用时通知，请在 `display.all` 或对应样式中设置为 `true`。

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

`tokenRate` 显示主 agent 当前流式输出速率，按最近 0.5～2 秒输出词元增量计算。

## 缓存率计算方式

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

含义是：缓存命中的输入词元 / 输入侧总词元。计算的数据范围由 `cacheRateMode` 决定。
