import { useTheme } from '@mui/material';
import { paper, paperNight } from './tokens';

export type Paper = { [K in keyof typeof paper]: string };

/**
 * The paper for the screen: cream with ink in light mode, warm brown with
 * cream ink in dark. Printed books always use `paper`.
 */
export function usePaper(): Paper & { light: boolean } {
  const light = useTheme().palette.mode !== 'dark';
  return { ...(light ? paper : paperNight), light };
}
