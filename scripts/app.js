"use strict";
const $ = id => document.getElementById(id);
// Layout hooks: desktop and mobile pages set window.UI = {update, onSelect, onAddress, onReady} as they need.
const fitPad = () => (window.UI && window.UI.pad) ? window.UI.pad() : {padding:[40, 40]};
const hook = (name, ...args) => { try { const f = window.UI && window.UI[name]; if (f) f(...args); } catch (e) { console.error(e); } };
const lc = s => s.replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase());
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- measures ---------- */
const TEAL = ["#E0F4FC","#A6DFF6","#5CC6EE","#00A6E5","#00759F","#044E6B"];
const AMBER = ["#F6EBD9","#F0CF9C","#E6A85E","#C9772E","#8E4B17","#5C2E0C"];
const GREEN = ["#EEF4E3","#CFE2AE","#A8CB78","#85B24A","#5B8A3A","#365C22"];
const SCORE = ["#B8432F","#E07B39","#E9C46A","#7FB37A","#0E6B66"];
const n0 = v => Math.round(v).toLocaleString("en-CA");
const p0 = v => v.toFixed(0) + "%", p1 = v => v.toFixed(1) + "%";
const kmoney = v => "$" + Math.round(v / 1000) + "k", money = v => "$" + n0(v);
const yrs = v => v.toFixed(1), yrs0 = v => v.toFixed(0);

const sum = (k) => D.das.reduce((s, a) => s + (a[k] || 0), 0);
// Measures come from data/explorer.json; build_explorer.py defines them.
const RAMPS = {teal:TEAL, amber:AMBER, green:GREEN, score:SCORE};
const FMT = {
  n:     [n0, n0],
  d:     [v => v.toFixed(1), v => v.toFixed(1)],
  pct:   [p0, p1],
  money: [v => v >= 100000 ? "$" + Math.round(v / 1000) + "k" : v >= 10000 ? "$" + (v / 1000).toFixed(0) + "k" : money(v), money],
  score: [yrs0, yrs0],
};
let GROUPS = [], MEASURES = {}, KEYS = [];
function initMeasures() {
  for (const m of D.measures) {
    if (!GROUPS.includes(m.group)) GROUPS.push(m.group);
    const [fmt, long] = FMT[m.kind];
    MEASURES[m.key] = {g:GROUPS.indexOf(m.group), label:m.label, desc:m.desc, fmt, long, ramp:RAMPS[m.ramp],
      city:() => [D.city[m.key] == null ? "n/a" : long(D.city[m.key]), m.key === "score" ? "average resident" : "City of Guelph"]};
  }
  KEYS = Object.keys(MEASURES);
  if (!MEASURES[S.measure]) S.measure = "income";
  if (!MEASURES[S.y] || S.y === S.measure) S.y = S.measure === "lowinc" ? "income" : "lowinc";
}

const S = { measure:"income", y:"lowinc", method:"jenks", k:5, sel:null, pin:null, cls:null };
try { const saved = JSON.parse(localStorage.getItem("gce") || "{}"); for (const k of ["measure","y","method","k"]) if (saved[k] != null) S[k] = saved[k]; } catch (e) {}
const save = () => { try { localStorage.setItem("gce", JSON.stringify({measure:S.measure, y:S.y, method:S.method, k:S.k})); } catch (e) {} };

/* ---------- classification ---------- */
function jenks(v, k) {
  const n = v.length, L = [], V = [];
  for (let i = 0; i <= n; i++) { L.push(new Array(k + 1).fill(0)); V.push(new Array(k + 1).fill(0)); }
  for (let j = 1; j <= k; j++) { L[1][j] = 1; for (let i = 2; i <= n; i++) V[i][j] = Infinity; }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0, var_ = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1, val = v[i3 - 1];
      s2 += val * val; s1 += val; w++; var_ = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) for (let j = 2; j <= k; j++) if (V[l][j] >= var_ + V[i4][j - 1]) { L[l][j] = i3; V[l][j] = var_ + V[i4][j - 1]; }
    }
    L[l][1] = 1; V[l][1] = var_;
  }
  const br = new Array(k + 1); br[k] = v[n - 1]; br[0] = v[0];
  let kk = n;
  for (let j = k; j >= 2; j--) { const id = L[kk][j] - 2; br[j - 1] = v[id]; kk = L[kk][j] - 1; }
  return br;
}
function breaks(vals, method, k) {
  const v = [...vals].sort((a, b) => a - b), n = v.length;
  const uniq = new Set(v).size; k = Math.min(k, uniq);
  let br;
  if (method === "equal") { br = []; for (let i = 0; i <= k; i++) br.push(v[0] + (v[n - 1] - v[0]) * i / k); }
  else if (method === "quantile") { br = [v[0]]; for (let i = 1; i < k; i++) br.push(v[Math.min(n - 1, Math.ceil(i * n / k) - 1)]); br.push(v[n - 1]); }
  else br = jenks(v, k);
  const out = [br[0]]; for (let i = 1; i < br.length; i++) if (br[i] > out[out.length - 1]) out.push(br[i]);
  if (out.length === 1) out.push(out[0]);
  return out;
}
const classOf = (br, x) => { for (let i = 0; i < br.length - 2; i++) if (x <= br[i + 1]) return i; return br.length - 2; };
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rampN(stops, k) {
  if (k === 1) return [stops[Math.floor(stops.length / 2)]];
  const use = stops === SCORE ? stops : stops.slice(0, k <= 5 ? 5 : 6), out = [];
  for (let i = 0; i < k; i++) { const t = i / (k - 1) * (use.length - 1), a = Math.floor(t), b = Math.min(use.length - 1, a + 1), f = t - a;
    const A = hex2rgb(use[a]), B = hex2rgb(use[b]); out.push("rgb(" + A.map((c, j) => Math.round(c + (B[j] - c) * f)).join(",") + ")"); }
  return out;
}

