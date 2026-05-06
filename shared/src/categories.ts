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
