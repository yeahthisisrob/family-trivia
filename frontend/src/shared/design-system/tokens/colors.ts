export const colors = {
  /** Text and icons on a colored surface (a button, a badge, a game tile). */
  onColor: '#ffffff',
  /** The base for shadows and dark overlays: use with alpha(), e.g. alpha(colors.scrim, 0.2). */
  scrim: '#000000',

  /**
   * Fixed decorative hues: category icons, badges, charts. The same in every
   * theme and mode, chosen to read on both light and dark surfaces. Reach for
   * a theme role (primary, secondary, success, error) first; use an accent
   * when a color names a thing, not a role.
   */
  accent: {
    red: '#e53935',
    orange: '#fb8c00',
    amber: '#ffb300',
    gold: '#ffd700',
    green: '#43a047',
    teal: '#00897b',
    sky: '#64b5f6',
    blue: '#1e88e5',
    indigo: '#3949ab',
    violet: '#7c4dff',
    purple: '#8e24aa',
    pink: '#d81b60',
    brown: '#6d4c41',
    slate: '#546e7a',
  },

  // Brand colors follow the active theme (themes/registry.ts): CSS
  // variables set by AppearanceProvider, with Classic as the fallback.
  brand: {
    primary: 'var(--ft-brand-primary, #2e7d32)',
    primaryLight: 'var(--ft-brand-primary-light, #4caf50)',
    primaryDark: 'var(--ft-brand-primary-dark, #1b5e20)',
    secondary: 'var(--ft-brand-secondary, #ef6c00)',
    secondaryLight: 'var(--ft-brand-secondary-light, #ffb74d)',
    secondaryDark: 'var(--ft-brand-secondary-dark, #e65100)',
  },

  difficulty: {
    easy: '#4caf50',
    normal: '#2196f3',
    hard: '#f44336',
  },

  result: {
    correct: '#4caf50',
    correctBg: 'rgba(76, 175, 80, 0.08)',
    incorrect: '#e74c3c',
    incorrectBg: 'rgba(231, 76, 60, 0.08)',
  },

  medal: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  },

  category: {
    custom: '#9C27B0',
    customBg: 'rgba(156, 39, 176, 0.08)',
    default: '#607D8B',
    defaultBg: 'rgba(96, 125, 139, 0.08)',
  },

  // Surfaces, text and borders follow the theme and mode: they are CSS
  // variables set by AppearanceProvider (themes/vars.ts), with
  // the light value as fallback. Use them anywhere a color string goes; to
  // fade one, use tint(), not alpha().
  surface: {
    default: 'var(--ft-surface-default, #f9f9f9)',
    card: 'var(--ft-surface-card, #ffffff)',
    header: 'var(--ft-surface-header, #1b5e20)',
    subtle: 'var(--ft-surface-subtle, #f5f5f5)',
  },

  text: {
    primary: 'var(--ft-text-primary, rgba(0, 0, 0, 0.87))',
    secondary: 'var(--ft-text-secondary, rgba(0, 0, 0, 0.6))',
    disabled: 'var(--ft-text-disabled, rgba(0, 0, 0, 0.38))',
    inverse: '#ffffff',
  },

  casinoRush: {
    background: '#1a1a1a',
    surface: '#0a0a0a',
    accent: '#ff6b6b',
    gold: '#f7b731',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
  },

  user: ['#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#FFC107', '#E91E63', '#00BCD4'] as const,

  familySide: {
    side1: '#2196F3',
    side2: '#FF9800',
    neutral: '#607D8B',
  },

  border: {
    light: 'var(--ft-border-light, rgba(0, 0, 0, 0.12))',
    medium: 'var(--ft-border-medium, rgba(0, 0, 0, 0.23))',
  },

  // Default fallback for users without an assigned color
  defaultUser: '#1976d2',

  /**
   * One color per person, picked by a stable hash of their id (identityColor).
   * Identity follows the person, never their rank, and is the same in every theme.
   */

  // Game mode gradients — used on Arcade tiles and CategorySelect cards.
  // Each is a CSS linear-gradient string plus a complementary accent.
  gameMode: {
    slotMachine: {
      gradient: 'linear-gradient(135deg, #c62828 0%, #ef6c00 100%)',
      accent: '#ffd54f',
    },
    tetris: {
      gradient: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 60%, #ce93d8 100%)',
      accent: '#e1bee7',
    },
    curling: {
      gradient: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 60%, #64b5f6 100%)',
      accent: '#ffffff',
    },
    crossword: {
      gradient: 'linear-gradient(135deg, #00695c 0%, #00897b 60%, #4db6ac 100%)',
      accent: '#b2dfdb',
    },
    snake: {
      gradient: 'linear-gradient(135deg, #1b5e20 0%, #388e3c 60%, #66bb6a 100%)',
      accent: '#a5d6a7',
    },
  },
} as const;
