# 发布指南

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

确认包名可用后执行：

```bash
npm publish
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
