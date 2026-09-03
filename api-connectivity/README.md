# API 连通性报告

Windows / Python 3.9+，运行时仅使用标准库。双击 `refresh_api_report.bat` 会读取 Windows 凭据管理器并进行真实 API 调用，可能产生费用。

双击脚本现在会启动仅监听 `127.0.0.1:8765` 的本地服务并自动打开浏览器。网页上的“刷新”按钮通过这个服务刷新单个或全部服务商；直接双击 HTML 仍可查看报告，但刷新按钮会提示先启动脚本。关闭启动窗口即可停止服务。

## 常用命令

```powershell
# 只更新页面样式/交互，保留报告生成时间与结果；不读凭据，不调用 API
python -X utf8 refresh_api_report.py --render-only

# 也可以不自动打开浏览器，只启动本地服务
python -X utf8 local_server.py --no-browser

# 实时探测（默认每服务商最多 25 个文本模型、100 次请求、3 个并发）
python -X utf8 refresh_api_report.py

# 调整上限；请求上限包含目录分页、协议回退、HTTP 重试
python -X utf8 refresh_api_report.py --max-models 10 --max-requests 40 --workers 2 --retries 0

# 若公司代理使用自有 CA，提供可信 PEM 证书；不会关闭 TLS 验证
python -X utf8 refresh_api_report.py --ca-file C:\trusted\company-ca.pem

# 离线回归（Node.js 仅用于前端测试，生成报告不需要 Node.js）
python -m unittest -v test_api_report
node --test test_report_ui.cjs
```

## OpenCode 外部模型执行器

已提供全局命令 `oc-exec`，可从 Windows 凭据管理器读取 API key，并在 B.AI、Flatkey 与 AMD 的已验证模型之间切换。配置与用法见 [OPENCODE_EXECUTOR.md](OPENCODE_EXECUTOR.md)。

## 判定与限制

- 目录成功、目录为空、目录失败、缺少凭据分别展示。目录收录不代表实际可调用。
- 成功要求协议响应结构符合预期，且包含已完成的非空 assistant 文本。仅 HTTP 200、空对象、错误 JSON、未完成或仅思考内容均不计成功。
- 401/403/402 停止该服务商后续请求；已有在途请求可能完成。协议/参数不兼容才尝试后续协议。
- 429/5xx 最多重试一次（可配置），遵守 Retry-After；长等待或重复限流会停止该服务商后续请求。连接超时不自动重试，避免重复计费。
- 请求次数和输出 token 上限不等于货币预算；计费取决于服务商。默认按模型名排序抽样，不代表全目录可用。
- 媒体、向量、Batch 分类只是名称推断，统一不发送生成请求，不声明已验证。
- 禁止自动跟随重定向，防止认证头发送到其他端点。需要迁移端点时修改服务商配置。
- 延迟从发起请求到响应读取、验证完成；包含当前协议内重试等待，失败时逐协议记录耗时。报告底部显示本次生成时间；刷新后才会更新结果。
- 目录缓存仅存在本次运行内存中。报告内嵌的是展示数据快照，不是凭据，也不会作为下次实时探测成功的依据。
- `--render-only` 仅更新页面样式和交互，不更新探测结论；需要最新结果时，请使用页面刷新按钮或重新运行探测。
- 浏览器视觉效果仍需本地查看。离线前端测试覆盖主题、筛选、排序和复制逻辑，不代表真实浏览器性能测量。

## 文件职责

- `refresh_api_report.py`：Windows 凭据读取、服务商配置、命令行与任务调度。
- `api_probe.py`：HTTPS 请求、限流、请求预算、目录解析与响应验证。
- `report_renderer.py`：HTML 模板、输出转义、统计与原子写入。
- `report.css` / `theme.js` / `report.js`：页面样式、首次主题初始化与交互。
- `report_import.py`：读取内嵌快照、迁移旧报告，不访问网络。
- `local_server.py`：本机刷新 API；随机令牌仅注入当前浏览器响应，不写入报告。
- `api_connectivity_report.html`：最终独立报告；修改样式后用 `--render-only` 更新。
- `_check.js`：旧临时脚本，未接入生成流程；当前交互以 `report.js` 为准。
- `oc-exec.ps1` / `executor-profiles.json` / `executor-providers.json` / `opencode-executor-config.json`：OpenCode 外部模型执行器、动态报告映射、快捷映射和无密钥配置。

报告不应公开发布：即使没有密钥，也可能包含私有模型名称及响应片段。
