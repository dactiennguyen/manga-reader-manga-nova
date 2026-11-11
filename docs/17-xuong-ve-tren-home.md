# Xưởng vẽ trên Home

Tài liệu này dành cho lập trình viên làm tiếp phần Home. Mục tiêu: người dùng có lý do mở app mỗi ngày. Mọi thứ chạy trên máy, không cần server. Nội dung được tính từ truyện và hoạt động vẽ của chính người dùng.

Cập nhật: 2026-11-11, nhánh `feature/home-studio`.

## Quy tắc trung thực

Biên tập viên Mori và Hội đọc thử (12 người) là **nhân vật của app**, giống linh vật. Màn giới thiệu hội nói rõ: "Mười hai nhân vật sống trong ứng dụng này". Vì vậy không cần gắn chữ "mô phỏng".

Không bao giờ được:

- Gọi họ là người dùng, fan ngoài kia hay cộng đồng.
- Hiện số lượt đọc, lượt xem, lượt tải, lượt thích hay người theo dõi giả.
- Thêm nút bấm vào không làm gì.

Điểm Studio là điểm trò chơi tính từ tác phẩm của người dùng. Nó không phải số người đọc. `__tests__/studioCast.test.ts` quét toàn bộ câu chữ ở cả ba ngôn ngữ để tìm các từ bị cấm.

## 15 tính năng

| # | Tính năng | Logic | Giao diện |
| --- | --- | --- | --- |
| 1 | Hành trình mangaka, 6 cấp: Tân binh → Chuyển thể anime | `core/studio/journey.ts` | `JourneyCard`, `JourneyScreen` |
| 2 | 35 huy hiệu đồng, bạc, vàng | `badges.ts` | `BadgesCard`, `JourneyScreen` |
| 3 | Tiến bộ: trang đầu đặt cạnh trang mới nhất, kèm "ngày này tháng trước" | `progress.ts` | `ProgressCard` |
| 4 | Trailer: video dọc 720x1280 dựng từ khung đã vẽ | `trailer.ts`, `trailerPicks.ts` | `TrailerHero`, `TrailerSheet` |
| 5 | Nghe chương: đọc kịch bản thành tiếng, mỗi nhân vật một giọng | `tableRead.ts`, `tableVoices.ts`, `specs/NativeSpeech.ts` | `ListenSheet` |
| 6 | Đề bài hôm nay, lấy từ nhân vật và địa danh trong truyện | `prompts.ts` | `PromptCard` |
| 7 | Lời nhắn mỗi sáng của biên tập viên Mori (55 câu, 14 tình huống) | `editor.ts` | `EditorCard` |
| 8 | Tin nhắn từ nhân vật của người dùng | `characterChat.ts` | `CharacterMessageCard` |
| 9 | Hội đọc thử chấm điểm và nhận xét từng chương | `readers.ts` | `ClubCard`, `ClubScreen` |
| 10 | Bảng xếp hạng chương của hội | `ranking.ts` | `MagazineCard`, `ClubScreen` |
| 11 | Thư từ hội đọc thử | `fanMail.ts` | `LettersCard`, `MailboxScreen` |
| 12 | Điểm Studio | `points.ts` | `JourneyCard`, `JourneyScreen` |
| 13 | Tạp chí của tôi: số mỗi tuần, bìa, mục lục, đếm ngược | `magazine.ts` | `MagazineCard`, `MagazineScreen` |
| 14 | Thẻ nhân vật: chỉ số, độ hiếm, lật thẻ, chia sẻ ảnh | `cards.ts` | `CharacterCardsStrip`, `CardsScreen` |
| 15 | Hộp quà: mở khóa bảng màu, khung thẻ, tiếng động, kiểu bóng thoại, tư thế | `gifts.ts`, `rewards.ts` | `GiftCard`, `JourneyScreen` |

Logic nằm trong `src/core/studio/`, là hàm thuần và có test. Giao diện nằm trong `src/features/home/` và `src/features/studio/`. Trạng thái lưu ở meta key `studio` (`src/state/useStudio.ts`).

