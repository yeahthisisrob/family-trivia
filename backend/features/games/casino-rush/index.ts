/**
 * Casino Rush on the server: its routes (served at /casino-rush/*), its
 * files (casino-rush/<userId>/...), and what the rest of the app reads
 * about it through services/gameRegistry.
 */
import { canPlayGameModeAny } from '../../../services/gameModeService';
import { getJson } from '../../../services/s3';
import { defineServerGame } from '../kit';
import { openSessions, playerSession, resetPlayer } from './admin';
import { casinoRushStartGame, casinoRushStatus, casinoRushSubmitAnswer, ENABLED } from './handlers';
import { keys, STORAGE } from './keys';
import { type CasinoRushSession, olderAnswers } from './sessions';
import { casinoRushFacts } from './summary';

export default defineServerGame({
  id: 'casino-rush',
  label: 'Casino Rush',
  storage: STORAGE,
  routes: {
    'POST start': casinoRushStartGame,
    'POST answer': casinoRushSubmitAnswer,
    'GET status': casinoRushStatus,
  },
  async status(userId) {
    const [session, gate] = await Promise.all([
      getJson<CasinoRushSession>(keys.current(userId)).catch(() => null),
      canPlayGameModeAny(userId, 'casino-rush').catch(() => null),
    ]);
    const active = session?.status === 'active';
    return {
      canPlay: ENABLED && (gate?.canPlay ?? true) && !active,
      nextAvailable: gate?.nextAvailable ?? null,
      active,
    };
  },
  olderAnswers,
  admin: { open: openSessions, of: playerSession, reset: resetPlayer },
  aboutPlayer: {
    facts: (userId) => (ENABLED ? casinoRushFacts(userId) : Promise.resolve('')),
    guideline:
      "- Include Casino Rush performance if they've participated (successes, failures, favorite categories)",
    focus: '- Casino Rush participation (are they the family risk-taker or cautious one?)',
    roast:
      "- Casino Rush performance - whether they're overconfident, cautious, or hilariously unsuccessful",
  },
});
