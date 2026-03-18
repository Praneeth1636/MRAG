.PHONY: setup dev dev-backend dev-frontend test test-backend test-frontend eval build up down lint format clean logs help

GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Pull Ollama models and install deps
	@echo "$(YELLOW)Setting up MultiModal RAG...$(NC)"
	docker compose up -d ollama
	@sleep 5
	docker exec rag-ollama ollama pull llama3 || true
	docker exec rag-ollama ollama pull mistral || true
	docker exec rag-ollama ollama pull llava || true
	cd backend && pip install -e ".[dev]"
	cd frontend && npm ci

dev: ## Start all services in dev mode (watchers)
	docker compose -f docker-compose.yml -f docker-compose.override.yml up --build

dev-backend: ## Start only backend + Ollama locally
	docker compose up -d ollama
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend: ## Start only frontend dev server
	cd frontend && npm run dev

test: ## Run backend and frontend tests
	cd backend && python -m pytest tests/ -v --tb=short
	cd frontend && npm run test

test-backend: ## Run backend tests only
	cd backend && python -m pytest tests/ -v --tb=short

test-frontend: ## Run frontend tests only
	cd frontend && npm run test

eval: ## Run evaluation suite (requires backend + data)
	@echo "$(YELLOW)Run POST /api/v1/evaluate from the UI or API client for full eval.$(NC)"

build: ## Build Docker images
	docker compose build

up: ## Start services in background
	docker compose up -d

down: ## Stop services
	docker compose down

lint: ## Run linters
	cd backend && ruff check app/ tests/
	cd backend && mypy app/ --ignore-missing-imports
	cd frontend && npm run lint

format: ## Auto-format code
	cd backend && ruff format app/ tests/
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"

clean: ## Clean containers, volumes, and artifacts
	docker compose down -v --remove-orphans
	rm -rf backend/.pytest_cache backend/__pycache__
	rm -rf frontend/node_modules frontend/dist

logs: ## Tail Docker logs
	docker compose logs -f

