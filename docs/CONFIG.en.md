# Configuration

English | [简体中文](CONFIG.md)

`pi-hud-footer` works out of the box, and you can customize what it displays through JSON configuration files.

## Configuration file locations

Global configuration:

```txt
~/.pi/agent/hud-footer.json
```

Project configuration:

```txt
.pi/hud-footer.json
```

Project configuration is read only when the project is trusted, and it overrides global configuration.

After changing configuration, run this in pi:

```text
/hud-footer-reload
```

Or:

```text
/reload
```

## Example configuration

For an annotated full example, see [examples/hud-footer.jsonc](../examples/hud-footer.jsonc).

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

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `enabled` | boolean | `true` | Enable the HUD footer when a session starts. |
| `language` | string | `"auto"` | UI language. Supported values: `"auto"`, `"zh"`, `"en"`. `"auto"` selects Chinese or English from the system language and falls back to English for unsupported system languages or invalid configuration values. You can also use `/hud-footer-language` to open the TUI selector. |
| `style` | string | `"classic"` | HUD style. `"classic"`/`1` is the default classic three-line footer style; `"border"`/`2` is the editor-border style. You can also open a TUI selector to switch and save the style with `/hud-footer-theme`. |
| `display` | object | `{}` | Widget visibility rules. `all` applies to every style, and `classic` / `border` override `all`. |
| `cacheRateMode` | string | `"total"` | Cache hit rate mode. `"total"` uses the cumulative usage within `usageScope`; `"latest"` uses the last assistant request in that scope. Case-insensitive. |
| `currency` | string | `"USD"` | Cost display currency. Supported values: `"USD"` and `"CNY"`, case-insensitive. |
| `exchangeRate` | number | `6.8` | USD-to-CNY exchange rate (the amount of CNY per 1 USD). Must be a finite number greater than `0`; used only when `currency` is `"CNY"`. |
| `barWidth` | number | `18` | Width of the context progress bar. Clamped to `6..40`. |
| `maxTools` | number | `7` | Maximum number of tools shown in the tool statistics summary. Clamped to `1..20`. |
| `usageScope` | string | `"branch"` | Scope for cumulative API usage and cost. `"branch"` includes only the active branch; `"session"` includes the complete session tree. Case-insensitive. |

## Cumulative usage and cost

`usageScope` controls the cumulative scope of input, output, cache R/W, and cost together:

- `"branch"`: accumulates only the active path from the root to the current leaf. This is the default to preserve the existing statistics behavior, and it counts less than pi's built-in footer, which always totals the complete session tree.
- `"session"`: traverses the complete session tree and accumulates usage and cost from assistant messages, tool results with usage, usage records such as cache warming, compactions, and branch summaries. This matches pi's built-in footer.

These token values are cumulative API usage that has already occurred; they are not the tokens still present in the current context. Context usage always comes from pi's current effective context, while tool-call statistics always remain scoped to the active branch. Neither is affected by `usageScope`.

## Cache hit rate

`cacheRateMode` selects the cache hit rate source:

- `"total"`: calculates an aggregate rate from cumulative input and cache usage within `usageScope`. This is the default to preserve the existing display behavior.
- `"latest"`: uses the last assistant request in the `usageScope` range; `"session"` takes the last one in session file order, `"branch"` the last one on the active branch.

Both modes use `cacheRead / (input + cacheRead + cacheWrite)`. `"latest"` displays `0%` when no applicable assistant request is available.

## Cost currency and exchange rate

Pi reports cost statistics in USD, and `usageScope` controls the cumulative cost scope. With `currency` set to `"USD"`, the extension displays that value directly. With `currency` set to `"CNY"`, it displays `USD cost × exchangeRate` in CNY. For example:

```json
{
  "currency": "CNY",
  "exchangeRate": 7.2
}
```

## `display` rules

Supports the `all`, `classic`, and `border` groups. Precedence: `display.all` < `display.<current style>`. Unset fields are visible by default.

| Field | Description |
|---|---|
| `toolsLine` | Tool-call statistics line |
| `modelName` | Model name |
| `thinkingLevel` | Thinking level |
| `projectName` | Project name |
| `gitBranch` | Git branch |
| `context` | Context usage |
| `tokens` | Token total |
| `tokenBreakdown` | Input / output / cache R/W breakdown |
| `tokenRate` | Current main agent streaming output rate |
| `cacheRate` | Cache hit rate |
| `elapsed` | Session elapsed time |
| `cost` | Estimated cost |
| `state` | running / ready state |
| `turnDuration` | Per-turn duration notification, disabled by default to avoid conflicts with other extensions |

`turnDuration` is disabled by default. Set it to `true` under `display.all` or the relevant style to enable per-turn duration notifications.

## Style values

| Value | Description |
|---|---|
| `classic` / `1` | Default theme. Classic three-line footer style, suitable for users who prefer the previous layout. |
| `border` / `2` | Editor-border style. Embeds stable HUD information into the input editor borders while keeping tool statistics in the footer line to avoid dynamic footer-height changes. |

`/hud-footer-theme` switches and saves the style. If the current trusted project already has `.pi/hud-footer.json`, it writes to the project config; otherwise it writes to the global config at `~/.pi/agent/hud-footer.json`.

## Token metric icons

| Icon | Meaning |
|---|---|
| `↑` | Input tokens |
| `↓` | Output tokens |
| `R` | Cache read tokens |
| `W` | Cache write tokens |
| `⚡` | Cache hit rate |

`R` / `W` are hidden independently when their value is `0`.

`tokenRate` shows the main agent's current streaming output rate, computed from output-token deltas over the last 0.5-2 seconds.

## Cache hit rate formula

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

Meaning: cached input tokens / total input-side tokens. `cacheRateMode` determines the data scope used by the formula.
