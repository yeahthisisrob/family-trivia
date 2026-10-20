import { paceOf, type SeasonPace } from '@family-trivia/shared';
import { useFamilyData } from '../contexts/FamilyDataContext';

/** Daily or weekly: what "today" means in the season being played (docs/decisions/0016). */
export function useSeasonPace(): SeasonPace {
  return paceOf(useFamilyData().seasonStatus?.currentSeason);
}
