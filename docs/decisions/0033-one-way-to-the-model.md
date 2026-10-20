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
- **Every caller is on askText or askStructured.** The compatibility layer
  (`invokeBedrockPrompt`, `responseParser.ts`, `textExtractor.ts`,
  `jsonInText.ts`) is gone. Small guards for answers live in
  `services/bedrock/core/shape.ts`, and one schema and check for a
  multiple-choice question in `services/bedrock/questions/choiceQuestion.ts`.
- **A refused answer is handled where it was before.** A caller that used to
  carry on with nothing (no drops, no notes, the fallback options) catches
  `AiOutputInvalid` or wraps the call in `unlessInvalid(answer, fallback)`;
  other errors still throw.
- Tests talk to a stand-in Bedrock (`tests/helpers/fakeBedrock.ts`,
  `setBedrockClient`), not to mocks of the parsers.

## Consequences
A new AI feature writes a schema and a type guard, not a parser. There is
no JSON to find in prose anywhere: words come from askText, data from a
forced tool call.
