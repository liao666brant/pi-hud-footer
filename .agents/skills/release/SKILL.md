---
name: release
description: "版本发布：用户要求更新版本号、发版、发布到 npm 或创建 GitHub Release 时，按本仓约定完成版本号更新、提交推送、打标签触发 CI 发布，并核验 npm 与 GitHub Release 结果。"
---

# 版本发布

把 pi-hud-footer 从更新版本号走到发布完成：更新 `package.json` 版本 → 中文提交 → 推送 → 打 `vX.Y.Z` 标签触发 GitHub Actions 发布到 npm → 创建 GitHub Release → 核验结果。全程主 Agent 执行，不使用子代理。

## 事实来源

- `package.json` 的 `version` 是唯一版本来源。`pnpm-lock.yaml`、README、`docs/` 都不含版本号，改动只落在 `package.json`。
- 版本提升依据 `docs/PUBLISH.md` 的「版本建议」：`0.1.x` 早期修复、`0.x.0` 新增配置项或显示项、`1.0.0` API 与配置稳定。
- 发布只能经 `.github/workflows/publish.yml`：推送 `v*.*.*` 标签，或手动触发 `workflow_dispatch`。工作流用 pnpm 11.9.0 执行 `pnpm install --frozen-lockfile`、`pnpm typecheck`，标签触发时校验标签版本与 `package.json` 一致，再通过 OIDC 可信发布执行 `npm publish --access public --provenance`。本机 npm 未登录，无法本地 `npm publish`。

## 授权边界

提交、推送、打标签、触发发布、创建 GitHub Release 均需用户明确要求后才执行；移动或删除已推送的标签、任何 force-push 属于重写公开引用，需再次确认。不修改 Git 配置。

**完成条件：** 已按当前请求列出要执行的步骤；未获授权的步骤不执行，并在报告中说明。

## 1. 确定目标版本

`git status --porcelain` 确认工作树状态，`git log --oneline -10`、`git tag --sort=-v:refname` 找到上一条发布标签，并用 `git log --oneline v上一条标签..HEAD` 得到发布说明要覆盖的提交范围。

用 `npm view pi-hud-footer versions` 确认目标版本未被占用；已占用就提升版本号，不用其他手段覆盖已有版本。

**完成条件：** 目标版本号、提升理由、上一条发布标签与提交范围已确定。

## 2. 更新版本号并提交

修改 `package.json` 的 `version`，按 commit-zh 约定提交，消息沿用历史形式 `chore(release): 更新版本到 X.Y.Z`，且只提交该文件：`git commit --only -m <message> -- package.json`。

**完成条件：** 提交成功，diff 只含版本号一行。

## 3. 发布前本地复现 CI 检查

CI 若在安装阶段失败，根本走不到发布步骤，所以先按 CI 的顺序在本地验证：

```bash
rm -rf node_modules && pnpm install --frozen-lockfile && pnpm typecheck
```

已知失败：pnpm 11 报 `ERR_PNPM_IGNORED_BUILDS`，表示新引入的依赖未允许运行构建脚本；按现有模式在 `pnpm-workspace.yaml` 的 `allowBuilds` 中补 `<依赖名>: true`（现有条目为 `@google/genai`、`protobufjs`、`esbuild`），另起一次提交并推送后再发布。修复提交必须包含在标签指向的提交中。

**完成条件：** `pnpm install --frozen-lockfile` 与 `pnpm typecheck` 均通过；失败时已定位原因并修复，或已报告阻塞。

## 4. 推送并打标签

用户要求推送时执行 `git push origin main`；随后在工作树干净的前提下打轻量标签（历史标签都是直接指向提交的轻量标签）：

```bash
git tag vX.Y.Z <提交 SHA>
git push origin vX.Y.Z
```

标签版本必须与 `package.json` 一致。若标签已推送但需要改指到含修复的提交，先取得确认，再删除远端标签并重新推送，最后用 `git ls-remote --tags origin vX.Y.Z` 复核。替代路径是手动触发 `workflow_dispatch`（`gh workflow run publish.yml --ref main`），它跳过标签版本校验，需要人工核对 `package.json` 版本。

**完成条件：** `main` 与远端一致，远端标签指向预期提交。

## 5. 观察 CI 发布

用 `gh run list --workflow=publish.yml --limit 3` 找到本次运行，`gh run watch <run-id> --exit-status` 等待结束；失败时用 `gh run view <id> --log-failed` 读失败步骤的原因，按第 3 节处理。

**完成条件：** 运行结论为 success，日志含 `+ pi-hud-footer@X.Y.Z` 与 provenance 记录；失败时原因和后续动作已报告。

## 6. 核验 npm

`npm view pi-hud-footer version` 可能命中本地缓存，直接查注册表更可靠：

```bash
curl -s https://registry.npmjs.org/pi-hud-footer | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dist-tags']); print(d['time'].get('X.Y.Z'))"
```

npm 发布后会提示包在处理中，注册表最长要几分钟才更新；此时轮询等待，不要重复发布。需要时可下载 tarball 校验内容（版本号、本次新增的文件或命令）。

**完成条件：** 注册表 `dist-tags.latest` 是目标版本，`versions` 含该版本。

## 7. 创建 GitHub Release

仓库的说明格式是 `## 更新内容` 加 `- ` 列表，再接 `## 安装 / 更新` 段落（安装命令与 `npm latest 已发布为 X.Y.Z。`），内容取自第 1 节确定的提交范围。把说明写入临时文件后创建：

```bash
gh release create vX.Y.Z --title vX.Y.Z --notes-file <临时文件>
```

创建后删除临时文件，用 `gh release view vX.Y.Z` 和 `gh release list` 核对标签、draft / prerelease 状态与 Latest 标记。仓库里缺失 Release 的历史标签只在用户要求时回填。

**完成条件：** Release 已发布，正文与写入内容一致，Latest 指向该版本。

## 报告

给出目标版本与提升理由、提交 SHA、标签与远端状态、CI 运行 ID 与结论、npm `dist-tags`、Release 链接，以及未执行的步骤。
