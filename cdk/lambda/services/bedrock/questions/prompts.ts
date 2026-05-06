// File: services/bedrock/questions/prompts.ts
// Purpose: Shared prompt builders and format instructions

import { DifficultyLevel } from '../core/types';
import { DIFFICULTY_INSTRUCTIONS, TRIVIA_QUESTION_PREFIX, QUESTION_FORMAT_INSTRUCTIONS, TRIVIA_QUESTION_JSON_FORMAT } from '../core/constants';

/**
 * Builds a prompt for generating a trivia question with the specified parameters
 */
export function buildTriviaPrompt(
  parts: string[],
  difficulty: DifficultyLevel = 'normal'
): string {
  // Add difficulty-specific instruction
  const promptParts = [
    DIFFICULTY_INSTRUCTIONS[difficulty],
    ...parts
  ];

  // Add format validation reminder
  promptParts.push(QUESTION_FORMAT_INSTRUCTIONS);

  // Combine all parts into the final prompt
  return `${TRIVIA_QUESTION_PREFIX}\nBased on:\n${promptParts.join('\n')}\n\nReturn JSON:\n${TRIVIA_QUESTION_JSON_FORMAT}`;
}

/**
 * Builds a prompt for generating a personal fact-based question
 */
export function buildPersonalQuestionPrompt(facts: string[]): string {
  const promptParts = [
    `Here are some personal facts about the user:\n${facts.slice(-5).join('\n')}`
  ];
  
  return buildTriviaPrompt(promptParts);
}

/**
 * Builds a prompt for generating a fun fact based on user's question and answer
 */
export function buildFunFactPrompt(question: string, answer: string): string {
  return `The user answered: \"${question}\"\nTheir answer: \"${answer}\"\n\nGenerate a single short, interesting fact that relates to their answer. Keep it 1-2 sentences, friendly and conversational. Do NOT mention AI. Return ONLY the fact.`;
}

/**
 * Builds a prompt for generating a unique personal question that hasn't been asked before
 * Improved to create more diverse, fun, and engaging family questions
 */
export function buildUniqueQuestionPrompt(previousQuestions: string[] = []): string {
  const previousQuestionsContext = previousQuestions.length > 0 
    ? `\nAVOID questions similar to these previously asked questions:
${previousQuestions.slice(0, 5).map(q => `- "${q}"`).join("\n")}`
    : '';

  return `
Generate a single engaging personal question for a family member to answer about themselves.

REQUIREMENTS:
- Question must be quick and easy to answer (in 1-2 sentences)
- Should be fun, light-hearted, and conversational
- Focus on everyday experiences, preferences, or simple memories
- Be specific enough to elicit an interesting but concise response
- Should NOT require deep reflection or philosophical thinking
- Perfect for learning interesting tidbits about family members

Choose from varied topics to keep things fresh:
- Favorite things (foods, places, activities, seasons, etc.)
- Simple childhood memories or experiences
- Travel experiences or places they'd like to visit
- Food preferences or memorable meals
- Holiday traditions or celebrations
- Recent enjoyable experiences
- Current interests or hobbies
- Preferences about everyday life
- Light-hearted hypothetical scenarios
- Fun or unusual facts about themselves

EXAMPLES OF EXCELLENT QUESTIONS:
- "What was your favorite cartoon or TV show growing up?"
- "What's one small luxury in your daily routine that you really enjoy?"
- "What's a food combination you love that others might find strange?"
- "What's something you've recently tried for the first time?"
- "If you could instantly learn any practical skill, what would you choose?"
- "What's a small tradition that's special to you?"
- "What's your go-to comfort food when you're having a bad day?"
- "What's a place you've visited that pleasantly surprised you?"
- "What's a small act of kindness someone did for you that you still remember?"
- "What's something you wish you had more time to do regularly?"${previousQuestionsContext}

Return ONLY the question, with no introductions, explanations, or formatting.
`;
}

/**
 * Builds an improved prompt for generating a unique shared question that multiple family members can answer
 */
export function buildUniqueSharedQuestionPrompt(previousQuestions: string[] = [], userTheme?: string): string {
  const previousQuestionsContext = previousQuestions.length > 0 
    ? `\nAVOID questions similar to these previously asked questions:
${previousQuestions.slice(0, 5).map(q => `- "${q}"`).join("\n")}`
    : '';

  const themeContext = userTheme 
    ? `\nThe first person to check today's fact suggested this theme or words to inspire the question: "${userTheme}"\nTry to incorporate this theme in a creative way while keeping the question fun and answerable.`
    : '';

  return `
    Generate ONE engaging question that will be asked to MULTIPLE family members so their answers can be compared.${themeContext}
    
    STRICT ADDITIONAL RULES
    - Phrase it as a single, straightforward question (max 25 words).
    - Universally answerable by any family member in 1-2 sentences.
    - Light-hearted, fun, and non-controversial.
    - No role-play, metaphors, or elaborate hypothetical worlds (avoid “If our family were…”, “Imagine you are…”).
    - Avoid using the phrase “our family” altogether.
    - Stick to everyday topics that spark quick opinions or preferences.
    - Question must be quick and easy to answer (1-2 sentences).
    
    REQUIREMENTS:
    - Question must be universally answerable by anyone in a family
    - Should be quick and easy to answer (in 1-2 sentences)
    - Perfect for comparing different family members' perspectives or preferences
    - Must be fun and engaging without being too personal or controversial
    - Should NOT require deep reflection or philosophical thinking
    - Focus on light-hearted topics that prompt interesting variation among family members
    
    Choose from varied comparison topics:
    - Preferences and opinions
    - Harmless hypothetical scenarios
    - Favorite things
    - Simple "would you rather" scenarios
    - Childhood memories or experiences
    - Family traditions or events
    - Food preferences
    - Travel experiences
    - Everyday habits or routines
    - Mild superstitions or beliefs
    
    EXCELLENT EXAMPLES OF SHARED FAMILY QUESTIONS:
    - "What's your earliest memory of a family vacation?"
    - "If you could have dinner with any historical figure, who would you choose and why?"
    - "What's one food from your childhood that you still love today?"
    - "What's a small, everyday item you couldn't live without?"
    - "If you could instantly master any skill, what would you choose?"
    - "What's a song that always puts you in a good mood?"
    - "What's your go-to comfort food when you're feeling down?"
    - "If you could teleport anywhere for just one day, where would you go?"
    - "What's a tradition or habit in your family that you think is unique?"
    - "What's something simple that brings you joy?"
    
    ${previousQuestionsContext}
    
    Return ONLY the question—no introductions, explanations, or extra formatting.
    `;
}