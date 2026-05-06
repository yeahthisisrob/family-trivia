// File: lambda/services/bedrock/members/memberSummary.ts
import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody } from '../core/responseParser';
import { extractTextContent } from '../core/textExtractor';
import { logger } from '../../logger';
import { getJson } from '../../s3';
import { S3_PATHS } from '../../../constants';
import { getModelForService, FEATURE_FLAGS } from '../../../config';

// Helper to check if model is Claude
function isClaudeModel(modelId: string): boolean {
  return modelId.includes('anthropic.claude') || modelId.includes('us.anthropic.claude');
}

interface MemberData {
  userId: string;
  name: string;
  answerHistory: any[];
  facts: any[];
  memberInfo: any;
  customCategories: any[];
  /** Completed Family Feud rounds (questions + guesses + results) */
  familyFeudRounds?: any[];
  type?: 'regular' | 'roast'; // Optional parameter to generate only one type of summary
  forceGenerate?: boolean; // Flag to force regeneration despite cache
}

interface MemberInsight {
  text: string;
  category: 'preference' | 'personality' | 'fact' | 'activity' | 'relationship';
}

interface BasicQA {
  question: string;
  answer: string;
}

// Cache configuration
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
const summaryCache: Record<string, {
  regularSummary?: string;
  roastSummary?: string;
  basicQAs?: BasicQA[];
  insights?: MemberInsight[];
  timestamp: number;
}> = {};

/**
 * Extracts insights from AI response text
 */
function extractInsights(text: string): MemberInsight[] {
  try {
    // First try to parse the entire text as JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed.insights && Array.isArray(parsed.insights)) {
        logger.info('Successfully parsed insights from direct JSON', { count: parsed.insights.length });
        return parsed.insights.filter((insight: any) => 
          insight.text && 
          insight.category && 
          ['preference', 'personality', 'fact', 'activity', 'relationship'].includes(insight.category)
        );
      }
    } catch (e) {
      // Not direct JSON, try to find JSON within the text
      logger.info('Failed to parse as direct JSON', { error: e instanceof Error ? e.message : String(e) });
    }
    
    // Look for JSON insights in the response
    const insightsMatch = text.match(/\{"insights":\s*\[(.*?)\]\}/s);
    if (insightsMatch) {
      const insightsJson = insightsMatch[0];
      const parsed = JSON.parse(insightsJson);
      if (parsed.insights && Array.isArray(parsed.insights)) {
        logger.info('Successfully extracted insights from embedded JSON', { count: parsed.insights.length });
        return parsed.insights.filter((insight: any) => 
          insight.text && 
          insight.category && 
          ['preference', 'personality', 'fact', 'activity', 'relationship'].includes(insight.category)
        );
      }
    }
    
    logger.info('No insights found in response', { textPreview: text.slice(0, 100) });
  } catch (e) {
    logger.debug('Could not extract insights from response', { 
      error: e instanceof Error ? e.message : String(e),
      textPreview: text.slice(0, 100)
    });
  }
  return [];
}

/**
 * Analyzes member data and extracts insights for summary generation
 */
