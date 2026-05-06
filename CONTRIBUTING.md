# Contributing

Thanks for taking an interest in Family Trivia. This is a small, lovingly-built project — contributions are welcome, especially fixes, accessibility improvements, and ideas for keeping families connected.

## Getting set up

```bash
git clone https://github.com/yeahthisisrob/family-trivia.git
cd family-trivia
npm install
cd shared && npm run build && cd ..
```

Copy the example configs and fill in your own values:

```bash
cp cdk/cdk.context.example.json cdk/cdk.config.json
cp frontend/public/config.example.json frontend/public/config.local.json
```

`cdk/cdk.config.json` is gitignored — never commit it.

## Running locally

```bash
cd frontend && npm run dev          # Vite dev server
cd frontend && npm run storybook    # Component playground
cd cdk/lambda && npm test           # Backend tests
```

## Before opening a PR

```bash
cd frontend && npm run lint -- --fix && npm run typecheck && npm run build
cd cdk/lambda && npm run build
```

- Keep PRs focused — one concern per PR.
- New UI components should ship with a Storybook story.
- API changes should update the OpenAPI schema in `shared/schemas/api.openapi.yaml`.
- Use the logger service, not `console.log`.

## Filing issues

Bug reports are most useful with:
- Steps to reproduce
- What you expected vs. what happened
- Browser / Node version if relevant

## Code of conduct

Be kind. Assume everyone is trying their best.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
