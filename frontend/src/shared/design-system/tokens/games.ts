/**
 * Game art palettes. A game board is a drawing (felt, ice, a slot cabinet),
 * not app chrome, so its colors stay fixed across themes and modes. Keeping
 * them here, named by what they paint, means game components never carry raw
 * hex and a board can be restyled in one place.
 *
 * Add one entry per game, named by the thing painted: `felt`, `rail`,
 * `ice`, `houseRing`, `cabinet`, `reelWindow`.
 */
export const games = {} as Record<string, Record<string, string>>;
