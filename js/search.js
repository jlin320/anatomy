// Quick search: find a muscle, organ, nerve, bone or vessel by Chinese, English or a common
// abbreviation and highlight it on the model. Results merge the left and right copies of a structure
// and the clinical shortcuts below (e.g. 腿後肌 → the three hamstrings).
import { zhName } from './zh.js';

// [keys (Chinese / lay / abbreviation), label, English name patterns (regex on the name without side)]
const ALIASES = [
  // organs
  [['肝', '肝臟'], '肝臟 Liver', ['^liver$']], [['膽囊'], '膽囊 Gallbladder', ['^gallbladder$']],
  [['胃'], '胃 Stomach', ['^stomach$']], [['脾', '脾臟'], '脾臟 Spleen', ['^spleen$']],
  [['胰', '胰臟'], '胰臟 Pancreas', ['^pancreas$']], [['腎', '腎臟'], '腎臟 Kidney', ['^kidney$']],
  [['腎上腺'], '腎上腺 Adrenal gland', ['^suprarenal gland$']], [['輸尿管'], '輸尿管 Ureter', ['^ureter$']],
  [['膀胱'], '膀胱 Urinary bladder', ['^urinary bladder$']], [['攝護腺', '前列腺'], '攝護腺 Prostate', ['^prostate$']],
  [['心', '心臟'], '心臟 Heart', ['^heart$']], [['肺', '肺臟'], '肺 Lungs', ['^lung$']],
  [['食道'], '食道 Oesophagus', ['^oesophagus$']], [['十二指腸'], '十二指腸 Duodenum', ['^duodenum$']],
  [['小腸'], '小腸 Small intestine', ['^small intestine$', '^jejunum$', '^ileum$']],
  [['大腸', '結腸'], '大腸 Large intestine', ['^large intestine$', 'colon$', '^caecum$', '^rectum$']],
  [['盲腸', '闌尾'], '闌尾 Appendix', ['appendix']], [['直腸'], '直腸 Rectum', ['^rectum$']],
  [['甲狀腺'], '甲狀腺 Thyroid gland', ['^thyroid gland$']], [['氣管'], '氣管 Trachea', ['^trachea$']],
  [['喉', '喉頭'], '喉 Larynx', ['^larynx$']], [['舌', '舌頭'], '舌 Tongue', ['^tongue$']],
  [['子宮'], '子宮 Uterus', ['^uterus$']], [['卵巢'], '卵巢 Ovary', ['^ovary$']], [['睪丸'], '睪丸 Testis', ['^testis$']],
  [['腦'], '腦 Brain', ['^brain$']], [['脊髓'], '脊髓 Spinal cord', ['^spinal cord$']], [['眼', '眼球'], '眼球 Eyeball', ['^eyeball$']],
  [['扁桃腺'], '扁桃腺 Tonsils', ['tonsil$']], [['淋巴結'], '淋巴結 Lymph nodes', ['lymph node']],
  // muscles
  [['二頭肌', '肱二頭肌'], '肱二頭肌 Biceps brachii', ['^biceps brachii$']], [['三頭肌', '肱三頭肌'], '肱三頭肌 Triceps brachii', ['^triceps brachii$']],
  [['三角肌'], '三角肌 Deltoid', ['^deltoid$']], [['斜方肌'], '斜方肌 Trapezius', ['^trapezius$']],
  [['闊背肌', '背闊肌'], '闊背肌 Latissimus dorsi', ['^latissimus dorsi$']], [['胸大肌'], '胸大肌 Pectoralis major', ['^pectoralis major$']],
  [['胸鎖乳突肌'], '胸鎖乳突肌 Sternocleidomastoid', ['^sternocleidomastoid$']],
  [['旋轉肌', '旋轉肌袖', 'rotator cuff'], '旋轉肌袖 Rotator cuff', ['^supraspinatus$', '^infraspinatus$', '^teres minor$', '^subscapularis$']],
  [['棘上肌'], '棘上肌 Supraspinatus', ['^supraspinatus$']],
  [['腹直肌'], '腹直肌 Rectus abdominis', ['^rectus abdominis$']], [['腹斜肌'], '腹斜肌 Abdominal obliques', ['abdominal oblique']],
  [['橫膈', '橫膈膜'], '橫膈 Diaphragm', ['^diaphragm$']], [['豎脊肌', '豎棘肌'], '豎脊肌 Erector spinae', ['^erector spinae$', '^iliocostalis', '^longissimus', '^spinalis']],
  [['多裂肌'], '多裂肌 Multifidus', ['^multifidus']], [['腰方肌'], '腰方肌 Quadratus lumborum', ['^quadratus lumborum$']],
  [['髂腰肌', '腰大肌'], '髂腰肌 Iliopsoas', ['^iliopsoas$', '^psoas major$', '^iliacus$']],
  [['臀大肌'], '臀大肌 Gluteus maximus', ['^gluteus maximus( \\(.*\\))?$']], [['臀中肌'], '臀中肌 Gluteus medius', ['^gluteus medius( \\(.*\\))?$']],
  [['梨狀肌'], '梨狀肌 Piriformis', ['^piriformis$']],
  [['股四頭肌', 'quadriceps', 'quads'], '股四頭肌 Quadriceps', ['^quadriceps femoris$', '^rectus femoris$', '^vastus (lateralis|medialis|intermedius)$']],
  [['腿後肌', '膕旁肌', '大腿後肌', 'hamstring', 'hamstrings'], '腿後肌群 Hamstrings', ['^biceps femoris$', '^(long|short) head of biceps femoris$', '^semitendinosus$', '^semimembranosus$']],
  [['內收肌'], '內收肌群 Adductors', ['^adductor (longus|brevis|magnus|minimus)$']],
  [['小腿肚', '腓腸肌'], '腓腸肌 Gastrocnemius', ['^(lateral|medial) head of gastrocnemius$', '^gastrocnemius$']], [['比目魚肌'], '比目魚肌 Soleus', ['^soleus$']],
  [['脛前肌'], '脛前肌 Tibialis anterior', ['^tibialis anterior$']], [['咀嚼肌', '咬肌'], '咬肌 Masseter', ['^masseter$']],
  // nerves
  [['正中神經'], '正中神經 Median nerve', ['^median nerve$']], [['尺神經'], '尺神經 Ulnar nerve', ['^ulnar nerve$']],
  [['橈神經'], '橈神經 Radial nerve', ['^radial nerve$']], [['坐骨神經'], '坐骨神經 Sciatic nerve', ['^sciatic nerve$']],
  [['股神經'], '股神經 Femoral nerve', ['^femoral nerve$']], [['脛神經'], '脛神經 Tibial nerve', ['^tibial nerve$']],
  [['腓神經', '腓總神經'], '腓總神經 Common fibular nerve', ['^common fibular nerve$']],
  [['臂神經叢'], '臂神經叢 Brachial plexus', ['^brachial plexus$']], [['腰神經叢'], '腰神經叢 Lumbar plexus', ['^lumbar plexus$']],
  [['薦神經叢'], '薦神經叢 Sacral plexus', ['^sacral plexus$']],
  [['顏面神經', '面神經'], '顏面神經 Facial nerve', ['^facial nerve$']], [['三叉神經'], '三叉神經 Trigeminal nerve', ['^trigeminal nerve$']],
  [['迷走神經'], '迷走神經 Vagus nerve', ['^vagus nerve$']], [['膈神經'], '膈神經 Phrenic nerve', ['^phrenic nerve$']],
  [['視神經'], '視神經 Optic nerve', ['^optic nerve$']], [['腋神經'], '腋神經 Axillary nerve', ['^axillary nerve$']],
  [['肌皮神經'], '肌皮神經 Musculocutaneous nerve', ['^musculocutaneous nerve$']], [['閉孔神經'], '閉孔神經 Obturator nerve', ['^obturator nerve$']],
  // bones & joints
  [['股骨'], '股骨 Femur', ['^femur$']], [['脛骨'], '脛骨 Tibia', ['^tibia$']], [['腓骨'], '腓骨 Fibula', ['^fibula$']],
  [['肱骨'], '肱骨 Humerus', ['^humerus$']], [['橈骨'], '橈骨 Radius', ['^radius$']], [['尺骨'], '尺骨 Ulna', ['^ulna$']],
  [['肩胛骨'], '肩胛骨 Scapula', ['^scapula$']], [['鎖骨'], '鎖骨 Clavicle', ['^clavicle$']], [['髕骨', '膝蓋骨'], '髕骨 Patella', ['^patella$']],
  [['骨盆', '髖骨'], '髖骨 Hip bone', ['^hip bone$']], [['薦骨'], '薦骨 Sacrum', ['^sacrum$']], [['尾骨'], '尾骨 Coccyx', ['^coccyx$']],
  [['胸骨'], '胸骨 Sternum', ['^sternum$']], [['下顎骨'], '下顎骨 Mandible', ['^mandible$']], [['跟骨'], '跟骨 Calcaneus', ['^calcaneus$']],
  [['距骨'], '距骨 Talus', ['^talus$']], [['頸椎'], '頸椎 Cervical vertebrae', ['^vertebra c[1-7]$', '^atlas', '^axis']],
  [['胸椎'], '胸椎 Thoracic vertebrae', ['^vertebra t([1-9]|1[0-2])$']], [['腰椎'], '腰椎 Lumbar vertebrae', ['^vertebra l[1-5]$']],
  [['椎間盤'], '椎間盤 Intervertebral discs', ['intervertebral dis']],
  [['前十字韌帶', 'acl'], '前十字韌帶 ACL', ['^anterior cruciate ligament']], [['後十字韌帶', 'pcl'], '後十字韌帶 PCL', ['^posterior cruciate ligament']],
  [['內側副韌帶', 'mcl'], '內側副韌帶 MCL', ['^tibial collateral ligament']], [['外側副韌帶', 'lcl'], '外側副韌帶 LCL', ['^fibular collateral ligament']],
  [['半月板'], '半月板 Menisci', ['meniscus$']], [['阿基里斯腱', '跟腱', 'achilles'], '跟腱 Achilles tendon', ['^calcaneal tendon']],
  [['足底筋膜'], '足底筋膜 Plantar fascia', ['^plantar aponeurosis']], [['腕隧道', 'carpal tunnel'], '腕隧道（屈肌支持帶）Carpal tunnel', ['^flexor retinaculum']],
  // vessels
  [['主動脈'], '主動脈 Aorta', ['^aorta$']], [['下腔靜脈', 'ivc'], '下腔靜脈 IVC', ['^inferior vena cava$']], [['上腔靜脈', 'svc'], '上腔靜脈 SVC', ['^superior vena cava$']],
  [['頸動脈', 'cca'], '總頸動脈 CCA', ['^common carotid artery$']], [['內頸動脈', 'ica'], '內頸動脈 ICA', ['^internal carotid artery$']],
  [['外頸動脈', 'eca'], '外頸動脈 ECA', ['^external carotid artery$']], [['椎動脈', 'va'], '椎動脈 VA', ['^vertebral artery$']],
  [['基底動脈'], '基底動脈 Basilar artery', ['^basilar artery$']], [['中大腦動脈', 'mca'], '中大腦動脈 MCA', ['^middle cerebral artery']],
  [['前大腦動脈', 'aca'], '前大腦動脈 ACA', ['^anterior cerebral artery$']], [['後大腦動脈', 'pca'], '後大腦動脈 PCA', ['^posterior cerebral artery$']],
  [['威利氏環'], '威利氏環 Circle of Willis', ['^cerebral arterial circle$']], [['冠狀動脈'], '冠狀動脈 Coronary arteries', ['coronary artery$']],
  [['頸靜脈'], '頸靜脈 Jugular veins', ['jugular vein$']], [['股動脈'], '股動脈 Femoral artery', ['^femoral artery$']],
  [['頭靜脈'], '頭靜脈 Cephalic vein', ['^cephalic vein$']], [['橈動脈'], '橈動脈 Radial artery', ['^radial artery$']],
];
const SYSTEM_ZH = {
  'Skeletal system': '骨骼', Joints: '關節韌帶', 'Muscular system': '肌肉', 'Cardiovascular system': '血管',
  'Lymphoid organs': '淋巴', 'Nervous system & Sense organs': '神經', 'Visceral systems': '內臟', 'Regions of human body': '體表',
};
const SIDE = /\s*\((left|right)\)\s*$|^(right|left)\s+/gi;

