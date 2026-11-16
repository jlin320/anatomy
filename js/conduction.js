// Cardiac conduction system overlay for the Z-Anatomy heart (which has no conduction tissue).
// Landmarks are taken from the heart's own meshes, so the pathway sits in the right place:
//   SA node      - superior vena cava / right atrium junction
//   AV node      - triangle of Koch, between coronary sinus ostium and tricuspid septal leaflet
//   His bundle   - central fibrous body (between tricuspid septal leaflet and non-coronary aortic cusp)
//                  to the crest of the muscular septum
//   RBB          - right side of the septum, then the moderator band to the RV anterior papillary muscle
//   LBB          - left side of the septum, splitting into the anterior fascicle (to the anterolateral
//                  papillary muscle) and the posterior fascicle (to the inferior papillary muscle)
// The placement is schematic (accurate to a few millimetres), for explaining EKG findings to patients.
// An animated impulse (slowed down) shows where conduction stops and how the ventricles are
// activated late through the muscle instead (orange), which is what widens the QRS.

const SLOW = 3;            // slow-motion factor for the animation

const NAMES = {
  sa: ['Sinoatrial (SA) node', '竇房結（SA node）', '心臟的天然節律器，每次心跳從這裡開始。The natural pacemaker: every normal beat starts here.'],
  intern: ['Internodal pathways', '結間徑路', '把電訊號經右心房傳到房室結（心電圖 P 波）。Carry the impulse across the right atrium to the AV node (P wave).'],
  bach: ["Bachmann's bundle", '巴赫曼束（心房間傳導）', '把訊號傳到左心房。Carries the impulse to the left atrium.'],
  avn: ['Atrioventricular (AV) node', '房室結（AV node）', '心房與心室之間唯一的通道，會刻意延遲訊號（PR 間期）。The only gateway from atria to ventricles; it deliberately delays the impulse (PR interval).'],
  his: ['Bundle of His', '希氏束', '穿過心臟纖維骨架進入心室中膈。Passes through the fibrous skeleton into the ventricular septum.'],
  rbb: ['Right bundle branch', '右束支', '沿中膈右側下行，經調節束到右心室。Runs down the right side of the septum and via the moderator band to the right ventricle.'],
  lbb: ['Left bundle branch', '左束支', '在中膈左側，很快分成前、後兩分支。On the left side of the septum; soon splits into anterior and posterior fascicles.'],
  laf: ['Left anterior fascicle', '左前分支', '細長，供應左心室前上壁；最容易受損。Thin and long, supplies the anterior-superior left ventricle; the most easily damaged fascicle.'],
  lpf: ['Left posterior fascicle', '左後分支', '短而粗，供應左心室下後壁；較少單獨阻滯。Short and broad, supplies the inferior-posterior left ventricle; rarely blocked alone.'],
  pkR: ['Purkinje fibres (right ventricle)', '浦金埃纖維（右心室）', '把訊號快速散布到心室肌（QRS 波）。Spread the impulse quickly through the muscle (QRS complex).'],
  pkLA: ['Purkinje fibres (left anterior)', '浦金埃纖維（左心室前壁）', '把訊號快速散布到心室肌。Spread the impulse quickly through the muscle.'],
  pkLP: ['Purkinje fibres (left posterior & septal)', '浦金埃纖維（左心室下壁與中膈）', '把訊號快速散布到心室肌。Spread the impulse quickly through the muscle.'],
  spRV: ['Slow spread to right ventricle', '心肌間緩慢傳導（至右心室）', '右束支阻滯時，右心室只能靠心肌細胞間慢慢傳導，因此 QRS 變寬。In RBBB the right ventricle is reached slowly cell-to-cell, so the QRS widens.'],
  spLV: ['Slow spread to left ventricle', '心肌間緩慢傳導（至左心室）', '左束支阻滯時，左心室延遲且由右往左激動。In LBBB the left ventricle is activated late, from right to left.'],
  spLA: ['Slow spread to anterior left ventricle', '心肌間傳導（至左心室前上壁）', '左前分支阻滯時，前上壁由後分支繞行激動（電軸左偏）。In LAFB the anterior-superior wall is reached via the posterior fascicle (left axis deviation).'],
  spLP: ['Slow spread to inferior left ventricle', '心肌間傳導（至左心室下壁）', '左後分支阻滯時，下壁由前分支繞行激動（電軸右偏）。In LPFB the inferior wall is reached via the anterior fascicle (right axis deviation).'],
};
const BASE = { node: [1, 0.69, 0.13], path: [1, 0.83, 0], pk: [1, 0.9, 0.45], spread: [1, 0.62, 0.31] };

