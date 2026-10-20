/**
 * A multiple-choice question as the model writes it: the question, four
 * choices and the correct one. One schema and one check for every caller
 * that asks for such a question (0033).
 */
import { isFilled, isRecord } from '../core/shape';

export interface ChoiceQuestion {
  question: string;
  choices: string[];
  answer: string;
}

/** The fields of a choice question, for a JSON Schema's `properties`. */
export const CHOICE_QUESTION_FIELDS = {
  question: { type: 'string', description: 'A clear trivia question' },
  choices: {
    type: 'array',
    items: { type: 'string' },
    minItems: 4,
    maxItems: 4,
    description: 'Exactly four answer options',
  },
  answer: { type: 'string', description: 'The correct answer, exactly as one of the choices' },
};

export const CHOICE_QUESTION_SCHEMA = {
  type: 'object',
  properties: CHOICE_QUESTION_FIELDS,
  required: ['question', 'choices', 'answer'],
};

/** Why a value isn't a choice question, or null when it is. */
export function choiceQuestionProblem(v: unknown): string | null {
  if (!isRecord(v) || !isFilled(v.question)) return 'the question is empty';
  const { choices, answer } = v;
  if (!Array.isArray(choices) || choices.length !== 4 || !choices.every(isFilled))
    return 'there must be exactly four choices, none empty';
  if (typeof answer !== 'string' || !choices.includes(answer))
    return 'the answer must be exactly one of the choices';
  return null;
}

export const isChoiceQuestion = (v: unknown): v is ChoiceQuestion => !choiceQuestionProblem(v);
