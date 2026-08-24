<div align="center">

<img src="src/renderer/control/logo.png" width="120" alt="呆喵 logo" />

[![Build](https://github.com/yubdey/DaiMeow/actions/workflows/build.yml/badge.svg)](https://github.com/yubdey/DaiMeow/actions/workflows/build.yml)
[![Release](https://github.com/yubdey/DaiMeow/actions/workflows/build-release.yml/badge.svg)](https://github.com/yubdey/DaiMeow/actions/workflows/build-release.yml)
[![Version](https://img.shields.io/badge/version-1.1.0-blue)](https://github.com/yubdey/DaiMeow/releases)

# 呆喵 DaiMeow

**一只会陪你看屏幕的《怪物猎人》艾露猫桌宠**

基于 Electron + Live2D 的 Windows 桌面宠物。呆喵常驻屏幕角落，会定时「看」你的屏幕，用多模态大模型以艾露猫的身份（称呼你为「老大」喵~）点评你在做什么。

</div>

---

## ✨ 功能特点

- **Live2D 桌宠渲染**：透明无边框置顶窗口，Cubism 3 模型实时渲染，常驻屏幕不挡操作
- **AI 屏幕观察**：定时截图（默认每 15 秒）→ 多模态大模型 → 呆喵用 1~2 句简短台词评论屏幕内容
- **头像视线追踪**：呆喵的头和眼睛会跟随鼠标移动
- **手柄右摇杆控制视角**：通过 Windows XInput 读取手柄，右摇杆控制呆喵视线方向（后台窗口也能用）
- **多服务商支持**：Moonshot (Kimi)、火山方舟、阿里云百炼、智谱 AI、硅基流动、DeepSeek、小米 MiMo、Ollama 本地模型
- **人格系统**：6 种可切换人格（元气随从猫 / 温柔陪伴猫 / 傲娇吐槽猫 / 专业猎人猫 / 慵懒摸鱼猫 / 守护骑士猫），每人格有独立完整的 system prompt
- **桌宠调整**：位置、大小缩放、透明度、鼠标穿透开关、固定位置锁定、原生窗口拖动
- **系统托盘**：关闭窗口最小化到托盘，托盘菜单快捷控制
- **GitHub Pages 公告系统**：启动时后台异步检查远程公告，有新版本才弹窗
- **统计面板**：本次运行 / 累计运行时间、对话数、Token 消耗
- **聊天历史**：带截图的对话记录面板
- **空闲检测**：60 秒无操作自动暂停截图，节省资源

---

## 📥 下载

普通用户**不需要**下载源代码或安装开发环境。

前往 [GitHub Releases](https://github.com/yubdey/DaiMeow/releases) 下载最新版本：

- **`DaiMeow-vX.X.X-Windows-x64.zip`** —— 免安装绿色版，解压后直接运行 `DaiMeow.exe`
- **`DaiMeow-Setup-vX.X.X-Windows-x64.exe`** —— 安装版，带开始菜单/桌面快捷方式

### 系统要求

- **操作系统**：Windows 10 / 11（64 位）
- **网络**：使用云端 AI 需要联网；使用本地 Ollama 可离线
- **无需安装** Node.js、Python 或任何开发环境

### 首次运行

1. 解压 ZIP 或运行安装程序
2. 双击 `DaiMeow.exe` 启动
3. 首次启动会弹出《呆喵使用须知》，点击「我知道了」
4. 进入「设置」面板，选择 AI 服务商并填入 API Key（或选择 Ollama 本地模型）
5. 回到主页点击「呆喵？启动！」，呆喵出现在屏幕角落开始观察

### 关于 Ollama（可选）

呆喵支持本地 Ollama 模型，**完全免费、离线可用**：
1. 安装 [Ollama](https://ollama.com/)
2. 命令行拉取视觉模型：`ollama run qwen3.5:4b`
3. 呆喵设置里选「Ollama 本地模型」，程序会自动读取已安装的模型

> Ollama 是外部独立服务，不属于呆喵 EXE 内置组件。

### 如何更新到新版本

下载新版本 ZIP，解压覆盖即可（配置和统计自动保留在 `%APPDATA%/daimeow/`）。或重新运行安装版 exe 覆盖安装。

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | [Electron](https://www.electronjs.org/) 34 |
| Live2D 渲染 | [PixiJS](https://pixijs.com/) 7 + [pixi-live2d-display](https://www.npmjs.com/package/pixi-live2d-display) 0.4.0 |
| Cubism 运行时 | `@hazart-pkg/live2d-core`（Cubism Core v5） |
| 打包工具 | [esbuild](https://esbuild.github.io/)（打包宠物窗口渲染器） |
| 前端 | 原生 HTML / CSS / JavaScript（无框架） |
| 网络请求 | Node.js 内置 `fetch` |
| 手柄输入 | Windows XInput（通过 PowerShell 调用） |

---

## 📁 项目结构

```
DaiMeow/
├── package.json                  # 依赖与脚本
├── 启动呆喵.bat                  # Windows 一键启动脚本
├── scripts/
│   └── patch-bundle.js           # esbuild 产物后处理（Cubism2 兼容）
├── model/
│   └── daimeow/                  # Live2D 模型文件（.moc3 / .model3.json / 贴图等）
└── src/
    ├── main/                     # Electron 主进程
    │   ├── index.js              # 应用入口、生命周期、服务装配
    │   ├── windows.js            # 控制面板 + 宠物窗口创建
    │   ├── tray.js               # 系统托盘
    │   ├── ipc-handlers.js       # IPC 通道注册
    │   └── services/
    │       ├── api-client.js     # OpenAI 兼容 API + Ollama 双路径调用
    │       ├── chat-manager.js   # 聊天历史管理
    │       ├── config-store.js   # 配置持久化
    │       ├── gamepad-poller.js # 手柄 XInput 轮询
    │       ├── idle-detector.js  # 空闲检测
    │       ├── model-server.js   # 本地 HTTP 模型文件服务器
    │       ├── mouse-poller.js   # 鼠标位置轮询
    │       ├── notice-manager.js # GitHub Pages 公告检测
    │       ├── ollama-provider.js# Ollama 本地模型接口
    │       ├── personalities.js  # 6 种人格定义
    │       ├── personality-manager.js # 人格管理与 system prompt 构建
    │       ├── screenshot.js     # 屏幕截图与压缩
    │       └── stats-tracker.js  # 会话/累计统计
    ├── preload/
    │   ├── control-preload.js    # 控制面板 contextBridge
    │   └── pet-preload.js        # 宠物窗口 contextBridge
    └── renderer/
        ├── control/              # 控制面板（主页 / 设置 / 记录 / 调整 / 人格）
        │   ├── index.html
        │   ├── app.js
        │   ├── styles.css
        │   └── logo.png
        └── pet/                  # 宠物窗口（Live2D 渲染）
            ├── index.html
            ├── pet-app-esm.js    # PIXI + Live2D 渲染逻辑（源文件）
            └── pet-bundle.js     # esbuild 打包产物（运行时加载）
```

---

## 📦 安装与运行

> 需要已安装 [Node.js](https://nodejs.org/)（>= 20，内置 `fetch`）。

```bash
# 1. 安装依赖
npm install

# 2. 启动（prestart 会自动先打包宠物渲染器）
npm start
```

或使用开发模式（等价于 start）：

```bash
npm run dev
```

Windows 下也可以直接双击项目根目录的 `启动呆喵.bat` 一键启动。

### 手动打包宠物渲染器（通常无需手动执行）

```bash
npm run build:pet
```

### 常见启动问题

- **Electron 下载失败**（网络受限时）：需要手动下载 Electron 二进制并解压到 `node_modules/electron/dist`，或用国内镜像。

---

## ⚙️ 配置说明

配置文件保存在系统用户目录下：

```
Windows: %APPDATA%/daimeow/config.json
```

> ⚠️ 文件中的 API Key 是本机明文保存，请勿将 config.json 提交到 GitHub。

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `providerType` | `api`（云端 API）或 `ollama`（本地模型） | `api` |
| `provider` | 当前服务商（moonshot / volcano / alibaba / zhipu / siliconflow / deepseek / mimo 等） | `custom` |
| `apiKeys` | **按服务商分别保存的 API Key 映射** | `{}` |
| `apiEndpoint` | OpenAI 兼容接口地址 | Moonshot 默认 |
| `model` | 当前视觉模型 ID | — |
| `ollamaEndpoint` | Ollama 服务地址 | `http://127.0.0.1:11434` |
| `screenshotInterval` | 截图间隔（秒） | `5` |
| `maxTokens` | 单次回复最大 Token | `60` |
| `temperature` | 采样温度 | `0.6` |
| `petScale` | 实际缩放系数（0.3~1.0） | `0.5` |
| `petPositionX / petPositionY` | 桌宠位置（0~1 比例） | `0 / 0.5` |
| `fixedPosition` | 固定位置锁定 | `false` |
| `mousePassthrough` | 鼠标穿透 | `true` |
| `petOpacity` | 桌宠透明度（0.1~1.0） | `1.0` |
| `lastNotice` | 已显示公告版本（去重） | `''` |

### 服务商配置

在「设置」面板中选择服务商预设，填入该服务商的 API Key 与密钥即可。API Key 会**按服务商分别保存**，切换服务商互不串用。

**Ollama 本地模型**：在「AI 服务类型」选择「Ollama 本地模型」，程序会自动读取本机已安装的模型列表（`GET /api/tags`），无需 API Key。

---

## 🎮 使用说明

1. **首次启动**：弹出《呆喵使用须知》，点击「我知道了」进入主界面
2. **启动呆喵**：点击主页的「呆喵？启动！」按钮，宠物窗口出现，开始定时观察屏幕并评论
3. **切换人格**：「人格」面板选择喜欢的随从猫性格
4. **调整桌宠**：「调整」面板可修改位置、大小、透明度；关闭「鼠标穿透」后长按呆喵可拖动窗口；开启「固定位置」锁定
5. **查看记录**：「记录」面板回看对话历史与截图
6. **托盘控制**：关闭主窗口后最小化到托盘，左键单击托盘图标恢复窗口，右键可退出

---

## ❓ 常见问题

**Q：AI 没有回复，提示「API Key 未配置」？**
A：在「设置」面板选择服务商并填入 API Key，点击「保存配置」。

**Q：提示「API 请求失败 (400) Arrearage（欠费）」？**
A：这是服务商账户余额不足导致的，与程序无关。请前往对应服务商控制台充值，或切换到其他服务商 / Ollama 本地模型。

**Q：为什么回复内容是空的？**
A：所有模型的思考模式已在代码中强制关闭（`thinking: disabled`）。如果仍为空，可能是 `maxTokens` 过小或服务商接口异常，可在设置中调大 Max Tokens。

**Q：如何用本地模型（免费）？**
A：安装 [Ollama](https://ollama.com/) 并拉取一个视觉模型（如 `ollama run qwen3.5:4b`），然后在设置中「AI 服务类型」选「Ollama 本地模型」，程序会自动读取本地模型列表。

**Q：手柄怎么控制呆喵？**
A：插入支持 XInput 的手柄，右摇杆即可控制呆喵视线方向，无需切换窗口焦点。

**Q：配置保存在哪里？**
A：`%APPDATA%/daimeow/config.json`，统计在 `%APPDATA%/daimeow/totals.json`。

---

## 🔮 开发计划

- **公告系统扩展**（架构已预留，`notice-manager.js` 的设计可平滑扩展）：
  - 自动更新 exe（远程提供 `download` 字段）
  - Live2D 模型更新
  - AI 人格配置更新
  - 活动公告（`force` 强制显示已支持）

---

## 📄 开源协议

本项目使用 [MIT License](LICENSE)。

---

> 🐱 陪老大一起看屏幕，是呆喵最重要的事喵~