// ---------------------------------------------------------------- rhythms (times in ms)
const T = { intern: 60, bach: 70, his: 20, rbb: 35, lbb: 12, laf: 25, lpf: 25, pk: 35, spRV: 90, spLV: 95, spLA: 60, spLP: 60 };
export const RHYTHMS = {
  normal: { period: 1000, beats: [[0, 100]] },
  av1: { period: 1150, beats: [[0, 300]] },
  wenck: { period: 3600, beats: [[0, 140], [900, 230], [1800, 300], [2700, null]], markers: ['avn'] },
  mobitz2: { period: 2700, beats: [[0, 120], [900, 120], [1800, 120, 'hisDrop']], markers: ['his'] },
  chb: { period: 4800, beats: [0, 800, 1600, 2400, 3200, 4000].map((t) => [t, null]), escape: [300, 1900, 3500], markers: ['avn'] },
  rbbb: { period: 1000, beats: [[0, 100]], blocked: ['rbb'] },
  lbbb: { period: 1000, beats: [[0, 100]], blocked: ['lbb'] },
  lafb: { period: 1000, beats: [[0, 100]], blocked: ['laf'] },
  lpfb: { period: 1000, beats: [[0, 100]], blocked: ['lpf'] },
  bifasc: { period: 1000, beats: [[0, 100]], blocked: ['rbb', 'laf'] },
  trifasc: { period: 1250, beats: [[0, 300]], blocked: ['rbb', 'laf'] },
};

function timeline(r) {
  const ev = [], flashes = [];
  const blocked = new Set(r.blocked || []);
  const ventricles = (t, escape) => {
    if (!escape) { ev.push({ seg: 'his', t0: t, dur: T.his }); t += T.his; }
    if (!blocked.has('rbb')) { ev.push({ seg: 'rbb', t0: t, dur: T.rbb }); ev.push({ seg: 'pkR', t0: t + T.rbb, dur: T.pk }); }
    else flashes.push({ at: 'rbb', t });
    if (!blocked.has('lbb')) {
      ev.push({ seg: 'lbb', t0: t, dur: T.lbb });
      const t2 = t + T.lbb;
      if (!blocked.has('laf')) { ev.push({ seg: 'laf', t0: t2, dur: T.laf }); ev.push({ seg: 'pkLA', t0: t2 + T.laf, dur: T.pk }); }
      else flashes.push({ at: 'laf', t: t2 });
      if (!blocked.has('lpf')) { ev.push({ seg: 'lpf', t0: t2, dur: T.lpf }); ev.push({ seg: 'pkLP', t0: t2 + T.lpf, dur: T.pk }); }
      else flashes.push({ at: 'lpf', t: t2 });
      if (blocked.has('rbb')) ev.push({ seg: 'spRV', t0: t2 + 25, dur: T.spRV, slow: true });
      if (blocked.has('laf') && !blocked.has('lpf')) ev.push({ seg: 'spLA', t0: t2 + T.lpf + T.pk * 0.5, dur: T.spLA, slow: true });
      if (blocked.has('lpf') && !blocked.has('laf')) ev.push({ seg: 'spLP', t0: t2 + T.laf + T.pk * 0.5, dur: T.spLP, slow: true });
    } else {
      flashes.push({ at: 'lbb', t });
      if (!blocked.has('rbb')) ev.push({ seg: 'spLV', t0: t + 20, dur: T.spLV, slow: true });
    }
  };
  for (const [t0, av, mode] of r.beats) {
    ev.push({ seg: 'sa', t0, dur: 40, node: true });
    ev.push({ seg: 'intern', t0, dur: T.intern });
    ev.push({ seg: 'bach', t0, dur: T.bach });
    const t = t0 + T.intern;
    if (av === null) { ev.push({ seg: 'avn', t0: t, dur: 120, stopAt: 0.85 }); flashes.push({ at: 'avn', t: t + 100 }); continue; }
    ev.push({ seg: 'avn', t0: t, dur: av, slow: av > 160 });
    if (mode === 'hisDrop') { ev.push({ seg: 'his', t0: t + av, dur: T.his, stopAt: 0.5 }); flashes.push({ at: 'his', t: t + av + 10 }); continue; }
    ventricles(t + av, false);
  }
  for (const t of r.escape || []) { ev.push({ seg: 'his', t0: t, dur: 12, node: true }); ventricles(t, true); }
  return { period: r.period, ev, flashes, blocked, markers: [...blocked, ...(r.markers || [])] };
}

