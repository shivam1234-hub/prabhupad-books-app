import { Alert, AlertButton } from 'react-native';

/**
 * Give `Alert.alert` a body on web.
 *
 * react-native-web ships Alert as a literal no-op, so any shared screen that
 * confirms through it would show live-looking buttons that do nothing. Inside
 * Electron this routes to a real OS message box via the preload bridge; in a
 * plain browser it falls back to window.confirm / alert.
 */
export function installWebAlert(): void {
  if (typeof window === 'undefined') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]): void => {
    const list: AlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    const labels = list.map((b, i) => b.text ?? (i === 0 ? 'OK' : 'Cancel'));
    const cancelIndex = list.findIndex((b) => b.style === 'cancel');
    const destructiveIndex = list.findIndex((b) => b.style === 'destructive');
    const press = (i: number) => (list[i]?.onPress as undefined | (() => void))?.();

    const dialog = window.vedabaseDesktop?.dialog;
    if (dialog) {
      dialog({
        title,
        message,
        buttons: labels,
        defaultId: destructiveIndex >= 0 && cancelIndex >= 0 ? cancelIndex : 0,
        cancelId: cancelIndex >= 0 ? cancelIndex : labels.length - 1,
      }).then(press).catch(() => {});
      return;
    }

    const text = [title, message].filter(Boolean).join('\n\n');
    if (list.length === 1) { window.alert(text); press(0); return; }
    const confirmIndex = list.findIndex((b) => b.style !== 'cancel');
    press(window.confirm(text) ? (confirmIndex >= 0 ? confirmIndex : 0) : (cancelIndex >= 0 ? cancelIndex : 0));
  };
}
