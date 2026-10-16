/**
 * The night surface: where the family graph, maps and charts live. It is dark
 * in every theme and mode on purpose: glowing people, colored lines and soft
 * halos read best on a deep sky, and the graph looks the same for everyone.
 */
export const night = {
  sky: '#0b1020',
  surface: '#121a2e',
  raised: '#1a2440',
  grid: 'rgba(230, 236, 255, 0.08)',
  line: 'rgba(230, 236, 255, 0.22)',
  text: '#e6ecff',
  textDim: 'rgba(230, 236, 255, 0.62)',
  glow: 'rgba(140, 170, 255, 0.35)',
  /** Someone the family remembers: a warm white star with a gold halo. */
  remembered: '#f6ead0',
  halo: '#e8c66a',
} as const;
