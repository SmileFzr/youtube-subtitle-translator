# youtube-subtitle-translator
**注意，这是一个浏览器插件，不是程序**
YouTube视频实时生成字幕并翻译，比平台翻译的读起来更流畅
# YouTube 实时字幕翻译器 (YouTube Real-time Subtitle Translator)

一个兼容 Chrome 和 Edge 浏览器的扩展程序，用于实时翻译 YouTube 视频的原生字幕，并支持高度定制化和字幕导出功能，极大地提升了观看海外内容和市场研究的效率。

## 🚀 主要功能

* **实时翻译：** 利用 Google Translate 公共接口，提供快速、准确的字幕翻译。
* **样式隔离：** 翻译面板采用强制样式隔离（`all: initial`），确保显示效果不受 YouTube 页面 CSS 干扰。
* **高度定制：** 可设置源语言/目标语言、字体大小、颜色、最大行数和翻译延迟。
* **拖拽定位：** 按住 **Alt 键 + 鼠标**，可自由拖动翻译字幕的位置。
* **字幕导出：** 一键将当前视频积累的翻译文本导出为 `.txt` 文件，便于资料整理和二次利用。

## 🛠️ 安装指南

1.  **下载代码：** 点击本仓库右上角的 **Code** 按钮，选择 **Download ZIP** 并解压。
2.  **打开浏览器扩展程序页面：** 在 Chrome 或 Edge 中输入 `chrome://extensions`。
3.  **开启开发者模式：** 打开页面右上角的 **开发者模式** 开关。
4.  **加载扩展程序：** 点击 **加载已解压的扩展程序** 按钮，选择您解压后的项目文件夹。
5.  **开始使用！** 打开 YouTube 视频并点击扩展程序图标进行设置。

## ⚠️ API 说明

本项目使用 `https://translate.googleapis.com/translate_a/single` 接口进行翻译，该接口是 Google 翻译提供的**非官方公共 API**。它免费且无需密钥，但请注意，Google 并不保证其持续可用性或服务质量。

## 📄 许可证

本项目基于 **MIT License** 开放源代码。欢迎社区贡献！
实际字幕展示：
![字幕](https://github.com/user-attachments/assets/dc8e8fd1-d8d3-4ee1-a749-44e06c31c35e)
字幕插件设置界面：
![设置界面](https://github.com/user-attachments/assets/eb3df706-db2b-4c3b-9fdd-6985d6af1f23)
