/* vct.js — the variable cam timing (vane phaser) diagram for the experience section.
 * A self-drawn SVG on a 320x320 viewBox, centred (160,160). Thin 1.2px strokes match the
 * page's hairline language; the only heavy stroke is the sprocket ring. A tiny rAF loop
 * turns the rotor 0..+24deg (power2.inOut), grows the amber oil on the advance side while
 * it shrinks on the retard side, slides the lock pin out at the holds, and swaps the
 * ADVANCE / RETARD label. 6s loop. Reduced motion holds a static mid-advance frame.
 */
const NS = 'http://www.w3.org/2000/svg';
const C = 160, R_HUB = 40, R_WALL = 112, R_VANE_OUT = 108;
const RAD = Math.PI / 180;

function el(name, attrs) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function pt(rad, r) { return [C + r * Math.cos(rad), C + r * Math.sin(rad)]; }

// filled sector between two angles (degrees), from r1 to r2
function sectorPath(a1, a2, r1, r2) {
  const A1 = a1 * RAD, A2 = a2 * RAD;
  const [x1i, y1i] = pt(A1, r1), [x1o, y1o] = pt(A1, r2);
  const [x2o, y2o] = pt(A2, r2), [x2i, y2i] = pt(A2, r1);
  const large = (a2 - a1) > 180 ? 1 : 0;
  return `M${x1i},${y1i} L${x1o},${y1o} A${r2},${r2} 0 ${large} 1 ${x2o},${y2o} `
       + `L${x2i},${y2i} A${r1},${r1} 0 ${large} 0 ${x1i},${y1i} Z`;
}
function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5; }

export function createVct(svg, animate) {
  svg.setAttribute('viewBox', '0 0 320 320');
  const thin = { fill: 'none', stroke: '#1a1a1a', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  // housing: sprocket ring (the one heavy element) + inner wall
  svg.appendChild(el('circle', { cx: C, cy: C, r: 128, fill: 'none', stroke: '#1a1a1a', 'stroke-width': 8, 'stroke-dasharray': '4 3', opacity: 0.9 }));
  svg.appendChild(el('circle', Object.assign({ cx: C, cy: C, r: R_WALL }, thin)));

  // oil sectors (behind the ribs/rotor): 2 per chamber
  const oilAdv = [], oilRet = [];
  const oilGroup = el('g', {});
  for (let k = 0; k < 4; k++) {
    const a = el('path', { fill: '#d9a441', 'fill-opacity': 0.45 });
    const r = el('path', { fill: '#d9a441', 'fill-opacity': 0.45 });
    oilAdv.push(a); oilRet.push(r); oilGroup.appendChild(a); oilGroup.appendChild(r);
  }
  svg.appendChild(oilGroup);

  // four housing ribs at 0/90/180/270
  for (let k = 0; k < 4; k++) {
    svg.appendChild(el('rect', Object.assign({ x: C + R_HUB, y: C - 4, width: R_WALL - R_HUB, height: 8, rx: 4, fill: '#ffffff', transform: `rotate(${90 * k} ${C} ${C})` }, thin)));
  }

  // rotor group: hub + hex bolt + four vanes + lock pin
  const rotor = el('g', {});
  rotor.appendChild(el('circle', Object.assign({ cx: C, cy: C, r: R_HUB, fill: '#ffffff' }, thin)));
  const hex = [];
  for (let i = 0; i < 6; i++) { const [x, y] = pt(i * 60 * RAD, 12); hex.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
  rotor.appendChild(el('polygon', Object.assign({ points: hex.join(' '), fill: 'none' }, thin)));
  for (let k = 0; k < 4; k++) {
    rotor.appendChild(el('rect', Object.assign({ x: C + R_HUB, y: C - 7, width: R_VANE_OUT - R_HUB, height: 14, rx: 7, fill: '#f2f2f2', transform: `rotate(${45 + 90 * k} ${C} ${C})` }, thin)));
  }
  const pin = el('rect', Object.assign({ x: C + 84, y: C - 3, width: 14, height: 6, rx: 3, fill: '#ffffff' }, thin));
  const pinWrap = el('g', { transform: `rotate(45 ${C} ${C})` });
  pinWrap.appendChild(pin);
  rotor.appendChild(pinWrap);
  svg.appendChild(rotor);

  // label
  const labAdv = el('text', { x: C, y: 306, 'text-anchor': 'middle', 'font-size': 12, 'letter-spacing': '0.18em', fill: '#6b6b6b' });
  labAdv.textContent = 'ADVANCE';
  const labRet = el('text', { x: C, y: 306, 'text-anchor': 'middle', 'font-size': 12, 'letter-spacing': '0.18em', fill: '#6b6b6b', opacity: 0 });
  labRet.textContent = 'RETARD';
  svg.appendChild(labAdv); svg.appendChild(labRet);
  const rule = el('line', { x1: C - 40, y1: 314, x2: C + 40, y2: 314, stroke: '#eaeaea', 'stroke-width': 1 });
  svg.appendChild(rule);

  function render(angle, pinOut, advancing) {
    rotor.setAttribute('transform', `rotate(${angle} ${C} ${C})`);
    // oil weight tracks the rotor: the growing (advance) side darkens .12 -> .45, the
    // shrinking (retard) side lightens .45 -> .12, so the oil visibly moves.
    const f = angle / 24;
    const opAdv = (0.12 + f * 0.33).toFixed(3);
    const opRet = (0.45 - f * 0.33).toFixed(3);
    for (let k = 0; k < 4; k++) {
      const base = 90 * k, vane = base + 45 + angle;   // vane inside chamber [base, base+90]
      oilAdv[k].setAttribute('d', sectorPath(base + 2, vane - 8, R_HUB + 3, R_WALL - 3));   // advance side grows
      oilRet[k].setAttribute('d', sectorPath(vane + 8, base + 88, R_HUB + 3, R_WALL - 3));  // retard side shrinks
      oilAdv[k].setAttribute('fill-opacity', opAdv);
      oilRet[k].setAttribute('fill-opacity', opRet);
    }
    // lock pin slides 6px out at the holds
    pin.setAttribute('x', C + 84 + (pinOut ? 6 : 0));
    labAdv.setAttribute('opacity', advancing ? 1 : 0);
    labRet.setAttribute('opacity', advancing ? 0 : 1);
  }

  if (!animate) { render(24 * easeInOut(0.6), false, true); return render; }
  let paused = false;
  window.__vctRender = (a, pin, adv) => { paused = true; render(a, pin, adv); };   // test hook

  const T = 6, T1 = 2.2, HOLD = 0.7, T2 = 2.2;   // advance, hold, retard, hold(remainder)
  // Driven by the single master rAF (main.js) so the page keeps one animation loop.
  function frame(now) {
    if (paused) return;
    const t = (now / 1000) % T;
    let angle, pinOut, advancing;
    if (t < T1) { angle = 24 * easeInOut(t / T1); pinOut = false; advancing = true; }
    else if (t < T1 + HOLD) { angle = 24; pinOut = true; advancing = true; }
    else if (t < T1 + HOLD + T2) { angle = 24 * (1 - easeInOut((t - T1 - HOLD) / T2)); pinOut = false; advancing = false; }
    else { angle = 0; pinOut = true; advancing = false; }
    render(angle, pinOut, advancing);
  }
  return frame;
}
