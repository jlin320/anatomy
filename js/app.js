import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { zhName } from './zh.js';
import { BRAIN_PRESETS, BODY_PRESETS, bodyColor } from './presets.js';
import { loadMovement } from './opensim.js';
import { addConduction } from './conduction.js';
import { addHeadOverlay } from './headoverlay.js';
import { addDermatomes } from './dermatome.js';
import { searchModel } from './search.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('anatomy.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('anatomy.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ------------------------------------------------------------------ renderer / scene
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1720);
const camera = new THREE.PerspectiveCamera(35, 1, 0.005, 50);
camera.position.set(0, 0.3, 2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(0.5, 1, 1);
camera.add(key);
scene.add(camera);
const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

// ------------------------------------------------------------------ app state
const S = {
  model: null,          // active model
  models: {},           // id -> model (cached once loaded)
  sel: null,            // selected part
  xray: false,
  cut: 0,               // 0 off, 1 sagittal, 2 coronal, 3 axial
  cutFlip: false,
  pins: [],
  tab: null,
};
const CUTS = [null, { n: [-1, 0, 0], zh: '矢狀', en: 'Sagittal' }, { n: [0, 0, -1], zh: '冠狀', en: 'Coronal' }, { n: [0, -1, 0], zh: '水平', en: 'Axial' }];
const VIEWS = {
  front: [0, 0.05, 1], back: [0, 0.05, -1], left: [1, 0.05, 0], right: [-1, 0.05, 0],
  top: [0, 1, 0.02], bottom: [0, -1, 0.02], 'iso-left': [0.8, 0.45, 1], 'iso-right': [-0.8, 0.45, 1],
  'back-right': [-0.9, 0.3, -0.8], 'back-left': [0.9, 0.3, -0.8], 'below-left': [1, -0.6, 0.2],
};

// ------------------------------------------------------------------ parts (generic)
const FADE_OPACITY = 0.08, XRAY_OPACITY = 0.3;

function makePart(pid, en, meshes, color, extra = {}) {
  const zh = zhName(en);
  const part = { pid, en, zh, meshes, base: new THREE.Color(...color), color: new THREE.Color(...color), state: 'show', ...extra };
  for (const m of meshes) {
    m.material = new THREE.MeshStandardMaterial({ color: part.color.clone(), roughness: 0.55, metalness: 0 });
    m.userData.part = part;
  }
  return part;
}

function applyPart(p) {
  const selected = S.sel === p && !S.selSpot;
  const faded = p.state === 'fade';
  const trans = faded || (S.xray && !selected);
  for (const m of p.meshes) {
    m.visible = p.state !== 'hide';
    const mat = m.material;
    mat.color.copy(p.color);
    mat.transparent = trans;
    mat.opacity = faded ? (p.fadeOpacity || FADE_OPACITY) : (trans ? XRAY_OPACITY : 1);
    mat.depthWrite = !trans;
    mat.emissive.set(selected ? 0x3a6f99 : 0x000000);
    mat.side = (S.cut || p.doubleSided) ? THREE.DoubleSide : THREE.FrontSide;
    mat.needsUpdate = true;
    m.renderOrder = trans ? 1 : 0;
  }
}
const applyAll = () => { if (S.model) for (const p of S.model.parts.values()) applyPart(p); syncTree(); };

function setStates(fn) {
  for (const p of S.model.parts.values()) p.state = fn(p);
  applyAll();
}

// tree helpers --------------------------------------------------------
function leaves(node, out = []) {
  if (node.part) out.push(node.part);
  if (node.children) for (const c of node.children) leaves(c, out);
  return out;
}
// A part matches when its own name or any ancestor group's name matches one of the patterns.
// `within` (optional) limits matching to the named top-level groups, e.g. ['Visceral systems'].
function matchParts(model, patterns, within, leafOnly = false) {
  const res = patterns.map((p) => new RegExp(p, 'i'));
  const hit = new Set();
  const walk = (n, inherited) => {
    // leafOnly: match structures by their own name only (a vessel without all of its branches)
    const own = (!leafOnly || n.part) && res.some((r) => r.test(n.name));
    const m = (!leafOnly && inherited) || own;
    if (n.part && m) hit.add(n.part);
    if (n.children) n.children.forEach((c) => walk(c, m));
  };
  model.tree.filter((t) => !within || within.includes(t.name)).forEach((t) => walk(t, false));
  return hit;
}

// ------------------------------------------------------------------ camera framing
function visibleBox(onlyShown = true) {
  const box = new THREE.Box3();
  for (const p of S.model.parts.values()) {
    if (p.state === 'hide' || (onlyShown && p.state === 'fade')) continue;
    for (const m of p.meshes) if (m.visible) box.expandByObject(m);
  }
  if (box.isEmpty()) box.setFromObject(S.model.root);
  return box;
}
function frame(box, dir, animate = true) {
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const d = new THREE.Vector3(...(dir || camera.position.clone().sub(controls.target).normalize().toArray())).normalize();
  // fit the 8 box corners to both the horizontal and vertical field of view
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / 1.25, tanH = tanV * camera.aspect;
  const upHint = Math.abs(d.y) > 0.95 ? new THREE.Vector3(0, 0, -Math.sign(d.y)) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(upHint, d).normalize();
  const up = new THREE.Vector3().crossVectors(d, right);
  let dist = 0.05;
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(sph.center);
    const z = c.dot(d);
    dist = Math.max(dist, Math.abs(c.dot(right)) / tanH + z, Math.abs(c.dot(up)) / tanV + z);
  }
  const to = sph.center.clone().add(d.multiplyScalar(dist));
  if (!animate) { camera.position.copy(to); controls.target.copy(sph.center); controls.update(); return; }
  const p0 = camera.position.clone(), t0 = controls.target.clone(), start = performance.now();
  S.anim = (now) => {
    const k = Math.min(1, (now - start) / 450), e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(p0, to, e);
    controls.target.lerpVectors(t0, sph.center, e);
    if (k >= 1) S.anim = null;
  };
}

