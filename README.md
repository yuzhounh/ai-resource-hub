<p align="center">
  <img src="./ai-resource-hub.svg" width="144" alt="AI Resource Hub icon">
</p>

<h1 align="center">AI Resource Hub</h1>

<p align="center"><strong>AI 工具集、API 控制台与 Agent 生态地图等的统一入口</strong></p>

<p align="center">
  <a href="https://github.com/yuzhounh/ai-resource-hub/releases"><img src="https://img.shields.io/badge/version-v2.0.0-8875DE" alt="version v2.0.0"></a>
  <a href="https://ai-resource-hub-manager.vercel.app/"><img src="https://img.shields.io/badge/Vercel-online-43A68F" alt="Vercel online"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-D39448" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/last%20updated-2026--09--03-668DD8" alt="last updated 2026-09-03">
</p>

AI Resource Hub 将工具集、API 控制台、Agent 生态地图、科研自动化、笔记、连通性报告与 Plan 管理整合为一个统一入口，覆盖常用 AI 产品、模型与 API 控制台、AI Agent 产品和运行形态，并提供个人数据云同步能力。

## 在线访问

<https://ai-resource-hub-manager.vercel.app/>

## 内容与视图

- **工具集 (`#tools`)**：AI 助手、搜索、科研、Coding / Agent、模型平台、榜单与创作工具导航。
- **API 控制台 (`#api`)**：国内外模型厂商和 API Router 的 Key、Usage、充值、套餐与文档入口，集成 Coding Plan 对比与参考。
- **笔记 (`#inbox`)**：随手采集 AI 工具、模型、开源项目与 API 链接，一键生成结构化提示词复制给 AI 合并入库；内容保存在 Google 账户。
- **连通性报告 (`#connectivity`)**：Windows 凭据 API 密钥多协议（Chat / Responses / Anthropic Messages / Batch）连通性验证报告，含 16 服务商实测快照与模型级明细；服务商归档状态保存在 Google 账户，并自动同步 Plan 管理的归档。
- **Agent 生态地图 (`#agents`)**：AI 编程、知识工作、桌面和浏览器操作、常驻个人 Agent、Coding / Token Plan、API Router 与基础模型。
- **科研全景图 (`#research`)**：端到端研究系统、Deep Research 与文献综述、Agent Skills 技能库、Awesome 合集、学术写作规范与选型速查。
- **Plan 管理 (`#manage`)**：个人 Plan、限时优惠、模型、Harness 兼容性与用量记录管理区；数据保存在 Google 账户。

## 功能

- 七个并列的一级分类标签与各自的二级分类导航，全站单页无缝切换（无需跳转外部 HTML）。
- 独立的行级/卡片级即时过滤搜索框，`/` 键快捷聚焦，`Esc` 清空。
- 页面右上角 Google 账号入口：笔记、连通性与 Plan 管理三个页面需登录后才显示内容，数据保存在登录用户自己的 Firestore 路径中。
- Plan 管理中归档的服务商，会在连通性页面自动归档（按服务商名称匹配）。
- 手动维护 Plan、限时优惠、模型、Harness 兼容性、用量快照和备注。
- URL 哈希深链接、浏览器前进与后退，支持直接锚定任意二级分类。
- 响应式布局、深色模式与键盘快捷键。

## 本地使用

直接用浏览器打开 `index.html` 即可浏览工具集、控制台、生态图等公开页面，不需要安装依赖或启动服务器。

笔记、连通性与 Plan 管理使用 Firebase Web SDK（Google 登录 + Firestore），需要通过本地 HTTP 服务或线上域名访问，并在 Firebase Authentication 的 Authorized domains 中加入对应域名。

## Google 账号配置

1. 在 Firebase Authentication 中启用 Google 登录，并添加 Vercel 正式域名。
2. 创建 Cloud Firestore，初始选择 Production / Locked Mode。
3. 首次登录后，在 Plan 管理面板复制页面显示的 Firebase UID。
4. 将 `firestore.rules` 中的占位 UID 替换为该 UID。
5. 在 Firebase Console 发布规则，或使用 Firebase CLI 部署规则。

Firestore 仅保存笔记、套餐、用量与归档状态等个人数据。项目没有 API Key 字段，也不会调用供应商 API；表单和 JSON 导入会拦截常见格式的 API Key 与 Bearer Token。不要在备注、错误信息或导入文件中保存任何凭证。

## 连通性报告更新

`api-connectivity/` 内为迁移过来的完整探测链路：`api_probe.py`（HTTPS 请求、限流、请求预算、目录解析与响应验证）、`refresh_api_report.py`（Windows 凭据读取、服务商配置与任务调度）、`report_renderer.py` / `report.css` / `report.js` / `theme.js`（报告页面与交互）、`report_import.py`（读取内嵌快照、迁移旧报告）、`local_server.py`（本机刷新服务，仅监听 127.0.0.1）、`api_connectivity_report.html`（最终独立报告）、`test_api_report.py` / `test_report_ui.cjs`（离线回归与前端测试）。

在 `api-connectivity/` 下执行（实时探测会读取 Windows 凭据并产生真实 API 调用与费用）：只更新页面样式用 `python -X utf8 refresh_api_report.py --render-only`；实时探测用 `python -X utf8 refresh_api_report.py`；离线回归用 `python -m unittest -v test_api_report` 与 `node --test test_report_ui.cjs`（Node.js 仅用于前端测试）。

报告不应公开发布：即使没有密钥，也可能包含私有模型名称及响应片段。

## 项目文件

- `index.html`：站点统一入口，集成工具集、API 控制台、Agent 生态地图、科研全景图、笔记、连通性报告与 Plan 管理七个单页视图。
- `api-connectivity/`：模型 API 连通性报告与自动化探测测试链路（`refresh_api_report.py` / `api_probe.py` / `local_server.py` 等）。
- `ai-resource-hub.svg`：页头图标。
- `favicon.svg`：浏览器标签页图标。
- `hub-auth.js`：Firebase 初始化、右上角 Google 账号入口、三视图登录门控与 Plan 归档广播。
- `manager.css` / `manager.js`：Plan 管理区样式与 Firestore 数据管理交互。
- `inbox.css` / `inbox.js`：笔记区样式与 Firestore 云同步逻辑。
- `firestore.rules`：只允许固定 Firebase UID 访问个人数据的规则模板。

## License

[MIT](./LICENSE)
