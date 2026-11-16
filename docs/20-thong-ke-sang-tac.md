# Thống kê sáng tác

Màn Thống kê cho người dùng thấy họ đã vẽ và viết được bao nhiêu. Có bốn tab: tuần, tháng, năm và tất cả. Chạm vào một số liệu thì mở màn chi tiết của số đó.

## Vào từ đâu

| Chỗ bấm | Mở |
| --- | --- |
| Home, thẻ nhỏ chuỗi ngày vẽ (`StreakMiniCard`) | `Stats` |
| Profile, ô "truyện" và ô "nhân vật" | `Stats` |
| Profile, ô "trang đã xong" | `StatsMetric` với `pagesDone` |
| Profile, biểu đồ 7 ngày trong thẻ chuỗi ngày | `StatsMetric` với `strokes`, tab tuần |
| Profile, nút "Xem thống kê" trong thẻ chuỗi ngày | `Stats` |

Trước đây thẻ nhỏ ở Home mở Profile. Mục tiêu mỗi ngày vẫn chỉnh ở Profile.

## Màn Thống kê (`Stats`)

1. Tab kỳ và nút lùi, tiến kỳ. Không tiến quá kỳ hiện tại. Không lùi quá kỳ có dữ liệu đầu tiên.
2. Thẻ số nét, có biểu đồ cột. Tuần và tháng: mỗi cột là một ngày. Năm và tất cả: mỗi cột là một tháng.
3. Số ngày vẽ (kèm chuỗi dài nhất trong kỳ) và chuỗi ngày vẽ hiện tại.
4. "Bạn đã làm được": trang xong, trang tạo, khung tạo, từ đã viết, bóng thoại đã đặt, chương xong.
5. "Bạn hay vẽ lúc nào": bản đồ nhiệt theo thứ trong tuần và khung 3 giờ.
6. "Ai xuất hiện nhiều nhất": 5 nhân vật.
7. Kỷ lục cá nhân: chuỗi dài nhất, ngày vẽ nhiều nhất, ngày xong nhiều trang nhất, ngày viết nhiều từ nhất.

## Màn chi tiết (`StatsMetric`)

Chọn tuần, tháng hoặc năm. Có nút lùi, tiến kỳ, biểu đồ lớn, tổng so với kỳ trước, và danh sách số liệu từng ngày (năm thì từng tháng), mới nhất ở trên. Mori nói một câu ngắn theo kết quả: chưa có gì, mới bắt đầu, tăng, giảm, bằng kỳ trước, hoặc đang thu thập. Câu đổi mỗi ngày, giữ nguyên trong ngày, theo giọng ở `core/studio/editor.ts`.

## Số liệu lấy từ đâu

| Số liệu | Nguồn | Có từ khi nào |
| --- | --- | --- |
| Số nét mỗi ngày | `activity` trong `meta` (`core/story/activity.ts`) | Đã có từ trước. Giữ 400 ngày, tổng giữ mãi |
| Ngày vẽ, chuỗi, chuỗi dài nhất, ngày vẽ nhiều nhất | Tính từ số nét mỗi ngày | Đã có từ trước |
| Trang tạo, khung tạo, trang xong, từ đã viết, bóng thoại đã đặt, chương xong | Nhật ký tiến độ mới, khóa `statsProgress` | **Mới bắt đầu ghi** từ bản này |
| Bản đồ "Bạn hay vẽ lúc nào" | Buổi vẽ mới, khóa `drawSessions` | **Mới bắt đầu ghi** từ bản này |
| Ai xuất hiện nhiều nhất | Câu thoại trong kịch bản và bóng thoại trên trang có gắn nhân vật, trong mọi truyện còn thấy được | Đã có. Không có ngày nên không chia theo kỳ |
| Tab "Tất cả" của trang, khung, từ, bóng thoại, chương | Đếm thẳng trong truyện hiện có (`storyTotals`) | Đã có |

Truyện không lưu ngày tạo trang hay ngày xong trang. Vì vậy các số "đã làm được" chỉ đếm từ ngày cài bản này. Màn ghi rõ "Đếm từ ngày…, những ngày trước đó hiện là 0".

Ghim nhân vật trên canvas không được lưu, nên không dùng để đếm nhân vật.

