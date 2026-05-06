// File: lambda/routes/generateQuestionOptions.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { getRecentSharedQuestions as getRecentSharedFactQuestions } from '../services/factHistoryService';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getWeekStartDateET as getWeekStartDate } from '@family-trivia/shared';
import { invokeBedrockPrompt } from '../services/bedrock/core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from '../services/bedrock/core/responseParser';
import { getModelForService } from '../config';
import { S3_PATHS } from '../constants';

interface QuestionOption {
  id: string;
  question: string;
  theme?: string;
}

interface GenerateOptionsResponse {
  options: QuestionOption[];
  weekSummaryContext?: string;
}

/**
 * Generates 3 question options using the previous week's summary as context
 * Gives higher weight to user-provided themes
 */
export async function generateQuestionOptions(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { userId, theme = '', regenerate = false } = JSON.parse(event.body || '{}');
    
    if (!userId) {
      return errorResponse('Missing userId', 400);
    }
    
    logger.info('Generating question options', { userId, theme, regenerate });
    
    // ── Gather rich context for the AI ──────────────────────────

    // 1. Last week's summary
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStart = getWeekStartDate(lastWeek);
    let weekSummaryContext = '';
    try {
      const summary = await getJson<any>(`facts/weekly-summaries/${lastWeekStart}.json`);
      if (summary?.summary) weekSummaryContext = summary.summary;
    } catch { /* no summary available */ }

    // 2. Recent shared questions (to avoid repeats)
    let recentQuestions: string[] = [];
    try {
      const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      recentQuestions = await getRecentSharedFactQuestions({ since: cutoff, limit: 10 });
    } catch (err) {
      logger.warn('Could not load recent questions', { error: err });
    }

    // 3. Family member names
    let familyNames: string[] = [];
    try {
      const hierarchy = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
      if (hierarchy?.family?.people) {
        familyNames = Object.values(hierarchy.family.people)
          .map((p: any) => p.name || '')
          .filter(Boolean)
          .slice(0, 20);
      }
    } catch { /* no hierarchy */ }

    // 4. Recent answers/insights (what people have been sharing)
    let recentInsights: string[] = [];
    try {
      const creatorSummary = await getJson<any>(`summaries/${userId}/summary.json`);
      if (creatorSummary?.insights) {
        recentInsights = creatorSummary.insights
          .slice(0, 5)
          .map((i: any) => i.text || '')
          .filter(Boolean);
      }
    } catch { /* no summary */ }

    logger.info('Context gathered for question generation', {
      hasWeeklySummary: !!weekSummaryContext,
      recentQuestionsCount: recentQuestions.length,
      familyMemberCount: familyNames.length,
      insightsCount: recentInsights.length,
    });

    // ── Build prompt ─────────────────────────────────────────────

    const contextSections: string[] = [];

    if (weekSummaryContext) {
      contextSections.push(`LAST WEEK'S FAMILY SUMMARY:\n${weekSummaryContext}`);
    }

    if (recentQuestions.length > 0) {
      contextSections.push(`RECENT QUESTIONS (DO NOT REPEAT THESE):\n${recentQuestions.map(q => `- ${q}`).join('\n')}`);
    }

    if (familyNames.length > 0) {
      contextSections.push(`FAMILY MEMBERS: ${familyNames.join(', ')}\nYou can craft questions that encourage people to talk about each other or share group experiences.`);
    }

    if (recentInsights.length > 0) {
      contextSections.push(`THINGS THE QUESTION CREATOR (${userId}) HAS SHARED RECENTLY:\n${recentInsights.map(i => `- ${i}`).join('\n')}\nUse these to inspire questions that build on existing conversations.`);
    }

    // Categories grounded in family bonding psychology:
    // - Gratitude / positive affect (Fredrickson's broaden-and-build)
    // - Narrative identity (McAdams) — sharing life stories builds coherence
    // - Values clarification — what matters reveals who people are
    // - Positive humor (Vaillant) — mature bonding mechanism
    // - Hope / future self — forward-looking builds connection
    // - Relationship reminiscence (Gottman's "fondness and admiration")
    const categoryGuide: Record<string, string> = {
      'Small Wins': `GRATITUDE & POSITIVE AFFECT.
Purpose: Noticing small good things broadens thinking and builds lasting family bonds (Fredrickson's broaden-and-build theory).
Ask about: recent moments of appreciation, unexpected kindness, something that made them smile this week, a small victory, a compliment they received, something beautiful they noticed.
DO NOT ask about: favorite foods, generic preferences.
Good examples: "What small thing made you feel lucky this week?", "When did someone surprise you with kindness recently?", "What's a small win you're proud of?"`,

      'Life Chapters': `NARRATIVE IDENTITY.
Purpose: Sharing life stories builds identity coherence and connects generations (McAdams' life story model).
Ask about: turning points, formative experiences, lessons learned, moments that shaped them, who they admired growing up, a decision that changed things.
DO NOT ask about: favorite meals or daily routines.
Good examples: "What's a moment from your life that still shapes how you see things?", "Who was your biggest influence growing up and why?", "What's the best lesson someone ever taught you?"`,

      'What Matters': `VALUES CLARIFICATION.
Purpose: Revealing values helps family members understand each other at a deeper level.
Ask about: principles they live by, what they'd defend, what they want to be remembered for, a cause they care about, what they wish more people understood.
DO NOT ask about: food preferences, trivial likes/dislikes.
Good examples: "What's something you believe in strongly?", "What do you want to be remembered for?", "What's a cause that matters to you?"`,

      'Playful You': `POSITIVE HUMOR.
Purpose: Shared humor is a mature bonding mechanism (Vaillant's Harvard study on adult development).
Ask about: embarrassing but funny moments, things that always make them laugh, silly hopes, imaginative scenarios.
DO NOT ask about: favorite foods or generic preferences.
Good examples: "What's the funniest thing that's happened to you this year?", "If you could swap lives with anyone for a day, who and why?", "What's a silly thing you secretly love?"`,

      'Looking Forward': `HOPE & FUTURE SELF.
Purpose: Forward-looking reflection builds optimism and gives family something to support.
Ask about: things they're learning, hopes for the next year, a place they want to visit, something they're working toward, who they're becoming.
DO NOT default to food or cooking.
Good examples: "What are you learning right now?", "What's something you're hoping will happen this year?", "Where do you hope to be a year from now?"`,

      'Shared Memories': `RELATIONSHIP REMINISCENCE (Gottman's fondness and admiration).
Purpose: Shared memory retrieval strengthens relational bonds.
Ask about: memories involving family that still make them smile, traditions they loved, a trip or holiday that stands out, something the family always did.
DO NOT ask about: favorite family meals (too food-focused).
Good examples: "What's a family moment you think about often?", "What tradition did you love as a kid?", "What's a trip you still talk about?"`,

      'Surprise Me': `MIXED / WILDCARD.
Purpose: Variety. Pick 3 questions from different categories above — do NOT pick all food or all preferences.`,
    };

    const themeGuidance = theme && categoryGuide[theme]
      ? `CATEGORY: "${theme}"\n${categoryGuide[theme]}\nAll 3 questions MUST follow this category's purpose.`
      : theme
        ? `THEME: "${theme}"\nAt least 2 of the 3 questions should relate to this theme. The third can be complementary.`
        : '';

    const systemPrompt = `You are a family connection coach helping create questions for a family bonding app.
This is NOT trivia — it's research-backed psychology for building real relationships across generations.

Generate exactly 3 question options that:
1. Are short and mobile-friendly (under 15 words if possible)
2. Create genuine moments of connection
3. Are suitable for all ages (8 to 80)
4. Are meaningfully different from each other — different angles, not variations on the same theme
5. NEVER reference any family member by name
6. **NEVER default to food, meals, or cooking unless the category explicitly calls for it**
   Families are far more than what they eat. Ask about memories, values, humor, growth, and moments — not ingredients.
7. Avoid generic preference questions ("what's your favorite...") — dig deeper

${contextSections.length > 0 ? contextSections.join('\n\n') : ''}

${themeGuidance}

Return ONLY a JSON array with exactly 3 questions:
[
  {"id": "1", "question": "...", "theme": "category name"},
  {"id": "2", "question": "...", "theme": "category name"},
  {"id": "3", "question": "...", "theme": "category name"}
]`;

    // Context is ALWAYS included — theme just adds focus on top
    const userPrompt = theme
      ? `Generate 3 family discussion questions focused on "${theme}". Use the family context above to make them personal and connected to what everyone has been sharing.`
      : 'Generate 3 engaging family discussion questions that build on what the family has been sharing recently. Make them feel personal and connected.';
    
    try {
      // Combine system and user prompts for Claude
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      // Invoke Bedrock
      // Higher temperature (0.9) for more variety — avoids the food default
      const responseBody = await invokeBedrockPrompt(fullPrompt, 1024, 0.9, {
        userId,
        theme,
        regenerate
      });
      
      // Collect and parse response
      const responseBuffer = await collectResponseBody(responseBody);
      const modelId = getModelForService('PERSONAL_QUESTIONS');
      const parsedResponse = extractJsonFromResponse(responseBuffer, modelId);
      
      // Parse the response
      let options: QuestionOption[];
      // Get the actual response text
      const responseText = parsedResponse.rawText || JSON.stringify(parsedResponse);
      
      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        
        options = JSON.parse(jsonMatch[0]);
        
        // Validate we have exactly 3 options
        if (!Array.isArray(options) || options.length !== 3) {
          throw new Error('Expected exactly 3 question options');
        }
        
        // Ensure all options have required fields
        options = options.map((opt, index) => ({
          id: opt.id || String(index + 1),
          question: opt.question || 'What\'s something interesting about your day?',
          theme: opt.theme || (theme ? theme : undefined)
        }));
        
      } catch (parseError) {
        logger.error('Failed to parse AI response', { 
          error: parseError,
          response: responseText.substring(0, 200) 
        });
        
        // Fallback options
        options = generateFallbackOptions(theme);
      }
      
      logger.info('Generated question options', { 
        optionCount: options.length,
        hasTheme: !!theme 
      });
      
      return successResponse({
        options,
        weekSummaryContext: weekSummaryContext ? 'Previous week context included' : 'No context available'
      });
      
    } catch (aiError) {
      logger.error('AI generation failed, using fallbacks', { error: aiError });
      
      return successResponse({
        options: generateFallbackOptions(theme),
        weekSummaryContext: 'Fallback options (AI unavailable)'
      });
    }
    
  } catch (error) {
    logger.error('Error generating question options', { error });
    return errorResponse('Failed to generate question options', 500);
  }
}

/**
 * Generates fallback options when AI is unavailable
 */
function generateFallbackOptions(theme?: string): QuestionOption[] {
  // Curated fallbacks — psychology-backed, no food bias
  return [
    {
      id: '1',
      question: 'What small thing made you feel lucky this week?',
      theme: theme || 'Small Wins',
    },
    {
      id: '2',
      question: 'What\'s a moment from your life that still shapes how you see things?',
      theme: theme || 'Life Chapters',
    },
    {
      id: '3',
      question: 'What are you hoping will happen this year?',
      theme: theme || 'Looking Forward',
    },
  ];
}