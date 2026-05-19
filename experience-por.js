(function () {
  // ── Face data ──────────────────────────────────────────────────
  const FACES = [
    { label: 'CTF Workshop Lead', event: 'CTF Workshop', org: 'Cybersecurity Club', date: 'Feb 2026', desc: 'Designed and executed a full-day capture-the-flag training event for 60+ participants across web exploitation, cryptography, and reverse engineering tracks.', color: '#030b1e', accent: '#4F8EFF', icon: '⚑' },
    { label: 'Cybersecurity Club Lead', event: 'Club Leadership', org: 'College Tech Society', date: '2025–Present', desc: 'Founded and led the institution\'s cybersecurity chapter. Organized weekly workshops, inter-college CTF competitions, and industry speaker sessions.', color: '#031a0a', accent: '#00ff88', icon: '◈' },
    { label: 'Hackathon Organizer', event: 'Annual Hackfest', org: 'Campus', date: 'Nov 2025', desc: 'Co-organized a 24-hour hackathon with 120+ participants. Managed logistics, judging criteria, and partnerships with three industry sponsors.', color: '#1a030a', accent: '#ff6b8a', icon: '◬' },
    { label: 'Tech Talk Host', event: 'Tech Talk Series', org: 'Campus Tech Series', date: '2025', desc: 'Curated and hosted a speaker series bringing engineers from top companies. Coordinated AV, Q&A, and post-talk networking for 200+ attendees.', color: '#0d031a', accent: '#bf9eff', icon: '◎' },
    { label: 'Workshop Facilitator', event: 'Dev Workshop', org: 'IEEE Chapter', date: 'Mar 2026', desc: 'Led a hands-on technical workshop on web security fundamentals. Participants built and exploited sample vulnerable applications in a sandboxed lab environment.', color: '#1a1403', accent: '#ffe066', icon: '◇' },
    { label: 'Community Lead', event: 'Open Source Day', org: 'OSS Club', date: 'Jan 2026', desc: 'Organised the campus open-source contribution day, guiding 40+ students through their first pull requests on real-world projects across GitHub.', color: '#031a1a', accent: '#00e5ff', icon: '⬡' },
  ];

  const canvas = document.getElementById('cube-canvas');
  const ctx = canvas.getContext('2d');
  let DS = 360; // draw size

  function resizeCube() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(360, window.innerWidth - 48);
    canvas.style.width = w + 'px'; canvas.style.height = w + 'px';
    canvas.width = w * dpr; canvas.height = w * dpr;
    ctx.scale(dpr, dpr); DS = w;
  }
  resizeCube(); window.addEventListener('resize', resizeCube);

  const S = 100; // half-side
  const FOV = 460, ZDIST = 340;

  const VBASE = [[-S, -S, -S], [S, -S, -S], [S, S, -S], [-S, S, -S], [-S, -S, S], [S, -S, S], [S, S, S], [-S, S, S]];
  // face def: 4 vertex indices (winding order = counterclockwise when facing camera) + outward normal
  const FDEFS = [
    { vi: [4, 5, 6, 7], n: [0, 0, 1] },   // front  +Z
    { vi: [1, 0, 3, 2], n: [0, 0, -1] },  // back   -Z
    { vi: [0, 4, 7, 3], n: [-1, 0, 0] },  // left   -X
    { vi: [5, 1, 2, 6], n: [1, 0, 0] },   // right  +X
    { vi: [7, 6, 2, 3], n: [0, 1, 0] },   // bottom +Y (screen: up)
    { vi: [0, 1, 5, 4], n: [0, -1, 0] },  // top    -Y (screen: down)
  ];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

  // ── ROTATION STATE ────────────────────────────────────────────
  // FIX: steady compound rotation — not random drifting.
  // rotX and rotY at incommensurate rates guarantees all 6 faces appear.
  // rotX≈0.005 rad/frame at 60fps = ~1 rev / 21s
  // rotY≈0.009 rad/frame at 60fps = ~1 rev / 12s
  // Combined these create a tumbling diagonal motion showing every face.
  let rotX = 0.4, rotY = 0.6, rotZ = 0.1;
  const VX = 0.0052, VY = 0.0088, VZ = 0.0019;

  let hovFace = -1, frontFace = 0;

  function rotPt(p, rx, ry, rz) {
    let [x, y, z] = p;
    let y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx); y = y1; z = z1;
    let x2 = x * Math.cos(ry) + z * Math.sin(ry), z2 = -x * Math.sin(ry) + z * Math.cos(ry); x = x2; z = z2;
    return [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz), z];
  }
  function prj2(p) {
    const [x, y, z] = p;
    const sc = FOV / (FOV + z + ZDIST) * (DS / (S * 2.6));
    return { sx: x * sc + DS / 2, sy: y * sc + DS / 2, z, s: sc };
  }

  function polyContains(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].sx, yi = pts[i].sy, xj = pts[j].sx, yj = pts[j].sy;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function hitTest(mx, my, rv) {
    let best = -1, bestZ = -Infinity;
    FDEFS.forEach((def, fi) => {
      const rn = rotPt(def.n, rotX, rotY, rotZ);
      if (rn[2] <= 0) return;
      const pts = def.vi.map(i => prj2(rv[i]));
      if (polyContains(mx, my, pts)) {
        const z = def.vi.reduce((s, i) => s + rv[i][2], 0) / 4;
        if (z > bestZ) { bestZ = z; best = fi; }
      }
    });
    return best;
  }
  function getFrontFace(rv) {
    let best = 0, bd = -Infinity;
    FDEFS.forEach((def, fi) => { const rn = rotPt(def.n, rotX, rotY, rotZ); if (rn[2] > bd) { bd = rn[2]; best = fi; } });
    return best;
  }

  // ── Caption + dots update ─────────────────────────────────────
  const ctag = document.getElementById('ctag'), cname = document.getElementById('cname'), csub = document.getElementById('csub');
  const dots = Array.from(document.querySelectorAll('.fdot'));
  function updateCaption(fi) {
    const d = FACES[fi];
    ctag.style.opacity = '0';
    setTimeout(() => {
      ctag.textContent = d.event; ctag.style.color = d.accent;
      cname.textContent = d.label; csub.textContent = d.date + ' · ' + d.org;
      ctag.style.opacity = '1';
    }, 150);
    dots.forEach((dot, i) => dot.classList.toggle('on', i === fi));
  }

  // ── Draw one face ─────────────────────────────────────────────
  function drawFace(fi, rv, alpha, isHov) {
    const def = FDEFS[fi];
    const pts = def.vi.map(i => prj2(rv[i]));
    const fd = FACES[fi];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    pts.slice(1).forEach(p => ctx.lineTo(p.sx, p.sy));
    ctx.closePath();
    ctx.clip();

    // Face fill
    const minX = Math.min(...pts.map(p => p.sx)), maxX = Math.max(...pts.map(p => p.sx));
    const minY = Math.min(...pts.map(p => p.sy)), maxY = Math.max(...pts.map(p => p.sy));
    const fw = maxX - minX, fh = maxY - minY;

    // Base color fill
    ctx.globalAlpha = Math.min(1, alpha * 1.1);
    ctx.fillStyle = fd.color;
    ctx.fillRect(minX - 2, minY - 2, fw + 4, fh + 4);

    // Subtle grid
    ctx.globalAlpha = alpha * 0.12;
    ctx.strokeStyle = fd.accent;
    ctx.lineWidth = 0.5;
    const gs = 28;
    for (let gx = minX; gx < maxX; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, minY); ctx.lineTo(gx, maxY); ctx.stroke(); }
    for (let gy = minY; gy < maxY; gy += gs) { ctx.beginPath(); ctx.moveTo(minX, gy); ctx.lineTo(maxX, gy); ctx.stroke(); }

    // Radial glow at center
    ctx.globalAlpha = alpha * 0.2;
    const cxF = minX + fw / 2, cyF = minY + fh / 2;
    const gr = ctx.createRadialGradient(cxF, cyF, 0, cxF, cyF, Math.max(fw, fh) * 0.7);
    gr.addColorStop(0, fd.accent); gr.addColorStop(1, 'transparent');
    ctx.fillStyle = gr; ctx.fillRect(minX, minY, fw, fh);

    // Hover tint
    if (isHov) { ctx.globalAlpha = 0.15; ctx.fillStyle = '#fff'; ctx.fillRect(minX, minY, fw, fh); }

    // Icon + label
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Icon
    ctx.font = `${Math.max(18, fw * .2)}px sans-serif`;
    ctx.fillStyle = fd.accent;
    ctx.fillText(fd.icon, cxF, cyF - fw * .1);
    // Label
    ctx.font = `500 ${Math.max(9, fw * .075)}px 'Inter',sans-serif`;
    ctx.fillStyle = `rgba(255,255,255,${alpha * .9})`;
    ctx.fillText(fd.label, cxF, cyF + fw * .12);
    // Org
    ctx.font = `${Math.max(7, fw * .055)}px 'Courier Prime',monospace`;
    ctx.fillStyle = `rgba(255,255,255,${alpha * .4})`;
    ctx.fillText(fd.org.toUpperCase(), cxF, cyF + fw * .22);

    ctx.restore();

    // Border
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    pts.slice(1).forEach(p => ctx.lineTo(p.sx, p.sy));
    ctx.closePath();
    if (isHov) { ctx.shadowColor = fd.accent; ctx.shadowBlur = 20; ctx.strokeStyle = fd.accent; ctx.lineWidth = 1.8; }
    else { ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(79,142,255,${(.4 * alpha).toFixed(2)})`; ctx.lineWidth = 0.8; }
    ctx.stroke();
    ctx.restore();
  }

  // ── Render loop ───────────────────────────────────────────────
  const START = performance.now();
  let mouseX = -999, mouseY = -999, crect = canvas.getBoundingClientRect();
  window.addEventListener('resize', () => { crect = canvas.getBoundingClientRect(); });
  window.addEventListener('scroll', () => { crect = canvas.getBoundingClientRect(); });
  canvas.addEventListener('mousemove', e => {
    crect = canvas.getBoundingClientRect();
    const sx = DS / crect.width;
    mouseX = (e.clientX - crect.left) * sx;
    mouseY = (e.clientY - crect.top) * sx;
  });
  canvas.addEventListener('mouseleave', () => { mouseX = -999; mouseY = -999; hovFace = -1; canvas.style.cursor = 'default'; });

  function render(now) {
    const t = (now - START) * .001;

    // ── FIX: Steady rotation — both X and Y at constant rates ──
    rotX += VX; rotY += VY; rotZ += VZ;

    const rv = VBASE.map(v => rotPt(v, rotX, rotY, rotZ));
    const sorted = FDEFS.map((def, i) => ({
      i,
      avgZ: def.vi.reduce((s, vi) => s + rv[vi][2], 0) / 4,
      normZ: rotPt(def.n, rotX, rotY, rotZ)[2]
    })).sort((a, b) => a.avgZ - b.avgZ);

    ctx.clearRect(0, 0, DS, DS);

    // Subtle bg glow
    const bgG = ctx.createRadialGradient(DS / 2, DS / 2, 10, DS / 2, DS / 2, DS * .55);
    bgG.addColorStop(0, 'rgba(79,142,255,0.05)'); bgG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgG; ctx.fillRect(0, 0, DS, DS);

    // Hit-test for hover
    if (mouseX > 0) {
      hovFace = hitTest(mouseX, mouseY, rv);
      canvas.style.cursor = hovFace >= 0 ? 'pointer' : 'default';
    }

    // Draw faces back→front, cull back-faces
    sorted.forEach(({ i, normZ }) => {
      if (normZ <= 0.02) return;
      drawFace(i, rv, Math.min(1, normZ), i === hovFace);
    });

    // Edge overlay for depth cues
    EDGES.forEach(([a, b]) => {
      const pa = prj2(rv[a]), pb = prj2(rv[b]);
      ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy);
      ctx.strokeStyle = 'rgba(79,142,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();
    });

    // Vertex nodes
    VBASE.forEach((_, vi) => {
      const rv2 = rv[vi]; if (rv2[2] < -S * .6) return;
      const p = prj2(rv2), pulse = .65 + Math.sin(t * 2.5 + vi) * .35;
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 5);
      g.addColorStop(0, `rgba(79,142,255,${(.8 * pulse).toFixed(2)})`); g.addColorStop(1, 'rgba(79,142,255,0)');
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 1.5, 0, Math.PI * 2); ctx.fillStyle = `rgba(220,235,255,${(.95 * pulse).toFixed(2)})`; ctx.fill();
    });

    // Update caption
    const ff = getFrontFace(rv);
    if (ff !== frontFace) { frontFace = ff; updateCaption(ff); }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ── MODAL ──────────────────────────────────────────────────────
  const overlay = document.getElementById('modal-overlay');
  const mfCanvas = document.getElementById('modal-face-canvas');
  const mfCtx = mfCanvas.getContext('2d');
  let curModal = 0;

  // Mini spinning face preview in modal
  let mfRot = 0;
  function drawModalFace(fi) {
    const cw = mfCanvas.width, ch = mfCanvas.height;
    mfCtx.clearRect(0, 0, cw, ch);
    const fd = FACES[fi];
    // Gradient background
    const bg = mfCtx.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, fd.color); bg.addColorStop(1, '#000');
    mfCtx.fillStyle = bg; mfCtx.fillRect(0, 0, cw, ch);
    // Grid
    mfCtx.strokeStyle = `${fd.accent}22`; mfCtx.lineWidth = 1;
    for (let x = 0; x < cw; x += 36) { mfCtx.beginPath(); mfCtx.moveTo(x, 0); mfCtx.lineTo(x, ch); mfCtx.stroke(); }
    for (let y = 0; y < ch; y += 36) { mfCtx.beginPath(); mfCtx.moveTo(0, y); mfCtx.lineTo(cw, y); mfCtx.stroke(); }
    // Radial glow
    const rg = mfCtx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, ch * .7);
    rg.addColorStop(0, fd.accent + '55'); rg.addColorStop(1, 'transparent');
    mfCtx.fillStyle = rg; mfCtx.fillRect(0, 0, cw, ch);
    // Face number badge
    mfCtx.fillStyle = `${fd.accent}33`;
    mfCtx.font = `bold ${ch * .55}px 'Courier Prime',monospace`;
    mfCtx.textAlign = 'right'; mfCtx.textBaseline = 'bottom';
    mfCtx.fillText(`0${fi + 1}`, cw - 20, ch - 10);
    // Icon
    mfCtx.font = `${ch * .3}px sans-serif`;
    mfCtx.textAlign = 'center'; mfCtx.textBaseline = 'middle';
    mfCtx.fillText(fd.icon, cw * .5, ch * .42);
    // Label
    mfCtx.font = `600 ${Math.max(14, cw * .045)}px 'Inter',sans-serif`;
    mfCtx.fillStyle = 'rgba(255,255,255,0.95)';
    mfCtx.fillText(fd.label, cw / 2, ch * .72);
    mfCtx.font = `${Math.max(10, cw * .03)}px 'Courier Prime',monospace`;
    mfCtx.fillStyle = fd.accent + 'cc';
    mfCtx.fillText(fd.org.toUpperCase(), cw / 2, ch * .84);
  }

  function openModal(fi) {
    curModal = fi;
    const d = FACES[fi];
    document.getElementById('modal-badge').textContent = `0${fi + 1} / 06`;
    document.getElementById('m-event').textContent = d.event.toUpperCase();
    document.getElementById('m-role').textContent = d.label;
    document.getElementById('m-org').textContent = d.org;
    document.getElementById('m-desc').textContent = d.desc;
    document.getElementById('m-date').textContent = d.date;
    drawModalFace(fi);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  function navModal(d) { curModal = ((curModal + d) + 6) % 6; openModal(curModal); }

  canvas.addEventListener('click', e => {
    crect = canvas.getBoundingClientRect();
    const sx = DS / crect.width;
    const ex = (e.clientX - crect.left) * sx, ey = (e.clientY - crect.top) * sx;
    const rv = VBASE.map(v => rotPt(v, rotX, rotY, rotZ));
    const fi = hitTest(ex, ey, rv);
    if (fi >= 0) openModal(fi);
  });

  document.getElementById('mclose').addEventListener('click', closeModal);
  document.getElementById('mprev').addEventListener('click', () => navModal(-1));
  document.getElementById('mnext').addEventListener('click', () => navModal(1));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') navModal(-1);
    if (e.key === 'ArrowRight') navModal(1);
  });
  dots.forEach((dot, i) => dot.addEventListener('click', () => openModal(i)));

  // Init caption
  updateCaption(0);
})();
