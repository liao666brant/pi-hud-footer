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
| `barWidth` | number | `18` | Width of the context progress bar. Clamped to `6..40`. |
| `showTools` | boolean | `true` | Show the tool call statistics line. |
| `maxTools` | number | `7` | Maximum number of tools shown in the tool statistics line. Clamped to `1..20`. |
| `showCost` | boolean | `true` | Show estimated cost. |
| `showElapsed` | boolean | `true` | Show elapsed session time in the footer. |
| `showCacheRate` | boolean | `true` | Show token cache hit rate. |
| `showTurnDuration` | boolean | `true` | Show a turn duration notification after each assistant turn. |

## Cache hit rate formula

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

Meaning: cached input tokens / total input-side tokens.
