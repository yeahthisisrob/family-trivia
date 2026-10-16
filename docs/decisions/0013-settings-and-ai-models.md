# 0013. Settings from definitions, and an AI model per task with real costs

- Status: Accepted
- Date: 2026-10-16

## Context
Claude Sonnet 4 reached end of life on Bedrock and every AI feature failed,
because model ids were constants spread across the code. Families also had
no way to see what the AI costs, turn optional features off, or choose a
cheaper or better model for a particular job.

## Decision
- **Settings are definitions** (`shared/src/settings.ts`): key, type, label,
  help, default, optional env var. The server resolves each as saved value
  (`config/settings.json`), then environment, then default, and reports the
  source; Admin › Settings renders from the definitions, with a draft and a
  save bar, one section per URL (`?section=`).
- **AI by task** (`shared/src/ai.ts`): trivia, fact checks, family questions,
  spotlights, roasts, Feud, weekly summaries, game opponents. Each has a
  writer or fast default and a usage profile. `modelFor(task)` resolves the
  family's choice; the router loads choices once per request.
- **Real cost**: every Bedrock call is tagged with its task; the response's
  token counts are tallied per task and model in `usage/YYYY-MM.json`.
  Settings shows actual spend this month next to an estimate for the
  family's size, at list prices dated in the catalog.
- **Availability**: a one-token ping per catalog model (cached a day) shows
  which models this AWS account can call and why not (retired, not enabled).
- IAM allows any Anthropic model or profile, so changing models never needs
  an infra change.

## Consequences
Retiring a model is a settings change. New settings and AI tasks are one
entry each. Prices in the catalog need a refresh when AWS changes them.
