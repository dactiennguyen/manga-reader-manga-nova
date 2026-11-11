/**
 * Loose reading of the traits people type for a character, in English, Vietnamese or Japanese. A trait is free
 * text, so this only looks for common words; anything it does not know is simply ignored.
 */
export type TraitKind =
  | 'brave'
  | 'shy'
  | 'funny'
  | 'cold'
  | 'kind'
  | 'smart'
  | 'lazy'
  | 'proud'
  | 'fiery'
  | 'loyal'
  | 'mysterious'
  | 'clumsy';

const WORDS: Record<TraitKind, string[]> = {
  brave: ['brave', 'bold', 'courage', 'fearless', 'heroic', 'dũng cảm', 'can đảm', 'gan dạ', 'gan góc', '勇敢', '勇気', '大胆', '強気'],
  shy: ['shy', 'timid', 'introvert', 'quiet', 'reserved', 'nhút nhát', 'rụt rè', 'e thẹn', 'ít nói', 'hướng nội', '内気', '人見知り', 'シャイ', '恥ずかしがり', '大人し'],
  funny: ['funny', 'cheerful', 'goofy', 'joker', 'playful', 'silly', 'witty', 'hài hước', 'vui tính', 'vui vẻ', 'tinh nghịch', 'lém lỉnh', '面白', 'ひょうきん', 'おちゃらけ', '明る', 'お調子者'],
  cold: ['cold', 'aloof', 'stoic', 'distant', 'cool', 'serious', 'lạnh lùng', 'lạnh nhạt', 'kiệm lời', 'nghiêm', '冷た', '冷静', 'クール', '無口', '無愛想'],
  kind: ['kind', 'gentle', 'caring', 'warm', 'sweet', 'helpful', 'tốt bụng', 'hiền', 'dịu dàng', 'tử tế', 'ân cần', '優し', '親切', '思いやり', '穏やか'],
  smart: ['smart', 'clever', 'genius', 'intelligent', 'wise', 'thông minh', 'lanh lợi', 'sáng dạ', 'thiên tài', 'khôn', '賢', '頭がいい', '天才', '知的', '聡明'],
  lazy: ['lazy', 'sleepy', 'laid-back', 'slacker', 'lười', 'uể oải', 'ham ngủ', '怠け', 'めんどくさ', 'ものぐさ', 'のんびり'],
  proud: ['proud', 'arrogant', 'cocky', 'vain', 'confident', 'kiêu ngạo', 'tự cao', 'kiêu', 'tự tin', '傲慢', 'プライド', '高慢', '自信家', '偉そう'],
  fiery: ['hot-headed', 'hotheaded', 'impulsive', 'reckless', 'angry', 'passionate', 'stubborn', 'nóng tính', 'nóng nảy', 'bốc đồng', 'liều', 'cứng đầu', '短気', '熱血', '怒りっぽ', '無鉄砲', '頑固'],
  loyal: ['loyal', 'faithful', 'devoted', 'trustworthy', 'trung thành', 'chung thủy', 'đáng tin', '忠実', '一途', '誠実', '義理堅'],
  mysterious: ['mysterious', 'secretive', 'enigmatic', 'cryptic', 'bí ẩn', 'kín đáo', 'khó đoán', '謎', 'ミステリアス', '秘密'],
  clumsy: ['clumsy', 'awkward', 'klutz', 'vụng về', 'hậu đậu', 'lóng ngóng', 'ドジ', '不器用', 'おっちょこちょい'],
};

export const TRAIT_KINDS = Object.keys(WORDS) as TraitKind[];

/** The kinds found in a character's traits, in the order the traits were written, without repeats. */
export function traitKinds(traits: readonly string[]): TraitKind[] {
  const found: TraitKind[] = [];
  for (const trait of traits) {
    const text = trait.toLowerCase().normalize('NFC');
    for (const kind of TRAIT_KINDS) {
      if (!found.includes(kind) && WORDS[kind].some(word => text.includes(word))) {
        found.push(kind);
      }
    }
  }
  return found;
}
