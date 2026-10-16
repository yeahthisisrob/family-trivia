/** System category definition */
export interface SystemCategory {
  name: string;
  description: string;
  color?: string;
  emoji?: string;
}

/** User custom category */
export interface CustomCategory {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  type: 'custom';
  isPublic?: boolean;
  tags?: string[];
  questionCount?: number;
}

/** Categories response from the API */
export interface CategoryResponse {
  systemCategories: SystemCategory[];
  customCategories: CustomCategory[];
  lastCustomCategory?: CustomCategory;
}

/** The category whose questions are about the family itself, written from its own answers. */
export const FAMILY_CATEGORY: SystemCategory = {
  name: 'Our Family',
  description: 'Questions about us, from our own answers',
  emoji: '🏡',
};

export const isFamilyCategory = (name: string | undefined) => name === FAMILY_CATEGORY.name;

/** The categories a season offers. */
export function categoriesFor(
  system: SystemCategory[],
  trivia: 'general' | 'family' | 'mixed' | 'off',
): SystemCategory[] {
  if (trivia === 'off') return [];
  if (trivia === 'family') return [FAMILY_CATEGORY];
  if (trivia === 'mixed')
    return [FAMILY_CATEGORY, ...system.filter((c) => !isFamilyCategory(c.name))];
  return system;
}
