# Claude Code Instructions

## Principles
- DRY — don't repeat yourself
- VSA / FSD — vertical slice architecture, feature-sliced design
- Storybook — every new UI component gets stories
- OpenAPI — typed API contracts between frontend and backend
- Best practices — follow existing patterns in the codebase

## Build & Check
```bash
# Frontend
cd frontend && npm run lint -- --fix && npm run typecheck && npm run build

# Backend
cd cdk/lambda && npm run build

# Shared types (build first — frontend + backend depend on it)
cd shared && npm run build

# Storybook
cd frontend && npm run storybook
```

## Stack
- Frontend: React + TypeScript + MUI + Vite
- Backend: AWS Lambda (Node.js/TS) behind API Gateway
- Infra: AWS CDK
- AI: Amazon Bedrock (Claude models)
- Storage: S3
- Shared types: `shared/` package (`@family-trivia/shared`)

## Key Patterns
- Use LSP for refactors (findReferences, not grep)
- Use the logger service, never console.log
- Game modes register in `shared/src/game-modes.ts`
- Config/secrets in `cdk/cdk.config.json` (gitignored)
- MSW for Storybook API mocking
