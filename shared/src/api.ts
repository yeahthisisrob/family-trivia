/** Successful API response envelope */
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

/** Error API response envelope */
export interface ApiErrorResponse {
  ok: false;
  error: string;
  details?: string;
  errorType?: string;
}

/** Unified API response envelope */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Error response from the server (legacy, use ApiErrorResponse for new code) */
export interface ErrorResponse {
  error: string;
  details?: string;
  errorType?: string;
}

/** Generic submission result */
export interface SubmissionResult {
  correct: boolean;
  streak: number;
  pointsEarned?: number;
  correctAnswer?: string;
  message?: string;
}
