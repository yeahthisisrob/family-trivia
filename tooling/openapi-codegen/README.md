# openapi-codegen

Validates the OpenAPI contract and regenerates `shared/generated/api-types.ts`.
It exists for one reason: **it pins TypeScript 5.9 while the rest of the repo
runs TypeScript 7.**

`openapi-typescript` builds its output with the classic TypeScript compiler
API (`ts.factory`), which TypeScript 7 no longer exposes. Keeping the
generator in its own workspace package confines the old TypeScript to the one
place that needs it. Nothing imports this package; it only runs as a script.

Fold it back into `shared` once `openapi-typescript` supports TypeScript 7.

    just contract
