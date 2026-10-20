import type { NotificationItem } from '@family-trivia/shared';
import { describe, expect, it } from 'vitest';
import { notificationDetail, notificationMessage } from './notificationText';

const item = (n: Partial<NotificationItem>): NotificationItem =>
  ({
    id: 'n1',
    type: 'comment',
    timestamp: '2026-10-19T12:00:00Z',
    read: false,
    ...n,
  }) as NotificationItem;

describe('notificationMessage', () => {
  it('says who commented, and how many when there are several', () => {
    expect(notificationMessage(item({ commentUserId: 'bob' }))).toBe('bob commented');
    expect(notificationMessage(item({ commentUserId: 'bob', threadCommentCount: 3 }))).toBe(
      'bob commented (3 new)',
    );
  });

  it('names the place on the leaderboard', () => {
    const lead = { type: 'leader_change' as const, newLeaderId: 'carol' };
    expect(notificationMessage(item({ ...lead, podiumPosition: 2 }))).toBe(
      'carol moved into 2nd place!',
    );
    expect(notificationMessage(item(lead))).toBe('carol took the lead!');
  });

  it('names the game for a high score, with the score below', () => {
    const hs = item({
      type: 'high_score',
      scoreUserId: 'dave',
      gameId: 'slot-machine',
      score: 1200,
    });
    expect(notificationMessage(hs)).toBe('dave set a new Slot Machine high score!');
    expect(notificationDetail(hs)).toBe('Score: 1,200');
  });
});
