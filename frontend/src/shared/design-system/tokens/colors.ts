export const colors = {
  brand: {
    primary: '#2e7d32',
    primaryLight: '#4caf50',
    primaryDark: '#1b5e20',
    secondary: '#ff9800',
    secondaryLight: '#ffb74d',
    secondaryDark: '#f57c00',
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

  surface: {
    default: '#f9f9f9',
    card: '#ffffff',
    header: '#2e7d32',
    subtle: '#f5f5f5',
  },

  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.38)',
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

  user: [
    '#FF5722',
    '#4CAF50',
    '#2196F3',
    '#9C27B0',
    '#FFC107',
    '#E91E63',
    '#00BCD4',
  ] as const,

  familySide: {
    side1: '#2196F3',
    side2: '#FF9800',
    neutral: '#607D8B',
  },

  border: {
    light: 'rgba(0, 0, 0, 0.12)',
    medium: 'rgba(0, 0, 0, 0.23)',
  },

  // Default fallback for users without an assigned color
  defaultUser: '#1976d2',

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
