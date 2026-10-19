// Phones in landscape (the compact layout, src/compact.css): their screens, the measurements the phone tests make in the
// page, and a way to look at the phone the way a player does.
//   SIZES: CSS px in landscape with the safe area iOS reports there (Dynamic Island or notch on both sides, the home
//   indicator at the bottom; the iPhone SE has a home button: none). Chromium emulates the safe area (safeArea in
//   page.mjs), the touch screen (CDP touch events) and a phone's browser (isMobile, DPR 3).
export const SIZES = {
  '667x375': { name: 'iPhone SE', insets: null },
  '812x375': { name: 'iPhone 13 mini', insets: { left: 50, right: 50, bottom: 21 } },
  '852x393': { name: 'iPhone 16', insets: { left: 59, right: 59, bottom: 21 } },
  '874x402': { name: 'iPhone 16 Pro', insets: { left: 62, right: 62, bottom: 21 } },
  '932x430': { name: 'iPhone 16 Plus', insets: { left: 59, right: 59, bottom: 21 } },
  '956x440': { name: 'iPhone 16 Pro Max', insets: { left: 62, right: 62, bottom: 21 } },
};

// The in-page checks, in one function whose source is sent to the page (page.evaluate(PHONE_CHECKS)) once per page:
// it defines window.__phone with the measurements. `safe` is the safe area in CSS px.
export const PHONE_CHECKS = () => {
  const P = {};
  // the safe area as the page reads it (env(safe-area-inset-*), emulated by Chromium)
  P.readSafe = () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.append(d);
    const cs = getComputedStyle(d);
    P.safe = { top: parseFloat(cs.paddingTop), right: parseFloat(cs.paddingRight), bottom: parseFloat(cs.paddingBottom), left: parseFloat(cs.paddingLeft) };
    d.remove();
    return P.safe;
  };
  P.safe = { left: 0, right: 0, top: 0, bottom: 0 };
  // shown: not hidden, drawn, and not a screen reader's word (1 px, clipped: .res-label, a card's name on a phone)
  const vis = (el) => {
    if (!el || el.closest('[hidden]') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.clip !== 'auto' && cs.position === 'absolute') return false;
    }
    return true;
  };
  P.vis = vis;
  const name = (el) => {
    if (!el) return 'nothing';
    const d = Object.entries(el.dataset ?? {}).filter(([k]) => !k.startsWith('e2e')).map(([k, v]) => (v ? `${k}=${v}` : k)).join(',');
    const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${el.classList.length ? `.${[...el.classList].join('.')}` : ''}${d ? `[${d}]` : ''}${t ? ` "${t}"` : ''}`;
  };
  P.name = name;
  // inside the screen's safe area (0.5 px of rounding)
  P.inSafe = (el, what = name(el)) => {
    const r = el.getBoundingClientRect();
    const s = P.safe;
    const out = [];
    if (r.left < s.left - 0.5) out.push(`${what}: ${Math.round(s.left - r.left)} px into the left safe area`);
    if (r.right > innerWidth - s.right + 0.5) out.push(`${what}: ${Math.round(r.right - innerWidth + s.right)} px into the right safe area`);
    if (r.top < s.top - 0.5) out.push(`${what}: above the screen's top`);
    if (r.bottom > innerHeight - s.bottom + 0.5) out.push(`${what}: ${Math.round(r.bottom - innerHeight + s.bottom)} px into the bottom safe area`);
    return out;
  };
  // a press reaches the control (or something inside it) all over a finger's 44 px round the middle of what is seen of
  // it (points 21 px away from it: up, down, left, right and the diagonals): its own box may be smaller (a
  // pseudo-element can widen what a finger hits), and its corners may be round. Points off the screen are not
  // measured: a finger there is still on the control at the screen's edge.
  P.hit44 = (el, what = name(el), box = el) => {
    const r = box.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const miss = [];
    for (const [dx, dy] of [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21], [-15, -15], [15, -15], [-15, 15], [15, 15]]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x > innerWidth - 1 || y > innerHeight - 1) continue;
      const at = document.elementFromPoint(x, y);
      if (!at || !(at === el || el.contains(at))) miss.push(`${dx},${dy}: ${name(at)}`);
    }
    const seen = el.getBoundingClientRect();
    return miss.length ? [`${what}: not 44x44 to a finger (${Math.round(seen.width)}x${Math.round(seen.height)} seen; ${miss.slice(0, 2).join('; ')})`] : [];
  };
  P.covered = (el, what = name(el)) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    return at && (at === el || el.contains(at)) ? [] : [`${what}: covered by ${name(at)}`];
  };
  // texts that run out of their box: a text's lines out of the nearest box that draws it (a button, a chip, a panel), or
  // an element that clips its text (scrollWidth past its width). `except`: elements cut on purpose (an ellipsis)
  P.spills = (root, except = []) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !vis(el) || except.some((e) => e.contains(el))) continue;
      const box = el.closest('button, .btn, .res, .cost, .tag, .pill, .chip, .eyebrow, .card-label, .node-name, .msg, .toast, .proj-note, .modal-head, .modal-body, .modal, .inspector, .smog-panel, .objective, .build-info, .coach, .region-panel, .hud-top, .menu-footer, .tooltip, .lang-pill, .clock-time b, .group-label, .cat-state, .insp-status, .slot') ?? el;
      const B = box.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.width < 1) continue;
        if (q.right > B.right + 1 || q.left < B.left - 1) {
          out.push(`"${n.textContent.trim().slice(0, 24)}" out of ${name(box)} sideways`);
          break;
        }
      }
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push(`"${n.textContent.trim().slice(0, 24)}" cut by ${name(el)}`);
    }
    return [...new Set(out)];
  };
  // no text under 11 px
  P.small = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !vis(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      // (0 px: words not drawn at all, read by screen readers only: the path meter's on a phone, its icons say it)
      if (fs > 0 && fs < 10.95) out.push(`"${n.textContent.trim().slice(0, 16)}" at ${fs} px (${name(el)})`);
    }
    return [...new Set(out)];
  };
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  P.overlap = (a, b, what) => (vis(a) && vis(b) && hit(a.getBoundingClientRect(), b.getBoundingClientRect()) ? [`${what ?? `${name(a)} over ${name(b)}`}`] : []);
  // an element of a list that scrolls brought all into sight (or its top, when taller): then in sight and not covered
  P.reach = (el, what = name(el)) => {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    let list = el.parentElement;
    while (list && !(list.scrollHeight > list.clientHeight + 1 || list.scrollWidth > list.clientWidth + 1)) list = list.parentElement;
    const L = (list && list !== document.body && list !== document.documentElement ? list : document.documentElement).getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const view = { left: Math.max(0, L.left), top: Math.max(0, L.top), right: Math.min(innerWidth, L.right), bottom: Math.min(innerHeight, L.bottom) };
    const out = [];
    if (r.left < view.left - 0.5 || r.right > view.right + 0.5 || (r.height <= view.bottom - view.top + 0.5 && (r.top < view.top - 0.5 || r.bottom > view.bottom + 0.5))) out.push(`${what}: cannot be brought fully into sight`);
    return [...out, ...P.covered(el, what)];
  };
  window.__phone = P;
};

// The safe area a size should read in the page.
export const safeOf = (size) => ({ left: 0, right: 0, top: 0, bottom: 0, ...(SIZES[size]?.insets ?? {}) });
