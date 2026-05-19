const cur = document.getElementById('cursor'), crng = document.getElementById('cursor-ring');
let mx = -200, my = -200, rlx = -200, rly = -200;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
(function t() { rlx += (mx - rlx) * .11; rly += (my - rly) * .11; cur.style.left = mx + 'px'; cur.style.top = my + 'px'; crng.style.left = rlx + 'px'; crng.style.top = rly + 'px'; requestAnimationFrame(t); })();
document.querySelectorAll('a,.glass-card,.por-card').forEach(el => {
  el.addEventListener('mouseenter', () => { cur.style.width = '14px'; cur.style.height = '14px'; crng.style.width = '52px'; crng.style.height = '52px'; });
  el.addEventListener('mouseleave', () => { cur.style.width = '8px'; cur.style.height = '8px'; crng.style.width = '36px'; crng.style.height = '36px'; });
});
