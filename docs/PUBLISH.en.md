# Publishing Guide

English | [简体中文](PUBLISH.md)

This document describes how to publish `pi-hud-footer` for other pi users.

## Local check

Run this in the repository root:

```bash
pi -e . --list-models
```

If the exit code is `0`, pi can load the package successfully.

## GitHub publishing

After creating the remote repository for the first time:

```bash
git remote add origin git@github.com:USER/pi-hud-footer.git
git branch -M main
git push -u origin main
```

Create a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Other users can install it with:

```bash
pi install git:github.com:USER/pi-hud-footer@v0.1.0
```

Or:

```bash
pi install https://github.com/USER/pi-hud-footer@v0.1.0
```

## npm publishing

This project is configured for automatic publishing through GitHub Actions:

```txt
.github/workflows/publish.yml
```

The project uses npm **Trusted Publishing**, so `NPM_TOKEN` is not required.

First, add a Trusted Publisher in the npm package publishing settings:

```txt
Publisher: GitHub Actions
Repository owner: liao666brant
Repository name: pi-hud-footer
Workflow filename: publish.yml
Environment: leave empty
```

This publishes through GitHub Actions OIDC identity and works well for npm accounts with 2FA enabled.

Publishing flow:

```bash
pnpm version patch
# or manually update package.json version

git push origin main
git tag v0.1.1
git push origin v0.1.1
```

When a `v*.*.*` tag is pushed, the Action will:

1. Run `pnpm install --frozen-lockfile`
2. Run `pnpm typecheck`
3. Verify that the tag version matches `package.json` version
4. Run `npm publish --access public --provenance`

You can also manually run the `Publish to npm` workflow from the GitHub Actions page.

For local manual publishing, confirm the package name is available and run:

```bash
npm publish --access public
```

Other users can install it with:

```bash
pi install npm:pi-hud-footer
```

If using a scope:

```bash
pi install npm:@USER/pi-hud-footer
```

## Versioning recommendation

Follow semantic versioning:

- `0.1.x`: early fixes
- `0.x.0`: new configuration or display options
- `1.0.0`: stable API and configuration

Before each release:

1. Update `version` in `package.json`.
2. Update README / configuration documentation.
3. Run the local loading check.
4. Commit changes and create a tag.