// ---------------------------------------------------------------- build
export function addConduction(model, { THREE, makePart }) {
  const V = THREE.Vector3;
  const byName = (re) => [...model.parts.values()].find((p) => re.test(p.en));
  const need = {
    RA: /^Right atrium$/, LA: /^Left atrium$/, RV: /^Right ventricle$/, LV: /^Left ventricle$/,
    SVC: /^Superior vena cava$/, CS: /^Coronary sinus$/, TSL: /^Septal leaflet of right atrioventricular valve$/,
    NCC: /^Non-coronary leaflet$/, RCC: /^Right coronary leaflet$/, LCC: /^Left coronary leaflet$/,
    RVAPM: /^Anterior papillary muscle of right ventricle$/, LVIPM: /^Inferior papillary muscle of left ventricle$/,
  };
  const P = {};
  for (const [k, re] of Object.entries(need)) { P[k] = byName(re); if (!P[k]) { console.warn('conduction: missing', k); return null; } }
  model.root.updateMatrixWorld(true);
  const vertsCache = new Map();
  const verts = (part) => {
    if (vertsCache.has(part)) return vertsCache.get(part);
    const out = [];
    for (const m of part.meshes) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) out.push(new V(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld));
    }
    vertsCache.set(part, out);
    return out;
  };
  const centroid = (part) => verts(part).reduce((a, v) => a.add(v), new V()).multiplyScalar(1 / verts(part).length);
  const nearest = (part, p) => verts(part).reduce((b, v) => (v.distanceToSquared(p) < b.distanceToSquared(p) ? v : b)).clone();
  const lerp = (a, b, t) => a.clone().lerp(b, t);
  const C = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, centroid(p)]));
  const mm = 0.001;

  // left-ventricular long axis and septal direction
  const AR = C.NCC.clone().add(C.RCC).add(C.LCC).multiplyScalar(1 / 3);       // aortic root
  const apex = verts(P.LV).reduce((b, v) => (v.distanceToSquared(AR) > b.distanceToSquared(AR) ? v : b)).clone();
  const axis = apex.clone().sub(AR);
  const L = axis.length(); axis.normalize();
  const n = C.RV.clone().sub(C.LV); n.addScaledVector(axis, -n.dot(axis)).normalize();   // toward right ventricle
  const axisAt = (t) => AR.clone().addScaledVector(axis, t * L);
  const lvAt = (t, dir, pick = 'median') => {        // LV wall distance from the axis in a direction at level t
    const c = axisAt(t), d = [];
    for (const v of verts(P.LV)) {
      const r = v.clone().sub(c);
      const h = r.dot(axis);
      if (Math.abs(h) > 0.008) continue;
      r.addScaledVector(axis, -h);
      const len = r.length();
      if (len > 0 && r.dot(dir) / len > 0.85) d.push(len);
    }
    if (!d.length) return 0.02;
    d.sort((a, b) => a - b);
    return pick === 'max' ? d[d.length - 1] : d[Math.floor(d.length / 2)];
  };
  const sp = (t) => axisAt(t).addScaledVector(n, lvAt(t, n));                 // point inside the septum
  const anterior = new V(0, 0, 1), up = new V(0, 1, 0), left = new V(1, 0, 0);

  // landmarks
  const CFB = lerp(C.NCC, C.TSL, 0.5);                                          // central fibrous body
  const CSo = nearest(P.CS, C.TSL);                                             // coronary sinus ostium
  const AVN = lerp(CFB, CSo, 0.45);
  const svcJ = nearest(P.SVC, C.RA);
  const SA = lerp(svcJ, C.RA, 0.12).addScaledVector(left, -4 * mm).addScaledVector(anterior, 3 * mm);
  const B = sp(0.1);                                                            // His bifurcation
  const RVAPM = C.RVAPM, LVIPM = C.LVIPM;
  const alDir = anterior.clone().addScaledVector(n, -0.6).addScaledVector(up, 0.2).normalize();
  alDir.addScaledVector(axis, -alDir.dot(axis)).normalize();
  const LAPM = axisAt(0.55).addScaledVector(alDir, lvAt(0.55, alDir) * 0.75);  // anterolateral papillary (estimated)
  const latDir = n.clone().negate();
  const LVlat = axisAt(0.5).addScaledVector(latDir, lvAt(0.5, latDir) * 0.9);
  const infDir = up.clone().negate(); infDir.addScaledVector(axis, -infDir.dot(axis)).normalize();
  const LVinf = axisAt(0.5).addScaledVector(infDir, lvAt(0.5, infDir) * 0.9);
  const RVfree = verts(P.RV).reduce((b, v) => (v.clone().sub(axisAt(0.5)).dot(n) > b.clone().sub(axisAt(0.5)).dot(n) ? v : b)).clone();
  const latLA = left.clone().multiplyScalar(0.7).addScaledVector(up, 0.5).addScaledVector(anterior, 0.5).normalize();
  const LAtop = verts(P.LA).reduce((b, v) => (v.clone().sub(C.LA).dot(latLA) > b.clone().sub(C.LA).dot(latLA) ? v : b)).clone();
  const raMid = (k) => lerp(SA, AVN, 0.5).lerp(C.RA, 0.25).addScaledVector(anterior, k * mm);
  const L0 = sp(0.18).addScaledVector(n, -5 * mm);

  const curves = {
    sa: [],
    intern: [[SA, raMid(9), AVN], [SA, raMid(-9), AVN]],
    bach: [[SA, lerp(SA, LAtop, 0.5).addScaledVector(up, 6 * mm), LAtop]],
    avn: [[AVN, lerp(AVN, CFB, 0.5), CFB]],
    his: [[CFB, lerp(CFB, B, 0.5).addScaledVector(n, 1 * mm), B]],
    rbb: [[B.clone().addScaledVector(n, 2 * mm), sp(0.3).addScaledVector(n, 4 * mm), sp(0.55).addScaledVector(n, 5 * mm), RVAPM]],
    lbb: [[B.clone().addScaledVector(n, -2 * mm), lerp(B, L0, 0.5).addScaledVector(n, -4 * mm), L0]],
    laf: [[L0, lerp(L0, LAPM, 0.5).addScaledVector(n, -3 * mm), LAPM]],
    lpf: [[L0, sp(0.35).addScaledVector(n, -8 * mm), LVIPM]],
    // Purkinje endpoints are kept well inside the walls (the apex region is thin)
    pkR: [[RVAPM, lerp(RVAPM, RVfree, 0.6)], [sp(0.55).addScaledVector(n, 5 * mm), sp(0.75).addScaledVector(n, 5 * mm)],
      [RVAPM, lerp(RVAPM, sp(0.8).addScaledVector(n, 4 * mm), 0.6)]],
    pkLA: [[LAPM, lerp(LAPM, axisAt(0.8), 0.6)], [LAPM, lerp(LAPM, LVlat, 0.6)], [LAPM, lerp(LAPM, axisAt(0.3).addScaledVector(alDir, lvAt(0.3, alDir) * 0.7), 0.7)]],
    pkLP: [[LVIPM, lerp(LVIPM, axisAt(0.8), 0.6)], [LVIPM, lerp(LVIPM, LVinf, 0.6)], [sp(0.4).addScaledVector(n, -4 * mm), sp(0.7).addScaledVector(n, -4 * mm)]],
    spRV: [[sp(0.45).addScaledVector(n, -4 * mm), sp(0.5), sp(0.52).addScaledVector(n, 5 * mm), RVAPM, lerp(RVAPM, RVfree, 0.8)]],
    spLV: [[sp(0.4).addScaledVector(n, 4 * mm), sp(0.45), sp(0.47).addScaledVector(n, -6 * mm), LAPM],
      [sp(0.4).addScaledVector(n, 4 * mm), sp(0.45), sp(0.5).addScaledVector(n, -6 * mm), LVIPM]],
    spLA: [[LVIPM, lerp(LVIPM, apex, 0.6), lerp(LAPM, apex, 0.6), LAPM]],
    spLP: [[LAPM, lerp(LAPM, apex, 0.6), lerp(LVIPM, apex, 0.6), LVIPM]],
  };
  const curveObj = {};
  for (const [k, list] of Object.entries(curves)) curveObj[k] = list.map((pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal'));

  // meshes & parts
  const kinds = { sa: 'node', avn: 'node', pkR: 'pk', pkLA: 'pk', pkLP: 'pk', spRV: 'spread', spLV: 'spread', spLA: 'spread', spLP: 'spread' };
  const radius = { node: 1.7 * mm, path: 1.6 * mm, pk: 0.9 * mm, spread: 1.1 * mm };
  const group = { name: 'Cardiac conduction system (schematic)', children: [] };
  const spreadGroup = { name: 'Delayed muscle-to-muscle activation (blocks)', children: [] };
  const segParts = {};
  for (const [k, [en, zh, info]] of Object.entries(NAMES)) {
    const kind = kinds[k] || 'path';
    const meshes = curveObj[k].map((c) => new THREE.Mesh(new THREE.TubeGeometry(c, 48, radius[kind], 8, false)));
    if (k === 'sa') meshes.push(new THREE.Mesh(new THREE.SphereGeometry(4.5 * mm, 20, 14)));
    if (k === 'avn') meshes.push(new THREE.Mesh(new THREE.SphereGeometry(3.5 * mm, 20, 14)));
    if (k === 'sa') meshes[meshes.length - 1].position.copy(SA);
    if (k === 'avn') meshes[meshes.length - 1].position.copy(AVN);
    meshes.forEach((m) => model.root.add(m));
    const col = kind === 'node' ? BASE.node : kind === 'pk' ? BASE.pk : kind === 'spread' ? BASE.spread : BASE.path;
    const p = makePart('cond:' + k, en, meshes, col, { info: () => info });
    p.zh = zh;
    segParts[k] = p;
    const trail = kind === 'spread' ? ['Cardiovascular system', spreadGroup.name, en] : ['Cardiovascular system', group.name, en];
    model.registerPart(p, trail);
    (kind === 'spread' ? spreadGroup : group).children.push({ name: en, part: p });
  }
  const cv = model.tree.find((t) => t.name === 'Cardiovascular system');
  if (cv) cv.children.push(group, spreadGroup); else model.tree.push({ name: 'Cardiovascular system', children: [group, spreadGroup] });
  for (const p of Object.values(segParts)) p.state = 'hide';

  // animation: impulse dots, block markers
  const dotGeo = new THREE.SphereGeometry(2.6 * mm, 12, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true });
  const slowMat = new THREE.MeshBasicMaterial({ color: 0xff9f2f, depthTest: false, transparent: true });
  const dots = [];
  const dot = (i, slow) => {
    while (dots.length <= i) { const d = new THREE.Mesh(dotGeo, dotMat); d.renderOrder = 10; model.root.add(d); dots.push(d); }
    dots[i].material = slow ? slowMat : dotMat;
    dots[i].visible = true;
    return dots[i];
  };
  const markers = new THREE.Group();
  model.root.add(markers);
  const ringGeo = new THREE.TorusGeometry(4.5 * mm, 1.1 * mm, 8, 24);
  const markerAt = { rbb: [curveObj.rbb[0], 0.1], lbb: [curveObj.lbb[0], 0.25], laf: [curveObj.laf[0], 0.15], lpf: [curveObj.lpf[0], 0.15],
    avn: [curveObj.avn[0], 0.85], his: [curveObj.his[0], 0.5] };
  let tl = null, clock = 0, camera = null;

  const ctl = {
    setRhythm(id, cam) {
      camera = cam || camera;
      markers.clear();
      dots.forEach((d) => { d.visible = false; });
      tl = id && RHYTHMS[id] ? timeline(RHYTHMS[id]) : null;
      clock = 0;
      if (!tl) return;
      for (const k of tl.markers) {
        const [c, u] = markerAt[k];
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff2d2d, depthTest: false, transparent: true }));
        m.position.copy(c.getPointAt(u)); m.renderOrder = 11; m.userData.at = k;
        markers.add(m);
      }
    },
    onFrame(dt, cam) {
      if (!tl) return;
      camera = cam || camera;
      clock = (clock + dt * 1000 / SLOW) % tl.period;
      let i = 0;
      for (const e of tl.ev) {
        if (clock < e.t0 || clock > e.t0 + e.dur) continue;
        const u = (clock - e.t0) / e.dur;
        if (e.node) { const d = dot(i++, false); d.position.copy(e.seg === 'sa' ? SA : B); d.scale.setScalar(1 + 1.5 * Math.sin(u * Math.PI)); continue; }
        if (e.stopAt !== undefined && u > e.stopAt) continue;
        for (const c of curveObj[e.seg]) { const d = dot(i++, e.slow); d.position.copy(c.getPointAt(Math.min(1, u))); d.scale.setScalar(e.slow ? 0.9 : 1); }
      }
      for (; i < dots.length; i++) dots[i].visible = false;
      for (const m of markers.children) {
        const f = tl.flashes.filter((x) => x.at === m.userData.at).some((x) => clock >= x.t && clock < x.t + 180);
        m.material.opacity = f ? 1 : 0.65;
        m.scale.setScalar(f ? 1.5 : 1);
        if (camera) m.quaternion.copy(camera.quaternion);
      }
    },
    parts: segParts,
  };
  return ctl;
}