## Cách hoạt động

- **Ổn định theo ngày.** Lời nhắn, tin nhắn và đề bài được chọn bằng hàm băm của ngày (`seed.ts`). Chúng đổi mỗi ngày nhưng giữ nguyên trong ngày.
- **Điểm của hội.** Điểm được băm từ id chương cộng với chữ ký nội dung chương, nên chỉ đổi khi chương thay đổi. Mỗi thành viên chấm theo sở thích của mình, độ khó tính và một chút ngẫu nhiên.
- **Không mất cấp.** Cấp và quà dùng chuỗi ngày dài nhất, không dùng chuỗi hiện tại. Bỏ một ngày không làm mất cấp.
- **Phần thưởng là nội dung thật.** Bảng màu được thêm vào màu đã lưu. Tiếng động, bóng thoại và tư thế thưởng hiện trong sheet Mẫu có sẵn và sheet Tư thế khi đã mở khóa. Các mục có sẵn từ trước không bị khóa.
- **Home không tính lại khi đang vẽ.** `useHomeData` giữ dữ liệu cũ khi Home không ở trên cùng, nên vẽ không làm Home tính lại.

## Giọng đọc

Module `NativeSpeech` dùng TextToSpeech trên Android và AVSpeechSynthesizer trên iOS, chỉ dùng giọng có sẵn trên máy.

- **Android 11 trở lên:** cần mục `<queries>` cho `TTS_SERVICE` trong manifest.
- **Ngôn ngữ đọc:** theo chữ trong kịch bản, không theo ngôn ngữ giao diện.
- **Phân biệt giọng:** Android không cho biết giọng nam hay nữ, nên nhân vật chỉ khác nhau bằng cao độ.
- **Nền trên iOS:** tiếng dừng khi app chạy nền.

## Tranh

29 tranh riso ở `src/assets/art/studio/`, đăng ký trong `src/ui/studioArt.ts`, tổng 1 MB. Tranh được tạo bằng Codex (`codex exec`, công cụ `image_gen`). Prompt và script nằm trong scratchpad của phiên làm việc.

Khi tạo ảnh chân dung, đừng gửi kèm ảnh mẫu (`-i`): yêu cầu sẽ hay lỗi `Bad Request`. Hãy mô tả phong cách bằng chữ.

## Đã kiểm tra trên máy

**Redmi Note 10S (Android 13, tiếng Việt):** Home, Hành trình, Hội đọc thử, Hộp thư, Thẻ nhân vật, Tạp chí, Trailer. Tạo video trailer cho một trang đơn giản mất 17 giây.

**iPhone 17 Pro Simulator (iOS 26, tiếng Anh):** Home, Nghe chương (đọc đúng từng dòng, tô dòng đang đọc), Trailer, Tạo video, lật thẻ nhân vật. Tạo video 19 giây của Lantern Courier mất khoảng 3 phút trên Simulator, vì Simulator không có bộ mã hóa phần cứng.

Lỗi đã sửa sau khi thử:

- Ảnh trong thẻ bị bóp méo vì chỉ đặt cỡ bằng `className`. Giờ mọi ảnh studio có `width` và `height` qua `style`.
- Chip huy hiệu bị tràn chữ.
- Thẻ nhân vật thiếu tên và ảnh trong lưới 2 cột. Giờ dưới 200dp dùng thẻ gọn.
- Chữ trùng màu nền trên bìa tạp chí.
- Sheet thẻ thiếu lề hai bên.
- "Issue" bị dịch thành "Vấn đề".
- Sửa 231 câu tiếng Việt cho tự nhiên. Tên thống nhất là "Hội đọc thử Manganova".

## Còn lại

- Ngày đến của thư mừng chuỗi ngày và lên cấp là ước lượng, vì truyện không lưu thời điểm các sự kiện đó.
- Chưa đo thời gian tạo trailer cho truyện nhiều trang trên máy thật.
- Khi Metro nạp lại lúc đang sửa file catalog, app có thể hiện màn giới thiệu. Mở lại app từ đầu thì bình thường; dữ liệu không mất.
