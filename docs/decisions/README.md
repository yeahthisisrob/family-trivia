# Decisions

Short records of why the project is the way it is. One page each, written
when the decision is made, so the reason survives the people who made it.

- Add one when a choice would surprise a newcomer, is costly to undo, or
  closes off an alternative someone will propose again.
- Copy `0000-template.md`, take the next number, keep it under a page.
- Records aren't edited after the fact. If a decision changes, write a new
  one that supersedes it and mark the old one `Superseded by NNNN`.

| # | Decision | Status |
|---|---|---|
| [0001](0001-why-this-exists.md) | Why this exists: connection as families age | Accepted |
| [0002](0002-toolchain.md) | mise + pnpm workspace + one strict TypeScript base | Accepted |
| [0003](0003-biome.md) | Biome for format and lint, with debt counted | Accepted |
| [0004](0004-repo-layout.md) | `frontend/`, `backend/`, `infra/`, `shared/`; shared ships source | Accepted |
| [0005](0005-local-dev-server.md) | Local API is the real handler on Node, not SAM | Accepted |
| [0006](0006-privacy-by-default.md) | Privacy by default: no real family in the repo | Accepted |
| [0007](0007-identity-from-the-token.md) | Identity comes from the token, never the request | Accepted |
| [0008](0008-engineering-principles.md) | Engineering principles: Clean Code, DRY, FSD, VSA, OpenAPI-first | Accepted |
| [0009](0009-people-and-relationships.md) | People and relationships that change over time | Accepted |
| [0010](0010-seasons-drive-what-is-asked.md) | Seasons decide what is asked, and carry letters | Accepted |
| [0011](0011-light-dark-and-the-night-surface.md) | Light and dark, one theme per scheme, and a night surface for graphs | Accepted |
| [0012](0012-themes-and-tokens.md) | Themes are data, and every color is a token | Accepted |
| [0013](0013-settings-and-ai-models.md) | Settings from definitions, and an AI model per task with real costs | Accepted |
| [0014](0014-backups.md) | Backups: versioned data, checked copies, nightly only when asked | Accepted |
