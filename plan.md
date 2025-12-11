这是 **IconForge** 的硬核开发路线图 (Development Roadmap)。

这里的原则是：**不搞半成品 (No MVP)**，每一个模块必须打磨到 Close-Loop (逻辑闭环) 和 Production Ready (生产就绪) 才能进入下一阶段。我们像造一座核电站一样造这个工具。

---

# 🗺️ IconForge Development Roadmap

### Phase 1: The Core Furnace (后端核心图像引擎)
**目标:** 构建一个无 UI 的、纯 Python 的图像处理流水线。如果这一步不稳，前端画得再花也没用。

*   **Step 1.1: 基础脚手架**
    *   搭建 FastAPI 项目结构。
    *   配置 Docker 环境（特别是 `rembg` 需要较大的基础镜像和模型缓存处理）。
    *   实现文件上传 (`multipart/form-data`) 和临时存储/内存处理逻辑。
*   **Step 1.2: AI 去底与裁剪 (Auto-Magic)**
    *   集成 `rembg`。编写测试脚本：上传一张白底/复杂背景图，验证输出是否为干净的透明 PNG。
    *   实现 **Smart Crop 算法**：
        *   使用 `numpy` 分析 Alpha 通道。
        *   计算非透明像素的 Bounding Box。
        *   裁剪 + 居中 + 添加 10% Padding。
        *   **验收标准:** 无论上传的图偏左还是偏右，处理后必须完美居中且不贴边。
*   **Step 1.3: 多算法缩放 (Resampling)**
    *   封装 Pillow 的 `resize` 函数。
    *   暴露接口参数 `algo`: `LANCZOS`, `NEAREST`, `BILINEAR`。
    *   编写单元测试：对比生成 32x32 图片的边缘差异。
*   **Step 1.4: ICO 封装器 (The Minter)**
    *   实现 `pack_ico` 接口：接收一组 `BytesIO` (256, 48, 32, 16)，合并为一个 `.ico` 文件。
    *   **验收标准:** 生成的文件必须能被 Windows 资源管理器识别，且包含所有指定尺寸。

---

### Phase 2: The Workbench Canvas (前端像素引擎)
**目标:** 实现一个高性能、无延迟的像素画板。这是用户体验的护城河。

*   **Step 2.1: 画板基础 (The Grid)**
    *   搭建 React + Tailwind 框架。
    *   实现一个 16x16 的数据模型 (二维数组 `Color[16][16]`)。
    *   使用 HTML5 Canvas 渲染这个数组。不要用 `div` 堆砌（性能差），要用 Canvas `fillRect`。
    *   实现网格线绘制（浅灰色，辅助定位）。
*   **Step 2.2: 交互逻辑 (Interaction)**
    *   实现鼠标事件：点击画点、按住拖动连续画点 (Paint)。
    *   实现“橡皮擦”模式。
    *   **验收标准:** 在画板上快速划过，不能有断点，手感必须顺滑。
*   **Step 2.3: 左右分屏与取色 (Split View)**
    *   **左侧 (Reference):** 渲染后端传回来的算法缩放版 16px 图片。
    *   **取色器 (Eye Dropper):** 点击左侧 Canvas 的任意位置，提取 RGB 颜色并设为当前画笔颜色。
    *   **右侧 (Preview):** 实时渲染 16x16 的结果，不带网格线，1:1 显示，模拟托盘效果。
*   **Step 2.4: 状态管理**
    *   确保画板的每一次修改都实时更新到 React State。
    *   实现“一键清空”和“一键填白”功能。

---

### Phase 3: The Assembly Line (前后端集成)
**目标:** 将离散的模块串联成完整的工作流。

*   **Step 3.1: 上传与预览 (Stage 1 & 2)**
    *   前端实现文件拖拽上传。
    *   调用后端 API 获取去底后的 256px 原图。
    *   调用后端 API 获取不同算法生成的 32px 预览图。
    *   UI 实现：点击切换算法，实时刷新 32px 预览。
*   **Step 3.2: 传输手绘数据 (Stage 3 -> 4)**
    *   前端将 16x16 的像素数组转换为 PNG Blob。
    *   **关键点:** 不要传 JSON 数组给后端，前端直接生成 PNG 二进制流上传，减少后端计算量。
*   **Step 3.3: 最终合成与下载**
    *   前端发送请求：`POST /forge`。
        *   Payload: `source_image_id`, `mid_res_algo_choice`, `hand_drawn_16px_file`.
    *   后端接收并调用 Phase 1.4 的封装器。
    *   浏览器触发文件下载。

---

### Phase 4: Polish & Production (打磨与交付)
**目标:** 把工具变成产品。

*   **Step 4.1: 错误处理与边界情况**
    *   处理非图片文件上传。
    *   处理超大图片（限制 5MB 或 10MB）。
    *   处理 AI 去底失败的情况（提供“使用原图”的 Fallback 选项）。
*   **Step 4.2: UI/UX 微调**
    *   添加 Loading 骨架屏（AI 处理需要几秒钟）。
    *   优化 Canvas 的光标样式（画笔时显示铅笔图标，取色时显示滴管）。
    *   添加 Dark Mode 支持（这是给开发者用的工具，必须有黑夜模式）。
*   **Step 4.3: 部署与 CI/CD**
    *   编写 `Dockerfile` (优化构建体积，使用多阶段构建)。
    *   编写 `docker-compose.yml`。
    *   配置 GitHub Actions：自动构建 Image 并推送到 Registry。

---

### Definition of Done (完工标准)
当你能用这个工具，在 **60秒内**，把自己随手画的一个圆圈，变成一个包含 256(AI去底), 48(LANCZOS), 32(NEAREST), 16(手工修正填白) 的完美 `.ico` 文件，并成功应用到你的 `collector.exe` 上时，本项目宣告完成。
