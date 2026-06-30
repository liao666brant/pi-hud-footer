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

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `enabled` | boolean | `true` | Enable the HUD footer when a session starts. |
| `language` | string | `"auto"` | UI language. Supported values: `"auto"`, `"zh"`, `"en"`. `"auto"` selects Chinese or English from the system language and falls back to English for unsupported system languages or invalid configuration values. |
| `style` | string | `"classic"` | HUD style. `"classic"`/`1` is the default classic three-line footer style; `"border"`/`2` is the editor-border style. You can also open a TUI selector to switch and save the style with `/hud-footer-theme`. |
| `display` | object | `{}` | Widget visibility rules. `all` applies to every style, and `classic` / `border` override `all`. |
| `barWidth` | number | `18` | Width of the context progress bar. Clamped to `6..40`. |
| `maxTools` | number | `7` | Maximum number of tools shown in the tool statistics summary. Clamped to `1..20`. |

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
| `tokenRate` | Last-turn output tokens per second |
| `cacheRate` | Cache hit rate |
| `elapsed` | Session elapsed time |
| `cost` | Estimated cost |
| `state` | running / ready state |
| `turnDuration` | Per-turn duration notification |

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

`tokenRate` shows the previous assistant turn's output tokens / turn duration.

## Cache hit rate formula

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

Meaning: cached input tokens / total input-side tokens.
