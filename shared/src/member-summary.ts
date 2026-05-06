/** Structure for basic Q&A */
export interface BasicQA {
  question: string;
  answer: string;
}

/** Structure for member insights */
export interface MemberInsight {
  text: string;
  category: 'preference' | 'personality' | 'fact' | 'activity' | 'relationship';
}

/** Structure for a member summary */
export interface MemberSummaryResponse {
  userId: string;
  summary: string;
  mode: 'regular' | 'roast';
  lastUpdated: string;
  basicQAs?: BasicQA[];
  insights?: MemberInsight[];
}
