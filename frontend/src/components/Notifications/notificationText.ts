/** What a notification says, in the bell's panel and in its toast (0031). */
import type { NotificationItem } from '@family-trivia/shared';
import { reactionById } from '@family-trivia/shared';

const GAME_LABELS: Record<string, string> = {
  tetris: 'Tetris',
  curling: 'Curling',
  'slot-machine': 'Slots',
  snake: 'Snake',
  crossword: 'Crossword',
  blackjack: 'Blackjack',
  casino: 'Casino',
};

const PLACE: Record<number, string> = {
  1: 'took the lead!',
  2: 'moved into 2nd place!',
  3: 'cracked the top 3!',
};

/** The one line: who did what. */
export function notificationMessage(item: NotificationItem): string {
  const gameLabel = item.gameId ? (GAME_LABELS[item.gameId] ?? item.gameId) : '';
  const reaction = item.type === 'reaction' && item.reaction ? reactionById(item.reaction) : null;
  if (reaction)
    return `${item.reactionUserId} reacted ${reaction.emoji} to your ${item.contentType === 'trivia' ? 'answer' : 'fact'}`;
  switch (item.type) {
    case 'comment':
      return `${item.commentUserId} commented${item.threadCommentCount && item.threadCommentCount > 1 ? ` (${item.threadCommentCount} new)` : ''}`;
    case 'high_score':
      return `${item.scoreUserId} set a new ${gameLabel} high score!`;
    case 'family_feud':
      return item.feudEventType === 'new_round'
        ? `New Family Feud! About ${item.feudTargetName}`
        : `Family Feud results are in! ${item.feudWinnerCount === 0 ? 'Nobody guessed right!' : `${item.feudWinnerCount} got it right`}`;
    case 'album_added':
      return `${item.albumAddedBy} shared a new album`;
    default:
      return item.leaderType === 'group'
        ? `${item.newLeaderId} is now the top team!`
        : `${item.newLeaderId} ${PLACE[item.podiumPosition ?? 1] ?? PLACE[1]}`;
  }
}

/** The quoted second line, when there is one. */
export function notificationDetail(item: NotificationItem): string | undefined {
  switch (item.type) {
    case 'comment':
      return item.commentText;
    case 'high_score':
      return `Score: ${item.score?.toLocaleString()}${item.rank === 1 ? ' — #1 overall!' : item.rank ? ` — Rank #${item.rank}` : ''}`;
    case 'family_feud':
      return item.feudEventType === 'new_round'
        ? `"${item.feudQuestion}"`
        : `About ${item.feudTargetName} — ${item.feudTotalGuesses} guesses`;
    case 'album_added':
      return item.albumName;
    default:
      return undefined;
  }
}