/* ---------- data ---------- */
let D, map, daLayer, selLayer, selRend, tok = {};
const readTokens = () => { const cs = getComputedStyle(document.documentElement); for (const t of ["bldg","bldg-edge","label","halo","land","bg","water","water-edge","street","case","hwy","nodata","sel","panel","ink","accent","warn","muted"]) tok[t] = cs.getPropertyValue("--" + t).trim(); };
const ll = fl => { const o = []; for (let j = 0; j < fl.length; j += 2) o.push([fl[j + 1] / 1e5, fl[j] / 1e5]); return o; };
const daName = a => a.streets.length >= 2 ? a.streets[0] + " & " + a.streets[1] : a.streets[0] || ("DA " + a.da);

async function boot() {
  const r = await fetch("data/explorer.json"); if (!r.ok) throw new Error("data");
  D = await r.json();
  D.das.forEach((a, i) => { a.i = i; a.name = daName(a); });
  initMeasures();
  $("sub").textContent = `${n0(sum("pop"))} residents in ${D.das.length} neighbourhoods and ${KEYS.length} measures. Map any one, open a neighbourhood's profile, and see how measures move together.`;
  readTokens(); buildMap(); buildControls(); refresh(); $("loading").hidden = true;
  const start = D.das.find(a => a.streets[0] === "Wyndham St N") || D.das.find(a => a.pop > 0);
  select(start, {quiet:true});
  loadAddresses(); loadContext(); hook("onReady");
}
const CTX = {};
async function loadContext() {
  try {
    const r = await fetch("data/context.json"); if (!r.ok) throw new Error("context");
    const C = await r.json();
    const P = (lon, lat) => map.project(L.latLng(lat, lon), 0);
    // buildings: zoom-0 pixel coordinates in the rotated projection, with boxes for culling
    const n = C.b.length, off = new Int32Array(n + 1); let tot = 0;
    for (let i = 0; i < n; i++) { tot += C.b[i].length / 2; off[i + 1] = tot; }
    const bx = new Float64Array(tot), by = new Float64Array(tot), box = new Float64Array(n * 4);
    for (let i = 0, k = 0; i < n; i++) { let x = 0, y = 0, a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; const fl = C.b[i];
      for (let j = 0; j < fl.length; j += 2, k++) { x += fl[j]; y += fl[j + 1]; const p = P(x / 1e5, y / 1e5); bx[k] = p.x; by[k] = p.y; if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y; }
      box[i * 4] = a; box[i * 4 + 1] = b; box[i * 4 + 2] = c; box[i * 4 + 3] = d; }
    // streets: local streets join the road layer; every named street can get a label
    const dec = fl => { const o = []; let x = 0, y = 0; for (let j = 0; j < fl.length; j += 2) { x += fl[j]; y += fl[j + 1]; o.push([y / 1e5, x / 1e5]); } return o; };
    const labels = [];
    for (const [ni, cls, fl] of C.s) {
      const pts = dec(fl);
      if (cls === 1) D.roadL.push([1, L.polyline(pts, {renderer:D.rR, interactive:false, smoothFactor:1}).addTo(map)]);
      labels.push({name:C.names[ni], cls, p:pts.map(q => map.project(L.latLng(q[0], q[1]), 0))});
    }
    labels.sort((a, b) => b.cls - a.cls || b.p.length - a.p.length);
    styleRoads();
    CTX.bl = new CanvasLayer((ctx, v) => drawBuildings(ctx, v, off, bx, by, box), "bldg").addTo(map);
    CTX.lb = new CanvasLayer((ctx, v) => drawLabels(ctx, v, labels), "labels").addTo(map);
  } catch (e) { console.error(e); }
}
function drawBuildings(ctx, v, off, bx, by, box) {
  if (v.z < 14.5) return;
  const n = off.length - 1, X0 = v.ox / v.k, Y0 = v.oy / v.k, X1 = (v.ox + v.w) / v.k, Y1 = (v.oy + v.h) / v.k;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (box[i * 4 + 2] < X0 || box[i * 4] > X1 || box[i * 4 + 3] < Y0 || box[i * 4 + 1] > Y1) continue;
    for (let j = off[i]; j < off[i + 1]; j++) { const x = bx[j] * v.k - v.ox, y = by[j] * v.k - v.oy; if (j === off[i]) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath();
  }
  ctx.globalAlpha = Math.min(1, (v.z - 14.5) / 0.75 + 0.25);
  ctx.fillStyle = tok.bldg; ctx.fill();
  if (v.z >= 15.5) { ctx.strokeStyle = tok["bldg-edge"]; ctx.lineWidth = 0.7; ctx.stroke(); }
}
function drawLabels(ctx, v, labels) {
  if (v.z < 13.25) return;
  const minCls = v.z < 14.25 ? 3 : v.z < 15.25 ? 2 : 1, size = v.z >= 16 ? 12.5 : 11.5;
  ctx.font = `600 ${size}px "Public Sans", system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = 3.2; ctx.strokeStyle = tok.halo; ctx.fillStyle = tok.label;
  const placed = [], lastByName = new Map(), M = 20;
  for (const lab of labels) {
    if (lab.cls < minCls) continue;
    const pts = lab.p.map(p => [p.x * v.k - v.ox, p.y * v.k - v.oy]);
    let len = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); len += d; }
    if (!seg.length) continue;
    const tw = ctx.measureText(lab.name).width; if (len < tw + 24) continue;
    const at = d => { let r = d, j = 0; while (j < seg.length - 1 && r > seg[j]) { r -= seg[j]; j++; } const A = pts[j], B = pts[j + 1], g = seg[j] ? Math.min(1, r / seg[j]) : 0; return [A[0] + (B[0] - A[0]) * g, A[1] + (B[1] - A[1]) * g]; };
    const [cx, cy] = at(len / 2);
    if (cx < -M || cy < -M || cx > v.w + M || cy > v.h + M) continue;
    const s0 = at(Math.max(0, len / 2 - tw / 2)), s1 = at(Math.min(len, len / 2 + tw / 2));
    let ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    const hw = Math.abs(Math.cos(ang)) * tw / 2 + Math.abs(Math.sin(ang)) * size * 0.7, hh = Math.abs(Math.sin(ang)) * tw / 2 + Math.abs(Math.cos(ang)) * size * 0.7;
    const r = [cx - hw - 4, cy - hh - 4, cx + hw + 4, cy + hh + 4];
    if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;
    const prev = lastByName.get(lab.name); if (prev && prev.some(([x, y]) => Math.hypot(x - cx, y - cy) < 260)) continue;
    placed.push(r); if (!prev) lastByName.set(lab.name, [[cx, cy]]); else prev.push([cx, cy]);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.strokeText(lab.name, 0, 0); ctx.fillText(lab.name, 0, 0); ctx.restore();
  }
}
let ADDR = null;
async function loadAddresses() {
  $("addrNote").textContent = "loading addresses…";
  try {
    const r = await fetch("data/addresses.json"); if (!r.ok) throw new Error("addresses");
    const A = await r.json(), n = A.t.length, lat = new Float64Array(n), lon = new Float64Array(n);
    let x = 0, y = 0; for (let i = 0; i < n; i++) { x += A.x[i]; y += A.y[i]; lon[i] = x / 1e5; lat[i] = y / 1e5; }
    ADDR = {t:A.t, key:A.t.map(t => t.toLowerCase()), d:A.d, lat, lon};
    $("addrNote").textContent = n0(n) + " addresses";
    if ($("q").value.trim()) $("q").dispatchEvent(new Event("input"));
  } catch (e) { $("addrNote").textContent = "streets only"; console.error(e); }
}

/* ---------- map: rotated so Guelph's street grid runs up and down ---------- */
// The map is turned 46° clockwise by rotating the Web Mercator projection around downtown.
// ROT_DEG is counterclockwise-positive, so -46 turns the map clockwise. Clicks, zooming and every layer follow it.
const ROT_DEG = -46;
const ROT_CRS = (() => {
  const SM = L.Projection.SphericalMercator, t = ROT_DEG * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
  const c = SM.project(L.latLng(43.545, -80.25));
  const proj = {
    bounds: SM.bounds,
    project(ll) { const p = SM.project(ll), dx = p.x - c.x, dy = p.y - c.y; return L.point(c.x + dx * cs - dy * sn, c.y + dx * sn + dy * cs); },
    unproject(p) { const dx = p.x - c.x, dy = p.y - c.y; return SM.unproject(L.point(c.x + dx * cs + dy * sn, c.y - dx * sn + dy * cs)); },
  };
  return L.extend({}, L.CRS.EPSG3857, {projection:proj, code:"GUELPH-ROT"});
})();
// Fit a set of rings (arrays of LatLngs) on the rotated map. Leaflet's own fitBounds assumes north-up.
function fitTo(rings, o = {}) {
  const pad = o.pad || fitPad(), P = v => L.point(v || [0, 0]);
  const tl = P(pad.paddingTopLeft || pad.padding), br = P(pad.paddingBottomRight || pad.padding);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const q of r) { const p = map.project(q, 0); if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const size = map.getSize().subtract(tl).subtract(br), w = Math.max(x1 - x0, 1e-9), h = Math.max(y1 - y0, 1e-9);
  let z = Math.floor(Math.log2(Math.min(size.x / w, size.y / h)) * 4) / 4;
  z = Math.max(map.getMinZoom(), Math.min(z, o.maxZoom != null ? o.maxZoom : map.getMaxZoom()));
  const k = Math.pow(2, z), c = map.unproject(L.point((x0 + x1) / 2 * k, (y0 + y1) / 2 * k).add(br.subtract(tl).divideBy(2)), z);
  if (o.fly) map.flyTo(c, z, {duration:0.6}); else map.setView(c, z, {animate:false});
}
// A canvas redrawn after each pan or zoom; used for building footprints and street labels.
const CanvasLayer = L.Layer.extend({
  initialize(draw, pane) { this._draw = draw; L.setOptions(this, {pane}); },
  onAdd(m) { this._c = L.DomUtil.create("canvas", "leaflet-zoom-hide"); this._c.style.pointerEvents = "none"; m.getPane(this.options.pane).appendChild(this._c); m.on("moveend zoomend resize viewreset", this.redraw, this); this.redraw(); },
  onRemove(m) { this._c.remove(); m.off("moveend zoomend resize viewreset", this.redraw, this); },
  redraw() {
    const m = this._map; if (!m) return;
    const s = m.getSize(), dpr = window.devicePixelRatio || 1, c = this._c, tl = m.containerPointToLayerPoint([0, 0]);
    c.width = s.x * dpr; c.height = s.y * dpr; c.style.width = s.x + "px"; c.style.height = s.y + "px"; L.DomUtil.setPosition(c, tl);
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = m.getZoom(), k = Math.pow(2, z), o = m.getPixelOrigin();
    this._draw(ctx, {z, k, ox:o.x + tl.x, oy:o.y + tl.y, w:s.x, h:s.y});
  },
});
const NorthArrow = L.Control.extend({
  options:{position:"topright"},
  onAdd() { const d = L.DomUtil.create("div", "north"); d.title = "North";
    d.innerHTML = `<svg viewBox="0 0 40 40" width="40" height="40" aria-label="North arrow, map rotated ${Math.abs(ROT_DEG)}° ${ROT_DEG < 0 ? "clockwise" : "counterclockwise"}" role="img"><g transform="rotate(${-ROT_DEG} 20 20)"><path d="M20 6 26 26 20 22 14 26z" fill="currentColor"/><text x="20" y="36" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">N</text></g></svg>`;
    return d; },
});

