/** Birthday entry */
export interface Birthday {
  userId: string;
  name: string;
  birthday: string;
  month: number;
  day: number;
  daysUntil: number;
  isToday: boolean;
  isPast: boolean;
  type?: 'birthday' | 'anniversary' | 'holiday' | 'other';
  description?: string;
  year?: number;
  celebrationId?: string;
  isFromFacts?: boolean;
}

/** Upcoming birthdays response */
export interface UpcomingBirthdaysResponse {
  birthdays: Birthday[];
  todaysBirthdays: Birthday[];
}

/** Celebration entry */
export interface Celebration {
  id: string;
  type: 'birthday' | 'anniversary' | 'holiday' | 'other';
  name: string;
  date: string;
  description?: string;
  addedBy: string;
  addedAt: string;
  recurring: boolean;
  year?: number;
  addedByName?: string;
  isFromFacts?: boolean;
  isManual?: boolean;
}

/** Celebrations response */
export interface CelebrationsResponse {
  celebrations: Celebration[];
  lastUpdated: string;
}
