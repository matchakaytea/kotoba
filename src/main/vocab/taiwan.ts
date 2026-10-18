import type { DeckEntry } from './eggrolls';

/**
 * Rewrites the deck's Traditional Chinese into the words people in Taiwan
 * use. The deck is already mostly Taiwanese (計程車, 軟體, 冷氣機…); these
 * cover the mainland terms that slipped through.
 */

// Whole texts that need more than a word swap, usually because the swap would
// repeat a word the text already has (for example 默認，預設 → 預設，預設).
const REWRITES: Record<string, string> = {
  '物品；商品；質量': '物品；商品；品質',
  '（質量）低劣，下等，低級': '（品質）低劣，下等，低級',
  質量下降: '品質下降',
  '質的，質量的': '質的，品質上的',
  '水平，水準': '水準，程度',
  '水平高／低': '水準高／低',
  '語言水平，語言能力': '語言程度，語言能力',
  '不夠……水平；低於': '不夠……水準；低於',
  游泳水平提高: '游泳程度提高',
  智力水平: '智力水準',
  老師的魔術堪比專業水平: '老師的魔術堪比專業水準',
  '線；水平；航線': '線；水準；航線',
  '標準；平均水平': '標準；平均水準',
  '磁帶，錄音帶；窄長的布、紙等': '錄音帶；窄長的布、紙等',
  錄音磁帶: '錄音帶',
  盒式錄音磁帶: '卡式錄音帶',
  磁帶的反正面: '錄音帶的正反面',
  '拷貝磁帶；轉錄磁帶': '拷貝錄音帶；轉錄錄音帶',
  '機車，摩托車；腳踏車': '機車；腳踏車',
  '騎摩托車，騎機車': '騎機車',
  '簽名；信號，暗號': '簽名；訊號，暗號',
  '信號；紅綠燈，信號機': '訊號；紅綠燈，號誌',
  '改換裝潢，裝修': '改換裝潢，翻修',
  簡歷: '履歷表',
  介紹新作家的簡歷: '介紹新作家的簡介',
  '涼拌黃瓜；日式鹹黃瓜': '涼拌小黃瓜；日式醃小黃瓜',
  清除輸入的數據: '清除輸入的資料',
  不公布對政府不利的數據: '不公布對政府不利的資料',
  提取數據: '擷取資料',
  '（等級、品味、智能等的程度很高）高等':
    '（等級、品味、智力等的程度很高）高等',
  '電腦，計算機': '電腦',
  '（西式）賓館，旅館，飯店': '（西式）飯店，旅館',
  日式賓館: '日式旅館',
  '站台，月台': '月台',
  '（「プラットホーム」の略）站台，月台': '（「プラットホーム」の略）月台',
  '默認，預設；基本狀態': '預設；基本狀態',
  '鮭魚，大麻哈魚，三文魚': '鮭魚',
  '同鄉，老鄉': '同鄉',
  綜合體檢: '全身健康檢查',
  '橙子，柑橘': '柳橙，柑橘',
  載人航天: '載人太空飛行',
  '免洗筷，一次性筷子': '免洗筷',
};

// Word swaps that are safe anywhere they appear.
const WORDS: [string | RegExp, string][] = [
  ['自行車', '腳踏車'],
  ['塑料', '塑膠'],
  ['網絡', '網路'],
  ['空調', '冷氣'],
  ['摩托車', '機車'],
  ['信號燈', '紅綠燈'],
  ['信號', '訊號'],
  ['工資', '薪資'],
  ['簡歷', '履歷'],
  ['裝修', '裝潢'],
  [/(?<!小)黃瓜/g, '小黃瓜'],
  ['菜譜', '食譜'],
  ['小區', '社區'],
  ['煤氣', '瓦斯'],
  ['導彈', '飛彈'],
  ['智能手機', '智慧型手機'],
  ['性價比', 'CP值'],
  ['小伙子', '年輕人'],
  ['招聘', '聘請'],
  ['羽絨服', '羽絨外套'],
  ['卷子', '考卷'],
  ['外賣', '外帶'],
  ['默認', '預設'],
];

export function taiwanese(text: string): string {
  const rewrite = REWRITES[text];
  if (rewrite !== undefined) return rewrite;
  let result = text;
  for (const [from, to] of WORDS) {
    result =
      typeof from === 'string'
        ? result.replaceAll(from, to)
        : result.replace(from, to);
  }
  return result;
}

/** The entry with its Traditional Chinese meaning and examples in Taiwanese. */
export function taiwanEntry(entry: DeckEntry): DeckEntry {
  return {
    ...entry,
    meaningTc: taiwanese(entry.meaningTc),
    examples: entry.examples.map((example) => ({
      ...example,
      tc: taiwanese(example.tc),
    })),
  };
}
