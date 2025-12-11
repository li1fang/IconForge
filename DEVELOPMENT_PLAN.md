# IconForge Formal Development Plan

This plan sequences backend foundation through frontend delivery and production rollout. Each phase targets production-ready completeness with continuous integration introduced progressively.

## Phase 1 – Backend Foundations (Image Pipeline)
1. **Project scaffold**
   - Initialize FastAPI app with modular structure: `app/main.py`, `app/api`, `app/services`, `app/models`.
   - Establish configuration via `pydantic` settings for storage paths, model cache, and limits (e.g., max upload size).
   - Set up Docker base image (Python 3.11 slim + build tools) and prefetch rembg models during build or first start.
2. **File ingestion & validation**
   - Implement `POST /upload` accepting `multipart/form-data` images; validate MIME/extension, enforce size cap (5–10 MB), and reject non-image input with structured errors.
   - Store uploads in temp storage (e.g., `tempfile` or configured volume) with UUID references; include cleanup job for expired assets.
3. **Auto-Magic processing**
   - Integrate `rembg` for background removal; handle failure fallback to original if disabled by flag.
   - Implement smart crop using NumPy to detect alpha bounding box, recenter, and add 10% padding. Provide deterministic padding floor/ceiling rules.
   - Expose `GET /material/{id}` returning processed 256px PNG and metadata (dimensions, crop box, padding used).
4. **Resampling options**
   - Provide resizing service producing 48x48 and 32x32 variants via Pillow with algorithms `LANCZOS`, `NEAREST`, `BILINEAR`.
   - API: `GET /preview/{id}?algo=` returning mid-res previews; cache results keyed by source+algo to avoid recomputation.
5. **ICO minting**
   - Implement `pack_ico` utility accepting byte streams for 256/48/32/16 sizes; validate all sizes present, convert palettes as needed.
   - Endpoint `POST /forge` consuming `source_id`, `mid_algo`, and uploaded 16px hand-drawn PNG; returns downloadable ICO.
6. **Observability & safeguards**
   - Structured logging with request IDs; metrics for processing time and failure rates.
   - Centralized error handling with JSON problem details; rate limiting or auth stub ready for future enablement.
7. **Testing**
   - Unit tests for smart crop, resizing output characteristics, and ICO pack integrity (e.g., verify icon directory entries).
   - Integration tests exercising upload→process→forge flow using in-memory files.

## Phase 2 – Frontend Pixel Workbench
1. **App scaffold**
   - Create Vite + React 18 project with TypeScript, Tailwind, and ShadcnUI setup; define base layout and routing (single-page).
   - Configure API client wrapper with base URL from environment.
2. **16x16 canvas engine**
   - Implement canvas-based grid renderer for 16x16 color matrix; draw gridlines and support zoom scaling for clarity.
   - Interaction: click/drag painting, eraser mode, debounced state commits to keep brush strokes smooth.
3. **Split-view editing**
   - Left reference canvas renders backend 16px auto-scaled preview; add color picker to set active brush color.
   - Right preview shows live 1:1 result without grid; include quick-fill (clear, fill-white/black) controls.
4. **Upload & preview flow**
   - Drag-and-drop uploader; call `/upload` then fetch processed 256px and mid-res previews.
   - Algorithm selector toggles between preview responses; show loading skeletons and error toasts.
5. **Forge & download**
   - Convert 16x16 matrix to PNG blob client-side; submit to `/forge` with chosen algorithm and source id; trigger download.
6. **State management & persistence**
   - Centralize state (e.g., Zustand or Redux Toolkit) for source metadata, previews, and canvas edits; persist session state locally for refresh resilience.
7. **UX polish**
   - Adaptive dark mode, accessible keyboard shortcuts (switch tools, undo/redo), cursor icons for brush/eyedropper, and responsive layout.

## Phase 3 – Integration & Reliability
1. **End-to-end stitching**
   - Contract tests between frontend client and FastAPI endpoints using mock server definitions (e.g., OpenAPI schema validation).
   - Implement feature flags for AI removal fallback and size limits surfaced in UI.
2. **Error handling & edge cases**
   - Graceful UI flows for invalid uploads, oversized files, and rembg failures (offer "use original" option).
   - Backend validation on all inputs; sanitize filenames and ensure temp cleanup.
3. **Performance & caching**
   - Cache processed assets and previews; apply CDN headers for static frontend assets in production.
   - Preload rembg model at service start to reduce first-request latency; consider worker pool for CPU-bound tasks.

## Phase 4 – Deployment & Operations
1. **Containerization**
   - Multi-stage Dockerfiles for backend and frontend; ensure rembg model caching layer to avoid repeated downloads.
   - Docker Compose for local orchestration with mounted volumes for temp storage and model cache.
2. **Environments**
   - Define environment configs for dev/staging/prod (env files or Helm values if Kubernetes later).
   - Add runtime configuration for external storage or registry endpoints.
3. **Monitoring & security**
   - Health/readiness probes; rate limiting middleware options; CORS configuration for frontend domain.
   - Basic auth or token guard for non-public deployments; dependency scanning in CI.

## Phase 5 – Continuous Integration Roadmap
1. **CI Stage 1 (Lint & Type)**
   - GitHub Actions workflow running Python `ruff`/`black`/`mypy` and frontend `eslint`/`prettier`/`tsc` on pull requests.
2. **CI Stage 2 (Tests)**
   - Add FastAPI unit/integration tests and React component tests (Vitest/React Testing Library); execute in workflow with caching for pip/npm.
3. **CI Stage 3 (Artifacts)**
   - Build backend wheel/container and frontend production bundle; upload as workflow artifacts; enforce Docker build passes.
4. **CI Stage 4 (Delivery)**
   - Optional CD job: push Docker images to registry on main branch; gate with manual approval; publish OpenAPI spec artifact.

## Milestones & Acceptance
- Phase completion requires passing automated checks introduced up to that phase and delivering documented API/UX behavior.
- Achieve production readiness when a user can upload, tweak 16px details, and download a valid multi-size ICO within one minute consistently.
