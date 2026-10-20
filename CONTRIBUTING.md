# Contributing

Thanks for taking an interest in Family Trivia. It's a small, lovingly built
project. Contributions are welcome, especially fixes, accessibility, and ideas
for keeping families connected as they age and change. Start with
[docs/decisions/0001](docs/decisions/0001-why-this-exists.md): it's the
question every change answers to.

## How we write code

Read [0008](docs/decisions/0008-engineering-principles.md): Clean Code, DRY,
Feature-Sliced Design in the frontend, Vertical Slice Architecture in the
backend, and the OpenAPI contract first.

## Adding a game

The easiest place to start. A game is one folder in `frontend/src/games`:
an `index.tsx` that describes it, the game, and a story. The Arcade finds it
on its own, with a high-score board, and the game kit gives it scores, a save
per player and clues from the circle's own answers, so it needs no backend.
A game can also be a weekly trivia round on the Trivia tab, from the same
folder.
See [the games guide](frontend/src/games/README.md); `scramble/` is a small
one to copy.

## Setup

```bash
git clone https://github.com/yeahthisisrob/family-trivia.git
cd family-trivia
just install        # needs mise: https://mise.jdx.dev
```

`just install` installs the pinned toolchain, the dependencies and the git
hooks. Then copy the example configs:

```bash
cp infra/cdk.context.example.json infra/cdk.config.json
cp frontend/public/config.example.json frontend/public/config.local.json
cp backend/.env.example backend/.env.local
```

## Running locally

```bash
just dev            # API + web app
just storybook      # component playground
```

## Before opening a PR

```bash
just check
```

- One concern per PR. Conventional commit messages (`feat:`, `fix:`,
  `docs:`); release-please builds the changelog from them.
- New UI components ship with a Storybook story.
- A change to a screen the README pictures retakes its picture: `just screenshots <file>`
  (the list is `docs/screenshots/shots.json`; `just check` says which).
- API changes update `shared/schemas/api.openapi.yaml`, then `just contract`.
- **Use made-up people and places.** Never a real family's names, places,
  emails or photos, in code, fixtures, stories, screenshots or commit
  messages. Put your own family's names in `.leakguard` (gitignored) and the
  hooks will stop them from ever being committed. See
  [0006](docs/decisions/0006-privacy-by-default.md).
- A decision that would surprise a newcomer gets a short record in
  [docs/decisions](docs/decisions/README.md).

## How changes land

`main` is protected: changes come through a pull request, squash-merged, with
the checks green and a review from the maintainer. Force pushes and branch
deletion are blocked. Found a security problem? See [SECURITY.md](SECURITY.md)
and report it privately.

## Code of conduct

Be kind. Assume everyone is trying their best.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