## Cách ghi nhật ký tiến độ

`state/useStats.ts` theo dõi kho truyện. Sau 2 giây không đổi, nó so truyện với lần trước (`core/stats/progress.ts`) và cộng phần tăng vào hôm nay.

- Truyện thấy lần đầu (lúc mở app, nhập file, nhận qua Wi-Fi, truyện mẫu) là mốc. Không tính là làm hôm nay.
- Truyện trong thùng rác vẫn được đếm, nên bỏ vào thùng rác rồi khôi phục không cộng thêm.
- Xóa đi thì hạ mốc, không trừ vào ngày nào. Thêm lại thì tính lại.
- Một trang hoặc chương chỉ tính "xong" một lần trong mỗi lần mở app.
- Chỉ lưu tổng mỗi ngày. Giữ 400 ngày.

## Buổi vẽ

Mỗi lần nhấc bút, `noteStrokes` trong `state/useActivity.ts` cũng gọi `noteSessionStrokesNow`. Hai lần nhấc bút cách nhau tối đa 10 phút thì cùng một buổi. Mỗi buổi lưu giờ bắt đầu, giờ kết thúc và số nét.

- Bỏ buổi cũ hơn 365 ngày. Giữ tối đa 2.000 buổi.
- Bản đồ chia số nét của một buổi cho các khung giờ theo thời gian buổi đó nằm trong từng khung, theo giờ địa phương.
- Bản đồ chỉ hiện khi có ít nhất 5 buổi trong 3 ngày khác nhau. Trước đó màn hiện "Đang thu thập dữ liệu" và thanh tiến độ.
- Nhật ký ghi xuống sau 15 giây, và ghi ngay khi app ra nền (`flushStats` trong `AppRoot`).

## Lưu ở đâu

Hai khóa trong bảng `meta`, dạng JSON: `statsProgress` và `drawSessions`. Không có migration mới. Đọc hỏng thì bỏ phần hỏng, không làm hỏng màn.

## Ngày, tuần và múi giờ

- Mọi mốc là khóa ngày theo giờ địa phương (`dayKey`). Bước ngày dùng `shiftDay`, an toàn khi đổi giờ mùa hè.
- Tuần luôn bắt đầu thứ Hai, với mọi ngôn ngữ, giống Lịch sáng tác và Tổng kết tuần (`WEEK_START`).
- Số và ngày tháng định dạng theo ngôn ngữ của app (`core/stats/format.ts`, dùng `Intl`, có dạng dự phòng).

## Biểu đồ

Vẽ bằng `View`, không thêm thư viện. Cột bắt đầu từ 0, cùng một màu `accent`, ngày hôm nay đậm hơn. Số trên cùng là giá trị cột cao nhất. Bản đồ nhiệt dùng 5 mức của `accent`, có chú thích Ít, Nhiều. Mỗi biểu đồ là một ảnh cho trình đọc màn hình, với câu tóm tắt: tổng và ngày cao nhất. Số từng ngày nằm trong danh sách ở màn chi tiết.

## Code và test

| Phần | File |
| --- | --- |
| Kỳ, cột, tổng, chuỗi trong kỳ | `src/core/stats/period.ts` |
| Nhật ký tiến độ | `src/core/stats/progress.ts` |
| Buổi vẽ, bản đồ nhiệt | `src/core/stats/sessions.ts` |
| Nhân vật xuất hiện nhiều | `src/core/stats/characters.ts` |
| Ghép số liệu, kỷ lục | `src/core/stats/overview.ts` |
| Câu của Mori | `src/core/stats/voice.ts` |
| Định dạng số, ngày | `src/core/stats/format.ts` |
| Ghi và lưu | `src/state/useStats.ts` |
| Màn hình | `src/features/stats/` |
| Test | `__tests__/stats.test.ts`, `__tests__/statsScreens.test.tsx` |

Test đổi giờ mùa hè chạy với múi giờ Berlin và Santiago qua `__tests__/helpers/timeZone.ts`. Jest cho mỗi file một bản sao `process.env`, nên helper đặt `TZ` trên process thật.

Chữ nằm trong nhóm `stats` của 9 file ngôn ngữ.
