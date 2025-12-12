.PHONY: test-backend test-frontend test-all

# Run Python backend test suite
test-backend:
python -m pytest

# Run frontend unit tests with Vitest
test-frontend:
npm --prefix frontend test -- run

# Run all tests for Phase 5 CI stage
test-all: test-backend test-frontend
