import { useEffect } from 'react';

/** Closes/cancels a modal when the user presses Escape. Pass `false` for `active` to disable (e.g. while a save is in progress). */
export function useEscapeClose(onClose: () => void, active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, active]);
}
