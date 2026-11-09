# Lumina Studio Plus — Windows 桌面版

个人增强版的 Windows 打包说明。安装包自带 Python 运行时与构建好的界面，
安装后不需要再装 Python、Node 或 pnpm。

## 获取安装包

- **GitHub Actions（推荐）**：每次推送到 `plus/main`，工作流
  “Lumina Studio Plus (Windows desktop)” 会生成两个产物：
  - `LuminaPlus-installer`：安装程序（装到当前用户目录，无需管理员权限）——推荐
  - `LuminaPlus-portable`：免安装 zip，解压后运行 `Lumina Studio Plus.exe`
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

## 免安装版怎么解压

1. 下载的 `LuminaPlus-portable.zip` 里还有一层 `LuminaPlus-<版本>.zip`，两层都要解压。
2. 解压前先右键 zip → 属性 → 勾选“解除锁定” → 确定，避免解压出的文件被逐个拦截。
3. 解压到短路径，例如 `C:\LuminaPlus\`。Windows 自带的解压会悄悄跳过总长超过 260 个字符的文件，
   目录太深时程序会缺文件；启动时若检测到缺文件，会弹窗说明并给出日志位置。

## 常见问题

- **首次打开被 SmartScreen 拦截**：安装包未签名，点“更多信息 → 仍要运行”。
- **启动提示缺少 DLL**：安装微软 VC++ 2015-2022 x64 运行库后重试。
- **双击没有任何反应（没有窗口、没有提示）**：多半是程序所在文件夹的权限被其它软件改过
  （例如 Codex 的 Windows 沙箱会给整个用户目录加 AppContainer 权限项），Electron 的沙箱读不到
  程序文件，启动即退出（Windows 事件里异常码 `0x80000003`）。
  - 安装版：安装程序会自动给安装目录补上“所有应用程序包”读取权限。
  - 免安装版：程序首次启动时会尝试自动补；仍打不开就双击程序旁的 `fix-permissions.cmd`，
    或在 PowerShell 执行（把路径换成你的文件夹）：
    `icacls "C:\LuminaPlus" /grant *S-1-15-2-1:(OI)(CI)(RX)`
  - 这只增加读取/执行权限，不修改程序文件，也不动其它软件加的权限项。
- **打不开或启动失败**：弹窗会写明原因并可打开日志文件夹；日志在
  `%APPDATA%\Lumina Studio Plus\logs\lumina-electron.log`，后端的错误输出也记录在里面。
