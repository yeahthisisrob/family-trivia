import type { ResponseOf } from '../../../shared/api/contract';

/** The family as a graph: people with activity, ties, households, answered-alike pairs. */
export type GraphData = ResponseOf<'/graph'>;
export type GraphPerson = GraphData['people'][number];
