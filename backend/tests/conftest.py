from __future__ import annotations

from typing import Generator

import pytest
from fastapi.testclient import TestClient

from app.api.deps import ServiceContainer
from app.main import app


@pytest.fixture
def mock_services() -> ServiceContainer:
    """Create a mock ServiceContainer for API tests."""

    services = ServiceContainer()
    # Attributes used in tests will be patched per-test.
    return services


@pytest.fixture
def client(mock_services: ServiceContainer) -> Generator[TestClient, None, None]:
    """FastAPI test client with mocked services container."""

    app.state.services = mock_services
    with TestClient(app) as test_client:
        yield test_client

