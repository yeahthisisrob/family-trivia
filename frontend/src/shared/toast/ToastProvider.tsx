/**
 * Toasts (docs/decisions/0031): one short line at the bottom of the screen,
 * with at most one action. They queue, so two at once show one after the
 * other. Without a provider, useToast does nothing, so any component can call
 * it in a story or a test.
 */
import { Alert, Button, Snackbar } from '@mui/material';
import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface Toast {
  message: string;
  action?: { label: string; onClick: () => void };
  /** Default 'info'; 'success' after something saved. */
  tone?: 'info' | 'success' | 'error';
}

type ShowToast = (toast: Toast) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

export const useToast = (): ShowToast => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<(Toast & { key: number })[]>([]);
  const [open, setOpen] = useState(true);
  const show = useCallback<ShowToast>((toast) => {
    setQueue((q) => [...q.slice(-4), { ...toast, key: Date.now() + Math.random() }]);
    setOpen(true);
  }, []);
  const current = queue[0];
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <Snackbar
          key={current.key}
          open={open}
          autoHideDuration={current.action ? 6000 : 3500}
          onClose={(_, reason) => reason !== 'clickaway' && setOpen(false)}
          slotProps={{ transition: { onExited: () => setQueue((q) => q.slice(1)) } }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ bottom: { xs: 'calc(16px + env(safe-area-inset-bottom))' } }}
        >
          <Alert
            severity={current.tone ?? 'info'}
            variant="filled"
            icon={false}
            onClose={() => setOpen(false)}
            sx={{ borderRadius: 3, alignItems: 'center', boxShadow: 6 }}
            action={
              current.action && (
                <Button
                  color="inherit"
                  size="small"
                  sx={{ fontWeight: 800 }}
                  onClick={() => {
                    current.action?.onClick();
                    setOpen(false);
                  }}
                >
                  {current.action.label}
                </Button>
              )
            }
          >
            {current.message}
          </Alert>
        </Snackbar>
      )}
    </ToastContext.Provider>
  );
};
