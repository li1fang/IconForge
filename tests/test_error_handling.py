from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def _register_test_route() -> None:
    path = "/__test_error"

    if any(getattr(route, "path", None) == path for route in app.router.routes):
        return

    async def boom():
        raise RuntimeError("forced failure")

    app.add_api_route(path, boom, methods=["GET"], include_in_schema=False)


_register_test_route()


def test_problem_details_on_unhandled_error():
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/__test_error")

    assert response.status_code == 500
    payload = response.json()
    assert payload["title"] == "Internal Server Error"
    assert payload["status"] == 500
    assert payload["detail"]
    assert payload["request_id"]
    assert response.headers.get("X-Request-ID") == payload["request_id"]