// ------------------------------------------------------------------ selection chip
function select(p, point) {
  S.sel = p;
  S.selPoint = point || null;
  // selectAt: the part highlights the tapped spot itself (e.g. a whole dermatome band) instead of glowing
  S.selSpot = !!(p && point && p.selectAt && p.selectAt(point));
  if (!S.selSpot) S.model?.clearSpotHighlight?.();
  applyAll();
  const chip = $('#chip');
  if (!p) { chip.hidden = true; return; }
  $('#chipZh').textContent = p.zh || p.en;
  $('#chipEn').textContent = p.zh ? p.en : '';
  // infoAt: information about the tapped spot (e.g. which dermatome the skin belongs to)
  $('#chipInfo').textContent = (p.infoAt && point && p.infoAt(point)) || (p.info ? p.info() : '');
  chip.hidden = false;
  const row = $(`.tree .row[data-pid="${CSS.escape(p.pid)}"]`);
  $$('.tree .row.sel').forEach((r) => r.classList.remove('sel'));
  if (row) row.classList.add('sel');
}
function refreshChipInfo() { if (S.sel && S.sel.info) $('#chipInfo').textContent = S.sel.info(); }

$('#chip').addEventListener('click', (e) => {
  const act = e.target.closest('button')?.dataset.act;
  const p = S.sel;
  if (!act || !p) return;
  if (act === 'close') return select(null);
  if (act === 'focus') { const b = new THREE.Box3(); p.meshes.forEach((m) => b.expandByObject(m)); frame(b); }
  if (act === 'hide') { p.state = 'hide'; select(null); }
  if (act === 'isolate') { setStates((q) => (q === p ? 'show' : 'hide')); const b = new THREE.Box3(); p.meshes.forEach((m) => b.expandByObject(m)); frame(b); }
  if (act === 'fade') setStates((q) => (q === p ? 'show' : (q.state === 'hide' ? 'hide' : 'fade')));
  if (act === 'pin') addPin(p, S.selPoint);
  applyAll();
});

