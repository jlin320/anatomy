// Traditional Chinese names for structures. Keys are lower-case English names with
// "left/right" removed; zhName() adds 左/右 back. Unknown names fall back to English only.
const Z = {
  // brain – groups
  'brain': '腦', 'rhombencephalon': '菱腦', 'metencephalon': '後腦', 'prosencephalon': '前腦',
  'diencephalon': '間腦', 'telencephalon': '端腦', 'midbrain': '中腦', 'epithalamus': '上視丘',
  'hypothalamus': '下視丘', 'thalamus': '視丘', 'metathalamus': '後視丘', 'cerebral hemisphere': '大腦半球',
  'frontal lobe': '額葉', 'parietal lobe': '頂葉', 'temporal lobe': '顳葉', 'occipital lobe': '枕葉',
  'limbic lobe': '邊緣葉', 'insula': '腦島', 'cerebellum': '小腦', 'hemisphere of cerebellum': '小腦半球',
  'vermis': '蚓部', 'subcortex of cerebral hemisphere': '大腦皮質下', 'lentiform nucleus': '豆狀核',
  'globus pallidus': '蒼白球', 'striatum of cerebral hemisphere': '紋狀體', 'lateral ventricle': '側腦室',
  'inferior parietal lobule': '下頂小葉', 'inferior frontal gyrus': '下額回', 'middle frontal gyrus': '中額回',
  'cingulate gyrus': '扣帶回', 'anterior cingulate gyrus': '前扣帶回', 'side of midbrain': '中腦',
  'neurohypophysis': '神經垂體', 'septum of telencephalon': '透明中隔區',
  'lateral nuclear group': '外側核群', 'ventral nuclear group': '腹側核群',
  // brain – structures
  'pons': '橋腦', 'medulla oblongata': '延腦', 'fourth ventricle': '第四腦室', 'third ventricle': '第三腦室',
  'aqueduct': '中腦導水管', 'optic tract': '視徑', 'optic nerve': '視神經', 'optic chiasm': '視交叉',
  'mammillothalamic tract': '乳頭視丘徑', 'mammillary body': '乳頭體', 'pineal body': '松果體',
  'adenohypophysis': '腺垂體（腦下垂體前葉）', 'infundibulum of neurohypophysis': '漏斗',
  'subthalamic nucleus': '視丘下核', 'pulvinar': '枕核', 'medial geniculate body': '內側膝狀體',
  'lateral geniculate body': '外側膝狀體', 'anterior thalamic nucleus': '視丘前核',
  'dorsomedial thalamic nucleus': '背內側核', 'centromedian thalamic nucleus': '中央中核',
  'ventral lateral thalamic nucleus': '腹外側核', 'ventral anterior thalamic nucleus': '腹前核',
  'ventral posterolateral thalamic nucleus': '腹後外側核', 'ventral posteromedial thalamic nucleus': '腹後內側核',
  'pellucid septum': '透明中隔', 'fornix of forebrain': '穹窿', 'putamen': '殼核',
  'globus pallidus pars externa': '蒼白球外節', 'globus pallidus pars interna': '蒼白球內節',
  'nucleus accumbens': '依核', 'caudate nucleus': '尾核', 'white matter of cerebral hemisphere': '大腦白質',
  'superior parietal lobule': '上頂小葉', 'precuneus': '楔前葉', 'postcentral gyrus': '中央後回（感覺皮質）',
  'supramarginal gyrus': '緣上回', 'superior temporal gyrus': '上顳回', 'middle temporal gyrus': '中顳回',
  'inferior temporal gyrus': '下顳回', 'transverse temporal gyrus': '顳橫回（聽覺皮質）',
  'fusiform gyrus': '梭狀回', 'temporal pole': '顳極', 'claustrum': '屏狀核',
  'triangular part of inferior frontal gyrus': '下額回三角部（布洛卡區）',
  'opercular part of inferior frontal gyrus': '下額回蓋部（布洛卡區）',
  'orbital part of inferior frontal gyrus': '下額回眶部', 'precentral gyrus': '中央前回（運動皮質）',
  'straight gyrus': '直回', 'paracentral lobule': '旁中央小葉', 'superior frontal gyrus': '上額回',
  'frontal pole': '額極', 'central sulcus': '中央溝', 'lateral orbital gyrus': '外側眶回',
  'hippocampus': '海馬', 'amygdala': '杏仁核', 'parahippocampal gyrus': '海馬旁回',
  'posterior cingulate gyrus': '後扣帶回', 'cuneus': '楔葉', 'visual cortex': '視覺皮質',
  'lingual gyrus': '舌回', 'lateral occipital gyrus': '外側枕回', 'calcarine sulcus': '距狀溝',
  'anterior commissure': '前連合', 'corpus callosum': '胼胝體', 'substantia nigra': '黑質',
  'red nucleus': '紅核', 'superior colliculus': '上丘', 'inferior colliculus': '下丘',
  'dentate-nucleus': '齒狀核', 'white matter of hemisphere of cerebellum': '小腦白質',
  'temporal horn of lateral ventricle': '側腦室顳角',
  // organs (Z-Anatomy whole body)
  'liver': '肝臟', 'stomach': '胃', 'spleen': '脾臟', 'pancreas': '胰臟', 'gallbladder': '膽囊', 'kidney': '腎臟',
  'transverse colon': '橫結腸', 'ascending colon': '升結腸', 'descending colon': '降結腸', 'sigmoid colon': '乙狀結腸',
  'jejunum': '空腸', 'oesophagus': '食道', 'urinary bladder': '膀胱', 'ureter': '輸尿管', 'urethra': '尿道', 'prostate': '攝護腺',
  'trachea': '氣管', 'thyroid gland': '甲狀腺', 'heart': '心臟', 'tongue': '舌', 'thymus': '胸腺', 'suprarenal gland': '腎上腺',
  'palatine tonsil': '顎扁桃腺', 'soft palate': '軟顎', 'uvula of palate': '懸雍垂', 'epiglottis': '會厭',
  'nasopharynx': '鼻咽', 'oropharynx': '口咽', 'laryngopharynx': '喉咽', 'median nerve': '正中神經', 'ulnar nerve': '尺神經',
  'radial nerve': '橈神經', 'sciatic nerve': '坐骨神經', 'femoral nerve': '股神經',
  // brain-supplying arteries
  'aortic arch': '主動脈弓', 'brachiocephalic trunk': '頭臂動脈幹', 'subclavian artery': '鎖骨下動脈',
  'common carotid artery': '總頸動脈', 'internal carotid artery': '內頸動脈', 'external carotid artery': '外頸動脈',
  'vertebral artery': '椎動脈', 'basilar artery': '基底動脈', 'cerebral arterial circle': '威利氏環',
  'anterior cerebral artery': '前大腦動脈', 'anterior communicating artery': '前交通動脈',
  'middle cerebral artery (m1-segment)': '中大腦動脈（M1 段）', 'insular branches of middle cerebral artery (m2-segment)': '中大腦動脈（M2 段）',
  'insular branches of middle cerebral artery (m2)': '中大腦動脈（M2 段）', 'posterior communicating artery': '後交通動脈',
  'posterior cerebral artery': '後大腦動脈', 'ophthalmic artery': '眼動脈', 'superior cerebellar artery': '上小腦動脈',
  'anterior inferior cerebellar artery': '小腦前下動脈', 'posterior inferior cerebellar artery': '小腦後下動脈',
  // muscles (OpenSim)
  'adductor brevis': '內收短肌', 'adductor longus': '內收長肌', 'adductor magnus': '內收大肌',
  'biceps femoris long head': '股二頭肌長頭', 'biceps femoris short head': '股二頭肌短頭',
  'extensor digitorum longus': '伸趾長肌', 'extensor hallucis longus': '伸拇長肌',
  'flexor digitorum longus': '屈趾長肌', 'flexor hallucis longus': '屈拇長肌',
  'gastrocnemius lateral': '腓腸肌外側頭', 'gastrocnemius medial': '腓腸肌內側頭',
  'gluteus maximus': '臀大肌', 'gluteus medius': '臀中肌', 'gluteus minimus': '臀小肌', 'gracilis': '股薄肌',
  'iliacus': '髂肌', 'peroneus brevis': '腓骨短肌', 'peroneus longus': '腓骨長肌', 'piriformis': '梨狀肌',
  'psoas major': '腰大肌', 'rectus femoris': '股直肌', 'sartorius': '縫匠肌', 'semimembranosus': '半膜肌',
  'semitendinosus': '半腱肌', 'soleus': '比目魚肌', 'tensor fasciae latae': '闊筋膜張肌',
  'tibialis anterior': '脛前肌', 'tibialis posterior': '脛後肌', 'vastus intermedius': '股中間肌',
  'vastus lateralis': '股外側肌', 'vastus medialis': '股內側肌',
  // bones (OpenSim geometry)
  'pelvis': '骨盆', 'sacrum': '薦骨', 'femur': '股骨', 'tibia': '脛骨', 'fibula': '腓骨', 'patella': '髕骨',
  'talus': '距骨', 'foot': '足骨', 'calcn': '跟骨', 'toes': '腳趾', 'bofoot': '足骨', 'humerus': '肱骨',
  'ulna': '尺骨', 'radius': '橈骨', 'hand': '手', 'torso': '軀幹', 'hat_spine': '脊椎', 'hat_ribs_scap': '肋骨與肩胛',
  'hat_skull': '顱骨', 'hat_jaw': '下顎骨', 'hat_ribs': '肋骨', 'lumbar': '腰椎',
};

