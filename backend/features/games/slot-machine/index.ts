/**
 * The Slot Machine on the server: its routes (served at /slot-machine/*),
 * its files (slot-machine/<userId>/...), and its high-score board, fed by
 * the casino's slots, which earns podium points.
 */
import { canPlayGameModeAny } from '../../../services/gameModeService';
import { getJson } from '../../../services/s3';
import { defineServerGame } from '../kit';
import { openSessions, playerSession, resetPlayer } from './admin';
import {
  ENABLED,
  type SlotMachineSession,
  slotMachineAnswer,
  slotMachineArcadeSpin,
  slotMachineBalance,
  slotMachineQuestion,
  slotMachineSpin,
  slotMachineStatus,
} from './handlers';
import { keys, STORAGE } from './keys';

export default defineServerGame({
  id: 'slot-machine',
  label: 'Slot Machine',
  storage: STORAGE,
  podium: true,
  routes: {
    'POST spin': slotMachineSpin,
    'POST question': slotMachineQuestion,
    'POST answer': slotMachineAnswer,
    'GET status': slotMachineStatus,
    'POST arcade-spin': slotMachineArcadeSpin,
    'GET balance': slotMachineBalance,
  },
  // A spin left open resumes when the game opens, so it doesn't lock the tile.
  async status(userId) {
    const [session, gate] = await Promise.all([
      getJson<SlotMachineSession>(keys.session(userId)).catch(() => null),
      canPlayGameModeAny(userId, 'slot-machine').catch(() => null),
    ]);
    return {
      canPlay: ENABLED && (gate?.canPlay ?? true),
      nextAvailable: gate?.nextAvailable ?? null,
      active: session?.status === 'active',
    };
  },
  admin: { open: openSessions, of: playerSession, reset: resetPlayer },
});
