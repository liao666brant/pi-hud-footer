# pi-hud-footer

English | [简体中文](README.md)

A Claude HUD style custom footer/statusline extension for [pi coding agent](https://github.com/earendil-works/pi).

It replaces pi's default footer with a compact multi-line HUD for quickly checking the model, context usage, token usage, cache hit rate, cost, and tool call statistics.

## Features

- Shows the current model and thinking level
- Shows a context usage progress bar
- Shows the current project name and git branch
- Shows running / ready status
- Shows token usage summary
- Shows cache read/write tokens
- Shows token cache hit rate
- Shows estimated cost
- Shows tool call statistics while keeping footer height stable
- Shows turn duration after each assistant turn
- Supports two HUD styles: classic footer style and editor-border style
- Supports Chinese and English UI text; defaults to the system language and falls back to English for unsupported or invalid language settings
- Supports global and project-level JSON configuration

## Installation

Install from a local path:

```bash
pi install /path/to/pi-hud-footer
```

Install from GitHub:

```bash
pi install git:github.com:USER/pi-hud-footer@v0.3.0
```

If published to npm, you can also install it with:

```bash
pi install npm:pi-hud-footer
```

## Development / temporary loading

Load without installing:

```bash
pi -e ./pi-hud-footer
```

From inside this repository:

```bash
pi -e .
```

After making changes, run this in pi:

```text
/reload
```

## Commands

```text
/hud-footer
```

Toggle the HUD footer on or off for the current session.

```text
/hud-footer-reload
```

Reload the configuration and refresh the HUD footer.

```text
/hud-footer-theme
```

Open a TUI selector and temporarily switch the HUD style.

## Configuration

See [docs/CONFIG.en.md](docs/CONFIG.en.md).

Example configuration: [examples/hud-footer.json](examples/hud-footer.json)

Global configuration:

```txt
~/.pi/agent/hud-footer.json
```

Project configuration:

```txt
.pi/hud-footer.json
```

Project configuration is read only when the project is trusted, and it overrides global configuration.

## Cache hit rate formula

```txt
cacheRead / (input + cacheRead + cacheWrite)
```

That is: cached input tokens / total input-side tokens.

## Publishing

See [docs/PUBLISH.en.md](docs/PUBLISH.en.md).

## Security

pi extensions run with your system permissions. This extension only reads session metadata exposed by the pi extension API and git branch information exposed by the pi footer API. It does not access the network.

## License

MIT
