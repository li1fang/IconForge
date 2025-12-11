# ⚒️ IconForge

> **The .ico Alchemist for Indie Craftsmen.**
>
> **大图靠算，小图靠画。为细节洁癖者打造的图标熔炉。**

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Python](https://img.shields.io/badge/backend-FastAPI-green) ![React](https://img.shields.io/badge/frontend-React-blue) ![Docker](https://img.shields.io/badge/deploy-Docker-blue)

## 📖 Introduction (简介)

市面上的 `.ico` 转换工具通常只有两种：
1.  **傻瓜式：** 上传一张大图，暴力缩放成所有尺寸。结果：16x16 的托盘图标模糊不清，惨不忍睹。
2.  **全能式：** Photoshop / Aseprite。功能强大，但为了做一个图标启动它们太重了，而且还需要手动拼接图层。

**IconForge** 是一个垂直领域的“图标流水线”工具。它结合了 **AI 自动化** 与 **像素级的手工控制**。它相信：256px 的大图应该由算法生成，而 16px 的托盘图标必须由人类注入灵魂。

## ✨ Core Features (核心功能)

### Stage 1: Raw Material (原料摄入)
*   **Smart Ingestion:** 支持上传任意尺寸的高清图片（推荐 256x256+）。
*   **Auto-Magic:**
    *   🤖 **AI 去底:** 集成 `rembg` 模型，自动识别主体并移除背景。
    *   ✂️ **智能裁剪:** 自动计算非透明像素范围，居中裁剪，并预留 10% 呼吸空间 (Padding)。

### Stage 2: The Filter (算法选优)
针对 **48x48** 和 **32x32** 的中等尺寸，提供实时算法对比：
*   🔘 **Lanczos:** 柔和细腻，适合复杂材质、光影（如气泡、拟物风格）。
*   🔘 **Nearest Neighbor:** 硬朗锐利，适合像素风原图。
*   用户一键选择最顺眼的算法，无需手动调整。

### Stage 3: The Soul Injection (注入灵魂) - *16x16 Exclusive*
这是 IconForge 的核心。16x16 的图标决定了软件在托盘区的生死。
我们提供 **Split-View Soul Mode (分屏灵魂模式)**：
*   **左侧 (Reference & Picker):** 算法自动缩放的 16px 参考图。鼠标悬停可直接**吸取颜色**。
*   **中间 (The Grid):** 空白的 16x16 像素画板。使用吸取的颜色，手动点阵绘制，确保每一个像素都是清晰、实心的。
*   **右侧 (Preview):** 1:1 实时预览，模拟真实 Windows 托盘效果。
*   **工具:** 单像素画笔、橡皮擦、一键填白/填黑（专为单色图标设计）。

### Stage 4: Minting (封装)
*   后端自动将 High-res (256), Mid-res (48/32), Low-res (16 手绘版) 封装进标准的 Windows `.ico` 容器。
*   一键下载 `favicon.ico` 或 `app.ico`。

---

## 🛠 Tech Stack (技术栈)

### Backend (The Forge)
*   **Language:** Python 3.11+
*   **Framework:** **FastAPI** (高性能异步接口)
*   **Image Processing:**
    *   **Pillow (PIL):** 图像缩放、重采样、ICO 封装。
    *   **Rembg:** 基于 U2-Net 的 AI 背景移除工具。
    *   **NumPy:** 高效像素矩阵运算。

#### API Surface (Phase 1)
* `POST /api/v1/materials/upload` — `multipart/form-data` 上传原图，自动完成去底与智能裁剪，返回 256px PNG 的 Base64 预览及裁剪元数据。
* `GET /api/v1/materials/{id}` — 获取对应素材的 256px 处理结果和裁剪信息。
* `GET /api/v1/materials/{id}/preview?algo=LANCZOS&size=48` — 按算法 (`LANCZOS`/`NEAREST`/`BILINEAR`) 生成 48px 或 32px 预览，带内存缓存避免重复计算。

> 使用 `uvicorn app.main:app --reload` 可在本地启动 API。健康检查：`/health`、`/api/v1/ping`。

#### Upload Constraints & Cleanup (上传限制与清理策略)
*   **Allowed formats (格式限制)：** 仅支持 PNG / JPG(JPEG) / WEBP，上传时会检查扩展名与实际 MIME/格式是否一致，避免伪装文件。
*   **Max size (大小限制)：** 默认 `10MB`，可通过 `ICONFORGE_MAX_UPLOAD_SIZE_BYTES` 调整。
*   **Temp retention (临时文件保留)：** 上传素材会落盘到 `ICONFORGE_TEMP_DIR`（默认 `/tmp/iconforge/temp`）。若距离最近一次访问超过 `ICONFORGE_MATERIAL_TTL_SECONDS`（默认 `3600s`），将在后续上传或读取时自动逐出并清理目录与缓存。

#### Monitoring & Safety (观测与防护)
*   **Request ID 注入：** 后端为每个请求生成/透传 `X-Request-ID`，同时在日志中输出，用于端到端追踪。
*   **Structured Logging：** 服务启动时开启 JSON 格式化日志，字段包含 `timestamp`、`level`、`message`、`request_id`，方便集中式收集。
*   **Problem Details：** 全局异常处理器以统一的 RFC 7807 JSON 输出错误，字段：`type`、`title`、`status`、`detail`、`instance`、`request_id`。
*   **可选防护开关：**
    *   速率限制：`ICONFORGE_ENABLE_RATE_LIMIT=true` & `ICONFORGE_RATE_LIMIT_PER_MINUTE=120`（默认关闭）。
    *   简易 API Key：`ICONFORGE_REQUIRE_API_KEY=<your-key>`（设置后所有 API 需要请求头 `X-API-Key`）。

### Frontend (The Workbench)
*   **Framework:** **React 18** + Vite
*   **UI Library:** Tailwind CSS (极简样式) + ShadcnUI
*   **Canvas Engine:** HTML5 Canvas API (用于实现 16x16 画板交互)

### Infrastructure
*   **Docker:** 前后端分离容器化。
*   **Docker Compose:** 一键编排启动。

---

## 🚀 Getting Started (快速开始)

### Prerequisites
*   Docker & Docker Compose installed.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/IconForge.git
cd IconForge

# 2. Start the forge (This may take a while to download the AI models)
docker-compose up -d

# 3. Access the workbench
# Open browser at http://localhost:3000
```

---

## 🎨 Workflow Guide (使用流程)

1.  **Upload:** 拖拽你的 Logo 原图（JPG/PNG）到上传区。
2.  **Review AI:** 确认 AI 去底和自动裁剪的效果。如果不满意，可以上传已手动去底的 PNG。
3.  **Select Mid-Res:** 在 32px 预览区，点击 `Lanczos` 或 `Nearest`，看哪个更顺眼。
4.  **Craft Low-Res:** 进入 16px 编辑器。
    *   从左侧参考图吸取主色调。
    *   在中间画板描绘轮廓。
    *   或者直接使用“一键填白”，制作高对比度的托盘图标。
5.  **Forge:** 点击生成，获取你的大师级 `.ico` 文件。

---

## 🔮 Roadmap

*   [ ] 支持 MacOS `.icns` 格式导出。
*   [ ] 增加 "Ghost Overlay"（半透明叠层）作为辅助视图选项。
*   [ ] 提供简单的滤镜（如：为 16px 图标增加 1px 的黑色描边以适应浅色背景）。

## 📄 License

MIT License © 2025 YourName
