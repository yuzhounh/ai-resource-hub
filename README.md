<p align="center">
  <img src="./ai-resource-hub.svg" width="144" alt="AI Resource Hub icon">
</p>

<h1 align="center">AI Resource Hub</h1>

<p align="center"><strong>AI 工具集、API 控制台与 Agent 生态地图的统一入口</strong></p>

<p align="center">
  <a href="https://github.com/yuzhounh/ai-resource-hub/releases"><img src="https://img.shields.io/badge/version-v1.3.0-8875DE" alt="version v1.3.0"></a>
  <a href="https://ai-resource-hub-manager.vercel.app/"><img src="https://img.shields.io/badge/Vercel-online-43A68F" alt="Vercel online"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-D39448" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/last%20updated-2026--08--25-668DD8" alt="last updated 2026-08-25">
</p>

AI Resource Hub 将三个互相关联的静态导航页面整合为一个统一入口，覆盖常用 AI 产品、模型与 API 控制台，以及 AI Agent 产品和运行形态。

## 在线访问

<https://ai-resource-hub-manager.vercel.app/>

## 内容

- **工具集**：AI 助手、搜索、科研、Coding / Agent、模型平台、榜单与创作工具。
- **API 控制台**：国内外模型厂商和 API Router 的 Key、Usage、充值、套餐与文档入口。
- **Agent 生态地图**：AI 编程、知识工作、桌面和浏览器操作、常驻个人 Agent、Coding / Token Plan、API Router 与基础模型。

## 功能

- 四个一级标签和各自的二级分类导航。
- 三个独立搜索框，其中表格页面支持行级过滤。
- 使用 Firebase Authentication 和 Cloud Firestore 的个人 Plan 管理区。
- 手动维护 Plan、限时优惠、模型、Harness 兼容性、用量快照和备注。
- URL 哈希深链接、浏览器前进与后退。
- 响应式布局、深色模式和键盘快捷键。
- `/` 聚焦当前搜索框，`Esc` 清空搜索。

## 本地使用

直接用浏览器打开 `index.html`，不需要安装依赖或启动服务器。

Plan 管理区使用 Firebase Web SDK，Google 登录通常需要通过本地 HTTP 服务访问，并在 Firebase Authentication 的 Authorized domains 中加入本地域名。

## Plan 管理配置

1. 在 Firebase Authentication 中启用 Google 登录，并添加 Vercel 正式域名。
2. 创建 Cloud Firestore，初始选择 Production / Locked Mode。
3. 首次登录 Plan 管理区，复制页面显示的 Firebase UID。
4. 将 `firestore.rules` 中的 `REPLACE_WITH_FIREBASE_UID` 替换为该 UID。
5. 在 Firebase Console 发布规则，或使用 Firebase CLI 部署规则。

Firestore 仅保存套餐和使用记录。项目没有 API Key 字段，也不会调用供应商 API；表单和 JSON 导入会拦截常见格式的 API Key 与 Bearer Token。不要在备注、错误信息或导入文件中保存任何凭证。

## 项目文件

- `index.html`：站点入口，包含工具集、API 控制台、Agent 生态地图与 Plan 管理四个视图。
- `ai-resource-hub.svg`：页头图标。
- `favicon.svg`：浏览器标签页图标。
- `manager.css`：Plan 管理区样式。
- `manager.js`：Firebase 登录、Firestore 数据和管理交互。
- `firestore.rules`：只允许固定 Firebase UID 访问个人数据的规则模板。

## License

[MIT](./LICENSE)
