// Motion tokens — keep animations consistent across the app.
export const motion = {
  ease: {
    /** Slight overshoot for entrances */
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** MUI-standard smooth */
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Quick in, gentle out */
    snappy: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
} as const;