function buildMap() {
  const touch = !!(window.UI && window.UI.touch);
  map = L.map("map", {crs:ROT_CRS, zoomControl:!touch, minZoom:11, maxZoom:17, preferCanvas:true, attributionControl:!touch, zoomSnap:0.25});
  if (!touch) map.attributionControl.setPrefix(false).addAttribution("Statistics Canada 2021 Census · City of Guelph Open Data");
  for (const [p, z] of [["da", 400], ["bldg", 405], ["water", 410], ["roads", 420], ["bound", 425], ["labels", 428], ["sel", 430]]) { map.createPane(p).style.zIndex = z; if (p !== "da") map.getPane(p).style.pointerEvents = "none"; }
  new NorthArrow().addTo(map);
  const rend = p => L.canvas({pane:p, padding:0.3});
  const rDa = rend("da"), rW = rend("water"), rR = rend("roads"); selRend = L.svg({pane:"sel"});
  daLayer = L.featureGroup().addTo(map);
  for (const a of D.das) {
    a.poly = L.polygon(a.rings.map(ll), {renderer:rDa, weight:0.6, fillOpacity:0.92, smoothFactor:0.5}).addTo(daLayer);
    a.poly.on("click", () => select(a));
    a.poly.on("mouseover", () => hover(a, true)).on("mouseout", () => hover(a, false));
    if (!touch) a.poly.bindTooltip(() => tipHtml(a), {sticky:true, direction:"top", offset:[0, -10], className:"tip", opacity:1});
  }
  D.waterL = D.water.map(([name, rings]) => L.polygon(rings.map(ll), {renderer:rW, weight:0.8, fillOpacity:1, interactive:false, smoothFactor:1}).addTo(map));
  D.roadL = [];
  for (const fl of D.hwy) D.roadL.push([3, L.polyline(ll(fl), {renderer:rR, interactive:false, smoothFactor:1}).addTo(map)]);
  for (const [cls, fl] of D.streets) D.roadL.push([cls, L.polyline(ll(fl), {renderer:rR, interactive:false, smoothFactor:1}).addTo(map)]);
  const rB = L.svg({pane:"bound", padding:0.5}), city = D.boundary.map(ll);
  D.maskL = L.polygon([[[60, -100], [60, -60], [30, -60], [30, -100]], ...city], {renderer:rB, stroke:false, fillOpacity:0.8, interactive:false}).addTo(map);
  D.boundL = L.polygon(city, {renderer:rB, fill:false, weight:2.4, interactive:false}).addTo(map);
  selLayer = L.layerGroup().addTo(map);
  D.cityRings = city;
  fitTo(city, {pad:(window.UI && window.UI.pad) ? window.UI.pad(10) : {padding:[10, 10]}});
  D.rR = rR;
  map.on("zoomend", styleRoads);
  styleBase();
  const obs = () => { readTokens(); styleBase(); paint(); drawSel(); if (CTX.bl) { CTX.bl.redraw(); CTX.lb.redraw(); } };
  new MutationObserver(obs).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", obs);
  window.addEventListener("resize", () => map.invalidateSize());
}
function styleBase() {
  D.waterL.forEach(p => p.setStyle({color:tok["water-edge"], fillColor:tok.water}));
  D.maskL.setStyle({fillColor:tok.land});
  D.boundL.setStyle({color:tok.ink, dashArray:"7 4 2 4", opacity:0.8});
  styleRoads();
}
function styleRoads() {
  const z = map.getZoom();
  for (const [cls, l] of D.roadL) {
    const w = cls === 3 ? (z < 13 ? 1.4 : z < 15 ? 2.4 : 3.4) : cls === 2 ? (z < 13 ? 0 : z < 14 ? 0.8 : z < 15.5 ? 1.4 : 2.2) : (z < 14 ? 0 : z < 15 ? 0.6 : z < 16 ? 1 : 1.6);
    l.setStyle({color:tok.street, weight:w, opacity: w ? 0.85 : 0});
  }
}
function tipHtml(a) {
  const M = MEASURES[S.measure], v = a[S.measure];
  return `<b>${esc(a.name)}</b><br><span class="tv">${v == null ? "n/a" : M.long(v)}</span> · ${esc(lc(M.label))}`;
}
function hover(a, on) { if (a === S.sel || a === S.pin) return; a.poly.setStyle(on ? {weight:2.2, color:tok.sel} : {weight:0.6, color:tok.panel}); if (on) a.poly.bringToFront(); const c = document.querySelector(`.scatter circle[data-i="${a.i}"]`); if (c) c.setAttribute("r", on ? 6 : c.dataset.r); }

