# 0005. Local API is the real handler on Node, not SAM

- Status: Accepted
- Date: 2026-10-16

## Context
`just dev` started SAM from a `sam/` folder and scripts that were never
published, so a fresh clone couldn't run the API locally.

## Decision
`backend/dev-server.ts` wraps the real Lambda handler in a small Node HTTP
server on :3001 and reloads on change (`tsx watch`). Vite proxies `/api` to
it. Settings come from `backend/.env.local` (copy `.env.example`).

## Consequences
No Docker or SAM needed. It talks to a real S3 bucket with your credentials,
so point it at a dev bucket, never the one a family plays on.
