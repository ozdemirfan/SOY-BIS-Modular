/**
 * Dar ekranda (mobil / DevTools) tekerlek olayı bazen doğrudan document.body
 * kaydırmıyor; içerik üzerinde boş bir katmanda kalıyor. Kaydırmayı body'ye iletir.
 */
export function initMobileScrollWheelFix(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.addEventListener(
    'wheel',
    e => {
      if (window.innerWidth > 768) return;

      const body = document.body;
      if (!body || body.scrollHeight <= body.clientHeight + 1) return;

      let node: HTMLElement | null = e.target instanceof HTMLElement ? e.target : null;
      for (let i = 0; i < 40 && node; i++) {
        const st = window.getComputedStyle(node);
        const oy = st.overflowY;
        if (
          (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
          node.scrollHeight > node.clientHeight + 2
        ) {
          return;
        }
        node = node.parentElement;
      }

      const max = body.scrollHeight - body.clientHeight;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, body.scrollTop + e.deltaY));
      if (next === body.scrollTop) return;
      body.scrollTop = next;
      e.preventDefault();
    },
    { passive: false, capture: true }
  );
}
