// Dermatome map painted on Z-Anatomy's skin regions ("Regions of human body").
// Each skin vertex gets a spinal level from its region name and its position relative to the
// skeleton (vertebrae, sternum, umbilicus level, limb bones, skull landmarks). The map follows the
// usual clinical charts (ASIA key points, trunk bands sloping downward anteriorly) and is a guide for
// localising shingles and radicular symptoms, not an exact individual map — dermatomes overlap.

export const LEVELS = ['V1', 'V2', 'V3', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3', 'S4'];
const ZH = { V1: '三叉神經眼支', V2: '三叉神經上頜支', V3: '三叉神經下頜支' };
export const levelName = (k) => (k[0] === 'V' ? `${k} ${ZH[k]}` : `${k} ${{ C: '頸', T: '胸', L: '腰', S: '薦' }[k[0]]}${k.slice(1)} 神經`);

function palette(THREE) {
  const out = {};
  LEVELS.forEach((k, i) => {
    const c = new THREE.Color();
    c.setHSL((i * 0.381966) % 1, 0.62, i % 2 ? 0.5 : 0.62);      // golden-angle hues: neighbours never look alike
    out[k] = c;
  });
  return out;
}

export function addDermatomes(model, { THREE }) {
  const V = THREE.Vector3;
  const all = [...model.parts.values()];
  const get = (n) => all.find((p) => p.en === n);
  const skin = all.filter((p) => (model.pathOf(p)[0] === 'Regions of human body') && !/hair|eyelash/i.test(model.pathOf(p).join('/')));
  if (!skin.length) return null;
  // The left-side skin patches come out of the Z-Anatomy export with reversed triangle winding (they
  // are mirrored copies), so front-face-only drawing showed the inside of the far skin through them.
  // Drawing the thin skin double-sided keeps the nearest surface on top for display and for tapping.
  for (const p of all) if (model.pathOf(p)[0] === 'Regions of human body') p.doubleSided = true;
  model.root.updateMatrixWorld(true);
  const box = (n) => { const p = get(n); if (!p) return null; const b = new THREE.Box3(); p.meshes.forEach((m) => b.expandByObject(m)); return b; };
  const ctr = (n) => { const b = box(n); return b ? b.getCenter(new V()) : null; };
  const verts = (n) => {
    const p = get(n), out = [];
    if (!p) return out;
    for (const m of p.meshes) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) out.push(new V(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld));
    }
    return out;
  };

  // ---------------------------------------------------------------- landmarks
  const vert = {};
  for (let i = 1; i <= 12; i++) vert['T' + i] = ctr('Vertebra T' + i);
  for (let i = 1; i <= 5; i++) vert['L' + i] = ctr('Vertebra L' + i);
  for (let i = 3; i <= 7; i++) vert['C' + i] = ctr('Vertebra C' + i);
  if (!vert.T1 || !vert.L5) return null;
  const x0 = vert.T6.x;
  const zBack = vert.T6.z;
  const manub = box('Manubrium of sternum'), xiph = box('Xiphoid process'), pubic = box('Pubic symphysis');
  const zFront = manub ? manub.max.z : zBack + 0.15;
  const zc = (zBack + zFront) / 2;
  const rib4 = verts('Fourth rib (right)').reduce((b, v) => (v.z > b.z ? v : b), new V(0, 0, -1e9));
  const yUmb = (vert.L3.y + vert.L4.y) / 2;
  const ant = {                                 // anterior anchors of trunk dermatomes (T number -> height)
    2: manub ? manub.min.y : vert.T3.y, 4: rib4.y, 6: xiph ? xiph.min.y : vert.T9.y, 10: yUmb,
    12: pubic ? pubic.max.y + 0.06 : yUmb - 0.12, 13: pubic ? pubic.max.y + 0.02 : yUmb - 0.16,
  };
  const ka = Object.keys(ant).map(Number).sort((a, b) => a - b);
  const yAnt = (k) => {
    if (k <= ka[0]) return ant[ka[0]] + (ant[ka[0]] - ant[ka[1]]) / (ka[1] - ka[0]) * (ka[0] - k);
    for (let i = 0; i < ka.length - 1; i++) if (k <= ka[i + 1]) return ant[ka[i]] + (ant[ka[i + 1]] - ant[ka[i]]) * (k - ka[i]) / (ka[i + 1] - ka[i]);
    return ant[ka[ka.length - 1]];
  };
  const vy = (name) => (vert[name] ? vert[name].y : null);
  const yPost = (k) => {                        // posterior: about one vertebra below the same-numbered body
    const name = k <= 11 ? 'T' + (k + 1) : k === 12 ? 'L1' : 'L' + Math.min(5, k - 11);
    return vy(name);
  };
  const trunkLevel = (p, maxK = 13) => {
    const lat = Math.abs(p.x - x0), dz = p.z - zc;
    const a = Math.min(1, Math.max(0, 0.5 + 0.5 * dz / Math.hypot(dz, lat * 1.2)));     // 0 back, 1 front
    let best = null, bd = 1e9;
    for (let k = 1; k <= maxK; k++) {
      const y = yPost(k) + (yAnt(k) - yPost(k)) * a;
      const d = Math.abs(p.y - y);
      if (d < bd) { bd = d; best = k; }
    }
    const y2 = yPost(2) + (yAnt(2) - yPost(2)) * a, y3 = yPost(3) + (yAnt(3) - yPost(3)) * a;
    if (p.y > y2 + (y2 - y3) * 0.5 && a > 0.35) return 'C4';           // cape above the 2nd rib
    return best <= 12 ? 'T' + best : 'L' + (best - 12);
  };

  // limbs
  const axis = (n) => {                          // bone long axis: top centre -> bottom centre
    const b = box(n); if (!b) return null;
    const c = b.getCenter(new V());
    return { a: new V(c.x, b.max.y, c.z), b: new V(c.x, b.min.y, c.z), len: b.max.y - b.min.y };
  };
  const distTo = (p, ax) => { const t = Math.max(0, Math.min(1, (ax.a.y - p.y) / (ax.len || 1))); return p.distanceTo(ax.a.clone().lerp(ax.b, t)); };
  const frac = (p, ax) => Math.max(0, Math.min(1, (ax.a.y - p.y) / (ax.len || 1)));
  const across = (p, c5, c1) => { const v = c1.clone().sub(c5); return p.clone().sub(c5).dot(v) / v.lengthSq(); };
  const L = {};
  for (const s of ['right', 'left']) {
    L[s] = {
      hum: axis(`Humerus (${s})`), rad: axis(`Radius (${s})`), uln: axis(`Ulna (${s})`), fem: axis(`Femur (${s})`),
      tib: axis(`Tibia (${s})`), fib: axis(`Fibula (${s})`),
      mc1: ctr(`First metacarpal bone (${s})`), mc5: ctr(`Fifth metacarpal bone (${s})`),
      mt1: ctr(`First metatarsal bone (${s})`), mt5: ctr(`Fifth metatarsal bone (${s})`),
    };
  }
  const orb = ctr('Orbital region (right)') || ctr('Orbital region (left)');
  const oral = ctr('Oral region (right)') || ctr('Oral region (left)');
  const tempR = ctr('Temporal bone (right)'), mand = box('Mandible');
  const eyeY = orb ? orb.y : 0, mouthY = oral ? oral.y : 0, earZ = tempR ? tempR.z : 0;
  const jawY = mand ? mand.min.y + 0.02 : 0;

  // ---------------------------------------------------------------- classification
  function classify(p, part) {
    const path = model.pathOf(part).join(' / ');
    const n = part.en;
    const side = /\(left\)/.test(n) || /\(left\)/.test(path) ? 'left' : 'right';
    const lat = Math.abs(p.x - x0);
    const S = L[side];
    // head & face
    if (/Regions of head/.test(path)) {
      if (/Occipital|Mastoid|Posterior auricular/.test(n)) return 'C2';
      if (/Parietal/.test(n)) return p.z < earZ ? 'C2' : 'V1';
      if (/Frontal|Eyebrow/.test(n)) return 'V1';
      if (/Temporal/.test(n)) return p.y > eyeY + 0.025 ? 'V1' : p.z > earZ + 0.035 ? 'V2' : 'V3';
      if (/Orbital/.test(n) && !/Infra/.test(n)) return p.y > eyeY ? 'V1' : 'V2';
      if (/Nasal region/.test(n)) return (lat < 0.008 || p.y > eyeY - 0.012) ? 'V1' : 'V2';
      if (/Infra-orbital|Zygomatic|Nasolabial|Philtrum|upper lip/.test(n)) return 'V2';
      if (/Mental|Mentolabial/.test(n)) return 'V3';
      if (/Buccal|Oral|Angle of mouth|Labial commissure/.test(n)) return p.y > mouthY ? 'V2' : 'V3';
      if (/Parotideomasseteric/.test(n)) return p.y < jawY + 0.015 && p.z < earZ + 0.035 ? 'C2' : 'V3';
      if (/Tragus|Anterior notch|Crura|Triangular|Auricular region/.test(n)) return 'V3';
      return p.y < eyeY - 0.03 ? 'C2' : 'C3';                          // rest of the auricle
    }
    // neck
    if (/Regions of neck/.test(path)) {
      if (/Submental|Submandibular/.test(n)) return 'C3';
      if (/supraclavicular/i.test(n)) return 'C4';
      return vert.C4 && p.y > vert.C4.y ? 'C3' : 'C4';
    }
    // upper limb
    // Limb sub-patches (bicipital grooves, femoral triangle, snuffbox…) lie on top of the larger
    // regions, so they use the same position rules — overlapping skin must get the same colour.
    if (/Regions of upper limb/.test(path)) {
      if (/Deltoid/.test(n)) return 'C5';
      if (/Regions of hand/.test(path) && S.mc1 && S.mc5) { const u = across(p, S.mc5, S.mc1); return u > 0.6 ? 'C6' : u > 0.28 ? 'C7' : 'C8'; }
      if (/Brachial region/.test(path) && S.hum) {
        // around the arm: outer side and outer half of the front -> C5 (axillary/lateral cutaneous), inner side -> T1/T2
        const outward = new V(Math.sign(p.x - x0) || 1, 0, 0);
        const c = S.hum.a.clone().lerp(S.hum.b, frac(p, S.hum));
        const d = p.clone().sub(c); d.y = 0; d.normalize();
        if (d.dot(outward) > -0.15) return 'C5';
        return frac(p, S.hum) < 0.35 ? 'T2' : 'T1';
      }
      if (S.rad && S.uln) {                                             // elbow, forearm, wrist
        if (distTo(p, S.rad) < distTo(p, S.uln)) return 'C6';
        return frac(p, S.uln) > 0.5 ? 'C8' : 'T1';
      }
      return 'C6';
    }
    // lower limb
    if (/Regions of lower limb/.test(path)) {
      if (/Gluteal/.test(n)) {
        const b = box(`Gluteal region (${side})`) || box(n);
        const h = b ? (p.y - b.min.y) / (b.max.y - b.min.y) : 0.5;
        return h > 0.66 ? 'L2' : lat < 0.07 ? 'S3' : 'S2';
      }
      if (/Anterior region of thigh|Femoral triangle|Hip region/.test(path + n) && S.fem) {
        const f = frac(p, S.fem);
        return f < 0.12 ? 'L1' : f < 0.5 ? 'L2' : 'L3';
      }
      if (/Posterior region of thigh|Popliteal|Posterior region of knee/.test(n)) return 'S2';
      if (/Anterior region of knee/.test(n)) return 'L3';
      if (/Medial malleolus|Medial retromalleolar|Medial border of foot/.test(n)) return 'L4';
      if (/Lateral malleolus|Lateral retromalleolar|Lateral border of foot|Heel/.test(n)) return 'S1';
      if (/Anterior region of leg|Anterior region of ankle/.test(n) && S.tib && S.fib) return distTo(p, S.fib) < distTo(p, S.tib) ? 'L5' : 'L4';
      if (/Posterior region of leg/.test(n) && S.tib && S.fib) return distTo(p, S.fib) < distTo(p, S.tib) ? 'S1' : 'S2';
      if (/Regions of foot|Hallucial/.test(path + n) && S.mt1 && S.mt5) {
        const u = across(p, S.mt5, S.mt1);
        if (/Sole|arch|Plantar/.test(path + n)) return u > 0.55 ? 'L5' : 'S1';
        return u > 0.88 ? 'L4' : u > 0.2 ? 'L5' : 'S1';
      }
      return 'L3';
    }
    // perineum
    if (/Anal region/.test(n)) return 'S4';
    if (/Urogenital/.test(n)) return 'S3';
    if (/Sacral region/.test(n)) return 'S3';
    if (/Umbilicus/.test(n)) return 'T10';
    // trunk (thorax, abdomen, back)
    const t = trunkLevel(p, /Lumbar region/.test(n) ? 15 : 13);
    return t;
  }

  // ---------------------------------------------------------------- vertex colours
  const pal = palette(THREE);
  const SKIN = new THREE.Color('#e7c3a6');
  const painted = [];                            // { attr, base, lv } per skin mesh
  for (const part of skin) {
    for (const m of part.meshes) {
      const pos = m.geometry.attributes.position, n = pos.count;
      const col = new Float32Array(n * 3), lv = new Int8Array(n), v = new V();
      for (let i = 0; i < n; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld);
        const k = classify(v, part);
        lv[i] = LEVELS.indexOf(k);
        const c = pal[k] || SKIN;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const attr = new THREE.BufferAttribute(col.slice(), 3);
      m.geometry.setAttribute('color', attr);
      painted.push({ attr, base: col, lv });
    }
    part.base.copy(SKIN); part.color.copy(SKIN);
    part.infoAt = (point) => (on ? `皮節 Dermatome：${levelName(classify(point, part))}` : '');
    // Tapping the skin highlights the whole dermatome band (across every skin patch), not the patch.
    part.selectAt = (point) => { if (!on) return false; highlight(classify(point, part)); return true; };
  }
  let lit = null;
  function highlight(key) {
    const idx = key ? LEVELS.indexOf(key) : -1;
    if (idx === lit) return;
    lit = idx < 0 ? null : idx;
    for (const { attr, base, lv } of painted) {
      const a = attr.array;
      for (let i = 0; i < lv.length; i++) {
        const j = i * 3;
        if (lit === null) { a[j] = base[j]; a[j + 1] = base[j + 1]; a[j + 2] = base[j + 2]; }
        else if (lv[i] === lit) {                                        // the band: brighter, toward white
          a[j] = base[j] + (1 - base[j]) * 0.55; a[j + 1] = base[j + 1] + (1 - base[j + 1]) * 0.55; a[j + 2] = base[j + 2] + (1 - base[j + 2]) * 0.55;
        } else { a[j] = base[j] * 0.35; a[j + 1] = base[j + 1] * 0.35; a[j + 2] = base[j + 2] * 0.35; }  // everything else dimmed
      }
      attr.needsUpdate = true;
    }
  }
  let on = false;
  return {
    palette: pal,
    highlight,
    set(state) {
      on = !!state;
      if (!on) highlight(null);
      for (const part of skin) {
        for (const m of part.meshes) { m.material.vertexColors = on; m.material.needsUpdate = true; }
        part.color.set(on ? 0xffffff : SKIN); part.base.copy(part.color);
      }
    },
    isOn: () => on,
  };
}
