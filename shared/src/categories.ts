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

/** General trivia every circle starts with, until an admin changes them. */
export const DEFAULT_CATEGORIES: SystemCategory[] = [
  {
    name: 'History & Politics',
    description: 'Famous events, leaders, and political movements that shaped the world.',
    color: '#E53935',
  },
  {
    name: 'Science & Nature',
    description: 'Animals, space, physics, chemistry, and the natural world.',
    color: '#43A047',
  },
  {
    name: 'Geography & Travel',
    description: 'Countries, capitals, landmarks, cultures, and world geography.',
    color: '#1E88E5',
  },
  {
    name: 'Pop Culture',
    description: 'Movies, music, celebrities, TV shows, and modern entertainment.',
    color: '#8E24AA',
  },
  {
    name: 'Sports & Games',
    description: 'Olympics, famous athletes, board games, and video game trivia.',
    color: '#FB8C00',
  },
  {
    name: 'Literature & Arts',
    description: 'Authors, classic books, visual arts, theater, and music history.',
    color: '#FDD835',
  },
  {
    name: 'Fun Facts & Oddities',
    description: 'Weird records, strange traditions, quirky laws, and surprising trivia.',
    color: '#00ACC1',
  },
];

/** The category whose questions are about the family itself, written from its own answers. */
export const FAMILY_CATEGORY: SystemCategory = {
  name: 'Our Family',
  description: 'Questions about us, from our own answers',
  emoji: '🏡',
};

export const isFamilyCategory = (name: string | undefined) => name === FAMILY_CATEGORY.name;

/** The categories a season offers. */
export function categoriesFor(
  stored: SystemCategory[],
  trivia: 'general' | 'family' | 'mixed' | 'off',
): SystemCategory[] {
  const system = stored.length ? stored : DEFAULT_CATEGORIES;
  if (trivia === 'off') return [];
  if (trivia === 'family') return [FAMILY_CATEGORY];
  if (trivia === 'mixed')
    return [FAMILY_CATEGORY, ...system.filter((c) => !isFamilyCategory(c.name))];
  return system;
}
