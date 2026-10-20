/**
 * What's waiting for you (docs/decisions/0016): trivia from days you didn't
 * play and past questions you haven't answered. Nothing expires while the
 * season's open, so it says what's waiting, never what was missed.
 */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "5 trivia questions and 2 questions for everyone", or null when nothing waits. */
export function waitingLine(trivia: number, questions: number): string | null {
  if (trivia + questions === 0) return null;
  return [
    trivia ? plural(trivia, 'trivia question') : null,
    questions ? plural(questions, 'question for everyone', 'questions for everyone') : null,
  ]
    .filter(Boolean)
    .join(' and ');
}
