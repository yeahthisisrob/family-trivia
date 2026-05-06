/**
 * GamePad — reusable low-latency control surface for arcade games.
 *
 * Two layouts:
 *   - dpad: four directional buttons in a cross (Snake)
 *   - bar:  horizontal row of action buttons (Tetris)
 *
 * Optimized for mobile:
 *   - onPointerDown for zero-delay input (no 300ms click delay)
 *   - touchAction: none prevents scroll/zoom interference
 *   - Optional haptic vibration on press
 *   - Optional repeat-on-hold for buttons that need it (e.g., Tetris left/right)
 *   - Visual press feedback via scale + brightness
 */

import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────

export interface GamePadButton {
  /** Unique id — for dpad must be 'up' | 'down' | 'left' | 'right' */
  id: string;
  /** Display label (Unicode symbol, short text, etc.) */
  label: string;
  /** Fires on press */
  onPress: () => void;
  /** If true, fires repeatedly while held (~100ms interval) */
  repeat?: boolean;
}

interface GamePadProps {
  buttons: GamePadButton[];
  layout: 'dpad' | 'bar';
  /** Accent color for buttons (default: green) */
  accentColor?: string;
  disabled?: boolean;
}

// ── Constants ────────────────────────────────────────────────────

const REPEAT_DELAY = 180;
const REPEAT_INTERVAL = 70;
const HAPTIC_MS = 8;

function vibrate() {
  try { navigator?.vibrate?.(HAPTIC_MS); } catch { /* ok */ }
}

// ── Single button (shared by both layouts) ───────────────────────

interface PadButtonProps {
  label: string;
  onPress: () => void;
  repeat?: boolean;
  accent: string;
  disabled?: boolean;
  size: { w: number; h: number };
  fontSize?: string;
  borderRadius?: number;
}

const PadButton: React.FC<PadButtonProps> = ({
  label, onPress, repeat, accent, disabled, size, fontSize = '1.4rem', borderRadius = 14,
}) => {
  const [pressed, setPressed] = useState(false);
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRepeat = useCallback(() => {
    if (repeatTimerRef.current) { clearTimeout(repeatTimerRef.current); repeatTimerRef.current = null; }
    if (repeatIntervalRef.current) { clearInterval(repeatIntervalRef.current); repeatIntervalRef.current = null; }
  }, []);

  const handleDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled) return;
    setPressed(true);
    vibrate();
    onPress();
    if (repeat) {
      clearRepeat();
      repeatTimerRef.current = setTimeout(() => {
        repeatIntervalRef.current = setInterval(() => {
          vibrate();
          onPress();
        }, REPEAT_INTERVAL);
      }, REPEAT_DELAY);
    }
  }, [onPress, repeat, disabled, clearRepeat]);

  const handleUp = useCallback(() => {
    setPressed(false);
    clearRepeat();
  }, [clearRepeat]);

  return (
    <Box
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onPointerCancel={handleUp}
      sx={{
        width: size.w,
        height: size.h,
        borderRadius: `${borderRadius}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: pressed ? accent : alpha(accent, 0.85),
        boxShadow: pressed
          ? `inset 0 2px 4px ${alpha('#000', 0.3)}`
          : `0 3px 0 ${alpha('#000', 0.25)}, 0 4px 8px ${alpha('#000', 0.15)}`,
        transform: pressed ? 'scale(0.94) translateY(1px)' : 'scale(1)',
        transition: 'transform 60ms, box-shadow 60ms, background-color 60ms',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      <Typography sx={{
        fontSize,
        fontWeight: 900,
        color: '#fff',
        lineHeight: 1,
        textShadow: `0 1px 2px ${alpha('#000', 0.3)}`,
        pointerEvents: 'none',
      }}>
        {label}
      </Typography>
    </Box>
  );
};

// ── D-pad layout (Snake) ─────────────────────────────────────────

const DPadLayout: React.FC<{ buttons: GamePadButton[]; accent: string; disabled?: boolean }> = ({
  buttons, accent, disabled,
}) => {
  const get = (id: string) => buttons.find(b => b.id === id);
  const up = get('up');
  const down = get('down');
  const left = get('left');
  const right = get('right');

  const btnSize = { w: 64, h: 64 };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '5px', touchAction: 'none',
      pt: 1,
      // Extra padding at the bottom so iOS Safari's nav/share bar
      // doesn't overlap the down button.
      pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    }}>
      {up && (
        <PadButton {...up} accent={accent} disabled={disabled} size={btnSize} borderRadius={16} />
      )}
      <Box sx={{ display: 'flex', gap: '6px' }}>
        {left && (
          <PadButton {...left} accent={accent} disabled={disabled} size={btnSize} borderRadius={16} />
        )}
        {/* Center spacer — same size as a button so the cross is symmetric */}
        <Box sx={{ width: btnSize.w, height: btnSize.h }} />
        {right && (
          <PadButton {...right} accent={accent} disabled={disabled} size={btnSize} borderRadius={16} />
        )}
      </Box>
      {down && (
        <PadButton {...down} accent={accent} disabled={disabled} size={btnSize} borderRadius={16} />
      )}
    </Box>
  );
};

// ── Bar layout (Tetris) ──────────────────────────────────────────

const BarLayout: React.FC<{ buttons: GamePadButton[]; accent: string; disabled?: boolean }> = ({
  buttons, accent, disabled,
}) => (
  <Box sx={{
    display: 'flex', justifyContent: 'center', gap: '8px',
    touchAction: 'none',
    pt: 1,
    pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  }}>
    {buttons.map(btn => (
      <PadButton
        key={btn.id}
        {...btn}
        accent={accent}
        disabled={disabled}
        size={{ w: 72, h: 56 }}
        fontSize="1.3rem"
        borderRadius={14}
      />
    ))}
  </Box>
);

// ── Public component ─────────────────────────────────────────────

const GamePad: React.FC<GamePadProps> = ({
  buttons, layout, accentColor = '#2e7d32', disabled = false,
}) => {
  if (layout === 'dpad') {
    return <DPadLayout buttons={buttons} accent={accentColor} disabled={disabled} />;
  }
  return <BarLayout buttons={buttons} accent={accentColor} disabled={disabled} />;
};

export default GamePad;
