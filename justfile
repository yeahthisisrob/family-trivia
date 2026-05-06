# Family Trivia - Development Commands

# List available commands
default:
    @just --list

# Full dev startup: check everything, then start
dev: check quick

# Quick start: clean + build + start (skip checks)
quick: clean build-dev start

# Start all development services concurrently
start:
    npx concurrently \
        --names "SAM,FRONTEND,WATCH,TSC" \
        --prefix-colors "blue,green,yellow,cyan" \
        --kill-others \
        "just sam" \
        "just frontend" \
        "just watch" \
        "just typecheck-watch"

# Start SAM local API on port 3001
sam:
    cd sam && sam local start-api \
        --port 3001 \
        --env-vars env.json \
        --warm-containers EAGER \
        --host 0.0.0.0

# Start frontend dev server (swaps config for local)
frontend:
    ./scripts/dev-config.sh

# Watch and rebuild Lambda on file changes
watch:
    cd cdk/lambda && npx nodemon

# Watch TypeScript type checking
typecheck-watch:
    cd cdk/lambda && npx tsc --watch --noEmit

# Build Lambda for development (fast, no minify)
build-dev:
    cd cdk/lambda && node build.js dev

# Build Lambda for production
build-prod:
    cd cdk/lambda && node build.js

# Run all checks (lint + typecheck + test)
check:
    @echo "=== Frontend checks ==="
    cd frontend && npm run lint && npm run typecheck
    @echo ""
    @echo "=== Lambda checks ==="
    cd cdk/lambda && npx tsc --noEmit && npm test

# Build everything for production
build: build-prod
    cd frontend && npm run build

# Deploy to AWS
deploy: build
    cd cdk && npm run cdk:deploy

# Storybook dev server (http://localhost:6006)
storybook:
    cd frontend && npm run storybook

# Run all Storybook story tests headlessly
storybook-test:
    cd frontend && npm run storybook:test

# Watch Storybook story tests
storybook-test-watch:
    cd frontend && npm run storybook:test:watch

# Frontend unit tests
test-unit:
    cd frontend && npm run test:unit

# Watch frontend unit tests
test-unit-watch:
    cd frontend && npm run test:unit:watch

# Run ALL tests: backend Jest + frontend unit + Storybook interaction tests
test:
    @echo "=== Backend tests ==="
    cd cdk/lambda && npm test
    @echo ""
    @echo "=== Frontend unit tests ==="
    cd frontend && npm run test:unit
    @echo ""
    @echo "=== Storybook interaction tests ==="
    cd frontend && npm run storybook:test

# Clean up SAM processes and artifacts
clean:
    ./scripts/kill-sam.sh
    rm -rf .aws-sam

# Install all dependencies
install:
    cd cdk/lambda && npm ci
    cd frontend && npm ci
    cd cdk && npm ci