/* ---------- controls ---------- */
function buildControls() {
  const opts = (skip) => GROUPS.map((g, gi) => `<optgroup label="${g}">${KEYS.filter(k => MEASURES[k].g === gi && k !== skip).map(k => `<option value="${k}">${MEASURES[k].label}</option>`).join("")}</optgroup>`).join("");
  $("measure").innerHTML = opts(); $("measure").value = S.measure;
  const fillY = () => { $("ymeasure").innerHTML = opts(S.measure); $("ymeasure").value = S.y; };
  fillY(); S.fillY = fillY;
  $("measure").onchange = e => setMeasure(e.target.value);
  $("ymeasure").onchange = e => { S.y = e.target.value; save(); drawScatter(); };
  document.querySelectorAll("#method button").forEach(b => { b.setAttribute("aria-pressed", b.dataset.m === S.method); b.onclick = () => { S.method = b.dataset.m; document.querySelectorAll("#method button").forEach(x => x.setAttribute("aria-pressed", x === b)); S.cls = null; save(); refresh(); }; });
  document.querySelectorAll("#classes button").forEach(b => { b.setAttribute("aria-pressed", +b.dataset.k === S.k); b.onclick = () => { S.k = +b.dataset.k; document.querySelectorAll("#classes button").forEach(x => x.setAttribute("aria-pressed", x === b)); S.cls = null; save(); refresh(); }; });
  // address and street search
  const ABBR = {st:"street", rd:"road", ave:"avenue", av:"avenue", dr:"drive", cres:"crescent", cr:"crescent", ct:"court", crt:"court", pl:"place", blvd:"boulevard", pkwy:"parkway", pky:"parkway", ln:"lane", tr:"trail", trl:"trail", cir:"circle", sq:"square", hts:"heights", e:"east", w:"west", n:"north", s:"south"};
  const streetIdx = new Map();
  for (const a of D.das) for (const s of a.streets) { if (!streetIdx.has(s)) streetIdx.set(s, []); streetIdx.get(s).push(a); }
  const names = [...streetIdx.keys()].sort();
  let res = [], act = -1;
  const q = $("q"), ul = $("sugg");
  const render = () => {
    if (!res.length) ul.innerHTML = `<li aria-disabled="true">${ADDR ? "No Guelph address or street matches" : "No street matches. Addresses are still loading."}</li>`;
    else ul.innerHTML = res.map((r, i) => r.type === "addr"
      ? `<li role="option" data-k="${i}" aria-selected="${i === act}"><span>${esc(ADDR.t[r.i])} <em>· ${esc(D.das[ADDR.d[r.i]].name)}</em></span><small>address</small></li>`
      : `<li role="option" data-k="${i}" aria-selected="${i === act}"><span>${esc(r.a.name)}</span><small>DA ${r.a.da}</small></li>`).join("");
    ul.hidden = false; q.setAttribute("aria-expanded", "true"); };
  const hide = () => { ul.hidden = true; q.setAttribute("aria-expanded", "false"); };
  const choose = r => { hide(); if (r.type === "addr") { q.value = ADDR.t[r.i]; pickAddress(r.i); } else { S.addr = null; select(r.a, {zoom:true}); } };
  q.oninput = () => {
    const t = q.value.toLowerCase().replace(/[.,#]/g, " ").trim(); if (!t) { hide(); return; }
    const toks = t.split(/\s+/); res = [];
    if (ADDR) {
      const lead = /^\d/.test(toks[0]) ? toks[0] : null, rest = (lead ? toks.slice(1) : toks).map(x => ABBR[x] || x);
      const hits = [];
      for (let i = 0; i < ADDR.key.length && hits.length < 300; i++) {
        const w = ADDR.key[i].split(" ");
        if (lead && !(w[0] === lead || (rest.length === 0 && w[0].startsWith(lead)))) continue;
        if (!lead && !/^\d/.test(w[0])) continue;
        if (rest.every(x => w.some((y, j) => j > 0 && y.startsWith(x)))) hits.push(i);
      }
      if (lead || rest.join(" ").length >= 3) {
        hits.sort((a, b) => ADDR.key[a].length - ADDR.key[b].length || parseInt(ADDR.key[a]) - parseInt(ADDR.key[b]));
        for (const i of hits.slice(0, lead ? 8 : 4)) res.push({type:"addr", i});
      }
    }
    if (!/^\d/.test(toks[0])) {
      const st = toks.map(x => ABBR[x] ? [x, ABBR[x].slice(0, 2)] : [x]);
      const hitsS = names.filter(n => { const w = n.toLowerCase().split(" "); return st.every(alts => alts.some(x => w.some(y => y.startsWith(x)))); });
      const seen = new Set();
      for (const n of hitsS) for (const a of streetIdx.get(n)) if (!seen.has(a) && seen.size < 8) { seen.add(a); res.push({type:"da", a}); }
    }
    act = res.length ? 0 : -1; render(); };
  q.onkeydown = e => { if (ul.hidden) return; if (e.key === "ArrowDown") { act = Math.min(res.length - 1, act + 1); render(); e.preventDefault(); } else if (e.key === "ArrowUp") { act = Math.max(0, act - 1); render(); e.preventDefault(); } else if (e.key === "Enter" && act >= 0) { choose(res[act]); } else if (e.key === "Escape") hide(); };
  ul.onclick = e => { const li = e.target.closest("li[data-k]"); if (li) choose(res[+li.dataset.k]); };
  document.addEventListener("click", e => { if (!e.target.closest(".search")) hide(); });
}
function setMeasure(k) {
  S.measure = k; S.cls = null; $("measure").value = k;
  if (S.y === k) S.y = KEYS.find(x => x !== k && MEASURES[x].g !== MEASURES[k].g) || KEYS.find(x => x !== k);
  S.fillY(); save(); refresh();
}

/* ---------- render ---------- */
function refresh() {
  const M = MEASURES[S.measure];
  const vals = D.das.map(a => a[S.measure]).filter(v => v != null);
  S.br = breaks(vals, S.method, S.k); S.cols = rampN(M.ramp, S.br.length - 1);
  D.das.forEach(a => { const v = a[S.measure]; a.cls = v == null ? -1 : classOf(S.br, v); });
  paint(); renderLegend(); renderProfile(); drawScatter(); renderRanks(); drawSel(); hook("update");
}
function colorOf(a) { return a.cls < 0 ? tok.nodata : S.cols[a.cls]; }
function paint() {
  for (const a of D.das) {
    const dim = S.cls != null && a.cls !== S.cls;
    a.poly.setStyle({fillColor:colorOf(a), color:tok.panel, weight:0.6, fillOpacity: dim ? 0.12 : 0.92});
  }
}
function renderLegend() {
  const M = MEASURES[S.measure], br = S.br, k = br.length - 1;
  $("mLabel").textContent = M.label; $("mDesc").textContent = M.desc;
  const [cv, cn] = M.city(); const vals = D.das.map(a => a[S.measure]).filter(v => v != null);
  $("cityfig").innerHTML = `<div><small>${cn}</small><b>${cv}</b></div><div><small>Lowest</small><b>${M.long(Math.min(...vals))}</b></div><div><small>Highest</small><b>${M.long(Math.max(...vals))}</b></div>`;
  const counts = new Array(k).fill(0); let nd = 0; for (const a of D.das) a.cls < 0 ? nd++ : counts[a.cls]++;
  const mx = Math.max(...counts);
  const rows = [];
  for (let i = k - 1; i >= 0; i--) rows.push(`<button data-c="${i}" aria-pressed="${S.cls === i}"><i style="background:${S.cols[i]}"></i><span class="rng">${M.fmt(br[i])} – ${M.fmt(br[i + 1])}</span><span class="bar"><span style="width:${100 * counts[i] / mx}%"></span></span><span class="n">${counts[i]}</span></button>`);
  if (nd) rows.push(`<button class="nd" disabled><i></i><span class="rng">Not reported</span><span></span><span class="n">${nd}</span></button>`);
  $("legend").innerHTML = rows.join("");
  $("legend").querySelectorAll("button[data-c]").forEach(b => b.onclick = () => { const c = +b.dataset.c; S.cls = S.cls === c ? null : c; paint(); renderLegend(); drawScatter(); hook("update"); });
}
function pctRank(k, v) { const vals = D.das.map(a => a[k]).filter(x => x != null); return 100 * vals.filter(x => x < v).length / Math.max(1, vals.length - 1); }

function pickAddress(i) {
  const a = D.das[ADDR.d[i]];
  S.addr = {text:ADDR.t[i], lat:ADDR.lat[i], lon:ADDR.lon[i], da:a};
  select(a, {keepAddr:true});
  map.flyTo([S.addr.lat, S.addr.lon], Math.max(map.getZoom(), 15.5), {duration:0.6});
  hook("onAddress", S.addr);
}
function select(a, o = {}) {
  if (!a) return;
  if (!o.keepAddr && S.addr && S.addr.da !== a) S.addr = null;
  S.sel = a; drawSel(); renderProfile(); drawScatter(); hook("update"); if (!o.quiet) hook("onSelect", a, o);
  if (o.zoom) fitTo(a.rings.map(ll), {maxZoom:15.5, fly:true});
}
function drawSel() {
  if (!selLayer) return; selLayer.clearLayers();
  D.das.forEach(a => { if (a !== S.sel && a !== S.pin) a.poly.setStyle({weight:0.6, color:tok.panel}); });
  if (S.pin) L.polygon(S.pin.rings.map(ll), {renderer:selRend, color:tok.warn, weight:3, fill:false, dashArray:"6 4", interactive:false}).addTo(selLayer);
  if (S.sel) L.polygon(S.sel.rings.map(ll), {renderer:selRend, color:tok.sel, weight:3, fill:false, interactive:false}).addTo(selLayer);
  if (S.addr) L.circleMarker([S.addr.lat, S.addr.lon], {renderer:selRend, radius:7, color:tok.panel, weight:2.5, fillColor:tok.warn, fillOpacity:1, interactive:false}).addTo(selLayer)
    .bindTooltip(esc(S.addr.text), {permanent:true, direction:"top", offset:[0, -8], className:"tip"});
}
function renderProfile() {
  const a = S.sel, b = S.pin && S.pin !== a ? S.pin : null;
  if (!a) { $("profile").innerHTML = `<div class="empty">Tap any neighbourhood on the map to see every measure beside the city figure.</div>`; return; }
  const area = a.area < 1 ? (a.area * 100).toFixed(0) + " ha" : a.area.toFixed(2) + " km²";
  const head = `<div class="title"><b>${esc(a.name)}</b><small>DA ${a.da} · ${a.pop == null ? "n/a" : n0(a.pop)} residents · ${area}${a.streets.length > 2 ? " · also " + esc(a.streets.slice(2, 4).join(", ")) : ""}</small></div>${S.addr && S.addr.da === a ? `<div class="addrline"><i></i><span><b>${esc(S.addr.text)}</b> is in this neighbourhood</span></div>` : ""}`;
  const acts = `<div class="actions">${b ? `<button class="btn" id="unpin">Stop comparing</button><button class="btn" id="swap">Swap</button>` : `<button class="btn${S.pin === a ? " on" : ""}" id="pin">${S.pin === a ? "Pinned · tap another" : "Compare with another"}</button>`}<button class="btn" id="zoomto">Zoom to</button></div>`;
  let rows = "";
  const gh = gi => `<div class="gh">${GROUPS[gi]}</div>`;
  for (let gi = 0; gi < GROUPS.length; gi++) { rows += gh(gi); for (const k of KEYS.filter(k => MEASURES[k].g === gi)) {
    const M = MEASURES[k], va = a[k], vb = b ? b[k] : null;
    const pa = va == null ? null : pctRank(k, va), pb = vb == null ? null : pctRank(k, vb);
    const strip = `<span class="strip">${pa != null ? `<i style="left:${pa}%"></i>` : ""}${pb != null ? `<i class="b" style="left:${pb}%"></i>` : ""}</span>`;
    const f = v => v == null ? "n/a" : M.long(v);
    let cells;
    if (b) { const d = va != null && vb != null ? va - vb : null; const ds = d == null ? "" : (d > 0 ? "+" : d < 0 ? "−" : "±") + M.fmt(Math.abs(d)).replace("%", " pt");
      cells = `<span class="v">${f(va)}</span><span class="v" style="color:var(--warn)">${f(vb)}</span><span class="v city">${ds}</span>`; }
    else cells = `<span class="v">${f(va)}</span><span class="v city">${M.city()[0]}</span>`;
    rows += `<button data-k="${k}" aria-current="${k === S.measure}" title="Map ${esc(M.label)}"><span class="lbl"><span>${M.label}</span>${strip}</span>${cells}</button>`;
  } }
  const ph = b ? `<div class="ph"><span></span><span class="v">This</span><span class="v">Pinned</span><span class="v">Diff.</span></div>` : `<div class="ph"><span></span><span class="v">Here</span><span class="v">Guelph</span></div>`;
  const key = `<div class="key"><span><i style="background:var(--accent)"></i>${b ? esc(a.name) : "Where it ranks among 201 neighbourhoods"}</span>${b ? `<span><i style="background:var(--warn)"></i>${esc(b.name)}</span>` : ""}<span>dashed line = middle</span></div>`;
  $("profNote").textContent = b ? "comparing two" : "";
  $("profile").innerHTML = head + acts + key + `<div class="ptable${b ? " cmp" : ""}">${ph}${rows}</div>`;
  $("profile").querySelectorAll(".ptable button").forEach(x => x.onclick = () => setMeasure(x.dataset.k));
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on("pin", () => { S.pin = S.pin === a ? null : a; renderProfile(); drawSel(); });
  on("unpin", () => { S.pin = null; renderProfile(); drawSel(); drawScatter(); });
  on("swap", () => { const t = S.pin; S.pin = S.sel; S.sel = t; renderProfile(); drawSel(); drawScatter(); });
  on("zoomto", () => fitTo(a.rings.map(ll), {maxZoom:15.5, fly:true}));
}

function niceTicks(lo, hi, n = 4) { const span = hi - lo || 1, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag, step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag; const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10)); return t; }
function drawScatter() {
  const X = MEASURES[S.measure], Y = MEASURES[S.y];
  const pts = D.das.filter(a => a[S.measure] != null && a[S.y] != null);
  const W = 380, H = 270, ml = 44, mr = 10, mt = 10, mb = 38;
  const xs = pts.map(a => a[S.measure]), ys = pts.map(a => a[S.y]);
  const xt = niceTicks(Math.min(...xs), Math.max(...xs)), yt = niceTicks(Math.min(...ys), Math.max(...ys));
  const x0 = Math.min(xt[0], ...xs), x1 = Math.max(xt[xt.length - 1], ...xs), y0 = Math.min(yt[0], ...ys), y1 = Math.max(yt[yt.length - 1], ...ys);
  const sx = v => ml + (v - x0) / (x1 - x0 || 1) * (W - ml - mr), sy = v => H - mb - (v - y0) / (y1 - y0 || 1) * (H - mt - mb);
  // correlation + least-squares line
  const n = pts.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy), slope = sxy / sxx, icpt = my - slope * mx;
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter plot of ${esc(X.label)} against ${esc(Y.label)} for ${n} neighbourhoods">`;
  for (const t of xt) g += `<line class="ax" x1="${sx(t)}" x2="${sx(t)}" y1="${mt}" y2="${H - mb}" stroke-width=".6"/><text class="tick" x="${sx(t)}" y="${H - mb + 14}" text-anchor="middle">${X.fmt(t)}</text>`;
  for (const t of yt) g += `<line class="ax" x1="${ml}" x2="${W - mr}" y1="${sy(t)}" y2="${sy(t)}" stroke-width=".6"/><text class="tick" x="${ml - 6}" y="${sy(t) + 3}" text-anchor="end">${Y.fmt(t)}</text>`;
  g += `<text class="axl" x="${(ml + W - mr) / 2}" y="${H - 4}" text-anchor="middle">${esc(X.label)} →</text>`;
  g += `<text class="axl" transform="translate(11 ${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle">${esc(Y.label)} →</text>`;
  if (Math.abs(r) >= 0.2) { const cx0 = x0, cx1 = x1; g += `<line x1="${sx(cx0)}" y1="${sy(icpt + slope * cx0)}" x2="${sx(cx1)}" y2="${sy(icpt + slope * cx1)}" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 3" clip-path="url(#clip)"/>`; }
  g += `<clipPath id="clip"><rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}"/></clipPath>`;
  const order = [...pts].sort((a, b) => (a === S.sel || a === S.pin) - (b === S.sel || b === S.pin));
  for (const a of order) { const rr = Math.max(2.6, Math.min(5, Math.sqrt((a.pop || 100) / 60))); const dim = S.cls != null && a.cls !== S.cls;
    const sel = a === S.sel || a === S.pin;
    g += `<circle data-i="${a.i}" data-r="${rr.toFixed(1)}" cx="${sx(a[S.measure]).toFixed(1)}" cy="${sy(a[S.y]).toFixed(1)}" r="${sel ? 6 : rr.toFixed(1)}" fill="${colorOf(a)}" class="${sel ? "sel" : ""}${dim ? " dim" : ""}"${a === S.pin && a !== S.sel ? ` style="stroke:var(--warn)"` : ""}><title>${esc(a.name)}: ${X.long(a[S.measure])}, ${Y.long(a[S.y])}</title></circle>`; }
  g += `</svg>`;
  $("scatter").innerHTML = g;
  $("scatter").querySelectorAll("circle").forEach(c => { const a = D.das[+c.dataset.i];
    c.onclick = () => select(a, {zoom:true});
    c.onmouseenter = () => { if (a !== S.sel && a !== S.pin) { a.poly.setStyle({weight:2.2, color:tok.sel}); a.poly.bringToFront(); } };
    c.onmouseleave = () => { if (a !== S.sel && a !== S.pin) a.poly.setStyle({weight:0.6, color:tok.panel}); }; });
  const ar = Math.abs(r), strength = ar >= 0.7 ? "strong" : ar >= 0.45 ? "moderate" : ar >= 0.2 ? "weak" : "no clear";
  const dir = r > 0 ? "rises" : "falls";
  $("rnote").innerHTML = ar < 0.2
    ? `Across ${n} neighbourhoods there is <b>no clear link</b> between ${esc(lc(X.label))} and ${esc(lc(Y.label))} (r = ${r.toFixed(2)}).`
    : `There is a <b>${strength} ${r > 0 ? "positive" : "negative"}</b> link (r = ${r.toFixed(2)}): where ${esc(lc(X.label))} is higher, ${esc(lc(Y.label))} usually ${dir}. Dots are sized by population; tap one to open it. Correlation between areas does not show that one causes the other.`;
}
function renderRanks() {
  const M = MEASURES[S.measure];
  const v = D.das.filter(a => a[S.measure] != null && (a.pop || 0) >= 40).sort((a, b) => b[S.measure] - a[S.measure]);
  const li = a => `<li><button data-i="${a.i}" title="${esc(a.name)}"><span>${esc(a.name)}</span><b>${M.long(a[S.measure])}</b></button></li>`;
  $("rankNote").textContent = lc(M.label);
  $("ranks").innerHTML = `<div><h3>Highest</h3><ol>${v.slice(0, 5).map(li).join("")}</ol></div><div><h3>Lowest</h3><ol>${v.slice(-5).reverse().map(li).join("")}</ol></div>`;
  $("ranks").querySelectorAll("button").forEach(b => b.onclick = () => select(D.das[+b.dataset.i], {zoom:true}));
}

boot().catch(e => { $("loading").textContent = "The census data didn't load. Check that the data folder sits next to this page, then reload."; console.error(e); });
