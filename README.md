# Family Trivia

[![Checks](https://github.com/yeahthisisrob/family-trivia/actions/workflows/checks.yml/badge.svg)](https://github.com/yeahthisisrob/family-trivia/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> _"Assume everyone is trying their best, and be kind to each other."_
> — Christina Baker Kline

A daily question for the whole family, and a place that keeps what everyone answers. Each morning everyone gets one question about themselves and one trivia question; the answers become the family's timeline, each person's story, a map of what the family talks about, and, at the end of a season, a book you can read in the app or send to a printer. Games earn trivia multipliers, an arcade keeps high scores, and a Remembering page holds the words of the people the family has lost. One CDK command deploys it into your own AWS account; the family's words never leave it.

![The family's home: who we are, today's spotlight, and what we share](docs/screenshots/family-home.png)

---

## In memory of…

<div align="center">

**Elizabeth "Betty" D'Hondt**

_1946 — 2026_

_She cared deeply, for every creature, for every story,_
_with a heart as big as the elephants she loved._

</div>

This project started as a way to stay connected with my mom. After retirement, as her physical health declined, I watched depression slowly take more of her light. I'd sit with her, listen, try to be there — sometimes love looks like a hard balance between helping, giving space, and simply showing up. Family Trivia gave her something to do every morning, gave us something to talk about, and helped us capture more memories of our family, together.

May is **#MentalHealthMonth** 💚. Mental health struggles can be quiet — isolation, loss of identity, feeling like a burden when you're deeply loved. Check in, sit awhile, and make space for the conversations that matter. Let's have more good days, together.

Resources: [mhanational.org/may](https://mhanational.org/may)

**#WordsToRememberForNana**

---

## What it does

### A question a day

Everyone gets the same question about themselves each day ("What's a small everyday moment that always makes you smile?") and a trivia question in a category they pick. Missed days can be caught up. A season decides what's asked: general trivia, trivia about the family itself, both, or only the daily questions. Answers land on a shared timeline with comments, reactions and notifications, and the home page brings back a memory a day from the family's own pages.

|  |  |  |
|---|---|---|
| ![Today's question, with a microphone hint for people who'd rather talk](docs/screenshots/daily-fact.png) | ![What do you want to play: special challenges and categories](docs/screenshots/trivia.png) | ![On this day, two years ago: everyone's answers to the same question](docs/screenshots/daily-memory.png) |
| **Today's question.** Type it or say it. | **Trivia.** Pick a category or a special challenge. | **A memory a day.** What everyone said, on this day. |

### Games that earn a multiplier

Each game mode can be played once a week and multiplies that day's trivia score. The same games, plus Snake, Crossword, Blackjack and Roulette, run without limits in the Arcade, with high-score boards. The leaderboard ranks people and teams by season.

|  |  |  |  |
|---|---|---|---|
| ![Casino Rush: triple or nothing](docs/screenshots/casino-rush.png) | ![Slot Machine](docs/screenshots/slot-machine.png) | ![Curling](docs/screenshots/curling.png) | ![Tetris](docs/screenshots/tetris.png) |
| **Casino Rush.** 3 questions, 60s each, triple or bust. | **Slot Machine.** Spin for a category and a multiplier. | **Curling.** Land on the button. | **Tetris.** 60 seconds to clear lines. |

![Top players: the season's podium](docs/screenshots/podium.png)

### Everyone's story, told by the family

The Family tab opens on who the family is, in the family's own numbers and words, written by the AI from the answers and edited by an admin. A spotlight introduces one person a day (or roasts them, gently). Everyone has a profile that reads as a story: what they've said lately, what the family has said about them, and the questions still waiting for them, which they can fill in flash-card style.

|  |  |
|---|---|
| ![A profile told as a story](docs/screenshots/profile.png) | ![Spotlight: one person a day](docs/screenshots/spotlight.png) |
| **A profile.** What you've said lately, and how much of your story is filled in. | **Spotlight.** One person a day, from their answers. |

![Fill in your story: one more for the family's story](docs/screenshots/fill-in.png)

### Our map, and the family as a night sky

Our map lays out what the family talks about as territories (places, food, things we do), with each person pulled toward the topics they share. The night sky draws the family itself: who's tied to whom, households, and who answered alike, with the answers as evidence.

![Our map: what the family talks about, as territories](docs/screenshots/family-map.png)

![The family as a night sky: ties, partners and who answered alike](docs/screenshots/family-graph.png)

### Look back, and keep it as a book

When a season ends, Look back shows the questions most of the family answered and the answers people loved. Any season, and anyone's own words, can become a book: just the answers, or written warm or playful, with a foreword and chapters by theme. Books are fitted to their pages, open in the app as two-page spreads, download as page images, and come with a wraparound cover ready for a print-on-demand press. Every version is kept.

![Look back on a season](docs/screenshots/look-back.png)

![A season as a book: how it's written, and every version kept](docs/screenshots/book-dialog.png)

### Remembering

The people the family has lost keep a page: their years, the last things they told the family, and a book of their words. Families change, so people can be active, paused, or remembered, and relationships change over time.

![Remembering: the last things they told us](docs/screenshots/remembering.png)

### Run by the family, in its own account

Admins set up people, households and relationships, start seasons, and choose features. Settings picks the AI model for each task and shows what it really costs, from the tokens each call used. Backups are made from Settings and checked, and the whole family's archive downloads as one folder per person.

![Settings: an AI model per task, with real costs](docs/screenshots/settings.png)

_Every picture here is taken from a Storybook story with made-up people, listed in [`docs/screenshots/shots.json`](docs/screenshots/shots.json). `just screenshots` retakes them, and `just check` fails when a pictured story has changed since its picture was taken._

## Architecture

```
CloudFront (CDN)
├── /*     → S3 (React frontend)
└── /api/* → API Gateway → Lambda (Node.js/TS)
                              ├── S3 (data storage: JSON, no database)
                              └── Bedrock (Claude)
```

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + MUI + Vite on a token-based design system (light and dark, themes as data), organised by [Feature-Sliced Design](https://feature-sliced.design/), every component in Storybook |
| Backend | One Node.js Lambda (TypeScript), organised by Vertical Slice Architecture |
| Contract | OpenAPI first: `shared/schemas/api.openapi.yaml`, types generated into `@family-trivia/shared` |
| AI | Amazon Bedrock, a Claude model per task (writing, fact checks, spotlights, books), chosen in Settings |
| Books | pdfkit with EB Garamond, fitted to a 6 × 9 inch page; read in the app with pdf.js |
| Storage | S3 JSON files, backed up to a second bucket |
| Infrastructure | AWS CDK (TypeScript) |
| Tooling | mise (pinned toolchain), pnpm workspace, just, Biome, Vitest, lefthook, gitleaks, release-please |

## Prerequisites

- **AWS account** with Bedrock access (Claude models enabled in `us-east-1`)
- **[mise](https://mise.jdx.dev)**, which installs the pinned Node, pnpm and just for you
- **Google Cloud Console** project with an OAuth 2.0 client ID
- **Custom domain** with an ACM certificate in `us-east-1`

## Quick start

```bash
# 1. Clone and install (toolchain, dependencies, git hooks)
git clone https://github.com/yeahthisisrob/family-trivia.git
cd family-trivia
just install

# 2. Configure (see Configuration below)
cp infra/cdk.context.example.json infra/cdk.config.json
cp frontend/public/config.example.json frontend/public/config.local.json

# 3. Deploy (runs every check, builds, then deploys)
just deploy

# 4. Bootstrap the first admin (one-time, see "Bootstrap your admin" below).
#    Then open the CloudFront URL CDK printed and sign in with Google
#    + your passphrase. The first-run wizard walks you through creating
#    your family, adding members, and starting a season.
```

## Bootstrap your admin

CDK provisions the infrastructure but does not seed any users. After your first `cdk deploy`, drop one admin record into the data bucket so you can sign in:

```bash
# Replace BUCKET with the DataBucket name from `cdk deploy`'s output.
# Pick any short userId (used as your display id) and a passphrase
# you'll type once on first login.
cat > /tmp/users.json <<'JSON'
{
  "version": "1.0",
  "lastUpdated": "2026-05-07T00:00:00Z",
  "users": {
    "rob": { "group": "parents", "color": "#4CAF50", "passphrase": "happy-tiger", "isAdmin": true }
  }
}
JSON
aws s3 cp /tmp/users.json s3://BUCKET/config/users.json
```

Open the site, **Sign in with Google**, then enter your passphrase when prompted. You're now linked, admin, and the SetupWizard runs to build out the rest of your family.

## Inviting family members

Once the admin runs the SetupWizard, every new member gets a short auto-generated passphrase (e.g. `clever-river`). The flow for them is:

1. Admin shares each person's passphrase with them privately.
2. Family member opens the site → **Sign in with Google**.
3. First time only: they're prompted for their passphrase. The backend matches it to their family-member slot and links their Google account.
4. Every subsequent visit is plain Google sign-in — no passphrase needed.

Passphrases are **one-time identification, not ongoing auth** — they exist so people don't need to share an inbox or pre-register Google emails.

## Configuration

`infra/cdk.config.json` (gitignored; copy from `cdk.context.example.json`):

| Key | Description |
|-----|-------------|
| `googleClientId` | Google OAuth 2.0 client ID |
| `jwtSecret` | Random hex string — generate with `openssl rand -hex 32` |
| `certificateArn` | ACM certificate ARN for custom domain (optional) |
| `customDomain` | Your domain, e.g. `trivia.example.com` (optional) |
| `bedrockModelId` | Claude model for writing (default Sonnet 4.5). Newer models need access enabled in the Bedrock console |
| `bedrockFastModelId` | Claude model for fast checks and roasts (default Haiku 4.5) |

`frontend/public/config.local.json` (gitignored — copy from `config.example.json`): runtime URL config for the React app.

## Development

```bash
just dev          # API on :3001 + web app on :3000 (needs backend/.env.local)
just storybook    # component playground with MSW API mocks
just check        # what CI runs: lint, privacy, dead code, typecheck, tests, screenshots
just fix          # apply Biome's safe fixes
just contract     # after editing the OpenAPI schema
just screenshots  # retake the README pictures from their stories
```

`just dev` runs the real Lambda handler on Node against a bucket you choose:
copy `backend/.env.example` to `backend/.env.local` and point it at a dev
bucket, never the one your family plays on.

## Project structure

```
frontend/               React app (Vite, MUI, Storybook)
backend/                The API: one Lambda
  routes/               API handlers
  services/             Business logic
infra/                  AWS CDK stack
shared/                 Types and the OpenAPI contract
docs/decisions/         Why things are the way they are (start with 0001 and 0008)
scripts/                Leak guard, screenshots and their check
```

## Privacy

Family Trivia runs on a family's own names, places and memories, and keeps
them in that family's own AWS account. The repo never contains a real family:
the git hooks and CI run a [leak guard](scripts/leak-guard.mjs) that stops
names, emails, phone numbers and account ids from being committed. Put your
own family's names in `.leakguard` (gitignored). See
[docs/decisions/0006](docs/decisions/0006-privacy-by-default.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome, especially anything that helps families connect.

## License

[MIT](LICENSE) © 2026 Rob D'Hondt

---

_Built with love. In memory of Mom._ 💚
