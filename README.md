# AI 阅卷助手 (多平台版) v4.0

一个支持多个改卷网站和多个 AI 平台的 Chrome 扩展，用于自动化批改学生试卷。

## ✨ 功能特点

- 🤖 **多 AI 平台支持**：Kimi、豆包、DeepSeek（可扩展）
- 🌐 **多改卷网站支持**：wxy100.com（可扩展）
- 🔄 **全自动循环**：支持自动翻页批改
- ⚙️ **灵活配置**：多学科、多题型、多采分点
- 🎨 **现代化 UI**：美观易用的配置界面

## 📁 项目结构

```
chrome-ai-grade/
├── manifest.json                 # 扩展配置
├── background/
│   └── service-worker.js         # 后台服务
├── popup/
│   ├── popup.html                # 配置界面
│   └── popup.js                  # 配置逻辑
├── content-scripts/
│   ├── grading-site-loader.js    # 改卷网站加载器
│   └── ai-platform-loader.js     # AI 平台加载器
├── adapters/
│   ├── grading-sites/            # 改卷网站适配器
│   │   ├── base.js               # 基类
│   │   ├── wxy100.js             # wxy100.com
│   │   └── index.js              # 索引
│   └── ai-platforms/             # AI 平台适配器
│       ├── base.js               # 基类
│       ├── kimi.js               # Kimi
│       ├── doubao.js             # 豆包
│       ├── deepseek.js           # DeepSeek
│       └── index.js              # 索引
├── core/
│   ├── message-hub.js            # 消息通信
│   ├── adapter-registry.js       # 适配器注册
│   └── prompt-builder.js         # Prompt 构建
└── icons/                        # 扩展图标
```

## 🚀 使用方法

### 安装

1. 下载/克隆本项目
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择项目文件夹

### 配置

1. 点击扩展图标，打开配置面板
2. 选择 AI 平台（Kimi/豆包/DeepSeek）
3. 设置学科、题型、总分
4. 添加采分点（分值、关键词、参考答案）
5. 填写评分规则
6. 点击「保存配置」

### 使用

1. 打开 AI 平台网页（如 kimi.com）并保持登录
2. 打开改卷网站（如 wxy100.com）
3. 进入需要批改的题目页面
4. 点击页面右上角的「开始判分」按钮
5. 等待 AI 自动完成评分

### 全自动模式

勾选「全自动循环批改」后，系统会自动：
- 批改当前题目
- 自动翻到下一题
- 循环批改直到结束

## 🔧 扩展开发

### 添加新的改卷网站

1. 在 `adapters/grading-sites/` 创建新文件，如 `newsite.js`
2. 继承 `GradingSiteAdapter` 基类
3. 实现必要的方法：
   - `isReady()` - 检测页面就绪
   - `getAnswerImageUrls()` - 获取答题图片
   - `fillScore(score)` - 填入分数
   - `goToNext()` - 跳转下一题
4. 在 `content-scripts/grading-site-loader.js` 添加适配器
5. 在 `manifest.json` 添加 URL 匹配规则

### 添加新的 AI 平台

1. 在 `adapters/ai-platforms/` 创建新文件，如 `newai.js`
2. 继承 `AIPlatformAdapter` 基类
3. 实现必要的方法：
   - `getInputEditor()` - 获取输入框
   - `pasteImages(base64Images)` - 粘贴图片
   - `inputText(text)` - 输入文本
   - `clickSend()` - 点击发送
   - `waitForResponse()` - 等待回复
4. 在 `content-scripts/ai-platform-loader.js` 添加适配器
5. 在 `manifest.json` 添加 URL 匹配规则
6. 在 `popup/popup.html` 添加平台选择卡片

## 📋 适配器接口

### GradingSiteAdapter（改卷网站）

```javascript
class NewSiteAdapter extends GradingSiteAdapter {
  constructor() {
    super();
    this.name = 'newsite';
    this.displayName = '新网站名称';
    this.matchPatterns = ['newsite.com'];
  }

  isReady() { /* 返回 boolean */ }
  getAnswerImageUrls() { /* 返回 string[] */ }
  fillScore(score) { /* 返回 boolean */ }
  goToNext() { /* 返回 boolean */ }
}
```

### AIPlatformAdapter（AI 平台）

```javascript
class NewAIAdapter extends AIPlatformAdapter {
  constructor() {
    super();
    this.name = 'newai';
    this.displayName = '新AI名称';
    this.matchPatterns = ['newai.com'];
  }

  getInputEditor() { /* 返回 HTMLElement */ }
  async pasteImages(base64Images) { /* 返回 boolean */ }
  async inputText(text) { /* 返回 boolean */ }
  async clickSend() { /* 返回 boolean */ }
  async waitForResponse(initialCount, timeoutMs) { /* 返回 string */ }
}
```

## 🔄 工作流程

```
改卷网站                    Background                    AI 平台
   │                           │                            │
   │ GRADE_REQUEST             │                            │
   │ (imageUrls, config)       │                            │
   ├──────────────────────────>│                            │
   │                           │ 下载图片转 Base64            │
   │                           │ 构建 Prompt                 │
   │                           │                            │
   │                           │ DO_AI_TASK                 │
   │                           │ (images, prompt)           │
   │                           ├───────────────────────────>│
   │                           │                            │
   │                           │                            │ 粘贴图片
   │                           │                            │ 输入 Prompt
   │                           │                            │ 发送并等待
   │                           │                            │
   │                           │ AI_DONE                    │
   │                           │ (score, details)           │
   │                           │<───────────────────────────┤
   │                           │                            │
   │ GRADE_RESULT              │                            │
   │ (score)                   │                            │
   │<──────────────────────────┤                            │
   │                           │                            │
   │ 自动填入分数               │                            │
   │ 跳转下一题                 │                            │
```

## ⚠️ 注意事项

1. 使用前请先打开并登录 AI 平台
2. 改卷网站和 AI 平台需要在不同标签页打开
3. 批改过程中请勿关闭相关标签页
4. 建议先手动测试几题确保配置正确
5. AI 返回的分数仅供参考，请自行复核

## 📝 版本历史

- **v4.0** - 多平台架构重构
  - 支持多个 AI 平台（Kimi/豆包/DeepSeek）
  - 适配器模式，易于扩展
  - 全新 UI 设计

- **v3.2** - Kimi.com 修复版
  - 修复 Kimi 网页兼容性问题

## 📄 License

MIT License
