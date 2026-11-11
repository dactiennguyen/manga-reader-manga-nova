import type { CatalogPart } from '..';

/** Listening to a chapter and the story trailer. */
export const media: CatalogPart = {
  // Listen to a chapter
  'Listen to the chapter': { vi: 'Nghe chương này', ja: 'この話を聴く' },
  Narrator: { vi: 'Người dẫn chuyện', ja: 'ナレーター' },
  Someone: { vi: 'Ai đó', ja: '誰か' },
  'Reads from this line': { vi: 'Đọc từ câu này', ja: 'このセリフから読み上げます' },
  'Looking for a voice…': { vi: 'Đang tìm giọng đọc…', ja: '読み上げの声を探しています…' },
  'No voice to read with': { vi: 'Chưa có giọng đọc', ja: '読み上げの声がありません' },
  'Add a text-to-speech voice for this language in your device settings, then open this again.': {
    vi: 'Hãy thêm giọng đọc chuyển văn bản thành giọng nói cho ngôn ngữ này trong Cài đặt của máy, rồi mở lại.',
    ja: '端末の設定でこの言語の読み上げ音声を追加してから、もう一度開いてください。',
  },
  'Nothing to read yet': { vi: 'Chưa có gì để đọc', ja: 'まだ読むものがありません' },
  'Write a few lines of script for this chapter first.': {
    vi: 'Hãy viết vài dòng kịch bản cho chương này trước nhé.',
    ja: 'まずこの話の脚本を少し書いてみましょう。',
  },
  'The voice stopped. Tap play to try again.': {
    vi: 'Giọng đọc bị ngắt. Nhấn phát để thử lại.',
    ja: '読み上げが止まりました。再生をタップしてやり直してください。',
  },
  'Line {n} of {total}': { vi: 'Câu {n}/{total}', ja: '{total}行中 {n}行目' },
  'Previous line': { vi: 'Câu trước', ja: '前のセリフ' },
  'Next line': { vi: 'Câu tiếp theo', ja: '次のセリフ' },
  Speed: { vi: 'Tốc độ', ja: '速さ' },
  'Settings and actions': { vi: 'Bối cảnh và hành động', ja: '場面と動作' },

  // Story trailer
  'Story trailer': { vi: 'Trailer truyện', ja: '予告編' },
  '{seconds} seconds, made from your panels': {
    vi: '{seconds} giây, dựng từ các khung tranh của bạn',
    ja: 'あなたのコマで作った{seconds}秒の映像',
  },
  'Trailer of {title}': { vi: 'Trailer của {title}', ja: '「{title}」の予告編' },
  'Cutting the panels…': { vi: 'Đang dựng từ các khung tranh…', ja: 'コマを切り出しています…' },
  'Nothing to show yet': { vi: 'Chưa có gì để chiếu', ja: 'まだ見せるものがありません' },
  'Draw a few panels in this story, then come back for its trailer.': {
    vi: 'Hãy vẽ vài khung tranh cho truyện này, rồi quay lại xem trailer nhé.',
    ja: 'この作品でいくつかコマを描いたら、予告編を見に来てください。',
  },
  'A manga by {name}': { vi: 'Truyện tranh của {name}', ja: '{name} 作' },
  'A new manga': { vi: 'Một bộ truyện mới', ja: '新作マンガ' },
  'Made with Manganova': { vi: 'Làm bằng Manganova', ja: 'Manganovaで制作' },
  'Watch trailer': { vi: 'Xem trailer', ja: '予告編を見る' },
  'Watch the trailer of {title}': { vi: 'Xem trailer của {title}', ja: '「{title}」の予告編を見る' },
  'Your latest page': { vi: 'Trang mới nhất của bạn', ja: 'いちばん新しいページ' },
};
