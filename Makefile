# CensusChat Makefile

.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install all dependencies
	cd backend && npm install
	cd frontend && npm install

.PHONY: dev
dev: ## Start development environment with Docker Compose
	@if [ ! -f .env ]; then echo "⚠️  .env file not found. Run 'make setup-env' first"; exit 1; fi
	docker compose up

.PHONY: dev-build
dev-build: ## Build and start development environment
	@if [ ! -f .env ]; then echo "⚠️  .env file not found. Run 'make setup-env' first"; exit 1; fi
	docker compose up --build

.PHONY: dev-backend
dev-backend: ## Start only backend in development mode
	cd backend && npm run dev

.PHONY: dev-frontend
dev-frontend: ## Start only frontend in development mode
	cd frontend && npm run dev

.PHONY: build
build: ## Build production Docker images
	docker compose build

.PHONY: up
up: ## Start production environment
	docker compose up -d

.PHONY: down
down: ## Stop all containers
	docker compose down

.PHONY: clean
clean: ## Clean all containers, volumes, and images
	docker compose down -v --rmi all

.PHONY: logs
logs: ## Show logs from all containers
	docker compose logs -f

.PHONY: logs-backend
logs-backend: ## Show backend logs
	docker compose logs -f backend

.PHONY: logs-frontend
logs-frontend: ## Show frontend logs
	docker compose logs -f frontend

.PHONY: test
test: ## Run backend unit tests (frontend has no unit suite; see test-e2e)
	cd backend && npm test

.PHONY: test-e2e
test-e2e: ## Run frontend Playwright end-to-end tests (backend API mocked)
	cd frontend && npm run test:e2e

.PHONY: lint
lint: ## Run linters
	cd backend && npm run lint
	cd frontend && npm run lint

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	cd backend && npm run typecheck
	cd frontend && npm run typecheck

.PHONY: load-data
load-data: ## Load Census data into DuckDB (long-running; needs CENSUS_API_KEY)
	cd backend && ./scripts/setup-database.sh

.PHONY: shell-backend
shell-backend: ## Open shell in backend container
	docker compose exec backend sh

.PHONY: shell-frontend
shell-frontend: ## Open shell in frontend container
	docker compose exec frontend sh

.PHONY: shell-postgres
shell-postgres: ## Open PostgreSQL shell
	docker compose exec postgres psql -U postgres -d censuschat

.PHONY: shell-redis
shell-redis: ## Open Redis CLI
	docker compose exec redis redis-cli

.PHONY: security-check
security-check: ## Run security checks (npm audit)
	cd backend && npm audit
	cd frontend && npm audit

.PHONY: setup-env
setup-env: ## Copy env.example to .env with security warnings
	@if [ -f .env ]; then echo "⚠️  .env already exists. Remove it first if you want to recreate"; exit 1; fi
	@cp env.example .env
	@echo "✅ Created .env file from env.example"
	@echo "🔐 IMPORTANT: Update all passwords and secrets in .env before running!"
	@echo "🔑 Generate secure JWT secret: openssl rand -base64 64"
	@echo "🔒 Generate secure passwords: openssl rand -base64 32"