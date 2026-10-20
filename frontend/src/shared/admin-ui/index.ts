/** The pieces every Admin tab is built from: cards, the confirm step, empty lists. */
export { default as AdminCard } from './AdminCard';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as EmptyState } from './EmptyState';

/** What went wrong with a save, in the server's words when it gave some. */
export const problemOf = (e: Error | null): string | null =>
  e ? e.message || "That didn't save. Try again." : null;
