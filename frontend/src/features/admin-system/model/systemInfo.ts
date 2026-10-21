/**
 * The deployment, a health check and counts, as server data
 * (docs/decisions/0035). A change to the Trivia Bank changes its count.
 */
import { useCircleQuery } from '../../../shared/api/query';

export const SYSTEM_INFO = ['admin', 'system-info'] as const;

export const useSystemInfo = () => useCircleQuery({ key: SYSTEM_INFO, path: '/admin/system-info' });
