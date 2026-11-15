# Canvas và engine vẽ

Canvas là phần rủi ro nhất về kỹ thuật. App cũ chưa từng được thử trên máy thật, với bút cảm ứng, hay với truyện dài (`docs/status.md`), nên hiện chưa có số đo làm mốc. Mọi ngưỡng ở đây là ước tính ban đầu, giai đoạn 1 sẽ đo.

## Giữ từ app cũ

- Nét vẽ vector theo tọa độ trang, cắt theo đa giác của khung.
- Nét đang vẽ nằm trong `saveLayer` của lớp, nhờ đó tẩy và độ đục đúng ngay khi đang vẽ.
- Giảm điểm theo mức phóng to, cache path bằng `WeakMap`.
- Giới hạn 50 bước hoàn tác và 8 lớp.

Quy tắc cử chỉ phải giữ nguyên:

| Cử chỉ | Hành vi |
| --- | --- |
| Chạm hai ngón | Hoàn tác |
| Chạm ba ngón | Làm lại |
| Chạm đúp hai ngón | Đặt lại khung nhìn |
| Giữ 550ms | Lấy màu |
| Ngón thứ hai đặt xuống khi đang vẽ | Hủy nét |
| Bút cảm ứng ở chế độ tự động | Bút vẽ, ngón tay di chuyển, bỏ qua lòng bàn tay |
| Hai ngón | Phóng to, xoay, có hít về góc và giới hạn mức zoom |

Vị trí công cụ đảo theo tay thuận. Đang vẽ không được rung hay nhảy khung nhìn.

## Sửa so với app cũ

| App cũ | App mới |
| --- | --- |
| Cử chỉ chạy trên luồng JS | Cử chỉ là worklet trên luồng giao diện |
| Pan và zoom gọi `setView`, render lại component khoảng 855 dòng | `ViewState` nằm trong `SharedValue`, không render React |
| Tính lại toàn bộ đường viền nét ở mỗi điểm, O(n²) theo nét | Chỉ tính lại đuôi nét |
| Vẽ lại cả lớp sau mỗi nét | Niêm phong picture theo từng nhóm 128 nét, chỉ ghi lại đuôi |
| Lưu cả khung sau 400ms | Ghi một dòng khi nhấc bút |
| Cache tranh không bao giờ giải phóng | LRU 3 khung, gọi `dispose` khi đẩy ra |
| Một số phiên bản tranh toàn cục, mọi `PageView` vẽ lại | `art_rev` theo từng trang |

## Thiết kế

```
Gesture (worklet, luồng UI)
   │  điểm chạm + lực nhấn
   ▼
Session reducer (worklet, thuần)      src/core/art/session.ts
   │  nét đang vẽ, ViewState
   ▼
SharedValue ───▶ Skia vẽ nét đang vẽ + picture đã niêm phong
   │
   │ nhấc bút: scheduleOnRN(Float32Array)
   ▼
JS: ChangeSet ──▶ ghi strokes, đẩy ngăn panel:<id>
   │ báo đã nhận
   ▼
UI: bỏ nét khỏi danh sách pending
```

- Dùng `useManualGesture` và `usePanGesture` chạy đồng thời qua `useSimultaneousGestures`. Phải giữ Pan vì `TouchData` không có lực nhấn và Manual không có `stylusData`.
- Chuyển logic `Session` của app cũ thành reducer thuần có chỉ thị `'worklet'`, có test. Bộ đếm giữ 550ms chạy trên JS.
- Chép `perfect-freehand` vào `src/core/art/freehand.ts` và thêm chỉ thị `'worklet'`. Thư viện npm không chạy được trong worklet.
- Luồng UI giữ nét đã xong trong danh sách `pending` cho tới khi JS xác nhận, để gạch nhanh không bị nháy.
- `<Canvas opaque>` để dùng SurfaceView. Kiểm tra có chớp khi chuyển màn hay không.

**Điểm phải biết:** ở Skia 2.14, vẽ trên màn hình chạy trên main thread, sự kiện chạm cũng giao trên main thread. Một lần phát lại chậm sẽ làm trễ cả nét đang vẽ. Vì vậy thời gian phát lại là con số phải canh.

## Bút tùy chỉnh

Người dùng tự tạo bút dựa trên G-pen, bút chì hoặc cọ. Mở bằng nút tên bút ở đầu panel công cụ. Sheet "Bút vẽ" có ba nhóm: bút gốc của từng công cụ, bút có sẵn, bút của tôi.

| Thông số | Cách vẽ |
| --- | --- |
| Cỡ ban đầu, cỡ nhỏ nhất, cỡ lớn nhất | Khoảng của thanh trượt cỡ khi dùng bút này |
| Độ đậm | Độ đục của nét |
| Độ sắc nét | Dưới 98% thì làm mờ mép bằng `MaskFilter` blur, mức mờ đi theo zoom |
| Lực nhấn đổi cỡ | `thinning` của perfect-freehand |
| Lực nhấn đổi độ đậm | Lớn hơn 0 thì nét vẽ bằng các chấm tròn chồng lên nhau (`src/core/art/dabs.ts`) |
| Vuốt nhọn đầu, cuối | `taper` của perfect-freehand, tính bằng bội số của cỡ |
| Làm mượt | `streamline` từ 0,2 tới 0,95 |
| Chất liệu | Hạt chì, cọ khô, than chì: một ô ảnh lặp lại khoét lỗ trên mực. Mực bắn: giọt mực rơi quanh nét |

