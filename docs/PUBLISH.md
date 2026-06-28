# 发布指南

[English](PUBLISH.en.md) | 简体中文

本文档记录如何把 `pi-hud-footer` 发布给其他 pi 用户使用。

## 本地检查

在仓库目录内执行：

```bash
pi -e . --list-models
```

如果退出码为 `0`，说明 pi 可以正常加载该包。

## GitHub 发布

首次创建远程仓库后：

```bash
git remote add origin git@github.com:USER/pi-hud-footer.git
git branch -M main
git push -u origin main
```

创建版本标签：

```bash
git tag v0.1.0
git push origin v0.1.0
```

其他用户可以通过以下方式安装：

```bash
pi install git:github.com:USER/pi-hud-footer@v0.1.0
```

或：

```bash
pi install https://github.com/USER/pi-hud-footer@v0.1.0
```

## npm 发布

本项目已配置 GitHub Actions 自动发布：

```txt
.github/workflows/publish.yml
```

本项目使用 npm **Trusted Publishing**，不需要配置 `NPM_TOKEN`。

需要先在 npm 包的发布设置中添加 Trusted Publisher：

```txt
Publisher: GitHub Actions
Repository owner: liao666brant
Repository name: pi-hud-footer
Workflow filename: publish.yml
Environment: 留空
```

该方式通过 GitHub Actions OIDC 身份发布，适合开启 2FA 的 npm 账号。

发布流程：

```bash
pnpm version patch
# 或手动更新 package.json version

git push origin main
git tag v0.1.1
git push origin v0.1.1
```

当推送 `v*.*.*` tag 时，Action 会执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. 校验 tag 版本和 `package.json` version 一致
4. `npm publish --access public --provenance`

也可以在 GitHub Actions 页面手动运行 `Publish to npm` workflow。

如需本地手动发布，确认包名可用后执行：

```bash
npm publish --access public
```

其他用户可以通过以下方式安装：

```bash
pi install npm:pi-hud-footer
```

如果使用 scope：

```bash
pi install npm:@USER/pi-hud-footer
```

## 版本建议

遵循语义化版本：

- `0.1.x`：早期修复
- `0.x.0`：新增配置项或显示项
- `1.0.0`：API 和配置基本稳定

每次发布前：

1. 更新 `package.json` 中的 `version`。
2. 更新 README / 配置文档。
3. 执行本地加载检查。
4. 提交代码并打 tag。
