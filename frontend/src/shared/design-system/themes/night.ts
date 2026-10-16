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
  /** Territories on a map: soft, saturated pastels that glow on the sky. */
  territories: [
    '#7cc4ff',
    '#ffb86b',
    '#c3a6ff',
    '#7be0b0',
    '#ff8fb1',
    '#f3e37a',
    '#6fe3e3',
    '#ff9d7a',
    '#a7c7ff',
  ],
} as const;
