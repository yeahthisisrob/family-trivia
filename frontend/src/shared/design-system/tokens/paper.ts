/** Letters and memorial pages: warm paper and ink in every theme and mode. */
export const paper = {
  paper: '#f3ead7',
  edge: '#e6dabf',
  glow: '#faf2dd',
  ink: '#3a2e21',
  inkSoft: '#6b5a44',
  rule: '#c9b994',
  shadow: 'rgba(58, 46, 33, 0.35)',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
} as const;

/** The same paper in a dark room: warm brown, cream ink, for dark mode. */
export const paperNight = {
  paper: '#241e19',
  edge: '#2f2721',
  glow: '#2b241e',
  ink: '#f0e5cd',
  inkSoft: '#bba98a',
  rule: '#5c4d3b',
  shadow: 'rgba(0, 0, 0, 0.55)',
  serif: paper.serif,
} as const;
