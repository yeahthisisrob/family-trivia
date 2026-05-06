/** Group description */
export interface GroupDescription {
  groupId: string;
  description: string;
  updatedBy: string;
  updatedAt: string;
}

/** AI-generated group description suggestion */
export interface GroupDescriptionSuggestion {
  suggestion: string;
  groupId: string;
}
