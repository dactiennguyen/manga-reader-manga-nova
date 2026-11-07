# Lộ trình

Làm phần rủi ro trước, giao diện sau. Mỗi giai đoạn kết thúc bằng một bản chạy được trên máy thật. Chưa ước tính thời gian vì phụ thuộc số người làm và kết quả giai đoạn 1.

Cỡ: **S** nhỏ, **M** vừa, **L** lớn, tính tương đối.

## Giai đoạn 0: Bảo toàn dữ liệu cũ

Cỡ S. Làm trên app cũ, trước khi viết dòng code nào.

- Xuất mọi truyện đang có ra file `.mangaka`.
- Lưu lại APK đang chạy được.
- Thử nhập lại một file `.mangaka` trên máy thật. Chức năng này chưa từng được thử.
- Đo app cũ trên máy thật: độ trễ nét vẽ, thời gian mở một trang nhiều nét. Đây là mốc so sánh.
- Làm mục 2 ở [bảng việc cần quyết](01-tong-quan.md#việc-bạn-cần-quyết-hoặc-tự-làm).

**Xong khi:** có các file `.mangaka` và APK cất ở chỗ an toàn, có số đo mốc.

## Giai đoạn 1: Thử nghiệm kỹ thuật

Cỡ M. Giai đoạn rủi ro nhất, cố tình làm thô.

- Khởi tạo project theo [03-stack-va-phien-ban.md](03-stack-va-phien-ban.md). Chép tài liệu sản phẩm vào `docs/product/`.
- **Bản release** với đủ thư viện native trên RN 0.88.1, bật R8.
- Màn thử: khung giả lập 5.000 nét, nét vẽ trên luồng UI, pan và zoom không render React, bút cảm ứng, ghi nét vào SQLite.
- Thử `<Canvas opaque>` khi chuyển màn.

**Xong khi:** đạt các ngưỡng ở [07-canvas.md](07-canvas.md#ngưỡng-ở-giai-đoạn-1) trên máy tầm trung, hoặc đã quyết làm raster. Nếu một thư viện không chạy được trên 0.88.1, ghi lại và lùi về 0.87.x cho thư viện đó hoặc thay thư viện trước khi đi tiếp.

## Giai đoạn 2: Lõi và dữ liệu

Cỡ L.

- Chép và tách file theo [08-chuyen-code-cu.md](08-chuyen-code-cu.md), kèm 17 file test.
- Schema, migration, repo, `applyChangeSet`, các ngăn hoàn tác.
- Luật ESLint chặn import sai lớp.
- Bộ nhập `.mangaka` bản 1. `render/drawPage`.
- GC ở chế độ giả.

**Xong khi:** nhập được file `.mangaka` thật từ giai đoạn 0 và dựng được trang giống app cũ, xác nhận bằng so sánh ảnh.

## Giai đoạn 3: Canvas đầy đủ

Cỡ L.

- Mọi công cụ, lớp, hình, tô, screentone, di chuyển và co giãn lớp, tất cả cử chỉ.
- Hoàn tác, tắt app mở lại vẫn còn tranh.

**Xong khi:** vẽ trên tranh đã nhập, hoàn tác, xuống nền, tắt hẳn app, mở lại, tranh còn nguyên. Thử với bút nếu có.

## Giai đoạn 4: Bộ giao diện và khung app

Cỡ M.

- `src/ui/` với token và test tương phản.
- Điều hướng, Dock, Toast, Dialog, Sheet.
- Welcome, Preferences, Home, Library, NewProject, Project, Trash.

**Xong khi:** tạo, mở, xóa, khôi phục được truyện. Đi được bằng TalkBack ở các màn này.

## Giai đoạn 5: Viết truyện và AI

Cỡ L.

- Outline, Script, Character, World, WorldEntry.
- `AiClient` và mọi tính năng AI bằng chữ.
- Profile phần AI server.

**Xong khi:** viết xong một chương, cả tay và AI. Kịch bản 200 khối vẫn gõ mượt, không mất focus.

## Giai đoạn 6: Dàn trang và thoại

Cỡ L.

- Storyboard, PanelLayout, Lettering dùng ngăn `page`.
- Tự chia trang, tự đặt thoại, bản ngôn ngữ.

**Xong khi:** đi trọn luồng tạo truyện, kịch bản, chia trang, chỉnh khung, vẽ, đặt thoại. Đổi mẫu khung rồi Undo lấy lại được tranh.

## Giai đoạn 7: Hoàn thiện

Cỡ M.

- Preview, Export, Assistant, phần còn lại của Profile, About.
- Giao diện sáng. Giao diện máy tính bảng tối thiểu.
- `.mangaka` bản 2. Mở file từ app khác.
- Bật GC thật.
- Thử truyện 300 trang. Rà soát trợ năng.

**Xong khi:** đạt toàn bộ danh sách ở [10-kiem-thu-va-phat-hanh.md](10-kiem-thu-va-phat-hanh.md#điều-kiện-phát-hành).

## Giai đoạn 8: Phát hành

Cỡ S. Khóa ký mới, ảnh chụp mới, thử nghiệm kín, nộp Play.

## Rủi ro

| Rủi ro | Hậu quả | Cách giảm |
| --- | --- | --- |
| GC xóa nhầm tranh đang dùng | Mất dữ liệu vĩnh viễn | Chạy giả tới giai đoạn 7, test mọi đường đi, backup trước migration |
| Thư viện chưa chạy được trên 0.88.1 | Chặn cả dự án | Giai đoạn 1 build release đủ thư viện |
| Hiệu năng vẽ không đạt | Trải nghiệm chính kém | Đo sớm, có phương án raster |
| Trang dựng lại khác app cũ | Truyện cũ bị đổi diện mạo | So sánh ảnh từ giai đoạn 2 |
| Phạm vi quá lớn cho một người | Không ra được bản nào | Khoảng 27.000 dòng không chép nguyên, nên đổi giao diện màn cũ thay vì viết mới. Chỉ viết lại những phần đã nêu ở tài liệu chuyển code |
| Mất hành vi nằm ẩn trong code cũ | Trải nghiệm kém hơn app cũ | Danh sách ở [06-man-hinh.md](06-man-hinh.md#hành-vi-dễ-mất-khi-viết-lại) |
| SurfaceView chớp khi chuyển màn | Xấu, không nguy hiểm | Thử ở giai đoạn 1. Có thể bỏ `opaque` |

Nếu cần rút gọn để ra bản sớm, cắt theo thứ tự: giao diện máy tính bảng, giao diện sáng, `.mangaka` bản 2.
