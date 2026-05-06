// Module: triviaBank
// Admin trivia bank management API

import { apiService } from '../../services/ApiService';

export interface BankStats {
  totalQuestions: number;
  categories: Array<{
    category: string;
    count: number;
    difficulties: { easy: number; normal: number; hard: number };
  }>;
  sources: Array<[string, number]>;
  questionsAsked: number;
}

export interface BankQuestion {
  question: string;
  choices: string[];
  answer: string;
  category: string;
  difficulty: string;
  source: string;
  externalId?: string;
}

export interface ImportResult {
  source: string;
  category: string;
  difficulty: string;
  fetched: number;
  added: number;
  duplicates: number;
  errors: number;
}

export async function getBankStats(adminUserId: string): Promise<BankStats> {
  return apiService.request<BankStats>(
    `/admin/trivia-bank/stats?adminUserId=${encodeURIComponent(adminUserId)}`,
    { method: 'GET' },
  );
}

export async function browseQuestions(
  adminUserId: string,
  category: string,
  difficulty: string,
  offset = 0,
  limit = 20,
): Promise<{ questions: BankQuestion[]; total: number }> {
  const params = new URLSearchParams({
    adminUserId, category, difficulty,
    offset: String(offset), limit: String(limit),
  });
  return apiService.request<{ questions: BankQuestion[]; total: number }>(
    `/admin/trivia-bank/browse?${params}`,
    { method: 'GET' },
  );
}

export async function deleteQuestion(
  adminUserId: string,
  category: string,
  difficulty: string,
  questionText: string,
): Promise<void> {
  await apiService.request('/admin/trivia-bank/question', {
    method: 'DELETE',
    body: JSON.stringify({ adminUserId, category, difficulty, questionText }),
  });
}

export async function importQuestions(
  adminUserId: string,
  source: string,
  category: string,
  difficulty: string,
  count?: number,
): Promise<ImportResult> {
  return apiService.request<ImportResult>('/admin/trivia-bank/import', {
    method: 'POST',
    body: JSON.stringify({ adminUserId, source, category, difficulty, count }),
  }, undefined, false, 120000); // 2 min timeout for imports
}
