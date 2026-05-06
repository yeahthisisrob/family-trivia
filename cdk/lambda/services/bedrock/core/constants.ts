export const DIFFICULTY_INSTRUCTIONS = {
  easy: `Difficulty: EASY
- Common knowledge that most adults would recognize
- Straightforward language and clear phrasing
- Incorrect options distinctly different from the correct answer
- Answer should be recognizable with basic familiarity of the subject`,

  normal: `Difficulty: NORMAL
- Requires specific knowledge but still broadly accessible
- Clear language with appropriate terminology
- Incorrect options that are plausible alternatives
- Tests genuine knowledge without being obscure`,

  hard: `Difficulty: HARD
- Requires detailed or specialized knowledge
- Includes specific facts, technical terms, or precise details
- requires drawing inferences from multiple variables or pieces of information
- Incorrect options may seem plausible but are erroneous conclusions
- Challenges even someone with strong subject knowledge`
};

export const TRIVIA_QUESTION_PREFIX =
  'Generate an engaging multiple-choice question with exactly four options and a single unambiguous correct answer. The question must NOT be circular or obvious - the answer should NOT appear within the question text itself, and the question should not be of the form "Which snack is made from X? Answer: X" as this is too obvious.';

export const TRIVIA_QUESTION_JSON_FORMAT =
  '{ "question": "...", "choices": ["...", "...", "...", "..."], "answer": "..." }';

export const POINT_MULTIPLIERS = {
  easy: 0.5,
  normal: 1.0,
  hard: 2.0,
};

export const QUESTION_FORMAT_INSTRUCTIONS = `IMPORTANT: The response must be a valid JSON object with exactly these keys:
- "question": A clear trivia question (string)
- "choices": An array of exactly 4 answer options (strings)
- "answer": The correct answer, which must be one of the choices (string)

CRITICAL REQUIREMENTS FOR NON-CIRCULAR QUESTIONS:
1. The correct answer MUST NOT appear within the question text itself
2. Never create questions like "Who is the wizard in Harry Potter?" where "Harry Potter" is both in the question and the answer
3. Avoid questions like "What snack is made from peanuts?" where the answer is "peanuts" - this is circular and too obvious
4. Never ask "what is X?" when the answer is "X" - this is a circular definition, not a trivia question
5. Formulate questions that completely separate the answer from the question text
6. If a name or term is part of the answer, don't mention it in the question
7. For food items, ask about their origin, history, nutrients, or unique qualities rather than what they're made from
8. Make sure the question tests knowledge rather than stating an obvious definition`;

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.7;

// Increase the retry attempts to improve chances of getting a unique question
export const MAX_RETRY_ATTEMPTS = 5;