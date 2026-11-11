import type { CatalogPart } from '..';

/**
 * Daily prompts. {expression} is a look ("happy" / "vui vẻ" / "うれしい", placed before 顔 in Japanese) and
 * {situation} a moment that follows a name ("in the rain" / "dưới mưa" / "雨の中で").
 */
export const clubPrompts: CatalogPart = {
  'happy|look': { vi: 'vui vẻ', ja: 'うれしい' },
  'sad|look': { vi: 'buồn bã', ja: '悲しい' },
  'angry|look': { vi: 'giận dữ', ja: '怒った' },
  'surprised|look': { vi: 'ngạc nhiên', ja: '驚いた' },
  'scared|look': { vi: 'sợ hãi', ja: '怯えた' },
  'shy|look': { vi: 'ngượng ngùng', ja: '照れた' },

  'in the rain': { vi: 'dưới mưa', ja: '雨の中で' },
  'at midnight': { vi: 'lúc nửa đêm', ja: '真夜中に' },
  'on a crowded train': { vi: 'trên chuyến tàu đông nghẹt', ja: '満員電車で' },
  'right after losing': { vi: 'ngay sau khi thua', ja: '負けた直後に' },
  'on the morning of a big day': { vi: 'vào buổi sáng của một ngày trọng đại', ja: '大事な日の朝に' },
  'while hiding a secret': { vi: 'trong lúc giấu một bí mật', ja: '秘密を隠しながら' },
  'at a summer festival': { vi: 'ở lễ hội mùa hè', ja: '夏祭りで' },
  'during a sudden blackout': { vi: 'khi bỗng dưng mất điện', ja: '突然の停電の中で' },
  'on a rooftop at sunset': { vi: 'trên sân thượng lúc hoàng hôn', ja: '夕暮れの屋上で' },
  'while cooking something': { vi: 'trong lúc nấu ăn', ja: '料理をしながら' },
  'after running a long way': { vi: 'sau khi chạy một quãng dài', ja: '長い距離を走ったあとで' },
  'holding a letter': { vi: 'tay cầm một lá thư', ja: '手紙を持って' },
  'waiting for someone who is late': { vi: 'khi chờ một người đến trễ', ja: '遅れている人を待ちながら' },
  'on the first day of school': { vi: 'vào ngày đầu tiên đi học', ja: '新学期の初日に' },
  'in a snowstorm': { vi: 'giữa trận bão tuyết', ja: '吹雪の中で' },
  'while trying not to laugh': { vi: 'trong lúc cố nhịn cười', ja: '笑いをこらえながら' },

  'Draw {name} looking {expression}. Just the face, close up.': {
    vi: 'Vẽ {name} với vẻ mặt {expression}. Chỉ khuôn mặt, cận cảnh.',
    ja: '{expression}顔の{name}を描こう。顔だけ、アップで。',
  },
  'Sketch {name} looking {expression}, then the same face one second later.': {
    vi: 'Phác {name} với vẻ mặt {expression}, rồi vẽ gương mặt ấy một giây sau đó.',
    ja: '{expression}顔の{name}をラフで描いて、その1秒後の顔も描こう。',
  },
  'One panel, no words: {name} looking {expression}.': {
    vi: 'Một khung, không chữ: {name} với vẻ mặt {expression}.',
    ja: 'セリフなしの1コマ：{expression}顔の{name}。',
  },
  'Draw {name} looking {expression}, seen from a low angle.': {
    vi: 'Vẽ {name} với vẻ mặt {expression}, góc nhìn từ dưới lên.',
    ja: '{expression}顔の{name}を、あおりのアングルで描こう。',
  },
  'Three tiny sketches of {name}: calm, then {expression}, then calm again.': {
    vi: 'Ba bản phác nhỏ của {name}: bình thản, rồi {expression}, rồi lại bình thản.',
    ja: '{name}の小さなラフを3つ：落ち着いた顔、{expression}顔、また落ち着いた顔。',
  },
  'Draw {name} looking {expression} in one minute. Speed over polish.': {
    vi: 'Vẽ {name} với vẻ mặt {expression} trong một phút. Nhanh quan trọng hơn đẹp.',
    ja: '{expression}顔の{name}を1分で描こう。きれいさよりスピード。',
  },
  'Redraw {name} as a chibi, looking {expression}.': {
    vi: 'Vẽ lại {name} kiểu chibi, vẻ mặt {expression}.',
    ja: '{name}をちびキャラで、{expression}顔で描き直そう。',
  },
  'Draw {name} in everyday clothes, full body.': {
    vi: 'Vẽ toàn thân {name} trong bộ đồ thường ngày.',
    ja: '普段着の{name}を全身で描こう。',
  },
  "Draw {name}'s silhouette so it's recognizable without any details.": {
    vi: 'Vẽ bóng dáng {name} sao cho không cần chi tiết vẫn nhận ra.',
    ja: '細部なしでも誰かわかる{name}のシルエットを描こう。',
  },
  'Draw {name} looking {expression} {situation}.': {
    vi: 'Vẽ {name} với vẻ mặt {expression} {situation}.',
    ja: '{name}が{situation}{expression}顔をしているところを描こう。',
  },
  'A wide panel: {name} {situation}, looking {expression}.': {
    vi: 'Một khung ngang rộng: {name} {situation}, vẻ mặt {expression}.',
    ja: '横長の1コマ：{situation}{expression}顔をしている{name}。',
  },
  'Sketch {name} {situation}, looking {expression}. Add one sound effect.': {
    vi: 'Phác {name} {situation}, vẻ mặt {expression}. Thêm một tiếng động.',
    ja: '{situation}{expression}顔をしている{name}をラフで。擬音をひとつ入れて。',
  },
  'Draw {name} {situation}, seen from above.': {
    vi: 'Vẽ {name} {situation}, góc nhìn từ trên xuống.',
    ja: '{name}が{situation}過ごす姿を、俯瞰で描こう。',
  },
  'Thumbnail a page of {name} {situation}, ending on a close-up.': {
    vi: 'Phác nhanh một trang về {name} {situation}, kết bằng một khung cận cảnh.',
    ja: '{name}が{situation}過ごす1ページをネームにして、最後はアップで締めよう。',
  },
  'Draw {name} arriving at {place}.': { vi: 'Vẽ {name} đặt chân tới {place}.', ja: '{place}にたどり着いた{name}を描こう。' },
  "Draw {place} from {name}'s point of view.": {
    vi: 'Vẽ {place} qua đôi mắt của {name}.',
    ja: '{name}の目線から見た{place}を描こう。',
  },
  'Draw {name} small in a big wide shot of {place}.': {
    vi: 'Vẽ toàn cảnh {place} thật rộng, với {name} nhỏ xíu trong đó.',
    ja: '{place}の大きな引きの絵に、小さく{name}を描こう。',
  },
  'Draw {name} at {place} {situation}.': {
    vi: 'Vẽ {name} ở {place} {situation}.',
    ja: '{place}で、{name}が{situation}過ごす姿を描こう。',
  },
  'Draw {name} leaving {place} for the last time.': {
    vi: 'Vẽ {name} rời {place} lần cuối.',
    ja: '最後に{place}を去る{name}を描こう。',
  },
  'Draw {place} as an establishing shot, with no characters.': {
    vi: 'Vẽ {place} làm khung giới thiệu bối cảnh, không có nhân vật.',
    ja: 'キャラなしで、{place}の状況説明カットを描こう。',
  },
  'Draw {place} at night, with only one light on.': {
    vi: 'Vẽ {place} vào ban đêm, chỉ còn một ngọn đèn sáng.',
    ja: '明かりがひとつだけ灯る、夜の{place}を描こう。',
  },
  'Draw {place} twice: in the morning, then at night.': {
    vi: 'Vẽ {place} hai lần: buổi sáng, rồi ban đêm.',
    ja: '{place}を2回描こう。朝と、夜と。',
  },
  'Draw a corner of {place} that nobody in the story has noticed yet.': {
    vi: 'Vẽ một góc của {place} mà chưa ai trong truyện để ý tới.',
    ja: '物語の誰もまだ気づいていない、{place}の片隅を描こう。',
  },
  'Draw {name} and {other} back to back.': { vi: 'Vẽ {name} và {other} đứng tựa lưng nhau.', ja: '背中合わせの{name}と{other}を描こう。' },
  'Draw {name} and {other} sharing a meal.': { vi: 'Vẽ {name} và {other} ăn chung một bữa.', ja: '一緒にご飯を食べる{name}と{other}を描こう。' },
  "Draw {name} looking {expression} while {other} isn't watching.": {
    vi: 'Vẽ {name} với vẻ mặt {expression} lúc {other} không để ý.',
    ja: '{other}が見ていない隙に{expression}顔をする{name}を描こう。',
  },
  'Draw {name} and {other} arguing, in three panels.': {
    vi: 'Vẽ {name} và {other} cãi nhau trong ba khung.',
    ja: '言い争う{name}と{other}を3コマで描こう。',
  },
  'Draw {other} the way {name} sees them.': {
    vi: 'Vẽ {other} qua con mắt của {name}.',
    ja: '{name}の目に映る{other}を描こう。',
  },
  'Draw {name} and {other} {situation}.': { vi: 'Vẽ {name} và {other} {situation}.', ja: '{name}と{other}が{situation}過ごす姿を描こう。' },
  'Draw a pretend cover for the next volume of {story}.': {
    vi: 'Vẽ thử bìa cho tập tiếp theo của {story}.',
    ja: '『{story}』次巻の表紙を想像で描こう。',
  },
  'Draw one wordless panel that sums up {story}.': {
    vi: 'Vẽ một khung không chữ tóm gọn cả {story}.',
    ja: '『{story}』を言葉なしで表す1コマを描こう。',
  },
  'Design a small emblem or logo for {story}.': {
    vi: 'Thiết kế một biểu tượng hoặc logo nhỏ cho {story}.',
    ja: '『{story}』の小さなエンブレムかロゴをデザインしよう。',
  },
  'Write three lines {name} would never say, then one they would.': {
    vi: 'Viết ba câu {name} không đời nào nói, rồi một câu chắc chắn sẽ nói.',
    ja: '{name}が絶対に言わないセリフを3つ、言いそうなセリフを1つ書こう。',
  },
  'Write how {name} answers the question "What scares you?"': {
    vi: 'Viết câu trả lời của {name} cho câu hỏi "Bạn sợ gì nhất?"',
    ja: '「何が怖い？」と聞かれた{name}の答えを書こう。',
  },
  'Write a short scene where {name} feels {expression} but tries to hide it.': {
    vi: 'Viết một cảnh ngắn: {name} đang {expression} nhưng cố giấu đi.',
    ja: '{expression}気持ちを隠そうとする{name}の短いシーンを書こう。',
  },
  "Write {name}'s diary entry for today.": { vi: 'Viết trang nhật ký hôm nay của {name}.', ja: '{name}の今日の日記を書こう。' },
  'Write what {name} says {situation}.': { vi: 'Viết câu {name} nói {situation}.', ja: '{name}が{situation}言うセリフを書こう。' },
  'Write a phone call between {name} and someone they miss.': {
    vi: 'Viết cuộc điện thoại giữa {name} và một người mà họ đang nhớ.',
    ja: '{name}と、会いたい人との電話を書こう。',
  },
  "Write {name}'s favourite food and why, in one line of dialogue.": {
    vi: 'Viết món ăn yêu thích của {name} và lý do, gói trong một câu thoại.',
    ja: '{name}の好物とその理由を、セリフ1行で書こう。',
  },
  'Write two panels of dialogue: {name} {situation}.': {
    vi: 'Viết lời thoại cho hai khung: {name} {situation}.',
    ja: '2コマ分のセリフを書こう：{name}が{situation}過ごす場面。',
  },
  'Write an argument between {name} and {other} in six lines.': {
    vi: 'Viết một trận cãi nhau giữa {name} và {other} trong sáu câu.',
    ja: '{name}と{other}の口げんかを6行で書こう。',
  },
  'Write {name} giving {other} advice that is a little wrong.': {
    vi: 'Viết cảnh {name} cho {other} một lời khuyên hơi sai sai.',
    ja: '{name}が{other}にちょっとズレたアドバイスをする場面を書こう。',
  },
  'Write the first words {name} ever said to {other}.': {
    vi: 'Viết câu đầu tiên {name} từng nói với {other}.',
    ja: '{name}が{other}に初めてかけた言葉を書こう。',
  },
  'Write a secret {name} keeps from {other}.': {
    vi: 'Viết một bí mật {name} giấu {other}.',
    ja: '{name}が{other}に隠している秘密を書こう。',
  },
  'Write {name} and {other} {situation}, using only dialogue.': {
    vi: 'Viết cảnh {name} và {other} {situation}, chỉ dùng lời thoại.',
    ja: '{name}と{other}が{situation}過ごす場面を、セリフだけで書こう。',
  },
  '{name} wants this: {goal}. Write a scene where it slips away.': {
    vi: '{name} muốn điều này: {goal}. Viết một cảnh mà nó vuột khỏi tay.',
    ja: '{name}の望み：{goal}。それが手からこぼれ落ちるシーンを書こう。',
  },
  'Write the moment {name} first decides on this goal: {goal}.': {
    vi: 'Viết khoảnh khắc {name} lần đầu quyết định theo đuổi mục tiêu: {goal}.',
    ja: '{name}がこの目標を初めて決めた瞬間を書こう：{goal}。',
  },
  "{name}'s weakness: {weakness}. Write a scene that tests it.": {
    vi: 'Điểm yếu của {name}: {weakness}. Viết một cảnh thử thách điều đó.',
    ja: '{name}の弱点：{weakness}。それを試すシーンを書こう。',
  },
  'Write how {name} hides this weakness from everyone: {weakness}.': {
    vi: 'Viết cách {name} giấu mọi người điểm yếu này: {weakness}.',
    ja: '{name}がこの弱点をみんなに隠す方法を書こう：{weakness}。',
  },
  'Write what {place} sounds like, in three sound effects.': {
    vi: 'Tả âm thanh ở {place} bằng ba tiếng động.',
    ja: '{place}の音を、擬音3つで書こう。',
  },
  'Write a short legend people tell about {place}.': {
    vi: 'Viết một truyền thuyết ngắn mà người ta hay kể về {place}.',
    ja: '{place}にまつわる短い言い伝えを書こう。',
  },
  'Write who {name} meets at {place}.': { vi: 'Viết xem {name} gặp ai ở {place}.', ja: '{name}が{place}で誰に出会うか書こう。' },
  'Write the last line of the next chapter of {story} first, then work back.': {
    vi: 'Viết câu cuối của chương sau trong {story} trước, rồi viết ngược lên.',
    ja: '『{story}』次の章の最後のセリフを先に書いて、そこから逆算しよう。',
  },
  'Write a two-sentence blurb for the back cover of {story}.': {
    vi: 'Viết lời giới thiệu hai câu cho bìa sau của {story}.',
    ja: '『{story}』の裏表紙のあらすじを2文で書こう。',
  },
  'Write a scene from {story} told by an object in the room.': {
    vi: 'Viết một cảnh trong {story} qua lời kể của một đồ vật trong phòng.',
    ja: '部屋にある物の視点で、『{story}』の1シーンを書こう。',
  },
  'List five things that could go wrong in the next chapter of {story}.': {
    vi: 'Liệt kê năm chuyện có thể hỏng bét trong chương tiếp theo của {story}.',
    ja: '『{story}』次の章でうまくいかなくなりそうなことを5つ挙げよう。',
  },
  'Write a rumour about {name} that {other} heard.': {
    vi: 'Viết một tin đồn về {name} mà {other} nghe được.',
    ja: '{other}が耳にした{name}のうわさを書こう。',
  },
  'Write a text message {name} types, deletes, and never sends.': {
    vi: 'Viết một tin nhắn {name} gõ ra, xoá đi, và không bao giờ gửi.',
    ja: '{name}が打って、消して、結局送らなかったメッセージを書こう。',
  },
  'Write a line {name} shouts {situation}.': {
    vi: 'Viết một câu {name} hét lên {situation}.',
    ja: '{name}が{situation}叫ぶセリフを書こう。',
  },
  'Draw the hands of {name}: holding something they care about.': {
    vi: 'Vẽ đôi tay của {name}: đang nắm một thứ quý giá với họ.',
    ja: '{name}の手を描こう。大切なものを持っている手を。',
  },

  'Draw a character who is late for something important.': {
    vi: 'Vẽ một nhân vật đang trễ một việc quan trọng.',
    ja: '大事な用事に遅れそうなキャラを描こう。',
  },
  'Draw a hand holding something precious.': { vi: 'Vẽ một bàn tay đang cầm thứ gì đó quý giá.', ja: '大切なものを持つ手を描こう。' },
  'Draw your desk as a manga panel.': { vi: 'Vẽ bàn làm việc của bạn thành một khung manga.', ja: '自分の机を漫画の1コマとして描こう。' },
  'Draw a character looking {expression} {situation}.': {
    vi: 'Vẽ một nhân vật với vẻ mặt {expression} {situation}.',
    ja: '{situation}{expression}顔をしているキャラを描こう。',
  },
  'Draw a cat that thinks it is the main character.': {
    vi: 'Vẽ một con mèo tưởng mình là nhân vật chính.',
    ja: '自分が主人公だと思っている猫を描こう。',
  },
  'Draw the same face six times, each one a little different.': {
    vi: 'Vẽ cùng một khuôn mặt sáu lần, mỗi lần khác đi một chút.',
    ja: '同じ顔を6回、少しずつ変えて描こう。',
  },
  'Draw a door that should not be opened.': { vi: 'Vẽ một cánh cửa không nên mở.', ja: '開けてはいけない扉を描こう。' },
  'Draw two characters meeting for the first time.': { vi: 'Vẽ hai nhân vật gặp nhau lần đầu.', ja: '初めて出会う2人のキャラを描こう。' },
  'Draw a hero on their day off.': { vi: 'Vẽ một người hùng trong ngày nghỉ.', ja: '休日のヒーローを描こう。' },
  "Draw a villain doing something kind when nobody's watching.": {
    vi: 'Vẽ một phản diện làm việc tốt khi không ai nhìn thấy.',
    ja: '誰も見ていないところで親切なことをする悪役を描こう。',
  },
  'Draw a street at night with one lit window.': {
    vi: 'Vẽ một con phố ban đêm với duy nhất một ô cửa sáng đèn.',
    ja: '窓がひとつだけ明るい、夜の通りを描こう。',
  },
  'Draw anything moving fast, with speed lines.': {
    vi: 'Vẽ bất cứ thứ gì đang lao nhanh, kèm đường tốc độ.',
    ja: '速く動くものを何でもいいから、スピード線つきで描こう。',
  },
  'Draw someone looking {expression}, in one minute.': {
    vi: 'Vẽ một người với vẻ mặt {expression} trong một phút.',
    ja: '{expression}顔の人を1分で描こう。',
  },
  'Draw a character from behind so we can still feel their mood.': {
    vi: 'Vẽ một nhân vật từ phía sau mà vẫn cảm được tâm trạng.',
    ja: '後ろ姿だけで気持ちが伝わるキャラを描こう。',
  },
  'Draw a tiny creature that lives in a pencil case.': {
    vi: 'Vẽ một sinh vật tí hon sống trong hộp bút.',
    ja: '筆箱に住んでいる小さな生き物を描こう。',
  },
  'Draw a rooftop at sunset with someone waiting.': {
    vi: 'Vẽ một sân thượng lúc hoàng hôn, có ai đó đang chờ.',
    ja: '夕暮れの屋上で、誰かが待っている絵を描こう。',
  },
  'Draw a character {situation}.': { vi: 'Vẽ một nhân vật {situation}.', ja: '{situation}過ごすキャラを描こう。' },
  'Write the first line of a story that starts in the rain.': {
    vi: 'Viết câu mở đầu cho một câu chuyện bắt đầu dưới mưa.',
    ja: '雨の中で始まる物語の、最初の1行を書こう。',
  },
  "Write a one-sentence idea for a manga you'd love to read.": {
    vi: 'Viết trong một câu ý tưởng cho bộ manga mà bạn rất muốn đọc.',
    ja: '自分が読みたい漫画のアイデアを1文で書こう。',
  },
  'Invent a character in three words, then give them a name.': {
    vi: 'Tả một nhân vật bằng ba từ, rồi đặt tên cho họ.',
    ja: '3つの言葉でキャラを作って、名前をつけよう。',
  },
  'Write a four-panel joke: setup, build, twist, punchline.': {
    vi: 'Viết một mẩu truyện cười 4 khung: mở đầu, phát triển, bất ngờ, chốt.',
    ja: '起承転結で4コマのギャグを書こう。',
  },
  'Write a secret that would change everything for a hero.': {
    vi: 'Viết một bí mật có thể thay đổi mọi thứ với một người hùng.',
    ja: 'ヒーローのすべてを変えてしまう秘密を書こう。',
  },
  "Write a villain's reason that almost makes sense.": {
    vi: 'Viết động cơ của một phản diện mà nghe gần như có lý.',
    ja: 'ほとんど納得できてしまう悪役の動機を書こう。',
  },
  'Write a conversation between two strangers stuck in a lift.': {
    vi: 'Viết cuộc trò chuyện giữa hai người lạ bị kẹt trong thang máy.',
    ja: 'エレベーターに閉じ込められた見知らぬ2人の会話を書こう。',
  },
  "Write the title of a manga that doesn't exist yet.": {
    vi: 'Viết tên một bộ manga chưa hề tồn tại.',
    ja: 'まだ存在しない漫画のタイトルを書こう。',
  },
  'Write what a character says {situation}.': {
    vi: 'Viết câu một nhân vật nói {situation}.',
    ja: 'キャラが{situation}言うセリフを書こう。',
  },
  'Write a promise two friends made as kids.': {
    vi: 'Viết lời hứa hai người bạn đã trao nhau hồi nhỏ.',
    ja: '幼なじみの2人が子どもの頃に交わした約束を書こう。',
  },
  "Describe a place you'd set a story in, in two sentences.": {
    vi: 'Tả một nơi bạn muốn làm bối cảnh truyện, trong hai câu.',
    ja: '物語の舞台にしたい場所を2文で書こう。',
  },
  'Write a scene that ends with someone looking {expression}.': {
    vi: 'Viết một cảnh kết thúc bằng gương mặt {expression} của ai đó.',
    ja: '誰かの{expression}顔で終わるシーンを書こう。',
  },
  'Write a letter a character never sends.': {
    vi: 'Viết một lá thư mà nhân vật không bao giờ gửi.',
    ja: 'キャラが出さずにしまった手紙を書こう。',
  },
};
