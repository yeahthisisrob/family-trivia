# Family Trivia task runner.
#
# Every recipe goes through `mise exec` so the node/pnpm pinned in mise.toml
# are used even when mise isn't activated in your shell.
#
# Start here:
#   just install   one-time setup (toolchain, dependencies, git hooks)
#   just dev       run the API and the web app locally
#   just check     everything CI runs; do this before opening a PR

x := "mise exec --"

# Show available recipes
default:
    @just --list --unsorted

# ── setup ──────────────────────────────────────────────────────────────────

# One-time setup: toolchain, dependencies, git hooks
[group('setup')]
install:
    mise install
    {{x}} pnpm install
    {{x}} lefthook install
    @echo "Ready. 'just dev' to run it, 'just check' before a PR."

# Remove build output (keeps node_modules)
[group('setup')]
clean:
    rm -rf backend/dist frontend/dist frontend/storybook-static infra/cdk.out

# ── dev ────────────────────────────────────────────────────────────────────

# API (:3001) and web app (:3000) together
[group('dev')]
dev:
    {{x}} pnpm exec concurrently --names 'API,WEB' --prefix-colors 'blue,green' --kill-others \
        "just api" "just web"

# API only: the real Lambda handler on Node (backend/.env.local)
[group('dev')]
api:
    {{x}} pnpm --filter @family-trivia/api run dev

# Web app only (Vite)
[group('dev')]
web:
    {{x}} pnpm --filter @family-trivia/web run dev

# Storybook (:6006)
[group('dev')]
storybook:
    {{x}} pnpm --filter @family-trivia/web run storybook

# ── check ──────────────────────────────────────────────────────────────────

# Everything CI runs
[group('check')]
check: lint leaks layout deadcode typecheck test screenshots-current
    @echo "All checks passed."

# The layout rules (0008): no slice imports another, layers import only below
[group('check')]
layout:
    {{x}} node scripts/check-architecture.mjs

# Format and lint the whole repo (Biome)
[group('check')]
lint:
    {{x}} pnpm exec biome check .

# Apply every safe fix Biome can make
[group('check')]
fix:
    {{x}} pnpm exec biome check --write .

# No real family details in tracked files (docs/decisions/0006)
[group('check')]
leaks:
    {{x}} node scripts/leak-guard.mjs

# Unused files and dependencies
[group('check')]
deadcode:
    {{x}} pnpm exec knip --no-progress

# The README's pictures match their stories (retake: just screenshots)
[group('check')]
screenshots-current:
    {{x}} node scripts/check-screenshots.mjs

# Typecheck every package
[group('check')]
typecheck:
    {{x}} pnpm -r run typecheck

# Unit tests, every package
[group('check')]
test *args:
    {{x}} pnpm -r run test {{args}}

# Everything GitHub checks on a pull request, in the same order, before
# pushing: lint, leaks, dead code, types, tests, contract (regenerated: commit
# what changes), screenshots, build, then the stories with CI's two workers
# and the dark-mode audit
[group('check')]
ci:
    {{x}} pnpm exec biome ci .
    {{x}} node scripts/leak-guard.mjs
    {{x}} node scripts/check-architecture.mjs
    {{x}} pnpm exec knip --no-progress
    {{x}} pnpm -r run typecheck
    {{x}} pnpm -r run test
    {{x}} pnpm --filter @family-trivia/shared run contract
    {{x}} node scripts/game-folders.mjs --check
    {{x}} node scripts/check-screenshots.mjs
    {{x}} pnpm -r run build
    {{x}} pnpm --filter @family-trivia/web exec vitest run --project=storybook --maxWorkers=2
    {{x}} pnpm --filter @family-trivia/web run build-storybook
    {{x}} node scripts/dark-audit.mjs
    {{x}} node scripts/check-screenshots.mjs --stories

# Storybook interaction tests in Chromium
[group('check')]
test-stories:
    {{x}} pnpm --filter @family-trivia/web run storybook:test

# Render every story in dark mode and fail on light backgrounds
[group('check')]
dark-audit:
    {{x}} pnpm --filter @family-trivia/web run build-storybook
    {{x}} node scripts/dark-audit.mjs

# ── build ──────────────────────────────────────────────────────────────────

# Production build of every package
[group('build')]
build:
    {{x}} pnpm -r run build

# Lint the OpenAPI schema and regenerate shared/generated (and the games' server folder list)
[group('build')]
contract:
    {{x}} pnpm --filter @family-trivia/shared run contract
    {{x}} node scripts/game-folders.mjs

# Retake the README pictures from their stories (docs/screenshots/shots.json);
# `just screenshots family-map` retakes the ones whose file starts with that
[group('build')]
screenshots *only:
    {{x}} pnpm --filter @family-trivia/web run build-storybook
    {{x}} node scripts/screenshots.mjs {{only}}

# ── infra ──────────────────────────────────────────────────────────────────

# CloudFormation diff
[group('infra')]
diff: build
    {{x}} pnpm --filter @family-trivia/infra run diff

# Deploy. Runs every check first: never deploy something unverified.
[group('infra')]
deploy: check build
    {{x}} pnpm --filter @family-trivia/infra run deploy
