/* ==========================================================================
   VEILOT - Page interactions
   Header state · mobile navigation · active section · scroll reveals ·
   visibility map · accessible tabs · briefing form
   ========================================================================== */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header: border once the page scrolls ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile navigation ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const setNav = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  };
  toggle.addEventListener('click', () => setNav(toggle.getAttribute('aria-expanded') !== 'true'));

  // The header logo always returns to the top of the page, closing the mobile menu first
  document.querySelector('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    setNav(false);
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 961px)').addEventListener?.('change', (e) => { if (e.matches) setNav(false); });

  /* ---------- Current section in the navigation ---------- */
  const navLinks = Array.from(document.querySelectorAll('.site-nav ul a'));
  const linkFor = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
      const link = linkFor.get(entry.target.id);
      if (link) { link.classList.add('is-current'); link.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section[id]').forEach((s) => sectionIO.observe(s));

  /* ---------- Visibility map (problem section) ----------
     12 x 6 devices: what traditional tools see (teal) vs. what's connected
     but unexamined (outline), with the weaknesses hiding among the latter. */
  const map = document.getElementById('visibility-map');
  if (map) {
    const COLS = 12, ROWS = 6;
    const risks = new Set([19, 33, 42, 58, 68]);
    const frag = document.createDocumentFragment();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        // Known devices cluster on the left - the managed IT estate
        const known = c < 4 ? (i * 7) % 10 !== 0 : c < 6 && (i * 3) % 5 === 0;
        const cell = document.createElement('span');
        cell.className = 'vcell ' + (known ? 'is-known' : 'is-unknown') + (risks.has(i) ? ' is-risk' : '');
        cell.style.setProperty('--d', String(c * 45 + r * 20));
        frag.appendChild(cell);
      }
    }
    map.appendChild(frag);
  }

  /* ---------- Scroll reveals ---------- */
  const revealables = Array.from(document.querySelectorAll('[data-reveal]'));
  // Stagger siblings that reveal together
  ['.problem-list', '.caps', '.cta__copy'].forEach((sel) => {
    document.querySelectorAll(sel).forEach((group) => {
      group.querySelectorAll(':scope > [data-reveal]').forEach((el, i) => el.style.setProperty('--reveal-delay', `${i * 90}ms`));
    });
  });
  if ('IntersectionObserver' in window && !reduced) {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealIO.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealables.forEach((el) => revealIO.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-revealed'));
  }

  /* ---------- Wheel stepping (shared by Our approach and How it works) ----------
     Active anywhere inside the section's content area: the .container box
     minus its horizontal padding. Over the outer side margins, or above and
     below the content, the page scrolls normally.
     - Only when `visible` is (almost) entirely on screen, so a change is never
       hidden from view.
     - At the first / last step, moving outward scrolls the page on.
     - One deliberate gesture = one step: small deltas are accumulated, and
       trackpad momentum is absorbed for a moment after each step. */
  const wheelStepper = ({ zone, visible, count, index, go }) => {
    const STEP_DELTA = 60, LOCK_MS = 650;
    let acc = 0, lockedUntil = 0, lastWheel = 0;
    const inContent = (e) => {
      const r = zone.getBoundingClientRect(), cs = getComputedStyle(zone);
      const left = r.left + parseFloat(cs.paddingLeft), right = r.right - parseFloat(cs.paddingRight);
      return e.clientX >= left && e.clientX <= right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const onScreen = () => {
      const r = visible.getBoundingClientRect(), top = header.offsetHeight, ih = window.innerHeight;
      const seen = Math.min(r.bottom, ih) - Math.max(r.top, top);
      return seen >= Math.min(r.height, ih - top) * 0.9;
    };
    zone.addEventListener('wheel', (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch-zoom or sideways
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      const dir = Math.sign(dy);
      if (!dir || !inContent(e) || !onScreen()) { acc = 0; return; }
      const now = performance.now();
      const i = index();
      const atEnd = (dir > 0 && i === count - 1) || (dir < 0 && i === 0);
      // At an end, moving outward: release to the page (once any momentum from the last step has settled)
      if (atEnd && now >= lockedUntil) { acc = 0; return; }
      e.preventDefault();
      if (now < lockedUntil) { lockedUntil = Math.max(lockedUntil, now + 120); return; }
      if (now - lastWheel > 250 || Math.sign(acc) !== dir) acc = 0;
      lastWheel = now;
      acc += dy;
      if (Math.abs(acc) >= STEP_DELTA) {
        acc = 0;
        if (go(i + dir)) lockedUntil = now + LOCK_MS;
      }
    }, { passive: false });
  };

  /* Touch: a horizontal swipe on `el` steps; vertical swipes always scroll the page */
  const swipeStepper = (el, step) => {
    let sx = 0, sy = 0, tracking = false;
    el.addEventListener('touchstart', (e) => {
      tracking = e.touches.length === 1;
      if (tracking) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  };

  /* ---------- Approach: one stage at a time ----------
     Wheel (desktop), stage labels, arrow buttons, and horizontal swipes (touch). */
  const approach = document.getElementById('approach');
  if (approach) {
    const zone = approach.querySelector('.container');
    const area = approach.querySelector('.approach__interactive');
    const line = approach.querySelector('.approach__line');
    const steps = Array.from(approach.querySelectorAll('.astep'));
    const nodes = steps.map((s) => s.querySelector('.astep__node'));
    const stages = Array.from(approach.querySelectorAll('.astage'));
    const arrows = Array.from(approach.querySelectorAll('.approach__arrow'));
    const indexEl = document.getElementById('approach-index');
    const last = stages.length - 1;
    let active = 0;

    // Indicator and fill are placed from the markers' real centres, not percentages
    let centres = [];
    const measure = () => {
      const base = line.getBoundingClientRect().left;
      centres = nodes.map((n) => { const r = n.getBoundingClientRect(); return r.left + r.width / 2 - base; });
      line.style.setProperty('--x0', `${centres[0]}px`);
      line.style.setProperty('--x1', `${centres[last]}px`);
      line.style.setProperty('--x', `${centres[active]}px`);
    };

    const go = (i) => {
      i = Math.max(0, Math.min(last, i));
      if (i === active && stages[i].classList.contains('is-active')) return false;
      active = i;
      stages.forEach((s, n) => {
        s.classList.toggle('is-active', n === i);
        s.classList.toggle('is-past', n < i);
        s.setAttribute('aria-hidden', String(n !== i));
      });
      steps.forEach((s, n) => {
        s.classList.toggle('is-active', n === i);
        s.classList.toggle('is-reached', n <= i);
        if (n === i) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
      });
      if (centres.length) line.style.setProperty('--x', `${centres[i]}px`);
      if (indexEl) indexEl.textContent = String(i + 1).padStart(2, '0');
      arrows[0].disabled = i === 0;
      arrows[1].disabled = i === last;
      return true;
    };

    steps.forEach((s, i) => s.addEventListener('click', () => go(i)));
    arrows.forEach((b) => b.addEventListener('click', () => go(active + Number(b.dataset.dir))));
    wheelStepper({ zone, visible: area, count: stages.length, index: () => active, go });
    swipeStepper(area, (d) => go(active + d));

    stages.forEach((s, n) => s.setAttribute('aria-hidden', String(n !== 0)));
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    let mt = 0;
    window.addEventListener('resize', () => { clearTimeout(mt); mt = setTimeout(measure, 100); });
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(line);
  }

  /* ---------- Devices: three image columns ----------
     One column is always active. Desktop: hover (mouse), focus or click makes
     a column active. Stacked panels (tablet / mobile): the panel crossing the
     middle of the screen becomes active, and tapping a panel activates it too. */
  const dcols = document.querySelector('.dcols');
  if (dcols) {
    // Photos fade in once loaded; until then (or if a file is missing) the quiet tinted field shows
    dcols.querySelectorAll('.dcol__img').forEach((img) => {
      const loaded = () => img.classList.add('is-loaded');
      const missing = () => img.classList.add('is-missing');
      if (img.complete) (img.naturalWidth > 0 ? loaded() : missing());
      img.addEventListener('load', loaded);
      img.addEventListener('error', missing);
    });
    const cols = Array.from(dcols.querySelectorAll('.dcol'));
    const stackedMQ = window.matchMedia('(max-width: 960px)');
    const activate = (col) => {
      if (col.classList.contains('is-active')) return;
      cols.forEach((c) => c.classList.toggle('is-active', c === col));
    };
    cols.forEach((col) => {
      col.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !stackedMQ.matches) activate(col); });
      col.addEventListener('focus', () => activate(col));
      col.addEventListener('click', () => activate(col));
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!stackedMQ.matches) return;
        entries.forEach((en) => { if (en.isIntersecting) activate(en.target); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      cols.forEach((c) => io.observe(c));
    }
  }

  /* ---------- Contact: reactive grid ----------
     The section's grid is redrawn on a canvas (same 48px lines, same mask).
     Tiles never move: squares near the cursor simply brighten a little (a
     faint fill and a stronger outline) and fade back once it moves on.
     Touch screens: a touch lights the squares around the finger, and a softer light
     drifts through the grid while the section scrolls past. All listeners are passive,
     so scrolling and the form are never blocked. Decorative only; reduced motion keeps
     the static CSS grid. */
  const ctaGrid = document.querySelector('.cta__grid');
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)');
  if (ctaGrid && ctaGrid.getContext && !reduced) {
    const section = ctaGrid.parentElement;
    const g = ctaGrid.getContext('2d');
    const SIZE = 48, RADIUS = 170;
    let w = 0, h = 0, tiles = [], mx = -1e4, my = -1e4, raf = 0, strength = 1, touching = false, scrollEnd = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = section.clientWidth; h = section.clientHeight;
      ctaGrid.width = w * dpr; ctaGrid.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      tiles = [];
      for (let y = 0; y < h + SIZE; y += SIZE) for (let x = 0; x < w + SIZE; x += SIZE) tiles.push({ x, y, glow: 0 });
      draw();
      ctaGrid.classList.add('is-live');
    };

    // Base grid: each tile draws its top and left edge, exactly like the CSS gradient grid.
    // Lit tiles add a faint fill and a full outline on top, in place.
    const draw = () => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (const t of tiles) { g.fillRect(t.x, t.y, SIZE, 1); g.fillRect(t.x, t.y, 1, SIZE); }
      for (const t of tiles) {
        if (t.glow < 0.01) continue;
        g.fillStyle = `rgba(255,255,255,${(t.glow * 0.045).toFixed(3)})`;
        g.fillRect(t.x + 1, t.y + 1, SIZE - 1, SIZE - 1);
        g.fillStyle = `rgba(255,255,255,${(t.glow * 0.1).toFixed(3)})`;
        g.fillRect(t.x, t.y, SIZE + 1, 1); g.fillRect(t.x, t.y + SIZE, SIZE + 1, 1);
        g.fillRect(t.x, t.y, 1, SIZE + 1); g.fillRect(t.x + SIZE, t.y, 1, SIZE + 1);
      }
    };

    const step = () => {
      let active = false;
      for (const t of tiles) {
        const d = Math.hypot(mx - (t.x + SIZE / 2), my - (t.y + SIZE / 2));
        const target = d < RADIUS ? (1 - d / RADIUS) ** 1.6 * strength : 0;
        t.glow += (target - t.glow) * 0.14;
        if (Math.abs(target - t.glow) > 0.005) active = true;
      }
      draw();
      raf = active ? requestAnimationFrame(step) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

    const lightAt = (cx, cy, s) => {
      const r = ctaGrid.getBoundingClientRect();
      mx = cx - r.left; my = cy - r.top; strength = s; kick();
    };
    const lightsOut = () => { mx = my = -1e4; kick(); };

    // Mouse / pen
    section.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') lightAt(e.clientX, e.clientY, 1); }, { passive: true });
    section.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') lightsOut(); });

    // Touch: follows the finger, fades when it lifts (passive: never blocks scrolling or typing)
    const onTouch = (e) => { touching = true; const t = e.touches[0]; if (t) lightAt(t.clientX, t.clientY, 1); };
    section.addEventListener('touchstart', onTouch, { passive: true });
    section.addEventListener('touchmove', onTouch, { passive: true });
    const onTouchEnd = () => { touching = false; lightsOut(); };
    section.addEventListener('touchend', onTouchEnd, { passive: true });
    section.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Touch screens, while scrolling: a soft light moves across the grid with the section's
    // progress through the viewport, then fades once scrolling stops
    window.addEventListener('scroll', () => {
      if (!coarse.matches || touching) return;
      const r = section.getBoundingClientRect(), ih = window.innerHeight;
      if (r.bottom < 0 || r.top > ih) return;
      const p = Math.min(1, Math.max(0, (ih - r.top) / (ih + r.height)));
      lightAt(r.left + r.width * (0.6 + 0.3 * p), ih * 0.55, 0.55);
      clearTimeout(scrollEnd);
      scrollEnd = setTimeout(lightsOut, 260);
    }, { passive: true });
    let gt = 0;
    window.addEventListener('resize', () => { clearTimeout(gt); gt = setTimeout(build, 150); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(gt); gt = setTimeout(build, 150); }).observe(section);
    build();
  }

  /* ---------- Back to top (bottom-right) ----------
     Shown after about one screen of scrolling. On tablets and phones it steps
     aside while the briefing form is on screen, so it never covers the form. */
  const toTop = document.querySelector('.back-to-top');
  if (toTop) {
    const formEl = document.getElementById('briefing-form');
    let formInView = false;
    const toggleTop = () => {
      const show = window.scrollY > window.innerHeight * 0.8 && !(formInView && window.innerWidth <= 960);
      toTop.classList.toggle('is-visible', show);
    };
    if (formEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { formInView = en.isIntersecting; toggleTop(); }).observe(formEl);
    }
    toggleTop();
    window.addEventListener('scroll', toggleTop, { passive: true });
    toTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      document.querySelector('.brand').focus({ preventScroll: true });
    });
  }

  /* ---------- How it works: accessible step selector ----------
     Vertical list on desktop, compact row on mobile (arrow keys both ways).
     The previous step's animation fades out before the next one plays. */
  document.querySelectorAll('[role="tablist"][data-tabs]').forEach((list) => {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    const panelOf = (t) => document.getElementById(t.getAttribute('aria-controls'));
    const panels = tabs.map(panelOf);
    let swap = 0;

    const select = (tab, focus) => {
      const current = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      list.style.setProperty('--step', String(tabs.indexOf(tab)));
      if (focus) tab.focus();

      const next = panelOf(tab);
      const prev = current && current !== tab ? panelOf(current) : null;
      clearTimeout(swap);
      panels.forEach((p) => { if (p !== next && p !== prev) { p.hidden = true; p.classList.remove('is-leaving'); } });
      if (prev && !prev.hidden && !reduced) {
        prev.classList.add('is-leaving');
        swap = setTimeout(() => { prev.hidden = true; prev.classList.remove('is-leaving'); next.hidden = false; }, 170);
      } else {
        if (prev) { prev.hidden = true; prev.classList.remove('is-leaving'); }
        next.hidden = false;
      }
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => { if (tab.getAttribute('aria-selected') !== 'true') select(tab, false); }));
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let target = null;
      if (step !== undefined) target = tabs[(i + step + tabs.length) % tabs.length];
      else if (e.key === 'Home') target = tabs[0];
      else if (e.key === 'End') target = tabs[tabs.length - 1];
      if (!target) return;
      e.preventDefault();
      select(target, true);
    });

    // Mouse wheel over the content area (desktop) and horizontal swipes (touch) also move
    // between steps, with the same boundaries and release behaviour as Our approach
    const section = list.closest('section');
    const idx = () => tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const goTo = (i) => {
      if (i < 0 || i >= tabs.length || i === idx()) return false;
      select(tabs[i], false);
      return true;
    };
    if (section) {
      wheelStepper({ zone: section.querySelector('.container'), visible: section.querySelector('.process'), count: tabs.length, index: idx, go: goTo });
      swipeStepper(section.querySelector('.process__panels'), (d) => goTo(idx() + d));
    }
  });

  /* ---------- Briefing form ----------
     Client-side validation. To connect a backend, set FORM_ENDPOINT to a URL
     that accepts a JSON POST (e.g. your CRM or a form service). */
  const FORM_ENDPOINT = '';
  const form = document.getElementById('briefing-form');
  if (form) {
    const rules = {
      name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid work email.'),
      company: (v) => (v.trim() ? '' : 'Please enter your company.'),
      environment: (v) => (v ? '' : 'Please choose an environment.'),
    };
    const errIds = { name: 'f-name-err', email: 'f-email-err', company: 'f-company-err', environment: 'f-env-err' };

    const check = (field) => {
      const msg = rules[field.name] ? rules[field.name](field.value) : '';
      const wrap = field.closest('.field');
      const err = document.getElementById(errIds[field.name]);
      wrap.classList.toggle('has-error', !!msg);
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) { err.textContent = msg; msg ? field.setAttribute('aria-describedby', err.id) : field.removeAttribute('aria-describedby'); }
      return !msg;
    };

    Object.keys(rules).forEach((name) => {
      const field = form.elements[name];
      field.addEventListener('blur', () => { if (field.value) check(field); });
      field.addEventListener('input', () => { if (field.closest('.field').classList.contains('has-error')) check(field); });
      field.addEventListener('change', () => { if (field.closest('.field').classList.contains('has-error')) check(field); });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = Object.keys(rules).map((n) => form.elements[n]);
      const results = fields.map(check);
      const firstBad = fields[results.indexOf(false)];
      if (firstBad) { firstBad.focus(); return; }

      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(form));

      if (FORM_ENDPOINT) {
        try {
          const res = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(String(res.status));
        } catch (err) {
          submit.disabled = false;
          const e2 = document.getElementById('f-email-err');
          e2.textContent = 'Something went wrong while sending. Please try again.';
          return;
        }
      }

      const first = String(data.name || '').trim().split(/\s+/)[0];
      document.getElementById('success-name').textContent = first ? `, ${first}` : '';
      form.querySelector('.form__body').hidden = true;
      const ok = document.getElementById('form-success');
      ok.hidden = false;
      ok.focus();
    });
  }

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
