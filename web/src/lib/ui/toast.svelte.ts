// A short confirmation line (« C'est noté. », « Quête affichée au mur. ») that clears itself
// (final review M3: one helper for the care panel, the portrait and the lyre). Its timer dies with
// the component that uses it, and a new message restarts it.
export const TOAST_MS = 2500;

export function useToast(ms = TOAST_MS): { readonly message: string; show(message: string): void } {
  let message = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(timer));
  return {
    get message() {
      return message;
    },
    show(m: string) {
      clearTimeout(timer);
      message = m;
      timer = setTimeout(() => (message = ''), ms);
    },
  };
}