async function analyzeMemberData(memberData: MemberData) {
  const { answerHistory, facts, customCategories } = memberData;

  // Extract basic statistics
  const totalAnswered = answerHistory.length;
  const incorrectAnswers = answerHistory.filter(a => !a.correct);
  const wrongQuestions = incorrectAnswers.map(a => ({
    question: a.question?.question || '',
    category: a.question?.category || 'unknown',
    difficulty: a.question?.difficulty || 'normal'
  }));
  
  // Analyze category preferences
  const categoryCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = {};
  const customCategoriesCreated = customCategories.map(c => c.title || 'Untitled');
  const customCategoriesUsed: Record<string, number> = {};
  const wrongByCategory: Record<string, string[]> = {};
  const wrongByDifficulty: Record<string, string[]> = {};
  
  // Track personal question usage
  const personalQuestionsAnswered = answerHistory.filter(a => 
    a.question?.mode === 'personal' || a.question?.category === 'personal'
  ).length;
  
  // Initialize casino rush variables
  let casinoRushAnswers: any[] = [];
  let casinoRushSessionData: any = null;
  let casinoRushTotal = 0;
  let casinoRushCorrect = 0;
  let casinoRushWrong = 0;
  let casinoRushSuccessRate = 0;
  let casinoRushWrongQuestions: string[] = [];
  let topCasinoRushCategories: string[] = [];
  let casinoRushStatus = 'none';
  let casinoRushPotentialPoints = 0;

  // Only get Casino Rush data if feature is enabled
  if (FEATURE_FLAGS.CASINO_RUSH_ENABLED) {
    try {
      const casinoSession = await getJson<any>(`casino-rush/${memberData.userId}/session.json`);
      if (casinoSession && casinoSession.questions) {
        casinoRushSessionData = casinoSession;
        const isCompleted = casinoSession.status === 'completed';
        const pointsPerQuestion = isCompleted ? casinoSession.potentialPoints / casinoSession.questions.length : 0;
        
        // Convert casino rush session to answer format
        casinoSession.questions
          .filter((q: any) => q.answeredAt)
          .forEach((q: any, index: number) => {
            casinoRushAnswers.push({
              question: {
                ...q,
                mode: 'casino-rush',
                pointMultiplier: 3
              },
              selectedAnswer: q.userAnswer,
              correct: q.correct,
              timestamp: new Date(q.answeredAt).toISOString(),
              pointsEarned: pointsPerQuestion,
              isCasinoRush: true,
              questionNumber: index + 1,
              totalQuestions: casinoSession.questions.length,
            });
          });
      }
    } catch (e) {
      // No casino rush data found
    }
    
    // Analyze Casino Rush gameplay
    casinoRushTotal = casinoRushAnswers.length;
    casinoRushCorrect = casinoRushAnswers.filter(a => a.correct).length;
    casinoRushWrong = casinoRushTotal - casinoRushCorrect;
    casinoRushSuccessRate = casinoRushTotal > 0 ? 
      Math.round((casinoRushCorrect / casinoRushTotal) * 100) : 0;
    
    // Get casino rush wrong questions
    casinoRushWrongQuestions = casinoRushAnswers
      .filter(a => !a.correct && a.question?.question)
      .map(a => a.question.question);
      
    // Analyze casino rush categories
    const casinoRushCategories: Record<string, number> = {};
    casinoRushAnswers.forEach(answer => {
      const category = answer.question?.category || 'unknown';
      casinoRushCategories[category] = (casinoRushCategories[category] || 0) + 1;
    });
    topCasinoRushCategories = Object.entries(casinoRushCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
      
    // Casino Rush session details
    casinoRushStatus = casinoRushSessionData?.status || 'none';
    casinoRushPotentialPoints = casinoRushSessionData?.potentialPoints || 0;
  }
  
// Get detailed family hierarchy data to understand relationships
  let familyPosition: any = {};
  let familySide: string = 'unknown';
  let groupInfo: any = {};
  let detailedRelationships: any = {};
  
  try {
    const hierarchyData = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
    if (hierarchyData?.family?.people?.[memberData.userId]) {
      const personData = hierarchyData.family.people[memberData.userId];
      familySide = personData.familySide || 'unknown';
      
      // Get group information with detailed context
      if (personData.groupId && hierarchyData.family.groups?.[personData.groupId]) {
        groupInfo = hierarchyData.family.groups[personData.groupId];
      }
      
      // Extract detailed family relationships
      if (hierarchyData.family.relationships && hierarchyData.family.people) {
        const allPeople = hierarchyData.family.people;
        const relationships = hierarchyData.family.relationships;
        
        // Find all relationships involving this person
        const personRelationships = relationships.filter((rel: any) => 
          rel.parent1 === memberData.userId || 
          rel.parent2 === memberData.userId ||
          rel.partner1 === memberData.userId ||
          rel.partner2 === memberData.userId ||
          rel.person1 === memberData.userId ||
          (rel.people && rel.people.includes(memberData.userId)) ||
          (rel.children && rel.children.includes(memberData.userId)) ||
          (rel.aunt && rel.aunt === memberData.userId) ||
          (rel['nieces-nephews'] && rel['nieces-nephews'].includes(memberData.userId))
        );
        
        // Extract specific relationships with names
        let partner = null;
        let children: string[] = [];
        let parents: string[] = [];
        let siblings: string[] = [];
        let cousins: string[] = [];
        let aunt: string[] = [];
        let nieceNephew: string[] = [];
        
        personRelationships.forEach((rel: any) => {
          switch (rel.type) {
            case 'partners':
              if (rel.partner1 === memberData.userId && allPeople[rel.partner2]) {
                partner = allPeople[rel.partner2].name;
              } else if (rel.partner2 === memberData.userId && allPeople[rel.partner1]) {
                partner = allPeople[rel.partner1].name;
              }
              break;
              
            case 'parents-of':
              if (rel.parent1 === memberData.userId || rel.parent2 === memberData.userId) {
                // This person is a parent
                if (rel.children) {
                  children = rel.children.map((childId: string) => allPeople[childId]?.name).filter(Boolean);
                }
              } else if (rel.children && rel.children.includes(memberData.userId)) {
                // This person is a child
                if (rel.parent1 && allPeople[rel.parent1]) parents.push(allPeople[rel.parent1].name);
                if (rel.parent2 && allPeople[rel.parent2]) parents.push(allPeople[rel.parent2].name);
              }
              break;
              
            case 'cousins':
              if (rel.person1 === memberData.userId && rel.people) {
                cousins = rel.people.map((cousinId: string) => allPeople[cousinId]?.name).filter(Boolean);
              } else if (rel.people && rel.people.includes(memberData.userId) && rel.person1 && allPeople[rel.person1]) {
                cousins.push(allPeople[rel.person1].name);
              }
              break;
              
            case 'aunt-of':
              if (rel.aunt === memberData.userId && rel['nieces-nephews']) {
                nieceNephew = rel['nieces-nephews'].map((id: string) => allPeople[id]?.name).filter(Boolean);
              } else if (rel['nieces-nephews'] && rel['nieces-nephews'].includes(memberData.userId) && allPeople[rel.aunt]) {
                aunt.push(allPeople[rel.aunt].name);
              }
              break;
          }
        });
        
        // Also find siblings by looking for shared parents
        const myParentRelationships = relationships.filter((rel: any) => 
          rel.type === 'parents-of' && rel.children && rel.children.includes(memberData.userId)
        );
        
        myParentRelationships.forEach((parentRel: any) => {
          if (parentRel.children) {
            const siblingIds = parentRel.children.filter((id: string) => id !== memberData.userId);
            const siblingNames = siblingIds.map((id: string) => allPeople[id]?.name).filter(Boolean);
            siblings.push(...siblingNames);
          }
        });
        
        detailedRelationships = {
          partner,
          children,
          parents,
          siblings,
          cousins,
          aunt,
          nieceNephew,
          // Family generation context
          generation: children.length > 0 ? 'parent' : parents.length > 0 ? 'child' : 'adult',
          familyRole: partner ? 'married' : children.length > 0 ? 'parent' : 'individual'
        };
        
        familyPosition = {
          isParent: children.length > 0,
          isChild: parents.length > 0,
          hasPartner: !!partner,
          hasSiblings: siblings.length > 0,
          relationships: personRelationships.map((r: any) => r.type),
          totalRelatedPeople: [partner, ...children, ...parents, ...siblings, ...cousins, ...aunt, ...nieceNephew].filter(Boolean).length
        };
      }
    }
  } catch (e) {
    // Couldn't get family hierarchy data
    logger.debug('Could not fetch family hierarchy for member summary', { userId: memberData.userId });
  }
  
  // Categorize facts by type
  const sharedFacts = facts.filter(f => f.questionType === 'shared');
  const basicFacts = facts.filter(f => 
    f.questionType === 'basic' || f.questionType === 'personal'
  );
  
  // Extract basic Q&As (non-skipped answers)
  const basicQAs: BasicQA[] = basicFacts
    .filter(f => 
      f.answered === true && 
      f.skipped !== true && 
      f.answer !== '[Skipped]' && 
      f.answer && 
      f.question
    )
    .map(f => ({
      question: f.question,
      answer: f.answer
    }));
  
  // Analyze skip patterns
  const personalFactsAsked = basicFacts.length;
  const personalFactsSkipped = basicFacts.filter(f => 
    f.skipped === true || f.answer === '[Skipped]'
  );
  const personalFactsAnswered = basicFacts.filter(f => 
    f.answered === true && f.skipped !== true && f.answer !== '[Skipped]'
  );
  const personalSkippedQuestions = personalFactsSkipped.map(f => f.question);
  const personalSkipRate = personalFactsAsked > 0 ? 
    Math.round((personalFactsSkipped.length / personalFactsAsked) * 100) : 0;
  
  // Analyze shared questions
  const sharedQuestionsAsked = sharedFacts.length;
  const sharedFactsSkipped = sharedFacts.filter(f => 
    f.skipped === true || f.answer === '[Skipped]'
  );
  const sharedQuestionsAnswered = sharedFacts.filter(f => 
    f.answered === true && f.skipped !== true && f.answer !== '[Skipped]'
  ).length;
  const sharedSkippedQuestions = sharedFactsSkipped.map(f => f.question);
  const sharedSkipRate = sharedQuestionsAsked > 0 ? 
    Math.round((sharedFactsSkipped.length / sharedQuestionsAsked) * 100) : 0;
  
  // Track category bonus stats
  let categoryBonusCount = 0;
  let categoryBonusTotal = 0;
  answerHistory.forEach(a => {
    if (a.categoryBonus && a.categoryBonus > 0) {
      categoryBonusCount++;
      categoryBonusTotal += a.categoryBonus;
    }
  });

  // Process answer data to find patterns
  answerHistory.forEach(answer => {
    const category = answer.question?.category || 'unknown';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    
    // Check if this is a custom category using the explicit flag
    if (answer.question?.isCustomCategory || answer.isCustomCategory) {
      customCategoriesUsed[category] = (customCategoriesUsed[category] || 0) + 1;
    }
    
    const difficulty = answer.question?.difficulty || 'normal';
    difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
    
    // Track questions they got wrong by category and difficulty
    if (!answer.correct && answer.question?.question) {
      const question = answer.question.question;
      wrongByCategory[category] = wrongByCategory[category] || [];
      wrongByCategory[category].push(question);
      
      wrongByDifficulty[difficulty] = wrongByDifficulty[difficulty] || [];
      wrongByDifficulty[difficulty].push(question);
    }
  });
  
  // Extract top patterns
  const getTopItems = (counts: Record<string, number>, limit: number = 3) => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  };
  
  const topCategories = getTopItems(categoryCounts);
  const topDifficulties = getTopItems(difficultyCounts);
  
  // Determine which custom categories they actually played
  const customCategoriesPlayedList = Object.keys(customCategoriesUsed);
  
  // Get random samples for more personalized summaries
  const getRandomSamples = (items: any[], count: number = 3) => {
    return items.sort(() => 0.5 - Math.random()).slice(0, count);
  };
  
  const randomFacts = getRandomSamples(facts).map(f => 
    `Question: "${f.question}", Answer: "${f.answer}"`
  );
  
  // Get pattern of wrong answers
  const mostWrongCategories = Object.entries(wrongByCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .filter(([_, questions]) => questions.length > 0);
  
  const mostWrongDifficulties = Object.entries(wrongByDifficulty)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .filter(([_, questions]) => questions.length > 0);
  
  const allWrongQuestions = Object.values(wrongByCategory).flat();
  const randomWrongQuestions = getRandomSamples(allWrongQuestions, 5);
  
  return {
    topCategories,
    topDifficulties,
    personalQuestionsAnswered,
    personalFactsAsked,
    personalFactsAnswered: personalFactsAnswered.length,
    personalFactsSkipped: personalFactsSkipped.length,
    personalSkipRate,
    personalSkippedQuestions,
    sharedQuestionsAsked,
    sharedQuestionsAnswered,
    sharedFactsSkipped: sharedFactsSkipped.length,
    sharedSkipRate,
    sharedSkippedQuestions,
    randomFacts,
    customCategoriesCreated,
    customCategoriesPlayedList,
    totalAnswered,
    incorrectAnswers: incorrectAnswers.length,
    wrongQuestions,
    mostWrongCategories,
    mostWrongDifficulties,
    randomWrongQuestions,
    wrongByCategory,
    wrongByDifficulty,
    // Casino Rush data
    casinoRushTotal,
    casinoRushCorrect,
    casinoRushWrong,
    casinoRushSuccessRate,
    casinoRushWrongQuestions,
    topCasinoRushCategories,
    casinoRushStatus,
    casinoRushPotentialPoints,
    // Family hierarchy data
    familySide,
    familyPosition,
    groupInfo,
    detailedRelationships,
    // Structured data
    basicQAs,
    // Category bonus stats
    categoryBonusCount,
    categoryBonusTotal,
  };
}

/**
 * Builds prompts for generating member summaries in both regular and roast modes
 */
async function buildMemberSummaryPrompts(memberData: MemberData): Promise<{
  regularPrompt: string;
  roastPrompt: string;
  insightsPrompt: string;
}> {
  logger.info('Building member summary prompts');
  const { userId, name, memberInfo } = memberData;
  
  // Analyze member data to extract insights
  const analysis = await analyzeMemberData(memberData);
  
  // Build detailed family context using relationship data
  const buildFamilyContext = () => {
    const rel = analysis.detailedRelationships || {};
    const side = analysis.familySide ? `${analysis.familySide}'s side` : 'family';
    
    let familyDesc = [];
    
    // Primary relationships
    if (rel.partner) {
      familyDesc.push(`married to ${rel.partner}`);
    }
    
    if (rel.children && rel.children.length > 0) {
      familyDesc.push(`parent of ${rel.children.join(' and ')}`);
    }
    
    if (rel.parents && rel.parents.length > 0) {
      familyDesc.push(`child of ${rel.parents.join(' and ')}`);
    }
    
    // Extended relationships
    if (rel.siblings && rel.siblings.length > 0) {
      familyDesc.push(`sibling to ${rel.siblings.join(' and ')}`);
    }
    
    if (rel.cousins && rel.cousins.length > 0) {
      familyDesc.push(`cousin to ${rel.cousins.slice(0, 2).join(' and ')}${rel.cousins.length > 2 ? ' (and others)' : ''}`);
    }
    
    if (rel.aunt && rel.aunt.length > 0) {
      familyDesc.push(`has aunt ${rel.aunt[0]}`);
    }
    
    if (rel.nieceNephew && rel.nieceNephew.length > 0) {
      familyDesc.push(`aunt/uncle to ${rel.nieceNephew.join(' and ')}`);
    }
    
    return familyDesc.length > 0 ? familyDesc.join(', ') : 'individual family member';
  };

  // Build casino rush section only if feature is enabled
  const casinoRushSection = FEATURE_FLAGS.CASINO_RUSH_ENABLED && analysis.casinoRushTotal > 0 ? `
CASINO RUSH PERFORMANCE:
${analysis.casinoRushTotal > 0 ? 
  `- Casino Rush session status: ${analysis.casinoRushStatus}
- Questions attempted: ${analysis.casinoRushTotal} (${analysis.casinoRushCorrect} correct, ${analysis.casinoRushWrong} wrong)
- Potential points at stake: ${analysis.casinoRushPotentialPoints}
- Preferred Casino Rush categories: ${analysis.topCasinoRushCategories.join(', ') || 'Various'}
${analysis.casinoRushWrongQuestions.length > 0 ? 
  `- Questions they got wrong under pressure:\n${analysis.casinoRushWrongQuestions.slice(0, 3).map(q => `  * "${q}"`).join('\n')}` : ''}` : 
  '- No Casino Rush attempts yet (cautious or hasn\'t discovered it)'}
` : '';

  // Build Family Feud section from completed rounds
  const buildFamilyFeudSection = () => {
    const rounds = memberData.familyFeudRounds?.filter(r => r.status === 'completed') ?? [];
    if (rounds.length === 0) return '';

    // Rounds where this user was the target (being guessed about)
    const asTarget = rounds.filter(r => r.targetUserId === userId);
    // Rounds where this user guessed
    const asGuesser = rounds.filter(r => r.guesses?.[userId]);

    const targetQAs = asTarget.map(r => ({
      question: r.question,
      answer: r.realAnswer,
      totalGuesses: Object.keys(r.guesses || {}).length,
      correctGuesses: Object.values(r.guesses || {}).filter((g: any) =>
        g.guess?.trim().toLowerCase() === r.realAnswer?.trim().toLowerCase()
      ).length,
    }));

    const guessResults = asGuesser.map(r => {
      const guess = r.guesses[userId];
      const correct = guess?.guess?.trim().toLowerCase() === r.realAnswer?.trim().toLowerCase();
      return { targetName: r.targetUserName, question: r.question, guess: guess?.guess, correct };
    });

    const correctGuesses = guessResults.filter(g => g.correct).length;

    let section = `\nFAMILY FEUD PERFORMANCE:\n`;
    if (asTarget.length > 0) {
      section += `- Was the target in ${asTarget.length} round${asTarget.length !== 1 ? 's' : ''}\n`;
      section += targetQAs.slice(0, 3).map(qa =>
        `  * Q: "${qa.question}" → A: "${qa.answer}" (${qa.correctGuesses}/${qa.totalGuesses} guessed correctly)`
      ).join('\n') + '\n';
    }
    if (asGuesser.length > 0) {
      section += `- Guessed in ${asGuesser.length} round${asGuesser.length !== 1 ? 's' : ''} (${correctGuesses} correct)\n`;
      const wrongGuesses = guessResults.filter(g => !g.correct).slice(0, 2);
      if (wrongGuesses.length > 0) {
        section += wrongGuesses.map(g =>
          `  * Guessed "${g.guess}" for ${g.targetName}'s "${g.question}" (wrong)`
        ).join('\n') + '\n';
      }
    }
    return section;
  };

  const familyFeudSection = buildFamilyFeudSection();

  // Format analysis data into a context block - prioritize personal facts
  const contextSection = `
FAMILY MEMBER PROFILE:
- Name: ${name}
- Family Side: ${analysis.familySide ? `${analysis.familySide}'s side of the family` : 'family member'}
- Trivia Group: "${analysis.groupInfo?.name || 'Unknown'}" ${analysis.groupInfo?.description ? `(${analysis.groupInfo.description})` : ''}
- Family Relationships: ${buildFamilyContext()}
- Generation Role: ${analysis.detailedRelationships?.generation || 'adult member'} (${analysis.detailedRelationships?.familyRole || 'individual'})

PERSONAL FACTS SHARED (PRIMARY FOCUS - 70% OF SUMMARY):
${analysis.randomFacts.length > 0 ? analysis.randomFacts.join('\n') : 'No personal facts shared yet.'}

PERSONAL SHARING PATTERNS:
- Personal skip rate: ${analysis.personalSkipRate}% (${analysis.personalFactsSkipped}/${analysis.personalFactsAsked} skipped)
- Shared question skip rate: ${analysis.sharedSkipRate}% (${analysis.sharedFactsSkipped}/${analysis.sharedQuestionsAsked} skipped)
${analysis.personalSkippedQuestions.length > 0 ? 
  `- Example personal questions they tend to skip:\n${analysis.personalSkippedQuestions.slice(0, 3).map(q => `  * "${q}"`).join('\n')}` : ''}
${analysis.sharedSkippedQuestions.length > 0 ? 
  `- Example shared questions they avoid:\n${analysis.sharedSkippedQuestions.slice(0, 3).map(q => `  * "${q}"`).join('\n')}` : ''}

GAMEPLAY PATTERNS (SECONDARY FOCUS - 30% OF SUMMARY):
- Total questions answered: ${analysis.totalAnswered}
- Questions missed: ${analysis.incorrectAnswers}
- Favorite categories: ${analysis.topCategories.join(', ') || 'No clear favorites yet'}
- Preferred difficulty: ${analysis.topDifficulties.join(', ') || 'No clear preference'}
${casinoRushSection}${familyFeudSection}
TOUGH CATEGORY BONUS HUNTING:
${analysis.categoryBonusCount > 0 ?
  `- Earned category bonuses ${analysis.categoryBonusCount} time${analysis.categoryBonusCount === 1 ? '' : 's'} for a total of ${analysis.categoryBonusTotal} bonus points
- This means they've been brave enough to tackle the hardest categories (the ones everyone gets wrong) and still got them right!` :
  '- Has not yet earned any tough-category bonuses (categories with <60% global accuracy that award bonus points)'}

TRIVIA STRUGGLES:
${analysis.mostWrongCategories.length > 0 ? 
  `Categories they struggle with:\n${analysis.mostWrongCategories.map(([cat, questions]) => 
    `- ${cat}: ${questions.length} wrong (e.g., "${questions[0]}")`).join('\n')}` : 
  'No clear struggle patterns yet.'}

CUSTOM CATEGORIES:
- Created: ${analysis.customCategoriesCreated.length > 0 ? analysis.customCategoriesCreated.join(', ') : 'None yet'}
- Questions answered from custom categories: ${analysis.customCategoriesPlayedList.length > 0 ? analysis.customCategoriesPlayedList.join(', ') : 'None yet'}
`;

  // Common instructions for both regular and roast prompts - with conditional Casino Rush
  const casinoRushInstruction = FEATURE_FLAGS.CASINO_RUSH_ENABLED ?
    '- Include Casino Rush performance if they\'ve participated (successes, failures, favorite categories)' : '';
  const familyFeudInstruction = familyFeudSection
    ? '- Include Family Feud insights: what their answers reveal about them, how well family knows them'
    : '';
  
  const commonInstructions = `
IMPORTANT GUIDELINES:
- FOCUS ALLOCATION: 70% of the summary should be about their PERSONAL FACTS and sharing patterns, 30% about gameplay
- USE FAMILY CONTEXT: Always reference their specific family relationships and position when relevant
- Lead with their personal facts and what they reveal about their personality and life
- Weave in their family role naturally (e.g., "As Rob's sister..." or "Being a parent of two..." or "The cousin who...")
- Consider how their family position might influence their sharing patterns or trivia interests
- Highlight interesting, funny, or revealing personal details they've shared
- Comment on their sharing comfort level - what they're willing to share vs. what they skip
- When mentioning gameplay, connect it to their personality or family role when possible
${casinoRushInstruction}
${familyFeudInstruction}
- Do NOT mention accuracy rates or percentages
- Write as if you're describing them to another family member who knows the family structure
- LENGTH REQUIREMENT: Write 2-3 paragraphs (200-300 words total) for a concise yet insightful portrait
- First paragraph: Focus on their family role and most interesting personal facts
- Second paragraph: Their personality traits based on sharing patterns and trivia preferences
- Optional third paragraph: Any unique insights or memorable patterns
- Make it feel like you really know this person through their facts, habits, and family role

- Return ONLY the summary text (2-3 paragraphs, 200-300 words)
- Do not include any JSON, formatting, or additional content
- Start your response with the first sentence of the summary
`;

  // Regular summary prompt with 70% personal facts focus and family context
  const regularPrompt = `
You are creating a fun, insightful summary of a family member for a family trivia game. This will be shown in a featured spotlight carousel within the app.

${contextSection}

TASK: Write a friendly, engaging summary that captures who this person really is within the context of their family. Focus primarily (70%) on the personal facts they've shared and what these reveal about their personality, life, and character. Use their trivia habits (30%) as supporting details.

The tone should be warm, observational, and positive - like you're describing them to another family member who knows everyone.

WRITING APPROACH:
- Start by establishing their family role/relationship context naturally in the opening
- Use their family position to add depth to their personality insights
- Consider how being a parent/child/sibling/cousin might influence their sharing style
- Reference their place in the family tree when it adds meaningful context
- Make connections between their personal facts and their family role when relevant

PRIMARY FOCUS (70% - Personal Facts with Family Context):
- Lead with the most interesting personal facts, woven with their family role
- What their sharing patterns reveal about their personality within the family dynamic
- How their comfort level with sharing reflects their position/generation in the family
- Connect their personal experiences to their role as parent/child/partner/sibling

SECONDARY FOCUS (30% - Gameplay in Family Context):
- Their trivia preferences and how these might connect to their family interests${FEATURE_FLAGS.CASINO_RUSH_ENABLED ? '\n- Casino Rush participation (are they the family risk-taker or cautious one?)' : ''}
- How their gameplay style fits their family personality
- Custom categories that reveal their unique interests within the family

${commonInstructions}
`;

  // Construct family relationship context for roasting
  const rel = analysis.detailedRelationships || {};
  const roastRelationshipContext = `
FAMILY RELATIONSHIP CONTEXT FOR ROASTING:
${rel.partner ? `- They are married to/partnered with ${rel.partner}` : '- They are single'}
${rel.children && rel.children.length > 0 ? `- They are a parent to: ${rel.children.join(', ')}` : ''}
${rel.parents && rel.parents.length > 0 ? `- Their parents are: ${rel.parents.join(', ')}` : ''}
${rel.siblings && rel.siblings.length > 0 ? `- Their siblings are: ${rel.siblings.join(', ')}` : ''}
${rel.cousins && rel.cousins.length > 0 ? `- Their cousins include: ${rel.cousins.join(', ')}` : ''}
${rel.aunt ? `- They are an aunt/uncle to various family members` : ''}
${rel.nieceNephew ? `- They are a niece/nephew in the family` : ''}
- Family role: ${rel.familyRole || 'individual'} in the ${rel.generation || 'adult'} generation

Use these family relationships to add context to your roast - reference their role as a parent, sibling dynamics, or how they fit into the family structure when it makes the roast funnier or more relatable.`;

  // Roast mode prompt with 70% personal facts focus
  const roastPrompt = `
You are creating a playful "roast" summary of a family member for a family trivia game. This will appear in a featured spotlight carousel as the "roast mode" view.

${contextSection}

${roastRelationshipContext}

TASK: Write a playful, gently teasing summary that lovingly roasts this family member. Focus primarily (70%) on their personal facts and sharing habits, with their gameplay quirks (30%) as supporting material for gentle teasing.

The tone should be humorous and teasing like a close family member would, but NEVER mean-spirited or truly insulting.

Structure your roast to emphasize:

PRIMARY ROAST TARGETS (70% - Personal Facts):
- Gently tease about funny, unusual, or quirky personal facts they've shared
- Playfully comment on their sharing patterns (oversharing vs. being secretive)
- Make light of the contrast between what they reveal and what they keep private
- Lovingly joke about their personal quirks revealed through their answers
- Reference their family role/relationships when it adds humor (e.g., "typical parent behavior" or "classic sibling rivalry")

SECONDARY ROAST TARGETS (30% - Gameplay):
- Their trivia struggles and funny wrong answers (use specific examples)${FEATURE_FLAGS.CASINO_RUSH_ENABLED ? '\n- Casino Rush performance - whether they\'re overconfident, cautious, or hilariously unsuccessful' : ''}
- Their custom categories and the types of questions they create
- Their oddly specific category interests or preferences
- Patterns in the types of questions that consistently trip them up

Remember: Keep all jokes FAMILY-FRIENDLY and end on a genuinely affectionate note that shows you care about them.

${commonInstructions}
`;

  // Build insights extraction prompt
  const insightsPrompt = `
Extract 8-12 specific, interesting highlights about ${name} from their data.

Look for:
- Their favorite things (foods, shows, activities, places)
- Personality traits and characteristics
- Hobbies and interests
- Key facts about their life
- Important relationships

From their personal facts:
${analysis.randomFacts.slice(0, 10).join('\n')}

From their trivia patterns:
- Favorite categories: ${analysis.topCategories.join(', ')}
- Custom categories created: ${analysis.customCategoriesCreated.join(', ')}

Family context:
- ${name} is ${buildFamilyContext()}

IMPORTANT: Return ONLY a JSON object in exactly this format:
{"insights": [
  {"text": "Loves sci-fi shows", "category": "preference"},
  {"text": "June 23rd birthday", "category": "fact"},
  {"text": "Married to Blair", "category": "relationship"},
  {"text": "Gaming enthusiast", "category": "activity"},
  {"text": "Nostalgic personality", "category": "personality"}
]}

Rules:
- Extract specific details from their answers (e.g., if they said "Blue" is their favorite color, write "Loves blue color")
- Keep each insight 2-5 words
- Use natural phrasing ("Loves pasta" not "Likes: pasta")
- Categories: preference, personality, fact, activity, relationship
- Focus on interesting, unique details
`;

  return {
    regularPrompt,
    roastPrompt,
    insightsPrompt
  };
}

/**
 * Generates member summaries using Bedrock Claude 3.7
 */
export async function generateMemberSummary(memberData: MemberData): Promise<{
  regularSummary?: string;
  roastSummary?: string;
  basicQAs?: BasicQA[];
  insights?: MemberInsight[];
}> {
  const cacheKey = `${memberData.userId}_${memberData.type || 'both'}`;
  const currentTime = Date.now();
  
  // Check cache first if not forcing regeneration
  if (!memberData.forceGenerate && 
      summaryCache[cacheKey] && 
      (currentTime - summaryCache[cacheKey].timestamp) < CACHE_TTL) {
    logger.info('Returning cached member summary', { 
      userId: memberData.userId,
      cacheAge: Math.round((currentTime - summaryCache[cacheKey].timestamp) / 1000) + 's'
    });
    return {
      regularSummary: summaryCache[cacheKey].regularSummary,
      roastSummary: summaryCache[cacheKey].roastSummary,
      basicQAs: summaryCache[cacheKey].basicQAs,
      insights: summaryCache[cacheKey].insights
    };
  }
  
  // Add context to logs
  logger.appendKeys({
    userId: memberData.userId,
    name: memberData.name,
    summaryType: memberData.type || 'both'
  });
  
  logger.info('Generating member summary', {
    historyEntries: memberData.answerHistory?.length || 0,
    factsCount: memberData.facts?.length || 0,
    customCategoriesCount: memberData.customCategories?.length || 0
  });
  
  try {
    // Build the prompts
    const { regularPrompt, roastPrompt, insightsPrompt } = await buildMemberSummaryPrompts(memberData);
    
    // Analyze member data to get basicQAs
    const analysis = await analyzeMemberData(memberData);
    
    const result: { 
      regularSummary?: string; 
      roastSummary?: string; 
      basicQAs?: BasicQA[];
      insights?: MemberInsight[];
    } = {
      basicQAs: analysis.basicQAs // Include basic Q&As in result
    };
    
    // Determine what needs to be generated
    const generateBoth = !memberData.type;
    const generateRegular = !memberData.type || memberData.type === 'regular';
    const generateRoast = !memberData.type || memberData.type === 'roast';
    
    // If generating both, do it in parallel for speed
    if (generateBoth) {
      logger.info('Generating both summaries in parallel');

      const memberSummaryModel = getModelForService('MEMBER_SUMMARIES');
      const roastModel = getModelForService('ROAST_SUMMARIES');

      // Create promises for both summaries
      const regularPromise = (async () => {
        try {
          const regularResponse = await invokeBedrockPrompt(
            regularPrompt,
            2048,
            0.7,
            { summaryMode: 'regular' },
            memberSummaryModel
          );

          const regularBuffer = await collectResponseBody(regularResponse);
          const summaryText = extractTextContent(regularBuffer, memberSummaryModel, 'summary');

          return { summary: summaryText };
        } catch (error: any) {
          logger.error('Regular summary generation failed', { error: error.message });
          return { summary: 'Unable to generate summary due to an error.' };
        }
      })();

      const roastPromise = (async () => {
        try {
          const roastResponse = await invokeBedrockPrompt(
            roastPrompt,
            2048,
            0.9,
            { summaryMode: 'roast' },
            roastModel
          );

          const roastBuffer = await collectResponseBody(roastResponse);
          const fullResponse = extractTextContent(roastBuffer, roastModel, 'summary');
          const summaryText = fullResponse.replace(/\{"insights":\s*\[(.*?)\]\}/s, '').trim();
          
          return { summary: summaryText };
        } catch (error: any) {
          logger.error('Roast summary generation failed', { error: error.message });
          return { summary: 'Unable to generate summary due to an error.' };
        }
      })();
      
      // Wait for both to complete
      const [regularResult, roastResult] = await Promise.all([regularPromise, roastPromise]);
      
      result.regularSummary = regularResult.summary;
      result.roastSummary = roastResult.summary;
      
      // Generate insights separately
      try {
        const insightsResponse = await invokeBedrockPrompt(
          insightsPrompt,
          1024,
          0.5,
          { summaryMode: 'insights' },
          memberSummaryModel
        );
        
        const insightsBuffer = await collectResponseBody(insightsResponse);
        
        // Parse the response directly to avoid string conversion issues
        try {
          const responseText = insightsBuffer.toString('utf-8');
          const responseJson = JSON.parse(responseText);
          
          // Extract the actual insights array from the response
          let insightsData;
          if (isClaudeModel(memberSummaryModel)) {
            // Claude format
            const content = responseJson.content?.[0]?.text;
            if (content) {
              // Try to parse the content as JSON
              try {
                insightsData = JSON.parse(content);
              } catch (e) {
                // Content might be the insights array directly
                insightsData = content;
              }
            }
          } else {
            // Fallback for other models
            insightsData = responseJson.generation || responseJson.text || responseJson;
          }
          
          logger.info('Insights response received', { 
            type: typeof insightsData,
            isArray: Array.isArray(insightsData),
            preview: JSON.stringify(insightsData).slice(0, 200)
          });
          
          // Handle different response formats
          if (typeof insightsData === 'string') {
            result.insights = extractInsights(insightsData);
          } else if (Array.isArray(insightsData)) {
            // Direct array of insights
            result.insights = insightsData.filter((insight: any) => 
              insight.text && 
              insight.category && 
              ['preference', 'personality', 'fact', 'activity', 'relationship'].includes(insight.category)
            );
          } else if (insightsData && typeof insightsData === 'object' && insightsData.insights) {
            // Object with insights property
            result.insights = insightsData.insights.filter((insight: any) => 
              insight.text && 
              insight.category && 
              ['preference', 'personality', 'fact', 'activity', 'relationship'].includes(insight.category)
            );
          } else {
            // Try to extract as string
            result.insights = extractInsights(JSON.stringify(insightsData));
          }
        } catch (parseError: any) {
          logger.warn('Failed to parse insights response directly', { error: parseError.message });
          // Fallback to original method
          const insightsJson = extractTextContent(insightsBuffer, memberSummaryModel, 'insights');
          result.insights = extractInsights(insightsJson);
        }
        logger.info('Insights extracted', { count: result.insights?.length || 0 });
      } catch (insightError: any) {
        logger.warn('Failed to generate insights', { error: insightError.message });
        result.insights = [];
      }
      
      logger.info('Both summaries generated in parallel', {
        regularLength: result.regularSummary?.length,
        roastLength: result.roastSummary?.length,
        insightsCount: result.insights?.length || 0
      });
    } else if (generateRegular) {
      // Generate only regular summary
      logger.info('Generating regular summary only');
      try {
        const memberSummaryModel = getModelForService('MEMBER_SUMMARIES');
        
        const regularResponse = await invokeBedrockPrompt(
          regularPrompt, 
          2048,
          0.7,
          { summaryMode: 'regular' },
          memberSummaryModel
        );
        
        const regularBuffer = await collectResponseBody(regularResponse);
        const summaryText = extractTextContent(regularBuffer, memberSummaryModel, 'summary');
        
        result.regularSummary = summaryText;
        
        // Generate insights separately if not already present
        if (!result.insights) {
          try {
            const insightsResponse = await invokeBedrockPrompt(
              insightsPrompt,
              1024,
              0.5,
              { summaryMode: 'insights' },
              memberSummaryModel
            );
            
            const insightsBuffer = await collectResponseBody(insightsResponse);
            
            // Parse the response directly to avoid string conversion issues
            try {
              const responseText = insightsBuffer.toString('utf-8');
              const responseJson = JSON.parse(responseText);
              
              // Extract the actual insights array from the response
              let insightsData;
              if (isClaudeModel(memberSummaryModel)) {
                // Claude format
                const content = responseJson.content?.[0]?.text;
                if (content) {
                  // Try to parse the content as JSON
                  try {
                    insightsData = JSON.parse(content);
                  } catch (e) {
                    // Content might be the insights array directly
                    insightsData = content;
                  }
                }
              } else {
                // Fallback for other models
                insightsData = responseJson.generation || responseJson.text || responseJson;
              }
              
              logger.info('Insights response received', { 
                type: typeof insightsData,
                isArray: Array.isArray(insightsData),
                preview: JSON.stringify(insightsData).slice(0, 200)
              });
              
              // Handle different response formats
              if (typeof insightsData === 'string') {
                result.insights = extractInsights(insightsData);
              } else if (Array.isArray(insightsData)) {
                // Direct array of insights
                result.insights = insightsData.filter((insight: any) => 
                  insight.text && 
                  insight.category && 
                  ['preference', 'personality', 'fact', 'activity', 'relationship'].includes(insight.category)
                );
              } else if (insightsData && typeof insightsData === 'object' && insightsData.insights) {
                // Object with insights property
                result.insights = insightsData.insights.filter((insight: any) => 
                  insight.text && 
                  insight.category && 
                  ['preference', 'personality', 'fact', 'activity', 'relationship'].includes(insight.category)
                );
              } else {
                // Try to extract as string
                result.insights = extractInsights(JSON.stringify(insightsData));
              }
            } catch (parseError: any) {
              logger.warn('Failed to parse insights response directly', { error: parseError.message });
              // Fallback to original method
              const insightsJson = extractTextContent(insightsBuffer, memberSummaryModel, 'insights');
              result.insights = extractInsights(insightsJson);
            }
            logger.info('Insights extracted', { count: result.insights?.length || 0 });
          } catch (insightError: any) {
            logger.warn('Failed to generate insights', { error: insightError.message });
            result.insights = [];
          }
        }
        
        logger.info('Regular summary generated', {
          length: result.regularSummary?.length,
          insightsCount: result.insights?.length || 0,
          preview: result.regularSummary?.slice(0, 80) + '...'
        });
      } catch (error: any) {
        logger.error('Regular summary generation failed', { error: error.message });
        result.regularSummary = 'Unable to generate summary due to an error.';
      }
    } else if (generateRoast) {
      // Generate only roast summary
      logger.info('Generating roast summary only');
      try {
        const roastModel = getModelForService('ROAST_SUMMARIES');

        const roastResponse = await invokeBedrockPrompt(
          roastPrompt,
          2048,
          0.9,
          { summaryMode: 'roast' },
          roastModel
        );

        const roastBuffer = await collectResponseBody(roastResponse);
        const fullResponse = extractTextContent(roastBuffer, roastModel, 'summary');
        
        // For roast-only, we should still extract insights if not already present
        if (!result.insights) {
          const insights = extractInsights(fullResponse);
          if (insights.length > 0) {
            result.insights = insights;
          }
        }
        
        const summaryText = fullResponse.replace(/\{"insights":\s*\[(.*?)\]\}/s, '').trim();
        result.roastSummary = summaryText;
        
        logger.info('Roast summary generated', {
          length: result.roastSummary?.length,
          insightsCount: result.insights?.length || 0,
          preview: result.roastSummary?.slice(0, 80) + '...'
        });
      } catch (error: any) {
        logger.error('Roast summary generation failed', { error: error.message });
        result.roastSummary = 'Unable to generate summary due to an error.';
      }
    }
    
    // Update cache
    summaryCache[cacheKey] = {
      regularSummary: result.regularSummary,
      roastSummary: result.roastSummary,
      basicQAs: result.basicQAs,
      insights: result.insights,
      timestamp: currentTime
    };
    
    return result;
  } catch (error: any) {
    logger.error('Member summary generation failed', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to generate member summaries: ${error.message}`);
  } finally {
    // Clean up log context
    logger.removeKeys(['userId', 'name', 'summaryType']);
  }
}