// ------------------------------------------------------------------ pins (labels on the model)
function addPin(p, point, auto = false, label = null) {
  let local;
  const mesh = p.meshes[0];
  if (point) local = mesh.worldToLocal(point.clone());
  else { const b = new THREE.Box3().setFromObject(mesh); local = mesh.worldToLocal(b.getCenter(new THREE.Vector3())); }
  const el = h('div', { class: 'pin' }, label || (p.zh ? `${p.zh} ${p.en}` : p.en));
  el.addEventListener('click', () => select(p));
  $('#pins').append(el);
  if (auto) el.classList.add('auto');
  S.pins.push({ p, mesh, local, el, model: S.model, auto });
}
// autoOnly: remove just the labels a preset placed, keep the ones staff pinned by hand
function clearPins(autoOnly = false) {
  S.pins.filter((x) => !autoOnly || x.auto).forEach((x) => x.el.remove());
  S.pins = autoOnly ? S.pins.filter((x) => !x.auto) : [];
}
const _v = new THREE.Vector3();
function updatePins() {
  const r = canvas.getBoundingClientRect();
  for (const pin of S.pins) {
    const show = pin.model === S.model && pin.p.state !== 'hide';
    pin.el.hidden = !show;
    if (!show) continue;
    _v.copy(pin.local);
    pin.mesh.localToWorld(_v);
    const d = _v.clone().sub(camera.position);
    _v.project(camera);
    pin.el.style.left = ((_v.x + 1) / 2 * r.width) + 'px';
    pin.el.style.top = ((1 - _v.y) / 2 * r.height) + 'px';
    pin.el.classList.toggle('behind', _v.z > 1 || d.dot(camera.getWorldDirection(new THREE.Vector3())) < 0);
  }
}

// ------------------------------------------------------------------ picking
const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || !S.model) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 600;
  down = null;
  if (moved > 7 || !quick) return;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  S.model.beforePick?.();
  const meshes = [];
  for (const p of S.model.parts.values()) if (p.state !== 'hide') meshes.push(...p.meshes);
  let hits = ray.intersectObjects(meshes, false);
  if (S.cut) hits = hits.filter((x) => clipPlane.distanceToPoint(x.point) >= 0);
  const solid = hits.find((x) => x.object.userData.part.state === 'show');
  const hit = solid || hits[0];
  select(hit ? hit.object.userData.part : null, hit?.point);
});
canvas.addEventListener('dblclick', () => { if (S.sel) { const b = new THREE.Box3(); S.sel.meshes.forEach((m) => b.expandByObject(m)); frame(b); } });

// ------------------------------------------------------------------ tools
function setCut(mode) {
  S.cut = mode;
  const c = CUTS[mode];
  renderer.clippingPlanes = c ? [clipPlane] : [];
  $('#cutBar').hidden = !c;
  $('#cutLabel').textContent = c ? c.zh : '剖面';
  $('[data-tool="cut"]').classList.toggle('on', !!c);
  updateCut();
  applyAll();
}
function updateCut() {
  const c = CUTS[S.cut];
  if (!c || !S.model) return;
  const box = new THREE.Box3().setFromObject(S.model.root);
  const n = new THREE.Vector3(...c.n);
  if (S.cutFlip) n.negate();
  const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const ext = Math.abs(n.x) * size.x + Math.abs(n.y) * size.y + Math.abs(n.z) * size.z;
  const v = parseFloat($('#cutSlider').value) * ext / 2;
  const axis = new THREE.Vector3(...c.n).multiplyScalar(-1);   // slider + moves toward patient left/front/top
  const pt = ctr.clone().add(axis.multiplyScalar(v));
  clipPlane.setFromNormalAndCoplanarPoint(n, pt);
}
$('#cutSlider').addEventListener('input', updateCut);
$('#cutFlip').addEventListener('click', () => { S.cutFlip = !S.cutFlip; updateCut(); });

$('#tools').addEventListener('click', (e) => {
  const t = e.target.closest('button')?.dataset.tool;
  if (!t || !S.model) return;
  if (t === 'reset') { S.model.reset?.(); resetView(); }
  if (t === 'showall') { setStates(() => 'show'); for (const p of S.model.parts.values()) p.color.copy(p.base); S.model.recolor?.(); clearPresetUI(); applyAll(); }
  if (t === 'xray') { S.xray = !S.xray; e.target.closest('button').classList.toggle('on', S.xray); applyAll(); }
  if (t === 'cut') setCut((S.cut + 1) % CUTS.length);
  if (t === 'unpin') clearPins();
  if (t === 'snap') snapshot();
  if (t === 'search') openSearch(!!$('#search').hidden);
});

