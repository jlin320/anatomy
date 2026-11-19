// Movement model: OpenSim Rajagopal (2016) skeleton + 80 leg muscles, evaluated in the browser.
// Kinematics follow OpenSim conventions: CustomJoint spatial transforms (body-fixed rotations,
// translations in the parent frame), Pin = rotation about Z, Universal = X then Y,
// offset-frame orientation = body-fixed XYZ, coupler constraints dep = s * f(ind).

const DEG = Math.PI / 180;

// ---------------------------------------------------------------- functions
function prepSpline(f) {
  // Forsythe–Malcolm–Moler cubic spline (the algorithm behind OpenSim's SimmSpline)
  const x = f.x, y = f.y, n = x.length;
  const b = new Array(n).fill(0), c = new Array(n).fill(0), d = new Array(n).fill(0);
  if (n < 2) { f._c = { b, c, d }; return; }
  if (n < 4) {               // fall back to linear segments
    for (let i = 0; i < n - 1; i++) b[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
    b[n - 1] = b[n - 2]; f._c = { b, c, d }; return;
  }
  const nm1 = n - 1;
  d[0] = x[1] - x[0]; c[1] = (y[1] - y[0]) / d[0];
  for (let i = 1; i < nm1; i++) {
    d[i] = x[i + 1] - x[i];
    b[i] = 2 * (d[i - 1] + d[i]);
    c[i + 1] = (y[i + 1] - y[i]) / d[i];
    c[i] = c[i + 1] - c[i];
  }
  b[0] = -d[0]; b[nm1] = -d[n - 2]; c[0] = 0; c[nm1] = 0;
  c[0] = c[2] / (x[3] - x[1]) - c[1] / (x[2] - x[0]);
  c[nm1] = c[n - 2] / (x[nm1] - x[n - 3]) - c[n - 3] / (x[n - 2] - x[n - 4]);
  c[0] = c[0] * d[0] * d[0] / (x[3] - x[0]);
  c[nm1] = -c[nm1] * d[n - 2] * d[n - 2] / (x[nm1] - x[n - 4]);
  for (let i = 1; i < n; i++) { const t = d[i - 1] / b[i - 1]; b[i] -= t * d[i - 1]; c[i] -= t * c[i - 1]; }
  c[nm1] /= b[nm1];
  for (let i = n - 2; i >= 0; i--) c[i] = (c[i] - d[i] * c[i + 1]) / b[i];
  b[nm1] = (y[nm1] - y[n - 2]) / d[n - 2] + d[n - 2] * (c[n - 2] + 2 * c[nm1]);
  for (let i = 0; i < nm1; i++) {
    b[i] = (y[i + 1] - y[i]) / d[i] - d[i] * (c[i + 1] + 2 * c[i]);
    d[i] = (c[i + 1] - c[i]) / d[i];
    c[i] *= 3;
  }
  c[nm1] *= 3; d[nm1] = d[n - 2];
  f._c = { b, c, d };
}
function evalF(f, v) {
  if (!f) return 0;
  switch (f.t) {
    case 'lin': return f.c[0] * v + f.c[1];
    case 'const': return f.v;
    case 'poly': return f.c.reduce((a, k) => a * v + k, 0);
    case 'mul': return f.s * evalF(f.f, v);
    case 'pwl': {
      const x = f.x, y = f.y;
      if (v <= x[0]) return y[0];
      for (let i = 0; i < x.length - 1; i++) if (v <= x[i + 1]) return y[i] + (y[i + 1] - y[i]) * (v - x[i]) / (x[i + 1] - x[i]);
      return y[y.length - 1];
    }
    case 'spline': {
      if (!f._c) prepSpline(f);
      const x = f.x, y = f.y, n = x.length, { b, c, d } = f._c;
      if (v <= x[0]) return y[0] + b[0] * (v - x[0]);
      if (v >= x[n - 1]) return y[n - 1] + b[n - 1] * (v - x[n - 1]);
      let i = 0;
      while (i < n - 2 && v > x[i + 1]) i++;
      const dx = v - x[i];
      return y[i] + dx * (b[i] + dx * (c[i] + dx * d[i]));
    }
  }
  return 0;
}

// ---------------------------------------------------------------- labels
const JOINT_UI = [
  ['骨盆 Pelvis', [['pelvis_tilt', '前後傾 Tilt'], ['pelvis_list', '側傾 List'], ['pelvis_rotation', '旋轉 Rotation']]],
  ['腰椎 Lumbar', [['lumbar_extension', '伸展(+)/屈曲(−) Ext/Flex'], ['lumbar_bending', '側彎 Side bend'], ['lumbar_rotation', '旋轉 Rotation']]],
  ['右髖 R hip', [['hip_flexion_r', '屈曲 Flexion'], ['hip_adduction_r', '內收(+)/外展(−) Add/Abd'], ['hip_rotation_r', '內旋(+)/外旋(−) Rotation']]],
  ['右膝 R knee', [['knee_angle_r', '屈曲 Flexion']]],
  ['右踝 R ankle', [['ankle_angle_r', '背屈(+)/蹠屈(−) DF/PF'], ['subtalar_angle_r', '內翻/外翻 Inv/Ev'], ['mtp_angle_r', '腳趾 MTP']]],
  ['左髖 L hip', [['hip_flexion_l', '屈曲 Flexion'], ['hip_adduction_l', '內收(+)/外展(−) Add/Abd'], ['hip_rotation_l', '內旋(+)/外旋(−) Rotation']]],
  ['左膝 L knee', [['knee_angle_l', '屈曲 Flexion']]],
  ['左踝 L ankle', [['ankle_angle_l', '背屈(+)/蹠屈(−) DF/PF'], ['subtalar_angle_l', '內翻/外翻 Inv/Ev'], ['mtp_angle_l', '腳趾 MTP']]],
  ['右肩 R shoulder', [['arm_flex_r', '屈曲 Flexion'], ['arm_add_r', '內收/外展 Add/Abd'], ['arm_rot_r', '旋轉 Rotation']]],
  ['右肘與前臂 R elbow', [['elbow_flex_r', '屈曲 Flexion'], ['pro_sup_r', '旋前/旋後 Pro/Sup']]],
  ['右腕 R wrist', [['wrist_flex_r', '屈曲/伸展 Flex/Ext'], ['wrist_dev_r', '偏移 Deviation']]],
  ['左肩 L shoulder', [['arm_flex_l', '屈曲 Flexion'], ['arm_add_l', '內收/外展 Add/Abd'], ['arm_rot_l', '旋轉 Rotation']]],
  ['左肘與前臂 L elbow', [['elbow_flex_l', '屈曲 Flexion'], ['pro_sup_l', '旋前/旋後 Pro/Sup']]],
  ['左腕 L wrist', [['wrist_flex_l', '屈曲/伸展 Flex/Ext'], ['wrist_dev_l', '偏移 Deviation']]],
];
const BONE_EN = {
  pelvis: 'Hip bone', sacrum: 'Sacrum', femur: 'Femur', tibia: 'Tibia', fibula: 'Fibula', patella: 'Patella',
  talus: 'Talus', foot: 'Foot bones (tarsals & metatarsals)', bofoot: 'Toes', hat_spine: 'Spine', hat_jaw: 'Mandible',
  hat_skull: 'Skull', hat_ribs_scap: 'Ribs, sternum & scapula', humerus: 'Humerus', ulna: 'Ulna', radius: 'Radius',
  pisiform: 'Pisiform', lunate: 'Lunate', scaphoid: 'Scaphoid', triquetrum: 'Triquetrum', hamate: 'Hamate',
  capitate: 'Capitate', trapezoid: 'Trapezoid', trapezium: 'Trapezium',
};
const BONE_ZH = {
  pelvis: '髖骨', sacrum: '薦骨', femur: '股骨', tibia: '脛骨', fibula: '腓骨', patella: '髕骨', talus: '距骨',
  foot: '足骨（跗骨與蹠骨）', bofoot: '腳趾骨', hat_spine: '脊椎', hat_jaw: '下顎骨', hat_skull: '顱骨',
  hat_ribs_scap: '肋骨、胸骨與肩胛骨', humerus: '肱骨', ulna: '尺骨', radius: '橈骨', pisiform: '豆狀骨',
  lunate: '月狀骨', scaphoid: '舟狀骨', triquetrum: '三角骨', hamate: '鉤狀骨', capitate: '頭狀骨',
  trapezoid: '小多角骨', trapezium: '大多角骨', metacarpal: '掌骨', proximal: '近端指骨', medial: '中節指骨', distal: '遠端指骨',
};
function boneLabel(pid) {
  let side = '', s = pid;
  let m = s.match(/^(r|l)_(.*)$/); if (m) { side = m[1]; s = m[2]; }
  m = s.match(/^(.*)_(r|l)vs?$/); if (m) { side = m[2]; s = m[1]; }
  const sideEn = side === 'r' ? ' (right)' : side === 'l' ? ' (left)' : '';
  const sideZh = side === 'r' ? '右' : side === 'l' ? '左' : '';
  m = s.match(/^(index|middle|ring|little|thumb)_(proximal|medial|distal)$/);
  if (m) {
    const f = { index: ['食指', 'Index'], middle: ['中指', 'Middle'], ring: ['無名指', 'Ring'], little: ['小指', 'Little'], thumb: ['拇指', 'Thumb'] }[m[1]];
    return { en: `${f[1]} ${m[2]} phalanx${sideEn}`, zh: sideZh + f[0] + BONE_ZH[m[2]] };
  }
  m = s.match(/^metacarpal(\d)$/);
  if (m) return { en: `Metacarpal ${m[1]}${sideEn}`, zh: `${sideZh}第${m[1]}掌骨` };
  return { en: (BONE_EN[s] || s) + sideEn, zh: BONE_ZH[s] ? sideZh + BONE_ZH[s] : '' };
}
const MUSCLE_ZH = {
  addbrev: '內收短肌', addlong: '內收長肌', addmagDist: '內收大肌（遠端）', addmagIsch: '內收大肌（坐骨部）',
  addmagMid: '內收大肌（中部）', addmagProx: '內收大肌（近端）', bflh: '股二頭肌長頭', bfsh: '股二頭肌短頭',
  edl: '伸趾長肌', ehl: '伸拇長肌', fdl: '屈趾長肌', fhl: '屈拇長肌', gaslat: '腓腸肌外側頭', gasmed: '腓腸肌內側頭',
  glmax1: '臀大肌（上部）', glmax2: '臀大肌（中部）', glmax3: '臀大肌（下部）', glmed1: '臀中肌（前部）',
  glmed2: '臀中肌（中部）', glmed3: '臀中肌（後部）', glmin1: '臀小肌（前部）', glmin2: '臀小肌（中部）',
  glmin3: '臀小肌（後部）', grac: '股薄肌', iliacus: '髂肌', perbrev: '腓骨短肌', perlong: '腓骨長肌', piri: '梨狀肌',
  psoas: '腰大肌', recfem: '股直肌', sart: '縫匠肌', semimem: '半膜肌', semiten: '半腱肌', soleus: '比目魚肌',
  tfl: '闊筋膜張肌', tibant: '脛前肌', tibpost: '脛後肌', vasint: '股中間肌', vaslat: '股外側肌', vasmed: '股內側肌',
};
const GROUP_ZH = {
  'Hip flexors': '髖屈肌群', 'Gluteals & hip rotators': '臀肌與髖旋轉肌', Adductors: '內收肌群', Hamstrings: '膕旁肌（腿後肌）',
  Quadriceps: '股四頭肌', 'Calf (plantarflexors)': '小腿後肌群（蹠屈）', 'Shin (dorsiflexors)': '小腿前肌群（背屈）',
};

// ---------------------------------------------------------------- exercise library (degrees; pelvis_t* in metres)
// Periodic cubic (Catmull-Rom) through [phase, value] keys on a 0..1 loop.
function cyc(keys, p) {
  const n = keys.length;
  p = ((p % 1) + 1) % 1;
  const T = (i) => keys[((i % n) + n) % n][0] + Math.floor(i / n);
  const V = (i) => keys[((i % n) + n) % n][1];
  let i = n - 1;
  for (let j = 0; j < n; j++) if (keys[j][0] <= p) i = j;
  if (p < keys[0][0]) i = -1;
  const t0 = T(i), t1 = T(i + 1), h = t1 - t0, s = (p - t0) / h;
  const m0 = (V(i + 1) - V(i - 1)) / (t1 - T(i - 1)) * h, m1 = (V(i + 2) - V(i)) / (T(i + 2) - t0) * h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * V(i) + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * V(i + 1) + (s3 - s2) * m1;
}

const SIT = { hip_flexion_r: 90, hip_flexion_l: 90, knee_angle_r: 90, knee_angle_l: 90, ankle_angle_r: 0, ankle_angle_l: 0 };
const SYNTH = [
  { id: 'squat', zh: '深蹲', en: 'Squat', dur: 4, anchor: { feet: 'both', at: 'heel' },
    keys: [[0, {}], [0.15, {}], [0.5, { pelvis_tilt: -25, lumbar_extension: -15, hip_flexion_r: 105, hip_flexion_l: 105, knee_angle_r: 110, knee_angle_l: 110, ankle_angle_r: 28, ankle_angle_l: 28, arm_flex_r: 80, arm_flex_l: 80 }], [0.65, 'hold'], [1, {}]],
    groups: ['Quadriceps', 'Gluteals & hip rotators'],
    note: '股四頭肌與臀大肌為主；膝蓋與腳尖同方向。Quadriceps and gluteus maximus; knees track over toes.' },
  { id: 'sts', zh: '坐到站', en: 'Sit-to-stand', dur: 5, anchor: { feet: 'both', at: 'heel' }, prop: 'stool', propAt: 0,
    keys: [[0, SIT], [0.12, SIT],
      [0.3, { ...SIT, pelvis_tilt: -30, lumbar_extension: -10, hip_flexion_r: 118, hip_flexion_l: 118, ankle_angle_r: 10, ankle_angle_l: 10 }],
      [0.4, { pelvis_tilt: -30, lumbar_extension: -10, hip_flexion_r: 108, hip_flexion_l: 108, knee_angle_r: 80, knee_angle_l: 80, ankle_angle_r: 15, ankle_angle_l: 15 }],
      [0.55, { pelvis_tilt: -10, hip_flexion_r: 40, hip_flexion_l: 40, knee_angle_r: 30, knee_angle_l: 30, ankle_angle_r: 5, ankle_angle_l: 5 }],
      [0.65, {}], [0.72, {}],
      [0.86, { pelvis_tilt: -25, lumbar_extension: -8, hip_flexion_r: 100, hip_flexion_l: 100, knee_angle_r: 75, knee_angle_l: 75, ankle_angle_r: 12, ankle_angle_l: 12 }],
      [1, SIT]],
    groups: ['Quadriceps', 'Gluteals & hip rotators', 'Calf (plantarflexors)'],
    note: '先身體前傾（鼻子過腳尖）再起身。Lean forward (nose over toes) before rising — key cue for weak quadriceps.' },
  { id: 'kneeext', zh: '坐姿膝伸直', en: 'Seated knee extension', dur: 4, anchor: { feet: 'left', at: 'heel' }, prop: 'stool', propAt: 0,
    keys: [[0, SIT], [0.15, SIT], [0.45, { ...SIT, knee_angle_r: 0, ankle_angle_r: 10 }], [0.65, 'hold'], [1, SIT]],
    groups: ['Quadriceps'],
    note: '膝關節術後股四頭肌訓練。Quadriceps strengthening after knee surgery / for knee OA.' },
  { id: 'bike', zh: '臥式腳踏車', en: 'Recumbent bike pedalling', dur: 1.5, prop: 'seat', propAt: 0, trace: true,
    fn: (p) => {
      const a = 2 * Math.PI * p, b = a + Math.PI;
      return { pelvis_tilt: 22, lumbar_extension: -8, pelvis_ty: 0.72,
        hip_flexion_r: 92 + 22 * Math.cos(a), knee_angle_r: 70 + 40 * Math.cos(a), ankle_angle_r: -8 + 12 * Math.sin(a),
        hip_flexion_l: 92 + 22 * Math.cos(b), knee_angle_l: 70 + 40 * Math.cos(b), ankle_angle_l: -8 + 12 * Math.sin(b),
        arm_flex_r: 25, arm_flex_l: 25, elbow_flex_r: 40, elbow_flex_l: 40 };
    },
    groups: ['Quadriceps', 'Hamstrings', 'Gluteals & hip rotators'],
    note: '低衝擊下肢耐力訓練；可觀察膝關節活動範圍需求（約 30–115°）。Low-impact endurance; shows knee ROM needed for a full pedal stroke.' },
  { id: 'slr', zh: '直膝抬腿（仰躺）', en: 'Straight-leg raise (supine)', dur: 4, prop: 'bed', propAt: 0,
    base: { pelvis_tilt: 90, pelvis_ty: 0.62, pelvis_tx: 0 },
    keys: [[0, { ankle_angle_r: 10 }], [0.15, { ankle_angle_r: 10 }], [0.45, { hip_flexion_r: 55, ankle_angle_r: 10 }], [0.65, 'hold'], [1, { ankle_angle_r: 10 }]],
    groups: ['Hip flexors', 'Quadriceps'],
    note: '膝伸直時股直肌與髂腰肌出力；觀察膕旁肌被拉長。Rectus femoris & iliopsoas work; hamstrings lengthen (yellow).' },
  { id: 'heel', zh: '踮腳尖', en: 'Heel raise', dur: 3, anchor: { feet: 'both', at: 'toe' },
    keys: [[0, {}], [0.15, {}], [0.45, { ankle_angle_r: -28, ankle_angle_l: -28, mtp_angle_r: 25, mtp_angle_l: 25 }], [0.65, 'hold'], [1, {}]],
    groups: ['Calf (plantarflexors)'],
    note: '小腿肌力與平衡訓練。Calf strength and balance.' },
  { id: 'hipabd', zh: '站姿髖外展', en: 'Standing hip abduction', dur: 3.5, anchor: { feet: 'left', at: 'heel' },
    keys: [[0, {}], [0.15, {}], [0.45, { hip_adduction_r: -30, pelvis_list: -3, lumbar_bending: 3 }], [0.65, 'hold'], [1, {}]],
    groups: ['Gluteals & hip rotators'],
    note: '臀中肌訓練；臀中肌無力會出現垂德倫堡步態。Gluteus medius; weakness causes Trendelenburg gait.' },
  // --- sports (hand-made key poses; right-handed athlete). `lift` raises the body off the floor (jump).
  (() => {
    const address = { pelvis_tilt: -28, lumbar_extension: -6, hip_flexion_r: 40, hip_flexion_l: 40, knee_angle_r: 22, knee_angle_l: 22,
      ankle_angle_r: 12, ankle_angle_l: 12, arm_flex_r: 38, arm_flex_l: 38, arm_add_r: 22, arm_add_l: 22, elbow_flex_r: 12, elbow_flex_l: 4 };
    // Kinematic sequence: backswing about 3× slower than the downswing; the pelvis starts unwinding
    // while the chest and arms are still finishing the backswing (X-factor stretch), the arms and
    // club lag behind (wrists stay cocked until late), then everything releases through the ball.
    const takeaway = { ...address, pelvis_rotation: -10, lumbar_rotation: -20, hip_rotation_r: -4, hip_rotation_l: 4, knee_angle_l: 25,
      arm_flex_l: 48, arm_add_l: 32, arm_flex_r: 44, arm_add_r: 12, elbow_flex_r: 28, cw: 0.7, cx: 0.3, cy: -0.55, cz: 0.78 };
    const halfBack = { ...address, pelvis_rotation: -27, lumbar_rotation: -36, lumbar_bending: 3, hip_rotation_r: -10, hip_rotation_l: 10, knee_angle_l: 29, knee_angle_r: 20,
      arm_flex_l: 75, arm_add_l: 42, elbow_flex_l: 4, arm_flex_r: 72, arm_add_r: -8, arm_rot_r: -28, elbow_flex_r: 70, cw: 1, cx: 0.15, cy: 0.95, cz: 0.25 };
    const top = { ...address, pelvis_rotation: -42, lumbar_rotation: -45, lumbar_bending: 6, hip_rotation_r: -15, hip_rotation_l: 15,
      knee_angle_l: 32, knee_angle_r: 18, arm_flex_l: 95, arm_add_l: 45, elbow_flex_l: 5, arm_flex_r: 90, arm_add_r: -25, arm_rot_r: -50, elbow_flex_r: 95,
      wrist_dev_r: 20, wrist_dev_l: 20, cw: 1, cx: 0.15, cy: 0.1, cz: -1 };
    const transition = { ...top, pelvis_rotation: -30, lumbar_rotation: -54, lumbar_bending: 4, hip_rotation_r: -10, hip_rotation_l: 8, knee_angle_l: 27, knee_angle_r: 20 };
    const delivery = { ...address, pelvis_rotation: 12, lumbar_rotation: -32, lumbar_bending: -2, hip_rotation_l: -6, hip_rotation_r: 2, knee_angle_l: 18, knee_angle_r: 25,
      arm_flex_l: 68, arm_add_l: 38, elbow_flex_l: 4, arm_flex_r: 62, arm_add_r: 8, arm_rot_r: -15, elbow_flex_r: 68, wrist_dev_r: 15, wrist_dev_l: 15, cw: 1, cx: 0.25, cy: 0.75, cz: 0.6 };
    const impact = { ...address, pelvis_rotation: 38, lumbar_rotation: -14, lumbar_bending: -8, hip_rotation_l: -20, hip_rotation_r: 10, knee_angle_l: 12, knee_angle_r: 28,
      ankle_angle_r: 6, arm_add_l: 16, elbow_flex_r: 15, cw: 0 };
    const extension = { ...address, pelvis_tilt: -20, pelvis_rotation: 58, lumbar_rotation: 2, lumbar_bending: -10, hip_rotation_l: -26, hip_rotation_r: 20,
      knee_angle_l: 8, knee_angle_r: 32, ankle_angle_r: -8, mtp_angle_r: 15, arm_flex_r: 50, arm_add_r: 32, elbow_flex_r: 5, arm_flex_l: 48, arm_add_l: 6, arm_rot_l: 20, elbow_flex_l: 18, cw: 0.8, cx: 0.45, cy: -0.45, cz: -0.77 };
    const finish = { pelvis_tilt: -6, lumbar_extension: 5, pelvis_rotation: 82, lumbar_rotation: 28, lumbar_bending: -8, hip_flexion_r: 18, hip_flexion_l: 8,
      knee_angle_r: 35, knee_angle_l: 6, hip_rotation_l: -30, hip_rotation_r: 30, ankle_angle_r: -20, mtp_angle_r: 30,
      arm_flex_r: 105, arm_add_r: 40, elbow_flex_r: 30, arm_flex_l: 110, arm_add_l: -20, arm_rot_l: 40, elbow_flex_l: 100, cw: 1, cx: -0.5, cy: -0.15, cz: 0.85 };
    // club passes up over the lead shoulder between extension and finish
    const high = { ...Object.fromEntries([...new Set([...Object.keys(extension), ...Object.keys(finish)])].map((n) => [n, ((extension[n] || 0) + (finish[n] || 0)) / 2])),
      cw: 1, cx: 0.1, cy: 1, cz: -0.35 };
    // relaxing back to address: arms come down with the club pointing down (keeps the club from flipping)
    const relax = { ...Object.fromEntries([...new Set([...Object.keys(address), ...Object.keys(finish)])].map((n) => [n, ((address[n] || 0) + (finish[n] || 0)) / 2])),
      cw: 1, cx: 0.3, cy: -1, cz: 0.2 };
    return { id: 'golf', zh: '高爾夫揮桿', en: 'Golf swing', dur: 5, anchor: { feet: 'left', at: 'heel' }, prop: 'golf', impact: 0.53, view: 'front',
      keys: [[0, address], [0.08, address], [0.2, takeaway], [0.32, halfBack], [0.415, top], [0.45, transition], [0.495, delivery], [0.53, impact],
        [0.575, extension], [0.625, high], [0.68, finish], [0.84, finish], [0.91, relax], [0.97, address], [1, address]],
      groups: ['Gluteals & hip rotators', 'Adductors', 'Hamstrings'],
      note: '力量來自下半身：骨盆先轉、軀幹再跟上（「X 因子」），臀肌與內收肌群提供旋轉力。腰椎過度旋轉是高爾夫球員下背痛的主因；髖關節活動度不足會增加下背負擔。Power starts in the hips: the pelvis turns first and the trunk follows (the "X-factor"), driven by the gluteals and adductors. Over-rotating the lumbar spine is the main cause of golfers’ low back pain; stiff hips add to it.' };
  })(),
  (() => {
    const hold = { arm_flex_r: 45, arm_flex_l: 45, arm_add_r: 10, arm_add_l: 10, elbow_flex_r: 105, elbow_flex_l: 105, pro_sup_r: 60, pro_sup_l: 60 };
    const dip = { pelvis_tilt: -18, lumbar_extension: -4, hip_flexion_r: 55, hip_flexion_l: 55, knee_angle_r: 70, knee_angle_l: 70, ankle_angle_r: 25, ankle_angle_l: 25,
      arm_flex_r: 100, arm_add_r: -5, elbow_flex_r: 115, wrist_flex_r: -45, arm_flex_l: 85, arm_add_l: 20, elbow_flex_l: 110, pro_sup_r: 80, pro_sup_l: 60 };
    const release = { lift: 0.22, pelvis_tilt: 0, hip_flexion_r: 0, hip_flexion_l: 0, knee_angle_r: 2, knee_angle_l: 2, ankle_angle_r: -30, ankle_angle_l: -30,
      arm_flex_r: 155, arm_add_r: -5, elbow_flex_r: 8, wrist_flex_r: 55, arm_flex_l: 135, arm_add_l: 15, elbow_flex_l: 40, pro_sup_r: 80, pro_sup_l: 60 };
    const land = { pelvis_tilt: -10, hip_flexion_r: 30, hip_flexion_l: 30, knee_angle_r: 40, knee_angle_l: 40, ankle_angle_r: 18, ankle_angle_l: 18,
      arm_flex_r: 120, elbow_flex_r: 20, wrist_flex_r: 50, arm_flex_l: 90, elbow_flex_l: 50 };
    return { id: 'basket', zh: '籃球跳投', en: 'Basketball jump shot', dur: 3.2, anchor: { feet: 'both', at: 'toe' }, prop: 'hoop', release: 0.42, view: 'right',
      keys: [[0, hold], [0.1, hold], [0.28, dip], [0.42, release], [0.5, release], [0.62, land], [0.8, hold], [1, hold]],
      groups: ['Quadriceps', 'Calf (plantarflexors)', 'Gluteals & hip rotators'],
      note: '屈膝蓄力→股四頭肌、臀大肌、小腿肌爆發伸展起跳→在最高點出手、手腕下壓（「鵝頸」收尾）。落地要屈膝緩衝，預防前十字韌帶與跳躍膝（髕腱炎）傷害。Dip, then the quadriceps, gluteals and calves extend explosively; release at the top with a wrist snap ("goose-neck" follow-through). Land softly with bent knees to protect the ACL and patellar tendon (jumper’s knee).' };
  })(),
  (() => {
    // Right-handed forehand. Racket direction (rx, ry, rz) and string-face normal (nx, ny, nz) are in the
    // player's frame: X toward the net, Y up, Z the player's right.
    const ready = { pelvis_tilt: -15, lumbar_extension: -4, hip_flexion_r: 32, hip_flexion_l: 32, knee_angle_r: 32, knee_angle_l: 32,
      ankle_angle_r: 16, ankle_angle_l: 16, hip_adduction_r: -8, hip_adduction_l: -8,
      arm_flex_r: 35, arm_add_r: 12, elbow_flex_r: 80, arm_flex_l: 38, arm_add_l: 22, elbow_flex_l: 85,
      rx: 0.75, ry: 0.45, rz: -0.35, nx: 0, ny: 0, nz: 1 };
    const turn = { ...ready, pelvis_rotation: -28, lumbar_rotation: -30, hip_rotation_r: -10, hip_rotation_l: 10, knee_angle_r: 38, hip_flexion_r: 36,
      arm_flex_l: 70, arm_add_l: 5, elbow_flex_l: 25, arm_flex_r: 25, arm_add_r: -30, arm_rot_r: -20, elbow_flex_r: 90,
      rx: 0.1, ry: 0.95, rz: 0.25, nx: 1, ny: 0, nz: 0 };
    const top = { ...turn, pelvis_rotation: -38, lumbar_rotation: -42, knee_angle_r: 45, hip_flexion_r: 42, ankle_angle_r: 20,
      arm_flex_r: 5, arm_add_r: -55, arm_rot_r: -40, elbow_flex_r: 70, wrist_flex_r: -20,
      rx: -0.55, ry: 0.65, rz: 0.5, nx: 0, ny: 0, nz: 1 };
    const drop = { ...top, pelvis_rotation: -18, lumbar_rotation: -46, knee_angle_r: 40, hip_flexion_r: 38,
      arm_flex_r: 0, arm_add_r: -45, arm_rot_r: -55, elbow_flex_r: 55, wrist_flex_r: -40,
      rx: -0.45, ry: -0.6, rz: 0.45, nx: 0.3, ny: 0, nz: 1 };
    const contact = { ...ready, pelvis_rotation: 16, lumbar_rotation: 0, hip_rotation_r: 6, hip_rotation_l: -10, knee_angle_r: 26, knee_angle_l: 30,
      hip_flexion_r: 26, ankle_angle_r: -4, arm_flex_r: 76, arm_add_r: -28, arm_rot_r: -25, elbow_flex_r: 22, wrist_flex_r: -30,
      arm_flex_l: 40, arm_add_l: -10, elbow_flex_l: 40, rx: 0.12, ry: 0.15, rz: 1, nx: 1, ny: -0.1, nz: 0 };
    const extension = { ...contact, pelvis_rotation: 34, lumbar_rotation: 14, arm_flex_r: 75, arm_add_r: -5, elbow_flex_r: 35, wrist_flex_r: -10,
      knee_angle_r: 28, ankle_angle_r: -10, mtp_angle_r: 15, rx: 0.65, ry: 0.65, rz: 0.3, nx: 0.5, ny: -0.5, nz: -0.6 };
    const finish = { ...ready, pelvis_rotation: 48, lumbar_rotation: 24, knee_angle_r: 36, hip_flexion_r: 26, ankle_angle_r: -16, mtp_angle_r: 25,
      arm_flex_r: 75, arm_add_r: 50, arm_rot_r: 20, elbow_flex_r: 120, wrist_flex_r: 0, arm_flex_l: 22, arm_add_l: 20, elbow_flex_l: 90,
      rx: -0.8, ry: 0.05, rz: -0.6, nx: 0, ny: -1, nz: 0 };
    return { id: 'tennis', zh: '網球正拍', en: 'Tennis forehand', dur: 2.6, anchor: { feet: 'left', at: 'heel' }, prop: 'tennis', impact: 0.56, view: 'iso-right',
      keys: [[0, ready], [0.1, ready], [0.3, turn], [0.42, top], [0.5, drop], [0.56, contact], [0.64, extension], [0.74, finish], [0.86, finish], [1, ready]],
      groups: ['Gluteals & hip rotators', 'Adductors', 'Quadriceps'],
      note: '轉體引拍→髖部先轉、肩膀跟上→球拍落下（拍頭延遲）→擊球點在身體前方→收拍到對側肩。手臂力量多來自下肢與軀幹旋轉；只靠手腕/前臂發力或擊球點太晚，會加重前臂伸肌負擔，是網球肘（肱骨外上髁炎）的常見原因。Unit turn, the hips lead the shoulders, the racket drops and lags, contact in front of the body, follow through over the opposite shoulder. Most racket speed comes from the legs and trunk; hitting with the wrist or late overloads the forearm extensors, a common cause of tennis elbow (lateral epicondylitis).' };
  })(),
  (() => {
    // Right leg, phase 0 = right foot contact; the left leg runs half a cycle later. Stance ~38% of the cycle.
    const hip = [[0, 28], [0.15, 18], [0.38, -8], [0.48, -12], [0.62, 10], [0.82, 42], [0.93, 34]];
    const knee = [[0, 18], [0.14, 42], [0.38, 20], [0.5, 58], [0.68, 105], [0.85, 45], [0.95, 16]];
    const ankle = [[0, 4], [0.14, 20], [0.3, 10], [0.4, -22], [0.55, -8], [0.75, 8], [0.92, 6]];
    const mtp = [[0, 0], [0.28, 8], [0.38, 30], [0.48, 4], [0.8, 0]];
    const flight = (p) => {                       // body off the ground between toe-off and the next contact
      const u = ((p % 0.5) - 0.38) / 0.12;
      return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
    };
    return { id: 'run', zh: '跑步', en: 'Running', dur: 0.75, anchor: { floorOnly: true }, view: 'right',
      fn: (p) => {
        const r = (k) => cyc(k, p), l = (k) => cyc(k, p + 0.5);
        const sw = Math.cos(2 * Math.PI * (p - 0.35));     // right arm forward when the left leg is forward
        return { pelvis_tilt: -6, lumbar_extension: -2, pelvis_rotation: -5 * Math.cos(2 * Math.PI * (p - 0.85)), lumbar_rotation: 7 * Math.cos(2 * Math.PI * (p - 0.85)),
          pelvis_list: 3 * Math.sin(2 * Math.PI * (p * 2 - 0.05)),
          hip_flexion_r: r(hip), knee_angle_r: r(knee), ankle_angle_r: r(ankle), mtp_angle_r: r(mtp),
          hip_flexion_l: l(hip), knee_angle_l: l(knee), ankle_angle_l: l(ankle), mtp_angle_l: l(mtp),
          arm_flex_r: 5 + 26 * sw, arm_flex_l: 5 - 26 * sw, arm_add_r: 12, arm_add_l: 12,
          elbow_flex_r: 85 + 10 * sw, elbow_flex_l: 85 - 10 * sw, lift: 0.05 * flight(p) };
      },
      groups: ['Calf (plantarflexors)', 'Quadriceps', 'Hamstrings', 'Gluteals & hip rotators', 'Hip flexors'],
      note: '跑步與走路不同：有雙腳騰空期、單腳支撐時間較短，著地衝擊約體重 2–3 倍。股四頭肌與小腿肌吸收衝擊，臀大肌與小腿肌推進，膕旁肌在擺盪末期減速小腿。步頻稍快、步幅不過大（腳落在身體下方）可減少膝與脛骨負擔；常見傷害有髕骨股骨疼痛、髂脛束症候群、脛前疼痛、跟腱炎與足底筋膜炎。Unlike walking there is a flight phase, stance is shorter and landing loads are about 2–3× body weight. The quadriceps and calf absorb impact, the gluteals and calf drive forward, the hamstrings brake the swinging leg. A slightly quicker cadence with the foot landing under the body eases the knee and shin; common injuries are patellofemoral pain, ITB syndrome, shin splints, Achilles tendinopathy and plantar fasciitis.' };
  })(),
];

// ---------------------------------------------------------------- loader
export async function loadMovement(ctx) {
  const { THREE, loader, makePart, applyAll, select, refreshChipInfo, fetchJSON, h, $$, store } = ctx;
  const meta = await fetchJSON('data/opensim.json');
  const gltf = await loader.loadAsync('data/' + meta.glb);
  gltf.scene.updateMatrixWorld(true);

  const root = new THREE.Group();
  root.rotation.y = -Math.PI / 2;            // OpenSim X forward/Z right -> viewer +Z forward, -X right
  const ground = new THREE.Group();
  root.add(ground);
  const parts = new Map();

  // bodies & bones ----------------------------------------------------
  const bodyGroups = { ground: null };
  const bodyBox = {};
  for (const name of Object.keys(meta.bodies)) {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.name = name;
    ground.add(g);
    bodyGroups[name] = g;
    bodyBox[name] = new THREE.Box3();
  }
  for (const node of [...gltf.scene.children]) {
    const body = node.userData.body;
    if (!body || !bodyGroups[body]) continue;
    bodyBox[body].expandByObject(node);
    const meshes = [];
    node.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const lab = boneLabel(node.name);
    const p = makePart('bone:' + node.name, lab.en, meshes, [0.93, 0.89, 0.8], { kind: 'bone', body });
    if (lab.zh) p.zh = lab.zh;
    parts.set(p.pid, p);
    bodyGroups[body].add(node);
  }

  // joints ----------------------------------------------------------
  const M = (t, o) => new THREE.Matrix4().makeTranslation(t[0], t[1], t[2])
    .multiply(new THREE.Matrix4().makeRotationX(o[0])).multiply(new THREE.Matrix4().makeRotationY(o[1])).multiply(new THREE.Matrix4().makeRotationZ(o[2]));
  const joints = meta.joints.map((j) => ({ ...j, Mp: M(j.parent.t, j.parent.o), McInv: M(j.child.t, j.child.o).invert() }));
  const coords = meta.coords;
  const q = {};
  const defaults = () => { for (const [n, c] of Object.entries(coords)) q[n] = c.default; };
  defaults();
  const W = { ground: new THREE.Matrix4() };
  const tmpR = new THREE.Matrix4(), tmpA = new THREE.Matrix4(), axisV = new THREE.Vector3();

  function jointX(j) {
    const X = new THREE.Matrix4();
    if (j.type === 'CustomJoint') {
      const R = new THREE.Matrix4(), t = new THREE.Vector3();
      for (const ax of j.axes) {
        const v = evalF(ax.f, ax.coords.length ? q[ax.coords[0]] : 0);
        axisV.set(...ax.axis).normalize();
        if (ax.kind.startsWith('rotation')) { if (v) R.multiply(tmpA.makeRotationAxis(axisV, v)); }
        else t.addScaledVector(axisV, v);
      }
      X.makeTranslation(t.x, t.y, t.z).multiply(R);
    } else if (j.type === 'PinJoint') {
      X.makeRotationZ(q[j.coords[0]]);
    } else if (j.type === 'UniversalJoint') {
      X.makeRotationX(q[j.coords[0]]).multiply(tmpR.makeRotationY(q[j.coords[1]]));
    }
    return X;
  }
  function fk() {
    for (const c of meta.couplers) q[c.dep] = c.s * evalF(c.f, q[c.ind[0]]);
    for (const j of joints) {
      const parent = W[j.parent.body] || W.ground;
      W[j.child.body] = parent.clone().multiply(j.Mp).multiply(jointX(j)).multiply(j.McInv);
    }
    for (const [name, g] of Object.entries(bodyGroups)) {
      if (!g) continue;
      g.matrix.copy(W[name]);
      g.matrixWorldNeedsUpdate = true;
    }
  }

  // foot anchor points (body-local) ---------------------------------------
  const footPts = {};
  for (const s of ['r', 'l']) {
    const cb = bodyBox['calcn_' + s], tb = bodyBox['toes_' + s];
    footPts[s] = {
      heel: { body: 'calcn_' + s, p: new THREE.Vector3(cb.min.x, cb.min.y, (cb.min.z + cb.max.z) / 2) },
      mid: { body: 'calcn_' + s, p: new THREE.Vector3(cb.max.x, cb.min.y, (cb.min.z + cb.max.z) / 2) },
      toe: { body: 'toes_' + s, p: new THREE.Vector3(tb.max.x, tb.min.y, (tb.min.z + tb.max.z) / 2) },
    };
  }
  const ptG = (a) => a.p.clone().applyMatrix4(W[a.body]);
  fk();
  const allFoot = () => ['r', 'l'].flatMap((s) => ['heel', 'mid', 'toe'].map((k) => ptG(footPts[s][k])));
  const floorY = Math.min(...allFoot().map((v) => v.y));
  const ref = {};
  for (const s of ['r', 'l']) for (const k of ['heel', 'toe']) ref[s + k] = ptG(footPts[s][k]);

  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 64), new THREE.MeshStandardMaterial({ color: 0x24384c, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY - 0.002;
  root.add(floor);

  // muscles -----------------------------------------------------------
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const muscles = [];
  for (const mu of meta.muscles) {
    const nseg = mu.points.length - 1;
    const im = new THREE.InstancedMesh(cyl, null, nseg);
    im.frustumCulled = false;
    ground.add(im);
    const p = makePart('mus:' + mu.name, mu.label, [im], [0.75, 0.2, 0.2], { kind: 'muscle', mu });
    p.zh = (mu.side === 'r' ? '右' : '左') + (MUSCLE_ZH[mu.base] || mu.base);
    p.radius = 0.0022 + 0.00016 * Math.sqrt(mu.fmax);
    p.info = () => {
      const pct = Math.round((p.len / p.len0 - 1) * 100);
      const gz = mu.groups.map((g) => GROUP_ZH[g] || g).join('、');
      return `長度 Length ${(p.len * 100).toFixed(1)} cm（${pct > 0 ? '+' : ''}${pct}% 相對站姿 vs standing）· 最大肌力 Max force ${Math.round(mu.fmax)} N${gz ? ' · ' + gz : ''}`;
    };
    parts.set(p.pid, p);
    muscles.push(p);
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _qt = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function musclePoints(p) {
    const out = [];
    for (const pt of p.mu.points) {
      if (pt.cond) { const v = q[pt.cond.coord]; if (v < pt.cond.range[0] || v > pt.cond.range[1]) continue; }
      out.push(new THREE.Vector3(...pt.loc).applyMatrix4(W[pt.body]));
    }
    return out;
  }
  function updateMuscles() {
    for (const p of muscles) {
      const pts = musclePoints(p);
      const im = p.meshes[0];
      let len = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        _a.copy(pts[i]); _b.copy(pts[i + 1]);
        const d = _b.clone().sub(_a), l = d.length();
        len += l;
        _qt.setFromUnitVectors(_up, d.divideScalar(l || 1));
        _s.set(p.radius, l, p.radius);
        _m.compose(_a.add(_b).multiplyScalar(0.5), _qt, _s);
        im.setMatrixAt(i, _m);
      }
      im.count = Math.max(0, pts.length - 1);
      im.instanceMatrix.needsUpdate = true;
      p.len = len;
    }
  }
  updateMuscles();
  for (const p of muscles) p.len0 = p.len;

  // colouring: stretch (blue short – grey – red long) or plain red
  let colorMode = store.get('muscleColor', 'stretch');
  const cShort = new THREE.Color(0x2f7bff), cMid = new THREE.Color(0xb8433a), cLong = new THREE.Color(0xffd23a), cPlain = new THREE.Color(0xb8322a);
  function recolorMuscles() {
    for (const p of muscles) {
      if (p.override) continue;
      if (colorMode === 'plain') p.color.copy(cPlain);
      else {
        const t = Math.max(-1, Math.min(1, (p.len / p.len0 - 1) / 0.15));
        p.color.copy(cMid).lerp(t < 0 ? cShort : cLong, Math.abs(t));
      }
      p.base.copy(p.color);
      for (const m of p.meshes) m.material.color.copy(p.color);
    }
  }

  // anchoring & props ---------------------------------------------------
  function anchor(spec) {
    ground.position.set(0, 0, 0);
    if (!spec) return;
    const sides = spec.feet === 'both' ? ['r', 'l'] : spec.feet === 'left' ? ['l'] : spec.feet === 'right' ? ['r'] : [];
    if (spec.floorOnly) {
      ground.position.y = floorY - Math.min(...allFoot().map((v) => v.y));
      return;
    }
    const cur = sides.map((s) => ptG(footPts[s][spec.at]));
    const tgt = sides.map((s) => ref[s + spec.at]);
    const avg = (arr) => arr.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / arr.length);
    const c = avg(cur), t = avg(tgt);
    const pts = sides.flatMap((s) => ['heel', 'mid', 'toe'].map((k) => ptG(footPts[s][k])));
    ground.position.set(t.x - c.x, floorY - Math.min(...pts.map((v) => v.y)), 0);
  }
  const propMat = new THREE.MeshStandardMaterial({ color: 0x6d7d8c, roughness: 0.9 });
  const props = new THREE.Group();
  root.add(props);
  const trace = new THREE.Group();
  ground.add(trace);
  function boxOf(bodies) {
    const b = new THREE.Box3();
    for (const n of bodies) {
      const bb = bodyBox[n];
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
        b.expandByPoint(v.applyMatrix4(W[n]).add(ground.position));
      }
    }
    return b;
  }
  function addBox(x0, x1, y0, y1, z0, z1, rotZ = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), propMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.rotation.z = rotZ;
    props.add(m);
  }
  // ground-frame position of a point on a body, including the floor anchoring offset
  const gp = (body, x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z).applyMatrix4(W[body]).add(ground.position);
  const palms = () => gp('hand_r', 0, -0.08, 0).add(gp('hand_l', 0, -0.08, 0)).multiplyScalar(0.5);
  const shoulders = () => gp('humerus_r').add(gp('humerus_l')).multiplyScalar(0.5);
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...extra });
  const orient = (mesh, a, b) => {           // stretch a unit Y-cylinder from a to b
    const d = b.clone().sub(a), l = d.length();
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    mesh.scale.set(1, l, 1);
  };
  function buildDynamic(mo) {
    dyn = null;
    if (mo.prop === 'golf') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), mat(0xc8ccd2, { metalness: 0.6 }));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), mat(0x30343a, { metalness: 0.5 }));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), mat(0xffffff));
      const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.03, 6), mat(0xd9b26f));
      props.add(shaft, head, ball, tee);
      const clubEnd = () => {
        // club continues the line from the shoulders through the hands, hinged at the wrists by the
        // wrist hinge: the key poses give the club's direction (cx, cy, cz in the golfer's frame: X toward
        // the ball, Y up, Z the golfer's right; the target is -Z) and `cw` how much of it to use (0 = straight
        // line from the arms, as at address and impact, so the club meets the ball).
        const g = palms(), dir = g.clone().sub(shoulders()).normalize();
        const w = Math.max(0, Math.min(1, X.cw || 0));
        if (w) {
          const k = new THREE.Vector3(X.cx || 0, X.cy || 0, X.cz || 0);
          if (k.lengthSq() > 1e-6) dir.lerp(k.normalize(), w).normalize();
        }
        return [g, g.clone().addScaledVector(dir, 1.0)];
      };
      setPose(mo, 0);
      const [, h0] = clubEnd();
      const ballStart = new THREE.Vector3(h0.x, floorY + 0.045, h0.z);
      tee.position.set(ballStart.x, floorY + 0.015, ballStart.z);
      dyn = { mo, update(phase) {
        const [g, h] = clubEnd();
        orient(shaft, g, h);
        head.position.copy(h); head.quaternion.copy(shaft.quaternion);
        const s = (phase - mo.impact) / 0.3;   // ball flight after impact, toward the target (golfer's left = -Z)
        ball.visible = s < 1;
        if (s <= 0) ball.position.copy(ballStart);
        else ball.position.copy(ballStart).add(new THREE.Vector3(1.2 * s, 5 * s * (1 - s) * 1.6, -9 * s));
      } };
    }
    if (mo.prop === 'tennis') {
      const rmat = mat(0x2b6cb0, { metalness: 0.3 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), mat(0x22262b));
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 8), rmat);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.008, 8, 40), rmat);
      const strings = new THREE.Mesh(new THREE.CircleGeometry(0.122, 32), mat(0xf2f4f7, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
      const head = new THREE.Group();
      head.add(frame, strings);
      head.scale.set(1, 1.3, 1);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 12), mat(0xd8f13a));
      props.add(handle, throat, head, ball);
      const R = 0.125 * 1.3;                 // head centre beyond the throat (oval head, long radius)
      const racket = () => {
        const g = gp('hand_r', 0, -0.08, 0);
        const d = new THREE.Vector3(X.rx || 0, X.ry || 0, X.rz || 0);
        if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
        d.normalize();
        const n = new THREE.Vector3(X.nx || 0, X.ny || 0, X.nz || 1);
        n.addScaledVector(d, -n.dot(d));
        if (n.lengthSq() < 1e-4) n.set(0, 1, 0).addScaledVector(d, -d.y);
        n.normalize();
        return { g, d, n, end: g.clone().addScaledVector(d, 0.2), centre: g.clone().addScaledVector(d, 0.2 + R) };
      };
      setPose(mo, mo.impact);
      const hit = racket().centre;
      const far = new THREE.Vector3(3.2, floorY + 1.0, hit.z + 0.3), bounce = new THREE.Vector3(1.6, floorY + 0.033, hit.z + 0.15);
      const out = new THREE.Vector3(3.4, floorY + 1.5, hit.z - 0.5);
      const arc = (a, b, u, hgt) => a.clone().lerp(b, u).add(new THREE.Vector3(0, 4 * hgt * u * (1 - u), 0));
      const _x = new THREE.Vector3(), _mm = new THREE.Matrix4();
      dyn = { mo, update(phase) {
        const { g, d, n, end, centre } = racket();
        orient(handle, g.clone().addScaledVector(d, -0.08), g.clone().addScaledVector(d, 0.1));
        orient(throat, g.clone().addScaledVector(d, 0.1), end);
        _x.crossVectors(d, n).normalize();
        _mm.makeBasis(_x, d, n);
        head.position.copy(centre);
        head.quaternion.setFromRotationMatrix(_mm);
        const s = (phase - (mo.impact - 0.28)) / 0.28, o = (phase - mo.impact) / 0.3;
        ball.visible = s > 0 && o < 1;
        if (!ball.visible) ball.position.copy(hit);          // parked at the racket so it doesn't widen the camera framing
        else if (s <= 0.55) ball.position.copy(arc(far, bounce, Math.max(0, s) / 0.55, 0.25));
        else if (s <= 1) ball.position.copy(arc(bounce, hit, (s - 0.55) / 0.45, 0.35));
        else ball.position.copy(arc(hit, out, o, 0.5));
      } };
    }
    if (mo.prop === 'hoop') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), mat(0xe2701f));
      props.add(ball);
      setPose(mo, mo.release);
      const rel = palms().add(new THREE.Vector3(0.08, 0.1, 0));
      const hoop = new THREE.Vector3(3.2, floorY + 3.05, rel.z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 8, 32), mat(0xff5a1f));
      rim.rotation.x = Math.PI / 2; rim.position.copy(hoop);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, 1.8), mat(0xf2f4f7, { transparent: true, opacity: 0.85 }));
      board.position.set(hoop.x + 0.38, hoop.y + 0.3, hoop.z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hoop.y - floorY + 0.3, 12), mat(0x6d7d8c));
      pole.position.set(hoop.x + 1.0, (hoop.y + floorY) / 2 + 0.15, hoop.z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.05), mat(0x6d7d8c));
      arm.position.set(hoop.x + 0.69, hoop.y + 0.3, hoop.z);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.15, 0.4, 16, 1, true), mat(0xffffff, { wireframe: true, transparent: true, opacity: 0.7 }));
      net.position.set(hoop.x, hoop.y - 0.2, hoop.z);
      props.add(rim, board, pole, arm, net);
      dyn = { mo, update(phase) {
        const f = (phase - mo.release) / 0.3, d = (phase - mo.release - 0.3) / 0.15;
        ball.visible = phase < mo.release + 0.5;
        if (f <= 0) ball.position.copy(palms().add(new THREE.Vector3(0.08, 0.1, 0)));     // held in front of the hands
        else if (f <= 1) ball.position.copy(rel).lerp(hoop, f).add(new THREE.Vector3(0, 4 * 1.2 * f * (1 - f), 0));   // arc into the hoop
        else ball.position.set(hoop.x, hoop.y - Math.min(1, d) * (hoop.y - floorY - 0.12), hoop.z);               // drops through the net
      } };
    }
  }
  function buildProps(mo) {
    props.clear(); trace.clear();
    dyn = null;
    if (!mo) return;
    if (mo.prop === 'golf' || mo.prop === 'hoop' || mo.prop === 'tennis') { buildDynamic(mo); return; }
    if (mo.prop) {
      setPose(mo, mo.propAt || 0);
      const pel = boxOf(['pelvis']);
      if (mo.prop === 'stool') addBox(pel.min.x - 0.12, pel.max.x + 0.05, floorY, pel.min.y + 0.01, -0.22, 0.22);
      if (mo.prop === 'seat') {
        addBox(pel.min.x - 0.1, pel.max.x + 0.12, floorY + 0.1, pel.min.y + 0.01, -0.25, 0.25);
        const tor = boxOf(['torso']);
        addBox(-0.03, 0.03, 0, 0.6, -0.25, 0.25);
        const back = props.children[props.children.length - 1];
        back.position.set(tor.min.x - 0.02 - 0.15, pel.min.y + 0.3, 0);
        back.rotation.z = (coords.pelvis_tilt ? 22 : 0) * DEG;
      }
      if (mo.prop === 'bed') {
        const all = boxOf(Object.keys(meta.bodies).filter((n) => !n.startsWith('femur') && !n.startsWith('tibia') && !n.startsWith('talus') && !n.startsWith('calcn') && !n.startsWith('toes') && !n.startsWith('patella')));
        const pel = boxOf(['pelvis', 'torso']);
        addBox(all.min.x - 0.15, all.max.x + 0.9, floorY, pel.min.y + 0.005, -0.4, 0.4);
      }
    }
    if (mo.trace) {
      for (const s of ['r', 'l']) {
        const pts = [];
        for (let i = 0; i <= 48; i++) { setPose(mo, i / 48); pts.push(ptG(footPts[s].mid)); }
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        trace.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffb347 })));
      }
    }
  }

  // motions -----------------------------------------------------------
  const motions = [
    ...meta.motions.map((m) => ({ id: m.id, zh: '步行', en: 'Walking (motion capture)', dur: m.time[m.time.length - 1], data: m,
      anchor: { floorOnly: true }, groups: ['Calf (plantarflexors)', 'Quadriceps', 'Hamstrings', 'Gluteals & hip rotators'],
      note: '實際步態量測資料（一個步態週期）。點選肌肉看長度變化。Recorded gait, one cycle. Tap a muscle to watch its length change.' })),
    ...SYNTH,
  ];
  const toRad = (n, v) => (coords[n] && coords[n].rot ? v * DEG : v);
  function splines(mo) {
    const keys = [];
    mo.keys.forEach((k, i) => keys.push([k[0], k[1] === 'hold' ? keys[i - 1][1] : k[1]]));
    const t = keys.map((k) => k[0]);
    const rest = (n) => (!coords[n] ? 0 : mo.base && n in mo.base ? mo.base[n] : (coords[n].rot ? coords[n].default / DEG : coords[n].default));
    const ch = {};
    for (const n of new Set(keys.flatMap((k) => Object.keys(k[1])))) {
      const v = keys.map((k) => (n in k[1] ? k[1][n] : rest(n)));
      const d = v.slice(0, -1).map((x, j) => (v[j + 1] - x) / ((t[j + 1] - t[j]) || 1));
      const m = v.map((_, j) => (j === 0 || j === v.length - 1 || d[j - 1] * d[j] <= 0 ? 0 : (d[j - 1] + d[j]) / 2));
      for (let j = 0; j < d.length; j++) {     // Fritsch–Carlson limiter: keeps each segment monotone
        if (d[j] === 0) { m[j] = 0; m[j + 1] = 0; continue; }
        const a = m[j] / d[j], b = m[j + 1] / d[j], r = a * a + b * b;
        if (r > 9) { const k = 3 / Math.sqrt(r); m[j] = k * a * d[j]; m[j + 1] = k * b * d[j]; }
      }
      ch[n] = { v, m };
    }
    return { t, ch };
  }
  function setPose(mo, phase) {
    defaults();
    for (const k of Object.keys(X)) delete X[k];
    if (mo.base) for (const [n, v] of Object.entries(mo.base)) q[n] = toRad(n, v);
    if (mo.data) {
      const T = mo.data.time, t = phase * mo.dur;
      let i = 0;
      while (i < T.length - 2 && T[i + 1] < t) i++;
      const k = Math.max(0, Math.min(1, (t - T[i]) / ((T[i + 1] - T[i]) || 1)));
      for (const [n, arr] of Object.entries(mo.data.tracks)) q[n] = arr[i] + (arr[i + 1] - arr[i]) * k;
      if ('pelvis_ty' in mo.data.tracks) q.pelvis_ty = mo.data.tracks.pelvis_ty[i] + (mo.data.tracks.pelvis_ty[i + 1] - mo.data.tracks.pelvis_ty[i]) * k;
    } else if (mo.fn) {
      for (const [n, v] of Object.entries(mo.fn(phase))) { if (coords[n]) q[n] = toRad(n, v); else X[n] = v; }
    } else {
      // Key poses joined by a monotone cubic (Fritsch–Carlson) per channel: the motion keeps flowing
      // through intermediate keys (no stop at every pose, e.g. at golf impact) but never overshoots,
      // and holds / turning points still ease in and out.
      const spl = mo._spl || (mo._spl = splines(mo));
      const T = spl.t;
      let i = 0;
      while (i < T.length - 2 && T[i + 1] < phase) i++;
      const h = (T[i + 1] - T[i]) || 1, s = Math.max(0, Math.min(1, (phase - T[i]) / h));
      const h00 = 2 * s ** 3 - 3 * s * s + 1, h10 = s ** 3 - 2 * s * s + s, h01 = -2 * s ** 3 + 3 * s * s, h11 = s ** 3 - s * s;
      for (const [n, { v, m }] of Object.entries(spl.ch)) {
        const val = h00 * v[i] + h10 * h * m[i] + h01 * v[i + 1] + h11 * h * m[i + 1];
        if (!coords[n]) X[n] = val;             // extra animation channels, e.g. `lift` (metres off the floor for a jump)
        else q[n] = toRad(n, val);
      }
    }
    fk();
    anchor(mo.anchor);
    if (X.lift) ground.position.y += X.lift;
    if (dyn && dyn.mo === mo) dyn.update(phase);
  }
  const X = {};          // extra channels of the current pose
  let dyn = null;        // moving props (golf club & ball, basketball)

  const P = { mo: null, phase: 0, playing: false, speed: 1, dirty: true, manual: false };
  function chooseMotion(mo) {
    P.mo = mo; P.phase = 0; P.manual = false;
    ctx.onMotion?.(mo.id);
    buildProps(mo);
    setPose(mo, 0);
    P.playing = true; P.dirty = true;
    if (mo.view) {                       // sport scenes: frame the athlete together with the props (hoop, ball flight)
      root.updateMatrixWorld(true);
      ctx.frameObject(root, mo.view);
    }
    ui.sync();
  }
  function reset() {
    P.mo = null; P.playing = false; P.manual = false; P.phase = 0;
    props.clear(); trace.clear(); dyn = null;
    defaults(); fk(); anchor(null); P.dirty = true;
    for (const p of muscles) p.override = false;
    ui.sync();
  }

  // HUD -----------------------------------------------------------------
  const hud = document.getElementById('hud');
  const HUD_ROWS = [['髖 Hip', 'hip_flexion'], ['膝 Knee', 'knee_angle'], ['踝 Ankle', 'ankle_angle']];
  let hudOn = store.get('hud', true), hudT = 0;
  function updateHud() {
    hud.hidden = !hudOn || !active;
    if (hud.hidden) return;
    const f = (n) => Math.round(q[n] / DEG);
    hud.innerHTML = `<table><tr class="t"><td></td><td class="v">右 R</td><td class="v">左 L</td></tr>${
      HUD_ROWS.map(([l, n]) => `<tr><td>${l}</td><td class="v">${f(n + '_r')}°</td><td class="v">${f(n + '_l')}°</td></tr>`).join('')}</table>`;
  }

  // UI tabs -------------------------------------------------------------
  const sliders = {};
  const ui = { sync() {} };
  let active = false;

  function motionPane(pane) {
    const list = h('div', { class: 'motions' });
    const note = h('div', { class: 'preset-note' });
    const playBtn = h('button', { class: 'icon', 'aria-label': 'Play/pause 播放/暫停' }, '▶');
    const scrub = h('input', { type: 'range', min: 0, max: 1, step: 0.001, value: 0, 'aria-label': 'Position 進度' });
    const speeds = [0.25, 0.5, 1].map((s) => h('button', { 'data-s': s }, s + '×'));
    const hl = h('button', {}, '凸顯主要肌群 Highlight key muscles');
    const hudCb = h('input', { type: 'checkbox' });
    hudCb.checked = hudOn;
    hudCb.addEventListener('change', () => { hudOn = hudCb.checked; store.set('hud', hudOn); updateHud(); });
    for (const mo of motions) {
      const b = h('button', { 'data-id': mo.id, onclick: () => chooseMotion(mo) }, `${mo.zh} ${mo.en}`, h('small', {}, mo.note.split('。')[0] + '。'));
      list.append(b);
    }
    playBtn.addEventListener('click', () => { if (!P.mo) chooseMotion(motions[0]); else { P.playing = !P.playing; P.manual = false; } ui.sync(); });
    scrub.addEventListener('input', () => { if (!P.mo) return; P.playing = false; P.manual = false; P.phase = parseFloat(scrub.value); setPose(P.mo, P.phase); P.dirty = true; ui.sync(); });
    speeds.forEach((b) => b.addEventListener('click', () => { P.speed = parseFloat(b.dataset.s); ui.sync(); }));
    hl.addEventListener('click', () => { if (P.mo) highlightGroups(P.mo.groups); });
    pane.append(
      h('h3', {}, '動作示範 Exercise & gait'),
      list,
      h('div', { class: 'play' }, playBtn, scrub),
      h('div', { class: 'row-btns' }, ...speeds, hl),
      note,
      h('label', { class: 'toggle' }, hudCb, '顯示關節角度 Show joint angles'),
      h('p', { class: 'note' }, '肌肉路徑為簡化直線（未模擬包覆），僅供衛教說明。Muscle paths are straight-line simplifications for explanation only.'));
    const prev = ui.sync;
    ui.sync = () => {
      prev();
      $$('.motions button').forEach((b) => b.classList.toggle('on', P.mo?.id === b.dataset.id));
      playBtn.textContent = P.playing ? '❚❚' : '▶';
      scrub.value = P.phase;
      speeds.forEach((b) => b.classList.toggle('on', parseFloat(b.dataset.s) === P.speed));
      note.textContent = P.mo ? P.mo.note : '選一個動作開始。Choose an exercise to start.';
    };
  }

  function jointsPane(pane) {
    pane.append(h('p', { class: 'note' }, '拖動滑桿示範關節活動度；肌肉被拉長變黃、縮短變藍。Drag to demonstrate range of motion; muscles turn yellow when stretched, blue when shortened.'),
      h('div', { class: 'row-btns' }, h('button', { onclick: () => { reset(); } }, '回到站姿 Reset pose')));
    for (const [title, items] of JOINT_UI) {
      const box = h('div', { class: 'joint' }, h('h5', {}, title));
      for (const [n, lab] of items) {
        const c = coords[n];
        if (!c) continue;
        const val = h('b', {}, '0°');
        const inp = h('input', { type: 'range', min: (c.range[0] / DEG).toFixed(0), max: (c.range[1] / DEG).toFixed(0), step: 1, value: 0, 'aria-label': lab });
        inp.addEventListener('input', () => {
          if (P.mo && !P.manual) { P.playing = false; }
          P.manual = true;
          q[n] = parseFloat(inp.value) * DEG;
          const keep = { ...q };
          fk();
          Object.assign(q, keep);
          anchor(null);
          P.dirty = true;
          val.textContent = inp.value + '°';
          ui.sync();
        });
        sliders[n] = { inp, val };
        box.append(h('div', { class: 'slider' }, h('label', {}, lab, val), inp));
      }
      pane.append(box);
    }
    const prev = ui.sync;
    ui.sync = () => {
      prev();
      for (const [n, s] of Object.entries(sliders)) {
        const d = Math.round(q[n] / DEG);
        if (document.activeElement !== s.inp) s.inp.value = d;
        s.val.textContent = d + '°';
      }
    };
  }

  function highlightGroups(groups, side) {
    select(null);
    for (const p of parts.values()) {
      if (p.kind === 'bone') p.state = 'show';
      else p.state = p.mu.groups.some((g) => groups.includes(g)) && (!side || p.mu.side === side) ? 'show' : 'fade';
    }
    applyAll();
  }

  function musclePane(pane) {
    const modeBtns = [['stretch', '拉長／縮短 Stretch'], ['plain', '單色 Plain']].map(([m, l]) =>
      h('button', { 'data-m': m, onclick: () => { colorMode = m; store.set('muscleColor', m); recolorMuscles(); applyAll(); ui.sync(); } }, l));
    const fadeBones = h('input', { type: 'checkbox' });
    fadeBones.addEventListener('change', () => { for (const p of parts.values()) if (p.kind === 'bone') p.state = fadeBones.checked ? 'fade' : 'show'; applyAll(); });
    pane.append(h('h3', {}, '顏色 Colour'), h('div', { class: 'row-btns' }, ...modeBtns),
      h('div', { class: 'scale' }), h('div', { class: 'scale-l' }, h('span', {}, '縮短 −15%'), h('span', {}, '站姿長度'), h('span', {}, '拉長 +15%')),
      h('label', { class: 'toggle' }, fadeBones, '淡化骨骼 Fade bones'),
      h('h3', {}, '肌群 Muscle groups'));
    const chips = h('div', { class: 'chips' });
    chips.append(h('button', { onclick: () => { for (const p of parts.values()) p.state = 'show'; applyAll(); } }, '全部 All'));
    for (const g of meta.groups) chips.append(h('button', { onclick: () => highlightGroups([g]) }, `${GROUP_ZH[g] || g}`, h('small', {}, ' ' + g)));
    pane.append(chips, h('h3', {}, '肌肉 Muscles'));
    const listEl = h('div', { class: 'tree' });
    const bases = [...new Set(meta.muscles.map((m) => m.base))];
    for (const b of bases) {
      const pr = parts.get('mus:' + b + '_r'), pl = parts.get('mus:' + b + '_l');
      const pick = (p) => { if (p.state === 'hide') p.state = 'show'; select(p); };
      listEl.append(h('div', { class: 'row' },
        h('span', { class: 'nm' }, MUSCLE_ZH[b] || b, h('em', {}, pr.en.replace(/ \(right\)$/, ''))),
        h('button', { onclick: () => pick(pr) }, '右 R'), h('button', { onclick: () => pick(pl) }, '左 L')));
    }
    pane.append(listEl);
    const prev = ui.sync;
    ui.sync = () => { prev(); modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === colorMode)); };
  }

  const model = {
    id: 'move', root, parts, tree: [], credit: meta.credit, defaultView: 'iso-left',
    pathOf: (p) => [p.en],
    tabs: [
      { id: 'motion', zh: '動作', en: 'Exercise', build: motionPane },
      { id: 'joints', zh: '關節', en: 'Joints', build: jointsPane },
      { id: 'muscles', zh: '肌肉', en: 'Muscles', build: musclePane },
    ],
    activate() { active = true; ui.sync(); updateHud(); },
    deactivate() { active = false; hud.hidden = true; },
    reset() { reset(); },
    recolor() { recolorMuscles(); },
    beforePick() { for (const p of muscles) p.meshes[0].computeBoundingSphere(); },
    onFrame(dt) {
      if (P.playing && P.mo) {
        P.phase = (P.phase + dt * P.speed / P.mo.dur) % 1;
        setPose(P.mo, P.phase);
        P.dirty = true;
      }
      if (P.dirty) {
        updateMuscles();
        recolorMuscles();
        P.dirty = false;
        hudT += dt;
        if (hudT > 0.08 || !P.playing) { hudT = 0; updateHud(); refreshChipInfo(); ui.sync(); }
      }
    },
  };
  // initial pose
  fk();
  updateMuscles();
  recolorMuscles();
  root.updateMatrixWorld(true);
  return model;
}
