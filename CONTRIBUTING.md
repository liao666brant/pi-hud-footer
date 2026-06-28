# 贡献指南

感谢你愿意改进 `pi-hud-footer`。

## 开发方式

在仓库目录内临时运行扩展：

```bash
pi -e .
```

修改后在 pi 中重新加载资源：

```text
/reload
```

## 开发约定

- 保持源码简单，方便审计。
- 除非是可选功能并且文档中明确说明，否则不要访问网络。
- 不要读取任意用户文件。
- footer 渲染必须注意宽度安全，使用 `truncateToWidth` 和 `visibleWidth`。
- 优先增加配置项，不要把个人偏好硬编码。

## 发布检查清单

1. 更新 `package.json` 里的 `version`。
2. 如果行为变化，更新 README 和配置文档。
3. 执行本地加载检查：

   ```bash
   pi -e . --list-models
   ```

4. 提交变更。
5. 创建 git tag：

   ```bash
   git tag v0.1.0
   git push origin main --tags
   ```