// ------------------------------------------------------------------ quick search
const HIGHLIGHT = new THREE.Color('#ffe14d');
let searchHits = null;           // { parts, prev colours } of the current highlight
function clearSearchHighlight() {
  if (!searchHits) return;
  for (const [p, c] of searchHits.prev) if (p.color.equals(HIGHLIGHT)) p.color.copy(c);   // a preset may have recoloured it since
  searchHits = null;
}
function openSearch(open) {
  $('#search').hidden = !open;
  if (open) { const q = $('#searchInput'); q.focus(); q.select(); renderSearch(); }
}
function renderSearch() {
  const box = $('#searchResults');
  if (!S.model) return box.replaceChildren();
  const q = $('#searchInput').value;
  const res = searchModel(S.model, q);
  box.replaceChildren(...res.map((r, i) => h('button', { class: 'result' + (i === 0 ? ' first' : ''), role: 'option', onclick: () => pickResult(r) },
    h('span', { class: 'nm' }, r.label), r.meta ? h('small', {}, r.meta) : null)));
  if (q.trim() && !res.length) box.append(h('div', { class: 'none' }, '找不到 No match — 試試英文名稱 try the English name'));
  box._res = res;
}
function pickResult(r) {
  const m = S.model;
  clearSearchHighlight();
  clearPins(true);
  const prev = new Map();
  // the target in bright yellow; everything else that was visible stays as faint context
  for (const p of m.parts.values()) {
    if (r.parts.has(p)) p.state = 'show';
    else if (p.state === 'show') p.state = 'fade';
  }
  for (const p of r.parts) { prev.set(p, p.color.clone()); p.color.copy(HIGHLIGHT); }
  searchHits = { parts: r.parts, prev };
  applyAll();
  const box = new THREE.Box3();
  for (const p of r.parts) p.meshes.forEach((x) => box.expandByObject(x));
  frame(box.expandByScalar(box.getSize(new THREE.Vector3()).length() * (r.parts.size > 2 ? 0.15 : 0.5)));
  // label the largest structure
  const size = (p) => { const b = new THREE.Box3(); p.meshes.forEach((x) => b.expandByObject(x)); return b.getSize(new THREE.Vector3()).length(); };
  const ranked = [...r.parts].sort((a, b) => size(b) - size(a));
  if (r.parts.size === 1) select(ranked[0]);
  else { select(null); addPin(ranked[0], null, true, r.label); }
  openSearch(false);
}
$('#searchInput').addEventListener('input', renderSearch);
$('#searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const r = $('#searchResults')._res?.[0]; if (r) pickResult(r); }
  if (e.key === 'Escape') openSearch(false);
});
$('#searchClose').addEventListener('click', () => openSearch(false));
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); openSearch(true); }
});

function resetView() {
  select(null);
  setStates(S.model.initialState || (() => 'show'));
  for (const p of S.model.parts.values()) p.color.copy(p.base);
  S.model.recolor?.();
  clearPresetUI();
  setCut(0);
  applyAll();
  frame(visibleBox(), VIEWS[S.model.defaultView || 'front'], true);
}

