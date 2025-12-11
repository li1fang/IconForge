# IconForge Development Guide for AI Contributors

Welcome, fellow agent. Follow these rules when working in this repository.

## Product Context
- IconForge is a FastAPI + React tool for crafting high-quality multi-size ICO files that mix AI preprocessing with manual 16x16 pixel editing.
- The expected delivery sequence is defined in `DEVELOPMENT_PLAN.md`. Execute work in that order unless a task explicitly targets a later milestone.

## Engineering Standards
- **Backend:** Python 3.11+, FastAPI, Pillow/NumPy/rembg. Keep code modular under `app/` with clear separation of API routers, services, and utilities. Favor type hints and `pydantic` models.
- **Frontend:** React 18 with TypeScript, Vite, Tailwind + ShadcnUI. Prefer canvas rendering for pixel editing; avoid DOM grids for performance.
- **Testing:** Provide unit tests for algorithms and integration tests for API flows. Frontend tests should use Vitest + React Testing Library. Align test cases with acceptance criteria in the development plan.
- **Error handling:** Use structured JSON error responses on the backend and user-friendly toasts or inline messages on the frontend.
- **Performance:** Cache expensive image operations and preload rembg models where possible. Keep canvas interactions 60fps-smooth.

## CI & Tooling
- Introduce CI progressively: start with lint/type checks, then tests, then build artifacts. Use GitHub Actions with caching for pip/npm and ensure Docker builds stay reproducible.
- Enforce formatting (`black`, `ruff`, `mypy` for backend; `eslint`, `prettier`, `tsc` for frontend). Update workflows when new tooling is added.

## Collaboration & Documentation
- Update README or create focused docs when adding major workflows or APIs. Keep examples concise and runnable.
- When adding endpoints, document request/response shapes and any feature flags.
- Preserve user-facing language bilingual tone (English + Chinese) where present.

## Delivery Expectations
- Do not ship partial features; each PR should close its loop (API, tests, docs where relevant).
- Avoid heavyweight dependencies unless justified by image quality or performance wins.
- Prefer clear commit messages; group logically related changes.

Follow these rules to keep IconForge consistent, reliable, and production-ready.
