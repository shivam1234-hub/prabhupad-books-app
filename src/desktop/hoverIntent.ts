// Hover-intent timers shared by a link and the preview card it opens: the card
// opens after the pointer rests on the link, and stays open while the pointer
// travels from the link onto the card.
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

export const hoverIntent = {
  open(fn: () => void, delay = 300) {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    openTimer = setTimeout(() => { openTimer = null; fn(); }, delay);
  },
  cancelOpen() {
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
  },
  close(fn: () => void, delay = 260) {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { closeTimer = null; fn(); }, delay);
  },
  cancelClose() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  },
};