function snapshot() {
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    const a = h('a', { href: URL.createObjectURL(blob) });
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    a.download = `anatomy-${S.model.id}-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.png`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// ------------------------------------------------------------------ panel: tabs
$('#panelToggle').addEventListener('click', () => {
  const closed = document.body.classList.toggle('panel-closed');
  $('#panelToggle').setAttribute('aria-expanded', String(!closed));
  store.set('panelClosed', closed);
});
if (store.get('panelClosed', false)) document.body.classList.add('panel-closed');
$('#credit').addEventListener('click', () => $('#credit').classList.toggle('open'));
// opened from the Rehab Games menu (home-screen app has no back button): show a way back
try {
  if (new URLSearchParams(location.search).get('from') === 'rehab') sessionStorage.setItem('anatomy.fromRehab', '1');
  /* public copy: no rehab menu */
} catch { /* ignore */ }

function buildTabs(model) {
  const tabs = $('#tabs'), panes = $('#panes');
  tabs.replaceChildren(); panes.replaceChildren();
  for (const t of model.tabs) {
    const pane = h('div', { class: 'pane', 'data-tab': t.id, hidden: true });
    t.build(pane);
    panes.append(pane);
    tabs.append(h('button', { role: 'tab', 'data-tab': t.id, onclick: () => showTab(t.id) }, t.zh, ' ', h('small', {}, t.en)));
  }
  showTab(store.get('tab.' + model.id, model.tabs[0].id));
  $('#credit').textContent = model.credit;
}
function showTab(id) {
  if (!$(`.pane[data-tab="${id}"]`)) id = S.model.tabs[0].id;
  $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  $$('.pane').forEach((p) => { p.hidden = p.dataset.tab !== id; });
  store.set('tab.' + S.model.id, id);
}

// presets pane ---------------------------------------------------------
let activePreset = null;
function clearPresetUI() {
  activePreset = null;
  clearPins(true);
  if (S.model) for (const p of S.model.parts.values()) for (const x of p.meshes) if (x.userData.baseScale) x.scale.copy(x.userData.baseScale);
  $$('.presets button.on').forEach((b) => b.classList.remove('on'));
  $$('.preset-note').forEach((n) => n.replaceChildren());
  S.model?.setRhythm?.(null);
  S.model?.setDermatome?.(false);
}
function presetPane(groups) {
  return (pane) => {
    pane.append(h('p', { class: 'note' }, '點選構造可查看名稱、隔離或加標籤。Tap a structure to name, isolate or pin it.'));
    const note = h('div', { class: 'preset-note' });
    for (const g of groups) {
      const grid = h('div', { class: 'presets' });
      // collapsible group: closed until tapped; the device remembers which groups were open
      const key = `open.${S.model?.id || 'x'}.${g.group}`;
      const det = h('details', { class: 'preset-group', open: store.get(key, false) },
        h('summary', {}, h('h4', {}, g.group, h('span', { class: 'count' }, ` ${g.items.length}`))), grid);
      det.addEventListener('toggle', () => store.set(key, det.open));
      for (const it of g.items) {
        // the note appears right under the group that was tapped, so it is visible on phones
        const b = h('button', { onclick: () => { grid.after(note); applyPreset(it, note); $$('.presets button.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); } },
          it.zh, h('small', {}, it.en));
        grid.append(b);
      }
      pane.append(det);
    }
    pane.append(h('div', { class: 'row-btns' },
      h('button', { onclick: () => $$('details.preset-group', pane).forEach((d) => { d.open = true; }) }, '全部展開 Expand all'),
      h('button', { onclick: () => $$('details.preset-group', pane).forEach((d) => { d.open = false; }) }, '全部收合 Collapse all')));
    pane.append(note);
  };
}
function applyPreset(it, noteEl) {
  const m = S.model;
  activePreset = it;
  clearPins(true);
  const hit = matchParts(m, it.show, it.within, it.leafOnly);
  const alsoHit = new Set();
  if (it.also) for (const [pats, within] of it.also) for (const p of matchParts(m, pats, within, it.leafOnly)) { hit.add(p); alsoHit.add(p); }
  // `ghost`: [patterns, systems] pairs shown see-through around the structures (e.g. the heart walls)
  const ghostHit = new Set();
  if (it.ghost) for (const [pats, within] of it.ghost) for (const p of matchParts(m, pats, within)) if (!hit.has(p)) ghostHit.add(p);
  if (!hit.size) {
    noteEl.replaceChildren(h('div', {}, '此模型中找不到相符構造。No matching structures in this model.'));
    return;
  }
  select(null);
  for (const p of m.parts.values()) {
    // `context`: only these top-level groups are ghosted around the structures (keeps big models fast)
    p.fadeOpacity = ghostHit.has(p) ? (it.ghostOpacity || 0.2) : undefined;   // see-through organ stays readable
    p.state = hit.has(p) ? 'show'
      : ghostHit.has(p) ? 'fade'
      : it.context ? (it.context.includes(m.pathOf(p)[0]) ? 'fade' : 'hide')
        : (it.fade ? 'fade' : 'hide');
    p.color.copy(p.base);
    if (it.color && hit.has(p)) {
      const path = m.pathOf(p).join(' / ');
      const c = it.color.find(([re]) => new RegExp(re, 'i').test(path));
      if (c) p.color.set(c[1]);
    }
  }
  // `enlarge`: draw tiny structures (e.g. 3 mm lymph nodes) bigger for this preset only
  for (const p of m.parts.values()) {
    const k = it.enlarge && hit.has(p) && !alsoHit.has(p) ? it.enlarge : 1;
    for (const x of p.meshes) {
      if (!x.userData.baseScale) { if (k === 1) continue; x.userData.baseScale = x.scale.clone(); }
      x.scale.copy(x.userData.baseScale).multiplyScalar(k);
    }
  }
  m.root.updateMatrixWorld(true);
  applyAll();
  let box = visibleBox();
  const focusHit = it.focus ? [...hit].filter((p) => it.focus.some((re) => new RegExp(re, 'i').test(p.en))) : [];
  if (focusHit.length) {                           // zoom to the named structures (e.g. the wrist, the elbow)
    box = new THREE.Box3();
    for (const p of focusHit) p.meshes.forEach((x) => box.expandByObject(x));
    box.expandByScalar(box.getSize(new THREE.Vector3()).length() * 0.25);
  } else if (it.frame === 'ghost' && ghostHit.size) {     // frame the see-through organ (e.g. the whole heart)
    box = new THREE.Box3();
    for (const p of ghostHit) p.meshes.forEach((x) => box.expandByObject(x));
  } else if (it.frame === 'also' && alsoHit.size) {       // zoom to the joint/soft-tissue structures, not whole bones
    box = new THREE.Box3();
    for (const p of alsoHit) p.meshes.forEach((x) => box.expandByObject(x));
    box.expandByScalar(box.getSize(new THREE.Vector3()).length() * 0.15);
  }
  frame(box, VIEWS[it.view] || VIEWS.front);
  noteEl.replaceChildren();
  if (it.note) noteEl.append(h('div', {}, it.note));
  if (it.color) noteEl.append(h('div', { class: 'legend' }, it.color.filter((c) => c[2]).map(([, col, lab]) => h('span', {}, h('i', { style: `background:${col}` }), lab))));
  if (it.ekg) noteEl.append(h('div', { class: 'ekg' }, h('b', {}, '心電圖 EKG：'), it.ekg));
  // `pins`: name labels placed automatically (they stay readable even when the organ is behind others)
  if (it.pins) {
    m.root.updateMatrixWorld(true);
    // a pin is a structure name, or [structure name, custom label]
    for (const pin of it.pins) {
      const [n, label] = Array.isArray(pin) ? pin : [pin, null];
      const p = [...hit].find((q) => q.en === n);
      if (p) addPin(p, null, true, label);
    }
  }
  m.setRhythm?.(it.rhythm || null);
  m.setDermatome?.(!!it.dermatome);
  applyAll();
}

// structures tree pane --------------------------------------------------
function treePane(model) {
  return (pane) => {
    const q = h('input', { type: 'search', placeholder: '搜尋 Search (中/英)…', 'aria-label': 'Search 搜尋' });
    const tree = h('div', { class: 'tree' });
    pane.append(q, tree);
    const build = (n, depth) => {
      if (n.children) {
        const cb = h('input', { type: 'checkbox', 'aria-label': n.name });
        const zh = zhName(n.name);
        const det = h('details', depth < 1 ? { open: true } : {},
          h('summary', {}, h('div', { class: 'row' }, h('span', { class: 'tw' }, '▸'), cb,
            h('span', { class: 'nm' }, zh || n.name, zh ? h('em', {}, n.name) : null))),
          ...n.children.map((c) => build(c, depth + 1)));
        det._leaves = leaves(n); det._cb = cb; det._name = (n.name + ' ' + zh).toLowerCase();
        cb.addEventListener('click', (e) => { e.stopPropagation(); const on = cb.checked; det._leaves.forEach((p) => { p.state = on ? 'show' : 'hide'; }); applyAll(); });
        return det;
      }
      const p = n.part;
      const cb = h('input', { type: 'checkbox', 'aria-label': n.name });
      const row = h('div', { class: 'row leaf', 'data-pid': p.pid }, cb,
        h('span', { class: 'sw', style: `background:#${p.base.getHexString()}` }),
        h('span', { class: 'nm' }, p.zh || p.en, p.zh ? h('em', {}, p.en) : null));
      row._part = p; row._cb = cb; row._name = (p.en + ' ' + p.zh).toLowerCase();
      cb.addEventListener('change', () => { p.state = cb.checked ? 'show' : 'hide'; applyAll(); });
      row.querySelector('.nm').addEventListener('click', () => {
        // fade everything else so deep structures (hippocampus, thalamus…) are not hidden behind cortex
        for (const q of model.parts.values()) if (q !== p && q.state === 'show') q.state = 'fade';
        p.state = 'show';
        select(p); const b = new THREE.Box3(); p.meshes.forEach((m) => b.expandByObject(m));
        frame(b.expandByScalar(b.getSize(new THREE.Vector3()).length() * 0.6));
      });
      return row;
    };
    model.tree.forEach((n) => tree.append(build(n, 0)));
    q.addEventListener('input', () => {
      const s = q.value.trim().toLowerCase();
      const walk = (el) => {
        if (el.tagName === 'DETAILS') {
          let any = false;
          for (const c of el.children) if (c.tagName !== 'SUMMARY' && walk(c)) any = true;
          const self = s && el._name.includes(s);
          el.hidden = !!s && !any && !self;
          if (s && any) el.open = true;
          el.classList.toggle('hit', !!self);
          return any || self;
        }
        const ok = !s || el._name.includes(s);
        el.hidden = !ok;
        el.classList.toggle('hit', !!s && ok);
        return ok && !!s;
      };
      [...tree.children].forEach(walk);
    });
  };
}
function syncTree() {
  for (const row of $$('.tree .row.leaf')) row._cb.checked = row._part.state !== 'hide';
  for (const det of $$('.tree details')) {
    const on = det._leaves.filter((p) => p.state !== 'hide').length;
    det._cb.checked = on === det._leaves.length;
    det._cb.indeterminate = on > 0 && on < det._leaves.length;
  }
}

// ------------------------------------------------------------------ generic GLB + tree models
const loader = new GLTFLoader();
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(url + ' ' + r.status), { status: r.status });
  return r.json();
}
// "name.glb#parts=N" = the file was split into name.glb.1 … name.glb.N (the public copy keeps every
// file under the GitHub upload limit); the pieces are joined back together here.
async function loadGlb(url) {
  const m = url.match(/^(.*)#parts=(\d+)$/);
  if (!m) return loader.loadAsync(url);
  const bufs = await Promise.all(Array.from({ length: +m[2] }, (_, i) => fetch(`${m[1]}.${i + 1}`).then((r) => {
    if (!r.ok) throw new Error(`${m[1]}.${i + 1}: HTTP ${r.status}`);
    return r.arrayBuffer();
  })));
  const all = new Uint8Array(bufs.reduce((s, b) => s + b.byteLength, 0));
  let o = 0;
  for (const b of bufs) { all.set(new Uint8Array(b), o); o += b.byteLength; }
  return loader.parseAsync(all.buffer, '');
}

async function loadTreeModel(id, jsonUrl, presets, defaultView, colorFn) {
  const meta = await fetchJSON(jsonUrl);
  const root = new THREE.Group();
  const parts = new Map();
  const files = Array.isArray(meta.glb) ? meta.glb : [meta.glb];
  for (const f of files) {
    const gltf = await loadGlb('data/' + f);
    for (const node of [...gltf.scene.children]) {
      const info = meta.parts[node.name];
      if (!info) continue;
      const meshes = [];
      node.traverse((o) => { if (o.isMesh) meshes.push(o); });
      parts.set(node.name, makePart(node.name, info.name, meshes, info.color || [0.8, 0.8, 0.8]));
      root.add(node);
    }
  }
  const resolve = (n) => (n.part ? { name: n.name, part: parts.get(n.part) } : { name: n.name, children: n.children.map(resolve).filter((c) => c.part || c.children?.length) });
  // collapse "X / X" levels (a group whose only child is a group of the same name)
  const collapse = (n) => {
    if (!n.children) return n;
    n.children = n.children.map(collapse);
    if (n.children.length === 1 && n.children[0].children && n.children[0].name === n.name) return n.children[0];
    return n;
  };
  const tree = meta.tree.map(resolve).filter((c) => c.part || c.children?.length).map(collapse);
  const paths = new Map();
  const walk = (n, trail) => { const t = [...trail, n.name]; if (n.part) paths.set(n.part, t); n.children?.forEach((c) => walk(c, t)); };
  tree.forEach((n) => walk(n, []));
  if (colorFn) {
    for (const p of parts.values()) {
      const path = (paths.get(p) || [p.en]).join(' / ');
      const isDefault = p.base.getHex() === 0xe7e7e7 || p.base.getHex() === 0xcccccc;
      if (/^Nervous system[^/]*\/ Central/.test(path) && !isDefault) continue;   // keep brain colours
      const c = colorFn(path) || (isDefault ? '#d6cbbf' : null);
      if (c) { p.base.set(c); p.color.set(c); }
    }
  }
  const model = {
    id, root, parts, tree, credit: meta.credit, defaultView,
    pathOf: (p) => paths.get(p) || [p.en],
    // add a part built in the browser (e.g. the conduction overlay) with its tree path
    registerPart: (p, trail) => { parts.set(p.pid, p); paths.set(p, trail); },
    // optional: only some top-level groups visible when the model opens or is reset
    // (names may be a system or any group/structure inside one, e.g. "Spleen" from the lymphoid organs)
    initialState: meta.initial ? (p) => ((paths.get(p) || []).some((n) => meta.initial.includes(n)) ? 'show' : 'hide') : null,
    tabs: [
      { id: 'views', zh: '臨床視角', en: 'Views', build: presetPane(presets) },
      { id: 'tree', zh: '構造', en: 'Structures', build: null },
    ],
  };
  model.tabs[1].build = treePane(model);
  return model;
}

// ------------------------------------------------------------------ model switching
const LOADERS = {
  brain: () => loadTreeModel('brain', 'data/brain.json', BRAIN_PRESETS, 'iso-left'),
  body: async () => {
    const m = await loadTreeModel('body', 'data/body.json', BODY_PRESETS, 'front', bodyColor);
    addHeadOverlay(m, { THREE, makePart });
    const derm = addDermatomes(m, { THREE });
    if (derm) { m.setDermatome = (on) => derm.set(on); m.clearSpotHighlight = () => derm.highlight(null); }
    const cond = addConduction(m, { THREE, makePart });
    if (cond) {
      m.setRhythm = (id) => cond.setRhythm(id, camera);
      m.onFrame = (dt) => cond.onFrame(dt, camera);
    }
    return m;
  },
  move: () => loadMovement({ THREE, loader, makePart, applyAll, select, refreshChipInfo, fetchJSON, h, $, $$, scene, store, frameAll: (dir) => frame(visibleBox(), VIEWS[dir] || dir),
    frameObject: (o, dir) => frame(new THREE.Box3().setFromObject(o), VIEWS[dir] || dir) }),
};
const ctxApi = { treePane, presetPane };
export { ctxApi };

function showMessage(html) {
  const m = $('#message');
  if (!html) { m.hidden = true; return; }
  m.replaceChildren(h('div', { class: 'box' }, ...html));
  m.hidden = false;
}

async function switchModel(id) {
  $$('#models button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.model === id)));
  store.set('model', id);
  select(null);
  if (S.model) { S.model.root.visible = false; S.model.deactivate?.(); }
  showMessage(null);
  let m = S.models[id];
  if (!m) {
    $('#loading').hidden = false;
    try {
      m = await LOADERS[id]();
      if (m.initialState) for (const p of m.parts.values()) p.state = m.initialState(p);
      S.models[id] = m;
      scene.add(m.root);
    } catch (err) {
      console.error(err);
      $('#loading').hidden = true;
      S.model = null;
      $('#tabs').replaceChildren(); $('#panes').replaceChildren(); $('#credit').textContent = '';
      if (id === 'body' && err.status === 404) {
        showMessage([h('h3', {}, '全身模型尚未建立 Body model not built yet'),
          h('p', {}, '需要先用 Blender 將 Z-Anatomy 轉檔（見 tools/README）。'),
          h('p', {}, 'The Z-Anatomy whole-body model must first be converted with Blender (see tools/README.md). The Brain and Movement models work now.')]);
      } else {
        showMessage([h('h3', {}, '載入失敗 Could not load'), h('p', {}, String(err.message || err))]);
      }
      return;
    }
    $('#loading').hidden = true;
  }
  if (store.get('model', id) !== id) return;     // user switched again while loading
  S.model = m;
  m.root.visible = true;
  m.activate?.();
  buildTabs(m);
  setCut(0);
  S.xray = false; $('[data-tool="xray"]').classList.remove('on');
  applyAll();
  resize();
  frame(visibleBox(), VIEWS[m.defaultView || 'front'], false);
}
$('#models').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) switchModel(b.dataset.model); });

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, clock.getDelta());
  if (S.anim) S.anim(performance.now());
  controls.update();
  if (S.model?.onFrame) S.model.onFrame(dt);
  renderer.render(scene, camera);
  if (S.pins.length) updatePins();
});

resize();
window.__anatomy = { S, camera, controls, visibleBox };   // for debugging in the browser console
switchModel(document.querySelector(`[data-model="${store.get('model', 'brain')}"]`) ? store.get('model', 'brain') : 'brain');
