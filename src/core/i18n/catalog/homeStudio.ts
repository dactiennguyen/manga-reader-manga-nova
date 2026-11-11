import type { CatalogPart } from '..';

/** The studio cards on Home: editor, characters, prompt, streak, journey, magazine, club, letters, badges, progress, gifts. */
export const homeStudio: CatalogPart = {
  // Editor and character messages
  'Hide the note for today': { vi: 'Ẩn lời nhắn hôm nay', ja: '今日のメモを隠す' },
  '{name} says: {text}': { vi: '{name} nhắn: {text}', ja: '{name}より：{text}' },
  'Hide messages for today': { vi: 'Ẩn tin nhắn hôm nay', ja: '今日のメッセージを隠す' },

  // Prompt and streak
  "Today's prompt": { vi: 'Đề bài hôm nay', ja: '今日のお題' },
  'Do it': { vi: 'Làm ngay', ja: 'やってみる' },
  'Done for today': { vi: 'Hôm nay xong rồi', ja: '今日はクリア' },
  '{drawn}/{goal} today': { vi: 'Hôm nay {drawn}/{goal}', ja: '今日 {drawn}/{goal}' },
  '{count} stroke today': { vi: 'Hôm nay {count} nét', ja: '今日 {count}ストローク' },
  '{count} strokes today': { vi: 'Hôm nay {count} nét', ja: '今日 {count}ストローク' },

  // Journey
  'You reached {level}!': { vi: 'Bạn đã lên {level}!', ja: '{level}に到達しました！' },
  'New level': { vi: 'Cấp mới', ja: '新しいレベル' },
  'The last level. Every page from here is a victory lap.': {
    vi: 'Cấp cao nhất rồi. Từ giờ, mỗi trang là một vòng chạy ăn mừng.',
    ja: '最高レベルです。ここからの一枚一枚がウイニングランです。',
  },
  'See journey': { vi: 'Xem hành trình', ja: '道のりを見る' },
  '{count} Studio point': { vi: '{count} điểm Studio', ja: '{count} スタジオポイント' },
  '{count} Studio points': { vi: '{count} điểm Studio', ja: '{count} スタジオポイント' },

  // Character cards
  'Create a character and get their card': { vi: 'Tạo một nhân vật để nhận thẻ nhân vật', ja: 'キャラクターを作るとカードがもらえます' },

  // Magazine and club
  'Issue no. {n}': { vi: 'Số {n}', ja: '第{n}号' },
  'A new issue comes out today': { vi: 'Hôm nay ra số mới', ja: '今日は新しい号の発売日' },
  'Next issue in {count} day': { vi: 'Còn {count} ngày nữa ra số mới', ja: '次の号まであと{count}日' },
  'Next issue in {count} days': { vi: 'Còn {count} ngày nữa ra số mới', ja: '次の号まであと{count}日' },
  'Write or draw a chapter and the club will rank it here.': {
    vi: 'Viết hoặc vẽ một chương, hội đọc thử sẽ xếp hạng ở đây.',
    ja: '章を書くか描くと、読書クラブがここで順位をつけます。',
  },
  'Write a scene and the club will read it and vote.': {
    vi: 'Viết một cảnh, hội đọc thử sẽ đọc và chấm điểm.',
    ja: 'シーンを書くと、クラブが読んで投票します。',
  },
  Letters: { vi: 'Thư', ja: '手紙' },
  '{name}: {subject}': { vi: '{name}: {subject}', ja: '{name}：{subject}' },
  'The reading club writes to you when you finish pages and chapters.': {
    vi: 'Hội đọc thử sẽ gửi thư cho bạn mỗi khi bạn hoàn thành trang và chương.',
    ja: 'ページや章を仕上げると、読書クラブから手紙が届きます。',
  },

  // Badges
  'Next badges': { vi: 'Huy hiệu sắp đạt', ja: '次のバッジ' },
  New: { vi: 'Mới', ja: '新着' },

  // Progress
  'Your progress': { vi: 'Tiến bộ của bạn', ja: 'あなたの成長' },
  'Your first drawn page': { vi: 'Trang đầu tiên bạn vẽ', ja: '最初に描いたページ' },
  'Latest page': { vi: 'Trang mới nhất', ja: '最新のページ' },
  'Draw another page and see them side by side.': {
    vi: 'Vẽ thêm một trang để xem hai trang cạnh nhau.',
    ja: 'もう一枚描くと、並べて見比べられます。',
  },
  'Both drawn on the same day.': { vi: 'Cả hai trang được vẽ trong cùng một ngày.', ja: 'どちらも同じ日に描いたページです。' },
  '{count} day of practice between them.': { vi: 'Hai trang cách nhau {count} ngày luyện tập.', ja: '二枚の間に{count}日の練習。' },
  '{count} days of practice between them.': { vi: 'Hai trang cách nhau {count} ngày luyện tập.', ja: '二枚の間に{count}日の練習。' },
  'On this day {count} day ago': { vi: 'Đúng ngày này, {count} ngày trước', ja: '{count}日前の今日' },
  'On this day {count} days ago': { vi: 'Đúng ngày này, {count} ngày trước', ja: '{count}日前の今日' },

  // Gifts
  'You unlocked': { vi: 'Bạn đã mở khóa', ja: '解放しました' },
  'Open the next gift': { vi: 'Mở quà tiếp theo', ja: '次のプレゼントを開ける' },
  'A gift for you': { vi: 'Có quà cho bạn', ja: 'あなたへのプレゼント' },
  '{count} gift for you': { vi: 'Có {count} món quà cho bạn', ja: 'あなたへのプレゼントが{count}個' },
  '{count} gifts for you': { vi: 'Có {count} món quà cho bạn', ja: 'あなたへのプレゼントが{count}個' },
};
