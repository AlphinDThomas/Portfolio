(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight;
  function resize() { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; }
  resize(); window.addEventListener('resize', resize);

  let scrollFrac = 0, targetFrac = 0;
  function updateScroll() {
    const entries = document.querySelectorAll('.entry');
    if (entries.length >= 2) {
      const startY = entries[0].getBoundingClientRect().top + window.scrollY;
      const endY = entries[1].getBoundingClientRect().top + window.scrollY;
      const currentY = window.scrollY + window.innerHeight * 0.5;
      if (endY > startY) {
        targetFrac = Math.max(0, Math.min(1, (currentY - startY) / (endY - startY)));
      }
    } else {
      const ms = document.body.scrollHeight - window.innerHeight;
      targetFrac = ms > 0 ? Math.min(1, window.scrollY / ms) : 0;
    }
  }
  window.addEventListener('scroll', updateScroll);
  setTimeout(updateScroll, 100);
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  const BV = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const FACES_IDX = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 4, 7, 3], [1, 5, 6, 2], [0, 1, 5, 4], [3, 2, 6, 7]];

  function rotV(v, rx, ry, rz) {
    let [x, y, z] = v;
    let y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx); y = y1; z = z1;
    let x2 = x * Math.cos(ry) + z * Math.sin(ry), z2 = -x * Math.sin(ry) + z * Math.cos(ry); x = x2; z = z2;
    return [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz), z];
  }
  function prj(x, y, z, cx, cy, sz) {
    const f = 380, d = 200, s = f / (f + z + d);
    return { px: x * s * sz + cx, py: y * s * sz + cy, z, s };
  }

  const PARTS = Array.from({ length: 28 }, () => ({
    theta: Math.random() * Math.PI * 2, phi: Math.random() * Math.PI,
    r: 100 + Math.random() * 60, spd: (.2 + Math.random() * .4) * (Math.random() < .5 ? 1 : -1),
    sz: .8 + Math.random() * 1.3, ph: Math.random() * Math.PI * 2
  }));

  const porEl = document.getElementById('por-section');
  const START = performance.now();

  function frame(now) {
    const t = (now - START) * .001;
    scrollFrac += (targetFrac - scrollFrac) * 0.055;
    const ef = ease(scrollFrac);

    // Fade out as POR section comes into view
    const porTop = porEl.getBoundingClientRect().top;
    const alpha = Math.max(0, Math.min(1, (porTop - 60) / (H * 0.45)));
    canvas.style.opacity = alpha;
    if (alpha < 0.01) { requestAnimationFrame(frame); return; }

    // ── FIXED ASYMMETRIC VISUAL DATA TRAJECTORY MECHANICS ──
    // Calculate the absolute visual center of your text layout column
    const layoutCenter = W / 2;

    // Dynamically shift the cube completely outside the 920px text wrapper bounds
    // State 0 (Top): Starts right in the visual vacuum space (+260px from center)
    // State 1 (Bottom): Crosses over to the left visual vacuum space (-260px from center)
    const cubeX = lerp(layoutCenter + 260, layoutCenter - 260, ef);

    // Vertical translation path tracking smooth scroll progression mapping down the layout frame
    const cubeY = lerp(H * 0.35, H * 0.58, ef) + Math.sin(t * .7) * 12;

    const rs = 1 + scrollFrac * .5;
    const rx = t * .35 * rs, ry = t * .55 * rs, rz = t * .15;
    const SZ = 78;

    const verts = BV.map(v => { const [x, y, z] = rotV(v, rx, ry, rz); return prj(x, y, z, cubeX, cubeY, SZ); });
    const sf = FACES_IDX.map((f, i) => ({ i, avgZ: f.reduce((s, vi) => s + verts[vi].z, 0) / 4 })).sort((a, b) => a.avgZ - b.avgZ);

    ctx.clearRect(0, 0, W, H);

    // Ambient particles around cube
    PARTS.forEach(p => {
      const th = p.theta + t * p.spd;
      const px = Math.sin(p.phi) * Math.cos(th) * p.r + cubeX;
      const py = Math.sin(p.phi) * Math.sin(th) * p.r + cubeY;
      const a = .1 + Math.sin(t * 1.2 + p.ph) * .07;
      ctx.beginPath(); ctx.arc(px, py, p.sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(79,142,255,${a.toFixed(3)})`; ctx.fill();
    });

    // Faint face fills
    sf.forEach(({ i }) => {
      const f = FACES_IDX[i];
      const da = Math.max(0, (sf.findIndex(x => x.i === i) / FACES_IDX.length) * .04);
      ctx.beginPath(); ctx.moveTo(verts[f[0]].px, verts[f[0]].py);
      f.slice(1).forEach(vi => ctx.lineTo(verts[vi].px, verts[vi].py));
      ctx.closePath(); ctx.fillStyle = `rgba(79,142,255,${da.toFixed(4)})`; ctx.fill();
    });

    // Glowing edges
    EDGES.forEach(([a, b]) => {
      const va = verts[a], vb = verts[b];
      const mz = (va.z + vb.z) * .5, db = Math.max(.15, Math.min(.9, (mz + SZ * 1.2) / (SZ * 2.4)));
      [[5, .06], [3, .14], [1.5, .35], [.7, .75]].forEach(([lw, la]) => {
        ctx.beginPath(); ctx.moveTo(va.px, va.py); ctx.lineTo(vb.px, vb.py);
        ctx.strokeStyle = `rgba(79,142,255,${(la * db).toFixed(3)})`; ctx.lineWidth = lw; ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(va.px, va.py); ctx.lineTo(vb.px, vb.py);
      ctx.strokeStyle = `rgba(180,210,255,${(.45 * db).toFixed(3)})`; ctx.lineWidth = .4; ctx.stroke();
    });

    // Vertex glow dots
    verts.forEach(v => {
      const r = Math.max(1, 2.8 * v.s), pulse = .7 + Math.sin(t * 2.2 + v.z) * .3;
      const g = ctx.createRadialGradient(v.px, v.py, 0, v.px, v.py, r * 5);
      g.addColorStop(0, `rgba(79,142,255,${(.55 * pulse).toFixed(2)})`);
      g.addColorStop(.4, `rgba(79,142,255,${(.12 * pulse).toFixed(2)})`);
      g.addColorStop(1, 'rgba(79,142,255,0)');
      ctx.beginPath(); ctx.arc(v.px, v.py, r * 5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(v.px, v.py, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,228,255,${(.9 * pulse).toFixed(2)})`; ctx.fill();
    });

    // Dashed trajectory matrix lines mapping dynamically between visual margins
    if (scrollFrac > .01 || scrollFrac < .99) {
      const sx = layoutCenter + 260, sy = H * 0.35;
      const ex = layoutCenter - 260, ey = H * 0.58;
      
      // Draw faint full track
      ctx.beginPath(); ctx.setLineDash([4, 10]); 
      ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = 'rgba(79,142,255,0.06)'; 
      ctx.lineWidth = 1; ctx.stroke(); 
      
      // Glowing segment following the cube
      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, 'rgba(79,142,255,0)');
      if (ef > 0.05) grad.addColorStop(Math.max(0.01, ef - 0.15), 'rgba(79,142,255,0)');
      grad.addColorStop(ef, `rgba(79,142,255,${(Math.sin(scrollFrac * Math.PI) * 0.4).toFixed(3)})`);
      if (ef < 0.95) grad.addColorStop(Math.min(0.99, ef + 0.15), 'rgba(79,142,255,0)');
      grad.addColorStop(1, 'rgba(79,142,255,0)');
      
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = grad; ctx.stroke(); 
      ctx.setLineDash([]);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
