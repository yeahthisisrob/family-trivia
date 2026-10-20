# 0033. One way to the model: Converse, structured answers, checked

- Status: Accepted
- Date: 2026-10-20

## Context
Every AI call went through InvokeModel with a request body per model family
(Claude and Llama), asked for JSON in the prompt and then searched the reply
for it (`jsonInText.ts`, `responseParser.ts`). A homemade token bucket threw
fake throttling errors before AWS ever saw a request. Nothing was cached, and
a reply in the wrong shape surfaced as a generic error.

## Decision
- **Converse only** (`services/bedrock/core/converse.ts`): one request shape
  for every model. The SDK's adaptive retries handle throttling.
- **`askText`** for words, **`askStructured`** for data. A structured call
  gives the model one tool whose input is a JSON Schema and makes it call
  that tool (`toolChoice`), so there's no JSON to find in prose.
- **Model output is untrusted.** The caller's type guard checks the answer;
  a wrong shape is sent back once with what was wrong, then refused
  (`AiOutputInvalid`), never passed on.
- **Stable instructions go in `system`**, apart from the prompt, and a long
  one is cached (`cachePoint`) where the model allows it.
- **What each model can do lives in the catalog** (`shared/src/ai.ts`
  `MODEL_CATALOG`: price, `promptCache`, `forcedTool`), next to its price.
- **Every call logs one line**: task, model, tokens (and cached tokens),
  stop reason, time; its tokens go to the month's usage as before.
- The older `invokeBedrockPrompt` runs on Converse and returns the body
  shape the parsers read, so callers move over one at a time. Trivia
  questions and fun facts have moved.

## Consequences
A new AI feature writes a schema and a type guard, not a parser. Moving
the remaining callers removes `responseParser.ts` and `jsonInText.ts`.