function buildIndex(model) {
  const map = new Map();
  const add = (name, parts, isLeaf, top, depth) => {
    const base = name.replace(SIDE, '').trim();
    const key = base.toLowerCase();
    let e = map.get(key);
    if (!e) {
      // `bare`: the name without Z-Anatomy's trailing "muscle" ("Biceps brachii muscle" -> "biceps brachii")
      e = { key, bare: key.replace(/\s+muscles?$/, ''), en: base, zh: zhName(base) || zhName(name).replace(/^[左右]/, ''),
        leaf: new Set(), group: new Set(), names: new Set(), top, depth };
      map.set(key, e);
    }
    e.names.add(name);
    parts.forEach((p) => e[isLeaf ? 'leaf' : 'group'].add(p));
    e.depth = Math.min(e.depth, depth);
  };
  const leaves = (n, out = []) => { if (n.part) out.push(n.part); if (n.children) n.children.forEach((c) => leaves(c, out)); return out; };
  const walk = (n, top, depth) => {
    add(n.name, leaves(n), !!n.part, top, depth);
    if (n.children) n.children.forEach((c) => walk(c, top, depth + 1));
  };
  if (model.tree && model.tree.length) model.tree.forEach((t) => t.children?.forEach((c) => walk(c, t.name, 1)));
  else for (const p of model.parts.values()) add(p.en, [p], true, '', 1);
  // A vessel, nerve or organ often exists both as its own mesh (the trunk / whole organ) and as a group
  // of that mesh plus its branches or segments: the name means the single mesh.
  return [...map.values()].map((e) => ({ ...e, parts: e.leaf.size ? e.leaf : e.group,
    sides: [...e.names].filter((n) => /\((left|right)\)\s*$|^(right|left)\s/i.test(n)).length }));
}

