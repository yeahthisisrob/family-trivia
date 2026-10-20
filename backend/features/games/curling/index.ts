/** Curling on the server: its high-score board earns podium points. */
import { defineServerGame } from '../kit';

export default defineServerGame({ id: 'curling', label: 'Curling', podium: true });
