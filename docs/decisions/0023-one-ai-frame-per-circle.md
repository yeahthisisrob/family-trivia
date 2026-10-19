# 0023. One AI frame per kind of circle

- Status: Accepted
- Date: 2026-10-19

## Context
About thirty prompts were written for a family: "a family daily fact game",
"other family members will guess", summaries built from the family tree. A
friends circle got questions about relatives and summaries that called
friends family. Copying every prompt per kind would fork them (0021).

## Decision
- **One frame per kind** (`aiFrameFor` in `shared/src/vocabulary.ts`): who
  the people are ("a circle of close friends"), what one of them is called,
  the group as a whole, what to steer away from, and themes that fit.
  `circleFrame()` gives the frame for the request's circle.
- **Every prompt is framed on its way out.** `invokeBedrockPrompt` passes
  each prompt through `framePrompt`: a family prompt goes out unchanged; in a
  friends or mixed circle it opens with one line saying who these people are
  and to read "family" as the group. No prompt can miss it.
- **The prompts that matter most take the frame's words directly:** the
  day's question and its options (with a category about the group itself,
  "Us" for friends), the guessing game, and trivia written from the circle's
  own answers. The rest move over as they're touched.
- **Ties feed the AI the same way for every kind:** friendships and how they
  met reach summaries and questions ("Who did Alice meet in college?").

## Consequences
A new kind of circle is one more frame. Prompts never test the kind; they
use the frame's words, and the outgoing line covers anything still worded
for a family.
