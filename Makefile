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
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

.PHONY: dev-build
dev-build: ## Build and start development environment
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

.PHONY: dev-backend
dev-backend: ## Start only backend in development mode
	cd backend && npm run dev

.PHONY: dev-frontend
dev-frontend: ## Start only frontend in development mode
	cd frontend && npm run dev

.PHONY: build
build: ## Build production Docker images
	docker-compose build

.PHONY: up
up: ## Start production environment
	docker-compose up -d

.PHONY: down
down: ## Stop all containers
	docker-compose down

.PHONY: clean
clean: ## Clean all containers, volumes, and images
	docker-compose down -v --rmi all

.PHONY: logs
logs: ## Show logs from all containers
	docker-compose logs -f

.PHONY: logs-backend
logs-backend: ## Show backend logs
	docker-compose logs -f backend

.PHONY: logs-frontend
logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

.PHONY: test
test: ## Run all tests
	cd backend && npm test
	cd frontend && npm test

.PHONY: lint
lint: ## Run linters
	cd backend && npm run lint
	cd frontend && npm run lint

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	cd backend && npm run typecheck
	cd frontend && npm run typecheck

.PHONY: db-migrate
db-migrate: ## Run database migrations
	docker-compose exec backend npm run migrate

.PHONY: db-seed
db-seed: ## Seed the database
	docker-compose exec backend npm run seed

.PHONY: shell-backend
shell-backend: ## Open shell in backend container
	docker-compose exec backend sh

.PHONY: shell-frontend
shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

.PHONY: shell-postgres
shell-postgres: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d censuschat

.PHONY: shell-redis
shell-redis: ## Open Redis CLI
	docker-compose exec redis redis-cli