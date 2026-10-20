/**
 * Your world as server data (docs/decisions/0035): built for you alone from
 * every circle you're in, and cached under the circle the tab is in, like
 * every read.
 */
import { useCircleQuery } from '../../../shared/api/query';

export const useYourWorld = () => useCircleQuery({ key: ['your-world'], path: '/me/world' });
