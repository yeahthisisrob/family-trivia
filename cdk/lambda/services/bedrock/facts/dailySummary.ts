// File: lambda/services/bedrock/facts/dailySummary.ts
import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody } from '../core/responseParser';
import { extractTextContent } from '../core/textExtractor';
import { logger } from '../../logger';
import { getModelForService } from '../../../config';

interface DailyFactData {
  date: string;
  facts: Array<{
    userId: string;
    userName: string;
    familySide: string;
    groupId: string;
    groupName: string;
    question: string;
    answer: string;
    questionType: 'personal' | 'shared';
  }>;
  factType: 'personal' | 'shared';
  robSideCount: number;
  blairSideCount: number;
  hierarchy: any;
  /** Completed Family Feud rounds for the period */
  familyFeudRounds?: Array<{
    question: string;
    targetUserName: string;
    realAnswer: string | null;
    guesses: Record<string, { userName: string; guess: string }>;
    results?: { winners: Array<{ userName: string; points: number }> };
  }>;
}

/**
 * Generates a summary of all daily facts for a given date
 */
export async function generateDailyFactSummary(data: DailyFactData): Promise<string> {
  logger.info('Generating daily fact summary', {
    date: data.date,
    factCount: data.facts.length,
    factType: data.factType
  });

  try {
    // Group facts by family side for comparison
    const robSideFacts = data.facts.filter(f => f.familySide === 'rob');
    const blairSideFacts = data.facts.filter(f => f.familySide === 'blair');
    
    // Group facts by trivia group
    const factsByGroup: Record<string, typeof data.facts> = {};
    data.facts.forEach(fact => {
      if (!factsByGroup[fact.groupName]) {
        factsByGroup[fact.groupName] = [];
      }
      factsByGroup[fact.groupName].push(fact);
    });
    
    // Analyze interesting patterns
    const patterns = analyzeFacts(data.facts, data.factType);
    
    // Build the prompt
    const prompt = buildSummaryPrompt(data, robSideFacts, blairSideFacts, factsByGroup, patterns);
    
    // Get the model for member summaries (using same model as member summaries)
    const model = getModelForService('MEMBER_SUMMARIES');
    
    // Generate summary - use more tokens for weekly summaries
    const isWeekly = data.date.includes(' to ');
    const maxTokens = isWeekly ? 2048 : 1024;
    
    const response = await invokeBedrockPrompt(
      prompt,
      maxTokens,
      0.7,  // Temperature
      { summaryType: isWeekly ? 'weekly-facts' : 'daily-facts' },
      model
    );
    
    const buffer = await collectResponseBody(response);
    
    // Extract text content using utility
    return extractTextContent(buffer, model, 'summary');
    
  } catch (error: any) {
    logger.error('Failed to generate daily fact summary', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to generate daily fact summary: ${error.message}`);
  }
}

function analyzeFacts(facts: DailyFactData['facts'], factType: string) {
  const patterns: any = {
    commonThemes: [],
    interestingContrasts: [],
    uniqueAnswers: [],
    familyConnections: []
  };
  
  if (factType === 'shared') {
    // For shared questions, find common themes in answers
    const question = facts[0]?.question || '';
    const answers = facts.map(f => f.answer.toLowerCase());
    
    // Find common words/themes
    const wordFrequency: Record<string, number> = {};
    answers.forEach(answer => {
      const words = answer.split(/\s+/).filter(w => w.length > 3);
      words.forEach(word => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });
    });
    
    patterns.commonThemes = Object.entries(wordFrequency)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);
    
    // Find unique/outlier answers
    patterns.uniqueAnswers = facts.filter(f => {
      const answer = f.answer.toLowerCase();
      return !patterns.commonThemes.some((theme: string) => answer.includes(theme));
    }).slice(0, 3);
  } else {
    // For personal questions, group by question type
    const questionGroups: Record<string, typeof facts> = {};
    facts.forEach(fact => {
      const q = fact.question;
      if (!questionGroups[q]) {
        questionGroups[q] = [];
      }
      questionGroups[q].push(fact);
    });
    
    // Find questions answered by multiple people
    patterns.sharedQuestions = Object.entries(questionGroups)
      .filter(([_, responders]) => responders.length > 1)
      .map(([question, responders]) => ({
        question,
        responders: responders.map(r => r.userName)
      }));
  }
  
  // Find family connections in answers
  const familyMentions = facts.filter(f => {
    const answer = f.answer.toLowerCase();
    return answer.includes('family') || answer.includes('kids') || 
           answer.includes('husband') || answer.includes('wife') ||
           answer.includes('daughter') || answer.includes('son');
  });
  
  if (familyMentions.length > 0) {
    patterns.familyConnections = familyMentions.slice(0, 3);
  }
  
  return patterns;
}

function buildSummaryPrompt(
  data: DailyFactData,
  robSideFacts: typeof data.facts,
  blairSideFacts: typeof data.facts,
  factsByGroup: Record<string, typeof data.facts>,
  patterns: any
): string {
  // Check if this is a weekly summary (date contains " to ")
  const isWeekly = data.date.includes(' to ');
  
  // Group facts by question for weekly summaries
  const factsByQuestion: Record<string, typeof data.facts> = {};
  if (isWeekly && data.factType === 'shared') {
    data.facts.forEach(fact => {
      const q = fact.question;
      if (!factsByQuestion[q]) {
        factsByQuestion[q] = [];
      }
      factsByQuestion[q].push(fact);
    });
  }
  
  // Build responses section based on whether it's daily or weekly
  let responsesSection = '';
  if (isWeekly && data.factType === 'shared' && Object.keys(factsByQuestion).length > 1) {
    // For weekly summaries with multiple questions, organize by question
    responsesSection = Object.entries(factsByQuestion)
      .map(([question, responses]) => {
        const responsesList = responses.map(f => 
          `  - ${f.userName} (${f.familySide ? `${f.familySide}'s side` : 'family'}): "${f.answer}"`
        ).join('\n');
        return `QUESTION: "${question}"\nRESPONSES:\n${responsesList}`;
      }).join('\n\n');
  } else {
    // For daily summaries or single question, use the original format
    responsesSection = data.facts.map(f => 
      `- ${f.userName} (${f.groupName}, ${f.familySide ? `${f.familySide}'s side` : 'family'}): "${f.answer}"${f.questionType === 'personal' ? ` [Q: ${f.question}]` : ''}`
    ).join('\n');
  }
  
  const groupBreakdown = Object.entries(factsByGroup)
    .map(([group, facts]) => `- ${group}: ${facts.length} responses`)
    .join('\n');
  
  const summaryType = isWeekly ? 'weekly' : 'daily';
  const questionCount = Object.keys(factsByQuestion).length;
  
  return `You are creating a ${summaryType} summary of family facts shared in a family trivia game. This summary will be displayed prominently above the timeline to give family members insight into what everyone shared${isWeekly ? ' this week' : ' that day'}.

${isWeekly ? 'WEEK' : 'DATE'}: ${data.date}
FACT TYPE: ${data.factType === 'shared' ? `Shared Questions (everyone got the same question${isWeekly && questionCount > 1 ? 's' : ''})` : 'Personal Questions (everyone got different questions)'}
${isWeekly && questionCount > 1 ? `NUMBER OF DIFFERENT QUESTIONS THIS WEEK: ${questionCount}` : ''}
${!isWeekly && data.factType === 'shared' && data.facts[0] ? `SHARED QUESTION: "${data.facts[0].question}"` : ''}

PARTICIPATION:
- Total responses: ${data.facts.length}
- Side A: ${data.robSideCount} responses
- Side B: ${data.blairSideCount} responses

RESPONSES BY GROUP:
${groupBreakdown}

${isWeekly && questionCount > 1 ? 'ALL QUESTIONS AND RESPONSES:' : 'ALL RESPONSES:'}
${responsesSection}

${patterns.commonThemes?.length > 0 ? `
COMMON THEMES DETECTED:
- ${patterns.commonThemes.join(', ')}
` : ''}

${patterns.familyConnections?.length > 0 ? `
FAMILY MENTIONS:
${patterns.familyConnections.map((f: any) => `- ${f.userName}: "${f.answer}"`).join('\n')}
` : ''}

${data.familyFeudRounds && data.familyFeudRounds.length > 0 ? `
FAMILY FEUD ROUNDS (completed this ${isWeekly ? 'week' : 'period'}):
${data.familyFeudRounds.map(r => {
  const guessEntries = Object.values(r.guesses || {});
  const correctGuesses = guessEntries.filter(g => g.guess?.trim().toLowerCase() === r.realAnswer?.trim().toLowerCase());
  return `- About ${r.targetUserName}: "${r.question}"
  Answer: "${r.realAnswer}"
  ${guessEntries.length} guesses, ${correctGuesses.length} correct
  ${correctGuesses.length > 0 ? `Correct: ${correctGuesses.map(g => g.userName).join(', ')}` : 'Nobody guessed right!'}`;
}).join('\n')}
` : ''}
TASK: Write an engaging, insightful summary that:
${isWeekly && questionCount > 1 ? `1. Covers ALL ${questionCount} questions from the week, dedicating attention to each one` : '1. Highlights the most interesting, funny, or revealing responses'}
2. Compares responses between the two family sides (if there are notable differences)
3. Points out any surprising commonalities or contrasts
4. For shared questions: analyze how different family members approached ${isWeekly && questionCount > 1 ? 'each question' : 'the same question'}
5. ${isWeekly ? 'Shows the progression of topics throughout the week' : 'For personal questions: highlight the variety of topics'}
6. Mentions participation levels and which groups were most active
7. Uses specific names and quotes to make it personal and engaging
8. Keeps a warm, inclusive tone that celebrates family sharing

The summary should be ${isWeekly ? '3-5 paragraphs (300-400 words)' : '2-3 short paragraphs (150-200 words)'} that family members will enjoy reading before diving into the timeline.

IMPORTANT:
${isWeekly && questionCount > 1 ? '- Ensure EVERY question from the week is discussed in the summary' : '- Lead with the most interesting insights'}
- Use specific examples and names
- Make comparisons between family sides when relevant
- Keep the tone light and celebratory
- Focus on what makes this ${isWeekly ? "week's" : "day's"} responses unique or memorable
${data.familyFeudRounds && data.familyFeudRounds.length > 0 ? '- Include Family Feud highlights: who was guessed about, surprising answers, who knows who best' : ''}
- Return ONLY the summary text, no additional formatting or commentary`;
}