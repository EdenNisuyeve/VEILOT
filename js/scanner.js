/* ==========================================================================
   VEILOT - Hero scan field
   --------------------------------------------------------------------------
   A grid of white / light-grey tiles stands for a connected environment.
   The scanner is the logo icon stretched into a window: the lime square sits
   at its lower-left corner, the teal bracket at its upper-right, both at the
   icon's own proportions (bracket stroke = ¼ of its side). The window snaps
   to the grid, the tiles inside it lift, and it reveals four short signals
   placed beside the copy, the only information in the hero.

   - Mouse / pen: the window follows the pointer (move or drag).
   - Touch: tap the field to move it there; otherwise it walks the signals.
   - No pointer: it visits the four signals in order, then drifts quietly.
   - prefers-reduced-motion: all four signals shown, no autonomous motion.
   ========================================================================== */
(() => {
  const canvas = document.getElementById('scan-field');
  const hero = document.getElementById('hero');
  if (!canvas || !hero || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceMQ.matches;

  const C = {
    teal: '#0F2A2A',
    lime: '#C5ED47',
    white: [255, 255, 255],
    tileA: [241, 244, 243],   // light grey
    tileB: [246, 248, 247],   // lighter grey
    tileHot: [226, 233, 232], // tile inside the window
  };

  const signalList = hero.querySelector('.hero__signals');
  const signalEls = Array.from(hero.querySelectorAll('.signal'));

  // ---------- State ----------
  let W = 0, H = 0, DPR = 1;
  let CELL = 28, GAP = 3, N = 4, cols = 0, rows = 0, ox = 0, oy = 0;
  let cells = [];
  let anchors = [];                    // { i, j, found, at }
  const foundFlags = [false, false, false, false];
  let wander = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let seed = 7;

  // Window position = its top-left corner in px (eased), target snapped to the grid
  const win = { x: 0, y: 0, tx: 0, ty: 0, mode: 'patrol', resumeAt: 0, holdUntil: 0, nextWander: 0, placed: false };
  let running = false, inView = true, rafId = 0, last = performance.now();
  let nextRevealAt = 0; // signals appear one at a time, never in a burst

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  function rng() { // mulberry32 - stable tile pattern
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rel = (el) => {
    const h = hero.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { left: r.left - h.left, top: r.top - h.top, right: r.right - h.left, bottom: r.bottom - h.top };
  };
  const cellAt = (i, j) => (i >= 0 && j >= 0 && i < cols && j < rows ? cells[j * cols + i] : null);

  // ---------- Build ----------
  function build() {
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const small = W < 640;
    CELL = small ? 22 : 28;
    GAP = small ? 2 : 3;
    N = small ? 3 : 4;
    cols = Math.ceil(W / CELL) + 1;
    rows = Math.ceil(H / CELL) + 1;
    ox = Math.round((W - cols * CELL) / 2);
    oy = 0;

    // Quiet zones: the copy stays on calm, mostly white tiles
    const quiet = Array.from(hero.querySelectorAll('.hero__content .eyebrow, .hero__title, .hero__lead, .hero__actions'))
      .map((el) => { const q = rel(el), p = CELL * 0.6; return { x0: q.left - p, y0: q.top - p, x1: q.right + p, y1: q.bottom + p }; });

    seed = 1337;
    cells = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = ox + i * CELL, y = oy + j * CELL, cx = x + CELL / 2, cy = y + CELL / 2;
        const q = quiet.some((z) => cx > z.x0 && cx < z.x1 && cy > z.y0 && cy < z.y1);
        const v = rng();
        cells.push({
          i, j, x, y, cx, cy, quiet: q, heat: 0, anchor: -1,
          shade: q ? (v < 0.74 ? 0 : 1) : v < 0.5 ? 0 : v < 0.84 ? 1 : 2, // 0 white · 1 lighter · 2 light grey
        });
      }
    }

    // Signal anchors: four points spread across the open area right of the copy
    // (on narrow screens, a gentle zig-zag in the band under the buttons)
    const title = rel(hero.querySelector('.hero__title'));
    const lead = rel(hero.querySelector('.hero__lead'));
    const actions = rel(hero.querySelector('.hero__actions'));
    const buttonsRight = Math.max(...Array.from(hero.querySelectorAll('.hero__actions .btn')).map((b) => rel(b).right));
    // Phones: narrow cards whose text wraps into compact, squarer blocks
    const phone = W < 640;
    signalEls.forEach((el) => { el.style.width = ''; el.style.height = ''; });
    const widths = signalEls.map((el) => el.offsetWidth);
    const cardW = Math.max(...widths);
    const toI = (x) => Math.round((x - ox) / CELL), toJ = (y) => Math.round((y - oy) / CELL);
    const textRight = Math.max(title.right, lead.right, buttonsRight);
    // The right margin mirrors the copy's left margin, so the hero is framed evenly
    const contentLeft = rel(hero.querySelector('.hero__content')).left;
    const edge = W - contentLeft;
    // Last anchor column whose message (one tile to its right) still ends inside the margin
    const lastI = (w) => Math.floor((edge - w - GAP / 2 - ox) / CELL) - 1;
    let spots, aj = 0;
    if (W > 960) {
      const iMin = toI(textRight + CELL * 1.5);
      const y0 = CELL * 3, y1 = H - CELL * 4;
      // A balanced zig-zag: upper left, mid right, lower centre-left, bottom right.
      // fx = 1 means "flush with the right margin".
      spots = [[0, 0.06], [1, 0.34], [0.25, 0.64], [1, 0.92]].map(([fx, fy], k) => {
        const iMax = Math.max(iMin, lastI(widths[k]));
        return [Math.round(lerp(iMin, iMax, fx)), toJ(lerp(y0, y1, fy)), fx >= 1];
      });
    } else if (phone) {
      // Single-line cards, each as wide as its text, one every second row so they can never
      // overlap. Each card (with its anchor tile) is centred, then nudged one tile left or
      // right: a subtle zig-zag with even margins. The gap under the button tightens only if
      // needed for all four to fit in the first screen (window.innerHeight is the visible
      // area, browser bars excluded); the CSS height queries tighten the copy above it.
      const ai = toI(contentLeft);
      const heroTop = hero.getBoundingClientRect().top + window.scrollY;
      const fitRows = Math.floor((window.innerHeight - heroTop - oy - 8) / CELL);
      const step = 2;
      let under = CELL;
      if (Math.ceil((actions.bottom + under - oy) / CELL) + 3 * step + 1 > fitRows) under = 6;
      aj = Math.ceil((actions.bottom + under - oy) / CELL);
      const maxI = (k) => Math.max(ai, lastI(widths[k]));
      spots = [-1, 1, -1, 1].map((shift, k) => {
        const centred = Math.round(((W - CELL - widths[k]) / 2 - ox) / CELL);
        return [clamp(centred + shift, ai, maxI(k)), aj + k * step, false];
      });
    } else {
      const ai = toI(contentLeft);
      aj = Math.ceil((actions.bottom - oy) / CELL) + 1;
      const s = clamp(lastI(cardW) - ai, 0, 4);
      spots = [0, s, Math.round(s / 3), s].map((shift, k) => [ai + shift, aj + k * 2, false]);
    }
    anchors = spots.map(([i, j, flush], k) => ({ i, j, flush, found: foundFlags[k] || reduced, at: foundFlags[k] || reduced ? -1e6 : 0 }));
    anchors.forEach((a, k) => { const c = cellAt(a.i, a.j); if (c) c.anchor = k; });

    // Place the DOM signals on the grid, one tile to the right of each anchor.
    // Right-aligned ones stretch the last few pixels so they end exactly on the margin.
    signalEls.forEach((el, k) => {
      const a = anchors[k];
      const left = ox + (a.i + 1) * CELL + GAP / 2;
      el.style.left = `${left}px`;
      el.style.top = `${oy + a.j * CELL + GAP / 2}px`;
      el.style.height = `${CELL - GAP}px`;
      el.style.width = a.flush && edge - left >= widths[k] ? `${edge - left}px` : '';
      el.classList.toggle('is-on', a.found);
    });
    if (signalList) signalList.classList.add('is-ready');

    // Where the window drifts once all signals are found
    const m = CELL * (N + 1);
    if (W > 960) {
      const x0 = textRight + CELL * 2;
      wander = { x0, y0: CELL * 2, x1: Math.max(x0 + 1, W - m), y1: Math.max(CELL * 3, H - m) };
    } else {
      wander = { x0: CELL, y0: oy + (aj - 1) * CELL, x1: Math.max(CELL + 1, W - m), y1: oy + Math.max(aj + 4, ...anchors.map((a) => a.j)) * CELL };
    }

    if (!win.placed) {
      // Start a little away from the first signal, so the first reveal reads as a movement
      const t = windowFor(anchors[0]);
      win.x = win.tx = t.x + CELL * 3; win.y = win.ty = t.y - CELL;
      win.placed = true;
      win.holdUntil = performance.now() + 600;
    }
    if (reduced) { const t = windowFor(anchors[3]); win.x = win.tx = t.x; win.y = win.ty = t.y; }

    draw(performance.now());
  }

  // Window that frames an anchor near its lower-left, plus the start of its signal
  function windowFor(a) {
    return { x: ox + (a.i - 1) * CELL, y: oy + (a.j - (N - 2)) * CELL };
  }

  function snapTo(px, py) {
    const wi = Math.round((px - ox) / CELL - N / 2);
    const wj = Math.round((py - oy) / CELL - N / 2);
    return { x: ox + wi * CELL, y: oy + wj * CELL };
  }

  // ---------- Update ----------
  function update(now, dt) {
    // Touch taps hold briefly; a resting mouse hands back to the patrol so every signal gets seen
    if ((win.mode === 'touch' || win.mode === 'pointer') && now > win.resumeAt) win.mode = 'patrol';

    if (win.mode === 'patrol' && !reduced && now > win.holdUntil) {
      const next = anchors.find((a) => !a.found);
      if (next) {
        const t = windowFor(next); win.tx = t.x; win.ty = t.y;
      } else if (now > win.nextWander) {
        const t = snapTo(lerp(wander.x0, wander.x1, Math.random()), lerp(wander.y0, wander.y1, Math.random()));
        win.tx = t.x; win.ty = t.y; win.nextWander = now + 3200;
      }
    }

    const rate = reduced ? 1 : win.mode === 'patrol' ? 0.08 : 0.24;
    const k = 1 - Math.pow(1 - rate, dt / 16.7);
    win.x = lerp(win.x, win.tx, k);
    win.y = lerp(win.y, win.ty, k);

    // Cells covered by the window (rounded to the grid it travels on)
    const wi = Math.round((win.x - ox) / CELL), wj = Math.round((win.y - oy) / CELL);
    const settle = reduced ? 1 : 1 - Math.pow(1 - 0.2, dt / 16.7);
    for (const c of cells) {
      const dx = c.i < wi ? wi - c.i : c.i > wi + N - 1 ? c.i - (wi + N - 1) : 0;
      const dy = c.j < wj ? wj - c.j : c.j > wj + N - 1 ? c.j - (wj + N - 1) : 0;
      const d = Math.max(dx, dy); // 0 inside, 1 on the ring around it
      const target = (d === 0 ? 1 : d === 1 ? 0.22 : 0) * (c.quiet ? 0.3 : 1);
      c.heat += (target - c.heat) * settle;
    }

    // Reveal at most one signal at a time; on small screens give each a little longer to read
    if (now >= nextRevealAt) {
      const n = anchors.findIndex((a) => !a.found && a.i >= wi && a.i < wi + N && a.j >= wj && a.j < wj + N);
      if (n >= 0) {
        const a = anchors[n];
        a.found = true; a.at = now; foundFlags[n] = true;
        if (signalEls[n]) signalEls[n].classList.add('is-on');
        nextRevealAt = now + (W > 960 ? 220 : 480);
        if (win.mode === 'patrol') win.holdUntil = now + (W > 960 ? 950 : 1200); // let the reveal read before moving on
      }
    }
  }

  // ---------- Draw ----------
  const mix = (a, b, t) => `rgb(${lerp(a[0], b[0], t) | 0},${lerp(a[1], b[1], t) | 0},${lerp(a[2], b[2], t) | 0})`;

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const S = CELL - GAP;
    const wcx = win.x + (N * CELL) / 2, wcy = win.y + (N * CELL) / 2;

    for (const c of cells) {
      if (c.anchor >= 0) { drawAnchor(c, now); continue; }
      if (c.shade === 0 && c.heat < 0.02) continue;
      const base = c.shade === 0 ? C.white : c.shade === 1 ? C.tileB : C.tileA;
      // Tiles in the window shrink a touch and part from its centre: the grid "opens"
      let dx = c.cx - wcx, dy = c.cy - wcy;
      const len = Math.hypot(dx, dy) || 1, push = c.heat * 1.5;
      dx = (dx / len) * push; dy = (dy / len) * push;
      const shrink = c.heat * 2.5;
      ctx.fillStyle = mix(base, C.tileHot, c.heat);
      ctx.fillRect(c.x + GAP / 2 + dx + shrink / 2, c.y + GAP / 2 + dy + shrink / 2, S - shrink, S - shrink);
    }

    drawWindow();
  }

  function drawAnchor(c, now) {
    const a = anchors[c.anchor];
    const x = c.x + GAP / 2, y = c.y + GAP / 2, S = CELL - GAP;
    if (!a.found) {
      // A hidden signal: an outlined tile, quiet enough to read as part of the grid
      ctx.fillStyle = mix(C.tileB, C.tileHot, c.heat);
      ctx.fillRect(x, y, S, S);
      ctx.strokeStyle = 'rgba(15,42,42,0.38)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, S - 1.5, S - 1.5);
      return;
    }
    const age = a.at < 0 ? 1 : clamp((now - a.at) / 300, 0, 1);
    const s = S * (0.6 + 0.4 * smooth(age)), o = (S - s) / 2;
    ctx.fillStyle = C.lime;
    ctx.fillRect(x + o, y + o, s, s);
    ctx.strokeStyle = C.teal; ctx.lineWidth = 1.5;
    ctx.strokeRect(x + o + 0.75, y + o + 0.75, s - 1.5, s - 1.5);
  }

  // The scanner: the logo icon's two parts at the window's opposite corners
  function drawWindow() {
    const span = N * CELL;
    const m = Math.round(CELL / 2);           // icon module: square side = bracket side
    const t = Math.max(3, Math.round(m / 4)); // bracket stroke = ¼ module, as in the logo
    const o = Math.round(m / 2);              // ½-module offset, as in the logo
    const x0 = Math.round(win.x), y0 = Math.round(win.y), x1 = x0 + span, y1 = y0 + span;

    // Upper-right bracket (teal)
    const bx = x1 + o, by = y0 - o;
    ctx.fillStyle = C.teal;
    ctx.fillRect(bx - m, by, m, t);
    ctx.fillRect(bx - t, by, t, m);

    // Lower-left square (lime)
    ctx.fillStyle = C.lime;
    ctx.fillRect(x0 - o, y1 + o - m, m, m);
  }

  // ---------- Loop ----------
  function frame(now) {
    const dt = Math.min(64, now - last); last = now;
    update(now, dt);
    draw(now);
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (running || !inView || document.hidden || reduced) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function renderOnce() { const now = performance.now(); update(now, 16.7); draw(now); }

  // ---------- Input ----------
  // After the visitor stops moving or touching, the automatic scan takes over again and
  // reveals any remaining signals one by one; new input always takes priority.
  const IDLE_MS = 1800;
  const local = (e) => { const r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const p = local(e), t = snapTo(p.x, p.y);
    win.tx = t.x; win.ty = t.y; win.mode = 'pointer'; win.resumeAt = performance.now() + IDLE_MS;
    if (reduced) renderOnce();
  }, { passive: true });

  hero.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    win.mode = 'touch'; win.resumeAt = performance.now() + 1000; // brief hold, then patrol again
  });

  // Touch: a tap moves the scanner to that spot; dragging a finger sideways steers it.
  // The hero uses touch-action: pan-y, so vertical swipes stay with the page: the
  // browser scrolls and cancels the pointer, and the scanner simply lets go.
  let touchId = null;
  const steer = (e, hold) => {
    const p = local(e), t = snapTo(p.x, p.y);
    win.tx = t.x; win.ty = t.y; win.mode = 'touch'; win.resumeAt = performance.now() + hold;
    if (reduced) renderOnce();
  };
  hero.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target.closest('a, button')) return;
    touchId = e.pointerId;
    steer(e, IDLE_MS);
  }, { passive: true });
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || e.pointerId !== touchId) return;
    steer(e, IDLE_MS);
  }, { passive: true });
  const release = (e) => { if (e.pointerId === touchId) touchId = null; };
  hero.addEventListener('pointerup', release, { passive: true });
  hero.addEventListener('pointercancel', release, { passive: true });

  // ---------- Lifecycle ----------
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    inView ? start() : stop();
  }).observe(hero);

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  let resizeTimer = 0, lastW = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = hero.clientWidth;
      // ignore height-only changes from mobile browser chrome
      if (Math.abs(w - lastW) < 2 && Math.abs(hero.clientHeight - H) < 120) return;
      lastW = w; build();
    }, 150);
  });

  reduceMQ.addEventListener?.('change', (e) => {
    reduced = e.matches;
    build();
    reduced ? stop() : start();
  });

  function init() { lastW = hero.clientWidth; build(); start(); }
  // Wait for web fonts so anchors and quiet zones match the final text layout
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
})();
