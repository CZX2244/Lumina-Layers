# Lumina Studio Plus — Windows 桌面版

个人增强版的 Windows 打包说明。安装包自带 Python 运行时与构建好的界面，
安装后不需要再装 Python、Node 或 pnpm。

## 获取安装包

- **GitHub Actions（推荐）**：每次推送到 `plus/main`，工作流
  “Lumina Studio Plus (Windows desktop)” 会生成两个产物：
  - `LuminaStudioPlus-installer`：安装程序（装到当前用户目录，无需管理员权限）
  - `LuminaStudioPlus-portable`：免安装 zip，解压后运行 `Lumina Studio Plus.exe`
- 推送形如 `plus-v2.0.1-1` 的标签时，同时发布到本仓库的 Releases 页。

## 在自己电脑上构建

需要 Windows x64、Node.js 22.13+（或 24）、pnpm 10.33.2 和网络：

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\build.ps1
```

产物在 `dist-desktop\`。`-StageOnly` 只准备运行时并跑自检，不打包。

## 数据位置

设置、耗材档案、自定义 LUT、缓存、日志和输出都在
`%APPDATA%\Lumina Studio Plus\`，重装或升级不会丢失。

## 离线与隐私

- 个人版不连接任何云端耗材库或云 LUT 库，也不上传问题报告。
- 问题报告和日志只保存在本机：设置 → 增强功能 → 诊断与更新，可以打开对应文件夹。
- 更新需要手动检查：同一位置点“检查个人版更新”，会查询本仓库的 Releases；启动时不联网。
- 旧版本如果在 `plus-config.json` 里存过 Registry 地址或令牌，启动时会自动删除。

## 常见问题

- **首次打开被 SmartScreen 拦截**：安装包未签名，点“更多信息 → 仍要运行”。
- **启动提示缺少 DLL**：安装微软 VC++ 2015-2022 x64 运行库后重试。
