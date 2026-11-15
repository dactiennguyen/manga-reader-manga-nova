# Bài tập vẽ có hướng dẫn

Các bài học ngắn cho người mới. Mỗi bài vài phút, đồ theo nét mẫu bằng bút thật của app. Mục tiêu là cho người dùng một lý do để quay lại vẽ mỗi ngày.

## Khóa học

6 khóa, mỗi khóa 3 bài, mỗi bài 2 đến 4 bước. Không khóa bài nào. Thứ tự chỉ là gợi ý, ai cũng mở được bài mình muốn.

| Khóa | Bài |
| --- | --- |
| Nét vẽ và kiểm soát bút | Nét thẳng · Đường cong và hình tròn · Gạch nét |
| Vẽ mắt | Một con mắt đơn giản · Một đôi mắt · Biểu cảm đôi mắt |
| Khuôn mặt | Nhìn thẳng · Góc ba phần tư · Nhìn nghiêng |
| Bàn tay đơn giản | Từ hình khối · Nắm đấm · Bàn tay chỉ |
| Phối cảnh cơ bản | Hộp một điểm tụ · Hộp hai điểm tụ · Hộp trên chân trời |
| Hiệu ứng manga | Đường tốc độ · Đường tập trung · Đổ bóng để dán tông |

Nét mẫu được vẽ bằng code từ hình đơn giản: đường thẳng, cung, elip, Bézier, ống tròn (`src/core/lessons/shapes.ts`). Không có ảnh bitmap, nên tranh không bao giờ có cảm giác AI.

Một số bài "xây dần" (`build: true`): nét của các bước trước hiện mờ phía sau, ví dụ hình tròn của hộp sọ khi vẽ hàm.

Id của bài và bước được lưu cùng tiến độ, nên **không bao giờ đổi id**. Bài mới thì thêm id mới. Test `__tests__/lessons.test.ts` giữ danh sách id cố định.

## Màn hình

| Route | Việc |
| --- | --- |
| `Courses` | Danh sách khóa và bài, tiến độ, sao. Thẻ trên cùng là bài nên học tiếp |
| `Lesson` | Các bước của bài, mỗi bước một câu hướng dẫn và một hình mẫu. Chấm màu cho biết nét bắt đầu từ đâu |
| `LessonPractice` | Trang giấy 3:4, nét mẫu là nét đứt mờ. Người dùng đồ bằng bút G thật. Có hoàn tác, xóa bước, ẩn hiện nét mẫu, bước tiếp |
| `LessonResult` | Điểm, sao, tranh vừa vẽ, điểm từng bước, chuỗi ngày vẽ, nút bài tiếp, thử lại |

Màn luyện luôn tối như Canvas, để trang giấy sáng nhất. Công cụ nằm trên thanh phía trên, không đè lên trang.

Lối vào:

- **Home:** thẻ "Bài tập hôm nay" ngay dưới đề bài và chuỗi ngày vẽ. Người mới thấy bài đầu tiên ngay sau onboarding, nhưng không bị đẩy vào.
- **Profile:** mục "Bài tập vẽ" trong phần Studio, cạnh Hành trình mangaka.

## Chấm điểm

Hàm thuần `scoreTrace` trong `src/core/lessons/score.ts`. Trang rộng 900 đơn vị.

- **Phủ (coverage):** lấy điểm dọc nét mẫu, cứ 8 đơn vị một điểm. Điểm nào có mực gần thì được tính.
- **Chính xác (accuracy):** lấy điểm dọc nét mực. Điểm nào gần nét mẫu thì được tính.
- **Gần** là trong 30 đơn vị: được trọn điểm. Từ 30 đến 60 thì giảm dần. Xa hơn 60 thì không được gì.
- **Điểm bước** = 100 × phủ × chính xác^0,75. Bỏ sót nét bị trừ nhiều hơn tay run.
- **Điểm bài** = trung bình các bước. Bước bỏ qua tính 0.
- **Sao:** 1 sao từ 30, 2 sao từ 60, 3 sao từ 85. Có 1 sao là bài được tính xong.

Vẽ kín cả trang thì phủ đủ, nhưng chính xác rất thấp, nên điểm thấp. Lời nhận xét luôn nhẹ nhàng, chỉ nói cách làm tốt hơn.

## Nối với chuỗi ngày vẽ và điểm Studio

- **Số nét hôm nay:** mỗi lần nhấc bút trên trang luyện gọi `noteStrokes(1)`, giống Canvas. Vì vậy bài tập tính vào chuỗi ngày vẽ, mục tiêu mỗi ngày và widget.
- **Điểm Studio:** chỉ số mới `lessonsDone` (số bài có ít nhất 1 sao), mỗi bài 20 điểm (`points.ts`).
- **Huy hiệu:** "Bài học đầu tiên" (1 bài) và "Học trò xuất sắc" (12 bài).
- **Hành trình:** các cấp không đổi. Cấp vẫn đòi trang và chương thật.

## Lưu tiến độ

Meta key `lessons`, nối trong `src/app/boot.ts` qua `connectLessons` (`src/state/useLessons.ts`). Logic ở `src/core/lessons/progress.ts`.

- Mỗi bài lưu: điểm cao nhất, sao, số lần thử, ngày xong đầu tiên, ngày xong gần nhất.
- Dữ liệu có `v: 1`. Thiếu `v` thì đọc như bản 1. Bản sau đọc được bản trước.
- Sao luôn tính lại từ điểm cao nhất, nên dữ liệu hỏng không thể tự nhận thêm sao.
- Id bài không còn trong danh mục vẫn được giữ, nhưng không tính vào đâu cả.
- Nét vẽ khi luyện không được lưu. Kết quả lần luyện gần nhất chỉ giữ trong bộ nhớ cho màn kết quả.

## Bài gợi ý mỗi ngày

`suggestLesson`: bài đầu tiên chưa xong theo thứ tự danh mục. Khi xong hết thì gợi ý bài ít sao nhất, mỗi ngày một bài khác. Nếu hôm nay đã xong một bài có sao, thẻ trên Home hiện "Hôm nay xong rồi".

## Chữ

Mọi chữ nằm trong nhóm `lessons` ở cả 9 file ngôn ngữ. Câu hướng dẫn giữ ngắn, dưới 70 ký tự tiếng Anh, vì phải dịch nhiều.

## Chưa làm

- Chưa lưu tranh luyện thành trang trong truyện "Practice".
- Chưa đo trên máy thật: độ trễ nét, cảm giác ngưỡng 30 đơn vị khi vẽ bằng ngón tay.
- Chưa dùng lực bấm của bút cảm ứng ở trang luyện. Nét dùng lực giả lập như khi vẽ bằng ngón tay.