export function searchModel(model, query, limit = 40) {
  const s = query.trim().toLowerCase();
  if (!s) return [];
  const index = model._searchIndex || (model._searchIndex = buildIndex(model));
  const out = [];
  // clinical shortcuts / Chinese names
  for (const [keys, label, pats] of ALIASES) {
    const exact = keys.some((k) => k.toLowerCase() === s);
    if (!exact && !keys.some((k) => k.toLowerCase().includes(s) || (s.length > 1 && s.includes(k.toLowerCase())))) continue;
    const res = pats.map((p) => new RegExp(p, 'i'));
    const parts = new Set();
    for (const e of index) if (res.some((r) => r.test(e.bare))) e.parts.forEach((p) => parts.add(p));
    if (parts.size) out.push({ label, parts, score: exact ? 120 : 95, alias: true });
  }
  const wordStart = (t) => t.startsWith(s) || t.includes(' ' + s) || t.includes('(' + s);
  for (const e of index) {
    let sc = 0;
    if (e.key === s || e.bare === s || e.zh === query.trim()) sc = 100;
    else if (e.key.startsWith(s)) sc = 85;
    else if (e.zh && e.zh.includes(query.trim())) sc = 75;
    else if (wordStart(e.key)) sc = 65;
    else if (s.length >= 3 && e.key.includes(s)) sc = 45;
    if (!sc) continue;
    out.push({ label: e.zh ? `${e.zh} ${e.en}` : e.en, en: e.en, parts: e.parts, score: sc, top: e.top, sides: e.sides });
  }
  // same set of structures found twice (alias + its own name): keep the better one
  const seen = new Map();
  for (const r of out) {
    const sig = r.parts.size + ':' + [...r.parts].slice(0, 3).map((p) => p.pid).join(',');
    const prev = seen.get(sig);
    if (!prev || r.score > prev.score) seen.set(sig, r);
  }
  return [...seen.values()]
    // same score: the shorter (more basic) name first — "Median nerve" before "Median cricothyroid ligament"
    .sort((a, b) => b.score - a.score || (a.en || a.label).length - (b.en || b.label).length || a.parts.size - b.parts.size)
    .slice(0, limit)
    .map((r) => ({ ...r, meta: [r.top ? SYSTEM_ZH[r.top] || r.top : '', r.sides >= 2 ? '左右兩側 both sides' : '', r.parts.size > 2 && !(r.sides >= 2 && r.parts.size === 2) ? `${r.parts.size} 個構造 parts` : '']
      .filter(Boolean).join(' · ') }));
}
