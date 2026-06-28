# 配置说明

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

```json
{
  "enabled": true,
  "barWidth": 18,
  "showTools": true,
  "maxTools": 7,
  "showCost": true,
  "showElapsed": true,
  "showCacheRate": true,
  "showTurnDuration": true
}
```

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|---|---:|---:|---|
| `enabled` | boolean | `true` | 是否在会话启动时启用 HUD footer。 |
| `barWidth` | number | `18` | 上下文进度条宽度，会限制在 `6..40`。 |
| `showTools` | boolean | `true` | 是否显示工具调用统计行。 |
| `maxTools` | number | `7` | 工具统计行最多显示多少个工具，会限制在 `1..20`。 |
| `showCost` | boolean | `true` | 是否显示费用估算。 |
| `showElapsed` | boolean | `true` | 是否在 footer 显示会话已用时间。 |
| `showCacheRate` | boolean | `true` | 是否显示词元缓存命中率。 |
| `showTurnDuration` | boolean | `true` | 是否在每轮对话结束后显示本轮用时通知。 |

## 缓存率计算方式

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

含义是：缓存命中的输入词元 / 输入侧总词元。
