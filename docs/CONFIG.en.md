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

```json
{
  "enabled": true,
  "language": "auto",
  "style": "classic",
  "barWidth": 18,
  "showTools": true,
  "maxTools": 7,
  "showCost": true,
  "showElapsed": true,
  "showCacheRate": true,
  "showTurnDuration": true
}
```

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `enabled` | boolean | `true` | Enable the HUD footer when a session starts. |
| `language` | string | `"auto"` | UI language. Supported values: `"auto"`, `"zh"`, `"en"`. `"auto"` selects Chinese or English from the system language and falls back to English for unsupported system languages or invalid configuration values. |
| `style` | string | `"classic"` | HUD style. `"classic"`/`1` is the default classic three-line footer style; `"border"`/`2` is the editor-border style. You can also open a TUI selector to switch and save the style with `/hud-footer-theme`. |
| `barWidth` | number | `18` | Width of the context progress bar. Clamped to `6..40`. |
| `showTools` | boolean | `true` | Show the tool call statistics line; when enabled, the line keeps a fixed height and shows `-` before any tool calls. |
| `maxTools` | number | `7` | Maximum number of tools shown in the tool statistics summary. Clamped to `1..20`. |
| `showCost` | boolean | `true` | Show estimated cost; in `border` style, it is embedded in the editor top border. |
| `showElapsed` | boolean | `true` | Show elapsed session time; in `border` style, it is embedded in the editor top border. |
| `showCacheRate` | boolean | `true` | Show token cache hit rate. |
| `showTurnDuration` | boolean | `true` | Show a turn duration notification after each assistant turn. |

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
| `⇣` | Cache read tokens |
| `⇡` | Cache write tokens |
| `⚡` | Cache hit rate |

## Cache hit rate formula

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

Meaning: cached input tokens / total input-side tokens.