const SIDE = [[/^(left|l)[\s_-]+/i, '左'], [/^(right|r)[\s_-]+/i, '右'], [/[\s_-]+(left|l)$/i, '左'], [/[\s_-]+(right|r)$/i, '右']];

export function zhName(en) {
  if (!en) return '';
  let s = en.trim(), side = '', suffix = '';
  s = s.replace(/\s*\((left|right)\)$/i, (m, g) => { side = g.toLowerCase() === 'left' ? '左' : '右'; return ''; });
  s = s.replace(/\s*\((superior|middle|inferior|anterior|posterior|distal|ischial|proximal)\)$/i, (m, g) => {
    const k = { superior: '上部', middle: '中部', inferior: '下部', anterior: '前部', posterior: '後部', distal: '遠端', ischial: '坐骨部', proximal: '近端' };
    suffix = k[g.toLowerCase()]; return '';
  });
  let base = s.toLowerCase();
  // "triangular part of left inferior frontal gyrus" -> side inside the phrase
  base = base.replace(/\b(left|right)\s+/, (m, g) => { if (!side) side = g === 'left' ? '左' : '右'; return ''; });
  for (const [re, zh] of SIDE) if (re.test(base)) { if (!side) side = zh; base = base.replace(re, ''); }
  base = base.replace(/\s*\(banks of .*\)$/, '').trim();
  const hit = Z[base];
  return hit ? side + hit + (suffix ? '（' + suffix + '）' : '') : '';
}