- Bút có sẵn chỉ nhân bản được. Bút của tôi sửa, nhân bản, đổi tên, đổi thứ tự, xóa được.
- Khi sửa có nét mẫu vẽ bằng chính code của canvas, nên mẫu không lệch với nét thật.
- Mỗi công cụ nhớ bút đang chọn, lưu trong `meta` (`artPresets`).
- Nét lưu `brush` gồm mọi thông số. Nét không có `brush` vẽ đúng như trước.
- Bút gốc chì có `brush` vẽ thành đường viền tô đặc, để lực nhấn và vuốt nhọn có tác dụng.

**Chấm tròn (dab).** Vị trí chấm là hàm chạy dần theo điểm, nên nét dài ra chỉ thêm chấm, không dời chấm cũ. Chỉ vuốt nhọn cuối nét làm nhỏ các chấm sau cùng. Chấm đã qua vùng vuốt nhọn được ghi vào picture theo nhóm 64. Điểm được làm tròn 0,01 trước khi tính, nên nét đọc lại từ blob Float32 cho ra đúng các chấm cũ. Mỗi nét có tối đa 16.000 chấm. Nét đã xong được ghi một lần vào picture riêng để lớp không phải phát lại từng chấm.

## Tông tùy chỉnh

Tông dùng được ở cọ tô tông và lasso fill, như trước. Hàng chip giữ "Màu đặc" và bốn mức 10, 25, 40, 60%. Chip "Thêm tông" mở sheet "Tông".

| Loại | Thông số | Cách vẽ |
| --- | --- | --- |
| Chấm | Mật độ, khoảng cách, góc | Ô picture một chấm, lặp lại |
| Sọc song song | Khoảng cách, độ dày, góc | Ô picture một sọc |
| Đan chéo | Khoảng cách, độ dày, góc | Ô picture hai sọc |
| Cát | Mật độ, cỡ hạt | Ô 48 đơn vị, hạt đặt bằng hàm băm số nguyên |
| Chuyển sắc | Mật độ đầu, mật độ cuối, hướng, khoảng cách, góc | Shader SkSL tính chấm theo từng điểm ảnh |

- Bốn mức cũ vẫn lưu `{ density }` như trước và vẽ bằng đúng shader cũ.
- Tông mới lưu đủ thông số trong `tone` (`kind`, `pitch`, `angle`, `weight`, `density2`, `span`). `density` luôn có để bản app cũ vẫn vẽ được.
- Tông cố định theo trang như tông cũ. Riêng chuyển sắc có `span` là điểm đầu và cuối trên trang. `span` đi theo khi di chuyển, co giãn, xoay, lật đối xứng.
- Cọ tô chuyển sắc trải theo khung. Lasso fill trải theo vùng vừa khoanh, tính lại ở từng sự kiện khi đang vẽ và chốt khi nhấc tay.
- Hàm băm dùng phép bình phương số nguyên nhỏ hơn 2^53, không dùng `sin`, nên mọi máy cho cùng kết quả.

**Hiệu năng.** Shader của tông và chất liệu tạo ở luồng JS, có cache, rồi chuyển sang luồng UI qua `engine.shader` mỗi khi đổi công cụ. Bắt đầu một nét không phải ghi picture nào. Shader chuyển sắc được biên dịch một lần khi nạp module.

## Giới hạn

| Thứ | Giới hạn |
| --- | --- |
| Số điểm mỗi nét | 4.096, vượt thì tự kết thúc nét |
| Số lớp | 8 |
| Bước hoàn tác | 50 |
| Khung giữ trong bộ nhớ | 3 |
| Bút và tông tự tạo | 60 mỗi loại |
| Chấm của một nét | 16.000 |

## Ngưỡng ở giai đoạn 1

Dùng một khung giả lập 5.000 nét, đo trên một máy tầm trung thật.

| Chỉ số | Ngưỡng ban đầu |
| --- | --- |
| Phát lại picture đã niêm phong, mức 2.000 nét | ≤ 6ms mỗi khung hình |
| Pan và zoom | Không rơi khung hình rõ rệt, không render React |
| Mở khung 5.000 nét | Chốt sau lần đo đầu tiên |
| Nháy khi nhấc bút và gạch nhanh | Không có |
| Ghi một nét | Không chặn nét kế tiếp |

**Nếu không đạt ngưỡng phát lại**, mới thêm ba mặt phẳng raster (dưới lớp đang vẽ, lớp đang vẽ, trên lớp đang vẽ) theo tỉ lệ trang bằng `MakeOffscreen`, tối đa 4.096px mỗi cạnh và khoảng 96MB. Vượt tỉ lệ raster thì dùng lại vector. Đạt ngưỡng thì không làm phần này.

## Không làm

Raster hóa ngoài main thread, tuần tự hóa picture, vẽ front-buffer, dự đoán chuyển động.

Gesture Handler 3.5.0 trên Android không đọc `getHistorical*`, nên các mẫu bút gộp sẽ bị bỏ. Chỉ viết thêm Kotlin để lấy nếu thử với bút thấy nét bị gãy.

## Dựng trang

`src/render/` tách theo từng việc: `drawPage`, `drawArt`, `drawBubble`, `drawEffect`, `thumbs`. Dùng chung cho `PageView`, thumbnail, đọc thử và xuất file. Hàng đợi thumbnail tách khỏi `engine/page.ts` cũ, chỉ chạy theo `art_rev` từng trang.

Kết quả xuất phải khớp app cũ. Xem so sánh ảnh mẫu ở [10-kiem-thu-va-phat-hanh.md](10-kiem-thu-va-phat-hanh.md#so-sánh-ảnh-trang).
