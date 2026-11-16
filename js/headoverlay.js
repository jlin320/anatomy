// Head & neck structures Z-Anatomy lacks, placed from its own skull and pharynx meshes:
//   - paranasal sinus air spaces (frontal, maxillary, sphenoidal; the ethmoid cells already exist),
//     their drainage routes and the middle meatus (ostiomeatal complex)
//   - the rest of Waldeyer's ring: pharyngeal tonsil (adenoid), lingual tonsil, tubal tonsils
// Shapes are schematic ellipsoids sized from adult averages and the surrounding bones.

const INFO = {
  frontal: ['Frontal sinus', '額竇', '在眉毛上方的額骨內，經額鼻管排到中鼻道。In the forehead above the eyebrows; drains via the frontonasal duct into the middle meatus.'],
  maxillary: ['Maxillary sinus', '上頜竇', '最大的鼻竇，在臉頰內、眼眶下方；開口位置高，不易引流，最常發炎。上排牙根感染也可擴散至此。The largest sinus, in the cheek below the eye; its opening is high up so it drains poorly and is most often infected. Upper tooth roots sit just below it.'],
  sphenoid: ['Sphenoidal sinus', '蝶竇', '在鼻腔最深處、腦下垂體正下方；發炎時常為頭頂或後腦痛。Deep behind the nose, just below the pituitary gland; infection often causes pain at the top or back of the head.'],
  drain: ['Sinus drainage pathways', '鼻竇引流路徑', '額竇、上頜竇、前組篩竇 → 中鼻道；蝶竇、後組篩竇 → 蝶篩隱窩。Frontal, maxillary and anterior ethmoid sinuses drain to the middle meatus; sphenoid and posterior ethmoid to the sphenoethmoidal recess.'],
  omc: ['Middle meatus (ostiomeatal complex)', '中鼻道（竇口鼻道複合體）', '多個鼻竇的共同出口；黏膜腫脹阻塞這裡，鼻竇分泌物就排不出來。The shared outlet of several sinuses; swelling here traps their secretions.'],
  adenoid: ['Pharyngeal tonsil (adenoid)', '咽扁桃腺（腺樣體）', '在鼻咽後上壁；兒童肥大時會鼻塞、張口呼吸、打鼾，並可能阻塞耳咽管造成中耳炎。On the back wall of the nasopharynx; when enlarged in children it causes blocked nose, mouth breathing, snoring and ear infections (by blocking the Eustachian tube).'],
  lingual: ['Lingual tonsil', '舌扁桃腺', '在舌根表面。On the back of the tongue.'],
  tubal: ['Tubal tonsil', '耳咽管扁桃腺', '在耳咽管開口旁。Beside the opening of the Eustachian tube.'],
};

