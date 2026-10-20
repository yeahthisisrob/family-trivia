/** Tetris on the server: its high-score board earns podium points. */
import { defineServerGame } from '../kit';

export default defineServerGame({ id: 'tetris', label: 'Tetris', podium: true });
