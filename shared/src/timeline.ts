import { FactItem } from './profile';
import { HistoryEntry } from './history';
import { FamilySideConfig } from './family';

/** Pagination info for timeline */
export interface PaginationInfo {
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;
  nextFactCursor: string | null;
  nextTriviaCursor: string | null;
}

/** Timeline fact entry with user context */
export interface TimelineFactEntry extends FactItem {
  userId: string;
  username: string;
  groupId: string;
  familySide: string;
}

/** Timeline trivia entry with user context */
export interface TimelineTriviaEntry extends HistoryEntry {
  userId: string;
  username: string;
  groupId: string;
  familySide: string;
}

/** Timeline data response type */
export interface TimelineData {
  facts: TimelineFactEntry[];
  trivia: TimelineTriviaEntry[];
  familySides: Record<string, FamilySideConfig>;
  hierarchyData?: {
    family: {
      people: Record<string, {
        name: string;
        groupId: string;
        familySide?: string;
        [key: string]: unknown;
      }>;
      groups: Record<string, {
        name: string;
        description?: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  pagination?: PaginationInfo;
}

/** Options for timeline filtering */
export interface TimelineOptions {
  side?: string;
  userId?: string;
  limit?: number;
  before?: string;
  after?: string;
}