export function addHeadOverlay(model, { THREE, makePart }) {
  const V = THREE.Vector3;
  const all = [...model.parts.values()];
  const get = (n) => all.find((p) => p.en === n);
  const need = ['Maxilla (right)', 'Maxilla (left)', 'Frontal bone', 'Nasal bone (right)', 'Vomer', 'Mucosa of nasal cavity', 'Nasopharynx', 'Tongue', 'Ethmoid bone'];
  for (const n of need) if (!get(n)) { console.warn('head overlay: missing', n); return; }
  model.root.updateMatrixWorld(true);
  const box = (n) => { const b = new THREE.Box3(); get(n).meshes.forEach((m) => b.expandByObject(m)); return b; };
  const verts = (n) => {
    const out = [];
    for (const m of get(n).meshes) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) out.push(new V(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld));
    }
    return out;
  };
  const mm = 0.001;
  const nasal = box('Mucosa of nasal cavity'), maxR = box('Maxilla (right)'), maxL = box('Maxilla (left)');
  const nasalBone = box('Nasal bone (right)'), vomer = box('Vomer'), naso = box('Nasopharynx'), eth = box('Ethmoid bone');
  const midX = (vomer.min.x + vomer.max.x) / 2;
  const sideSign = { right: Math.sign(maxR.min.x - midX) || -1, left: Math.sign(maxL.max.x - midX) || 1 };
  const nasion = new V(midX, nasalBone.max.y, nasalBone.max.z - 4 * mm);

  // --- sinus air spaces
  const ellipsoid = (c, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18)); m.position.copy(c); m.scale.set(sx / 2, sy / 2, sz / 2); return m; };
  const items = [];
  for (const side of ['right', 'left']) {
    const s = sideSign[side], mx = side === 'right' ? maxR : maxL;
    const lateralNasal = s < 0 ? nasal.min.x : nasal.max.x;                 // lateral wall of nasal cavity
    const outer = s < 0 ? mx.min.x : mx.max.x;
    const mxW = Math.min(26 * mm, Math.abs(outer - lateralNasal) * 0.62);
    const mxC = new V(lateralNasal + s * (mxW / 2 + 1 * mm), mx.min.y + (mx.max.y - mx.min.y) * 0.5, mx.min.z + (mx.max.z - mx.min.z) * 0.5);
    items.push(['maxillary', side, ellipsoid(mxC, mxW, 30 * mm, 32 * mm), mxC]);
    const frC = new V(midX + s * 11 * mm, nasion.y + 16 * mm, nasion.z - 12 * mm);
    items.push(['frontal', side, ellipsoid(frC, 20 * mm, 22 * mm, 12 * mm), frC]);
    const spC = new V(midX + s * 7 * mm, Math.max(naso.max.y, eth.min.y + 20 * mm) + 7 * mm, (naso.min.z + eth.min.z) / 2 + 4 * mm);
    items.push(['sphenoid', side, ellipsoid(spC, 13 * mm, 18 * mm, 20 * mm), spC]);
  }
  const groupSinus = { name: 'Paranasal sinuses (schematic)', children: [] };
  const sinusCenters = {};
  for (const [k, side, mesh, c] of items) {
    model.root.add(mesh);
    const [en, zh, info] = INFO[k];
    const p = makePart(`head:${k}:${side}`, `${en} (${side})`, [mesh], [0.62, 0.86, 1], { info: () => info });
    p.zh = (side === 'right' ? '右' : '左') + zh;
    model.registerPart(p, ['Visceral systems', 'Respiratory system', groupSinus.name, p.en]);
    groupSinus.children.push({ name: p.en, part: p });
    sinusCenters[`${k}:${side}`] = c;
  }

  // --- middle meatus marker and drainage arrows (both sides)
  const arrowMeshes = [], omcMeshes = [];
  const arrow = (pts) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    arrowMeshes.push(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.7 * mm, 6, false)));
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.8 * mm, 4.5 * mm, 10));
    const end = curve.getPointAt(1), dir = curve.getTangentAt(1).normalize();
    head.position.copy(end); head.quaternion.setFromUnitVectors(new V(0, 1, 0), dir);
    arrowMeshes.push(head);
  };
  for (const side of ['right', 'left']) {
    const s = sideSign[side];
    const lateralNasal = s < 0 ? nasal.min.x : nasal.max.x;
    const mxC = sinusCenters[`maxillary:${side}`], frC = sinusCenters[`frontal:${side}`], spC = sinusCenters[`sphenoid:${side}`];
    const meatus = new V(lateralNasal - s * 4 * mm, mxC.y + 9 * mm, mxC.z + 2 * mm);       // under the middle concha
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4 * mm, 1 * mm, 8, 24));
    ring.position.copy(meatus); ring.rotation.y = Math.PI / 2;
    omcMeshes.push(ring);
    arrow([mxC.clone().add(new V(0, 6 * mm, 0)), new V(lateralNasal + s * 2 * mm, mxC.y + 13 * mm, mxC.z), meatus]);
    arrow([frC.clone().add(new V(0, -8 * mm, 0)), new V(frC.x - s * 3 * mm, frC.y - 22 * mm, frC.z - 4 * mm), meatus.clone().add(new V(0, 3 * mm, 3 * mm))]);
    const recess = new V(midX + s * 4 * mm, spC.y + 2 * mm, spC.z + 12 * mm);
    arrow([spC.clone().add(new V(0, 0, 8 * mm)), recess, recess.clone().add(new V(0, -7 * mm, 4 * mm))]);
  }
  for (const [k, meshes, color] of [['drain', arrowMeshes, [1, 1, 1]], ['omc', omcMeshes, [1, 0.8, 0.2]]]) {
    meshes.forEach((m) => model.root.add(m));
    const [en, zh, info] = INFO[k];
    const p = makePart(`head:${k}`, en, meshes, color, { info: () => info });
    p.zh = zh;
    model.registerPart(p, ['Visceral systems', 'Respiratory system', groupSinus.name, en]);
    groupSinus.children.push({ name: en, part: p });
  }

  // --- rest of Waldeyer's ring
  const ring = [];
  const nv = verts('Nasopharynx');
  const top = naso.max.y, back = naso.min.z;
  const adSel = nv.filter((v) => v.y > top - 0.35 * (top - naso.min.y) && v.z < back + 0.35 * (naso.max.z - back));
  const adC = adSel.reduce((a, v) => a.add(v), new V()).multiplyScalar(1 / Math.max(1, adSel.length));
  adC.x = midX; adC.z += 5 * mm; adC.y -= 2 * mm;
  ring.push(['adenoid', null, ellipsoid(adC, 24 * mm, 13 * mm, 8 * mm)]);
  const tv = verts('Tongue'), tb = box('Tongue');
  const baseZ0 = tb.min.z + 0.08 * (tb.max.z - tb.min.z), baseZ1 = tb.min.z + 0.3 * (tb.max.z - tb.min.z);
  const baseTop = tv.filter((v) => v.z > baseZ0 && v.z < baseZ1).reduce((b, v) => (v.y > b.y ? v : b), new V(0, -1e9, 0));
  const lgC = new V(midX, baseTop.y - 2.5 * mm, baseTop.z);
  const lg = ellipsoid(lgC, 26 * mm, 6 * mm, 14 * mm); lg.rotation.x = -0.5;
  ring.push(['lingual', null, lg]);
  for (const side of ['right', 'left']) {
    const tube = get(`Auditory tube (${side})`);
    if (!tube) continue;
    const tvx = verts(`Auditory tube (${side})`);
    const medial = tvx.reduce((b, v) => (Math.abs(v.x - midX) < Math.abs(b.x - midX) ? v : b));
    ring.push(['tubal', side, ellipsoid(medial.clone().add(new V(0, -2 * mm, 2 * mm)), 7 * mm, 9 * mm, 6 * mm)]);
  }
  const waldeyer = findGroup(model.tree, 'Pharyngeal lymphoid ring');
  const trailBase = ['Lymphoid organs', 'Secondary lymphoid organs', 'Pharyngeal lymphoid ring'];
  for (const [k, side, mesh] of ring) {
    model.root.add(mesh);
    const [en, zh, info] = INFO[k];
    const name = side ? `${en} (${side})` : en;
    const p = makePart(`head:${k}${side ? ':' + side : ''}`, name, [mesh], [0.86, 0.5, 0.55], { info: () => info });
    p.zh = (side === 'right' ? '右' : side === 'left' ? '左' : '') + zh;
    model.registerPart(p, [...trailBase, name]);
    (waldeyer || { children: [] }).children.push({ name, part: p });
  }

  // tree: sinuses under the respiratory system
  const resp = findGroup(model.tree, 'Respiratory system');
  if (resp) resp.children.push(groupSinus);
  for (const p of model.parts.values()) if (p.pid.startsWith('head:')) p.state = model.initialState ? model.initialState(p) : 'show';
}

function findGroup(tree, name) {
  const stack = [...tree];
  while (stack.length) {
    const n = stack.pop();
    if (n.name === name && n.children) return n;
    if (n.children) stack.push(...n.children);
  }
  return null;
}
