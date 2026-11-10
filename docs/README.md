# Manganova: tài liệu viết lại

Bộ tài liệu này mô tả cách viết lại app Manganova trên React Native 0.88.1, với giao diện mới "Studio". Người đọc là lập trình viên sẽ làm bản viết lại.

Cập nhật: 2026-11-07. Code nguồn: `/Users/phong/Desktop/PHONG/manga-reader-manga-android`, nhánh `feature/first-version`, commit `88ec97a`.

## Đọc theo thứ tự

| # | Tài liệu | Trả lời câu hỏi |
| --- | --- | --- |
| 1 | [Tổng quan](01-tong-quan.md) | Vì sao viết lại, phạm vi, quyết định đã chốt, việc còn chờ |
| 2 | [Kiến trúc](02-kien-truc.md) | Chia lớp, luồng dữ liệu, hoàn tác, AI, native |
| 3 | [Stack và phiên bản](03-stack-va-phien-ban.md) | Dùng thư viện nào, bản nào, cách khởi tạo project |
| 4 | [Dữ liệu](04-du-lieu.md) | Schema SQLite, lưu nét vẽ, dọn rác, nhập file `.manganova` |
| 5 | [Design system](05-design-system.md) | Token màu, chữ, thành phần, bố cục Studio |
| 6 | [Màn hình](06-man-hinh.md) | Route, việc của từng màn, hành vi phải giữ |
| 7 | [Canvas](07-canvas.md) | Thiết kế engine vẽ và các ngưỡng kiểm chứng |
| 8 | [Chuyển code cũ](08-chuyen-code-cu.md) | File nào chép, sửa, viết lại; lỗi cũ phải sửa |
| 9 | [Lộ trình](09-lo-trinh.md) | Các giai đoạn và điều kiện hoàn thành |
| 10 | [Kiểm thử và phát hành](10-kiem-thu-va-phat-hanh.md) | Test, CI, ký app, đưa lên Google Play |
| 11 | [Hướng dẫn chuyển màn hình](11-huong-dan-chuyen-man.md) | Bảng tra import và thành phần khi chuyển một màn |
| 12 | [Phong cách Studio](12-phong-cach-studio.md) | Giới thiệu style bằng hình ảnh: logo, màu, chữ, icon, màn hình thật |
| 13 | [Website](13-website.md) | Link trang giới thiệu và chính sách, cách deploy |
| 14 | [iOS](14-ios.md) | Chạy, build và phát hành bản iOS, khác biệt với Android |
| | [Google Play](google-play/README.md) | Ảnh, mô tả, việc phải xong trước khi nộp |
| | [Hướng dẫn điền Play Console](google-play/huong-dan-dien.html) | Từng ô trong Play Console điền gì |

Quy tắc nghiệp vụ không chép lại ở đây. Mô tả tính năng F-xx nằm trong `docs/features.md`, mô tả chi tiết 20 màn nằm trong `docs/screens/` của repo cũ. Giai đoạn 1 chép hai phần đó sang `docs/product/` của repo này.

## Trạng thái của các con số

- Phiên bản thư viện: đã tra trên npm ngày 2026-11-07. Cấu hình build: đọc từ template chính thức 0.88.1.
- Ngưỡng hiệu năng trong [Canvas](07-canvas.md): là ước tính ban đầu, chưa đo trên máy thật. Giai đoạn 1 sẽ đo.
- Bản viết lại chưa có code. Lệnh khởi tạo trong [Stack](03-stack-va-phien-ban.md) chưa được chạy thử.
