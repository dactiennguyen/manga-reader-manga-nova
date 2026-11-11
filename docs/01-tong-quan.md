# Tổng quan bản viết lại

## App làm gì

Manganova là app Android giúp một người tự làm trọn một chương manga trên điện thoại: viết kịch bản, dựng nhân vật, chia khung, vẽ, đặt thoại, đọc thử, xuất file. Tên thư mục cũ có chữ "reader" vì app từng là app đọc truyện, nhưng phần đó đã bị xóa khỏi nhánh `feature/first-version`.

## Vì sao viết lại

App cũ đã dùng React Native 0.87.1, chỉ kém bản mới nhất một bản nhỏ. Nâng phiên bản không phải lý do viết lại. Lý do nằm ở ba chỗ:

1. **Lớp dữ liệu không chịu được truyện dài.** Toàn bộ truyện là một chuỗi JSON. Mỗi thay đổi nhỏ đều tuần tự hóa lại tất cả dự án trên luồng JS.
2. **Có lỗi mất dữ liệu nằm trong thiết kế.** Hoàn tác bố cục không khôi phục được tranh đã bị xóa. Hoàn tác là code riêng của từng màn. Chi tiết ở [08-chuyen-code-cu.md](08-chuyen-code-cu.md#lỗi-cũ-phải-sửa).
3. **Giao diện cần đổi toàn bộ.** Phong cách cũ nằm trong cấu trúc thành phần (`ComicCard` dùng ở 56 chỗ, viền 2dp ở 64 chỗ), không chỉ trong bảng màu. Đổi màu thôi không ra phong cách mới.

Phần tốt của app cũ được giữ: logic thuần có test, định dạng nét vẽ vector theo đơn vị trang, các quy tắc cử chỉ ở Canvas. Mục tiêu là chép và sửa nhiều nhất có thể, chỉ viết lại những chỗ thật sự cần.

## Quyết định đã chốt

| Mục | Quyết định |
| --- | --- |
| Hướng làm | Project mới trong `manga-reader-ai`, không sửa repo cũ |
| Nền tảng build | React Native CLI thuần, 0.88.1, không dùng Expo |
| Hệ điều hành | Android. Code TypeScript viết để sau này dùng chung được cho iOS |
| Giao diện | "Studio": tối là mặc định, có bản sáng ([05-design-system.md](05-design-system.md)). Viết style bằng Tailwind qua Uniwind |
| Package id | `com.manganova.manga.reader.org`, không dùng lại id cũ |
| Icon | Vẽ mới theo Studio (`assets/icon/`, `scripts/gen-icons.sh`). Không lấy tài sản hình ảnh của app cũ |
| Người dùng cũ | Chưa phát hành, không có người dùng thật. Không đọc dữ liệu MMKV cũ |
| Truyện đã có | Mang sang bằng file `.mangaka` |
| Ngôn ngữ app | Tiếng Anh như hiện tại. Không thêm thư viện i18n ở bản đầu |

## Phạm vi

**Có trong bản viết lại:** mọi tính năng đang chạy được trong `docs/status.md` của repo cũ. Gồm 18 màn trong 20 màn của tài liệu cũ (không có Đăng nhập và AI tạo ảnh), cùng các tính năng AI bằng chữ gọi tới server do người dùng tự cấu hình.

**Thêm mới vì sửa lỗi hoặc đổi kiến trúc:**

- Hoàn tác thống nhất, khôi phục được cả tranh ([02-kien-truc.md](02-kien-truc.md#hoàn-tác)).
- Thành phần Toast, Dialog tự vẽ. Sheet kéo để đóng được.
- Vùng chạm 48dp và nhãn trợ năng cho mọi control.
- Sao chép vào clipboard. App cũ phải mở bảng chia sẻ.
- Giao diện cho máy tính bảng ở mức tối thiểu.

**Không làm ở bản này:** AI tạo ảnh (màn 15), tài khoản, credit, máy chủ trung gian AI, đồng bộ đám mây. Nhiều ngôn ngữ giao diện và chọn một phần lớp đã làm sau ([16-tinh-nang-bo-sung.md](16-tinh-nang-bo-sung.md)).

## Việc bạn cần quyết hoặc tự làm

Những mục này không chặn việc viết code ở giai đoạn đầu, nhưng phải xong trước khi phát hành.

| # | Việc | Đề xuất | Hạn |
| --- | --- | --- | --- |
| 1 | **Đổi khóa ký.** Repo cũ công khai và chứa keystore cùng mật khẩu ở dạng chữ thường (`android/app/build.gradle:90-100`). Coi khóa này là đã lộ | Tạo upload key mới, để ngoài git, dùng GitHub Secrets. App chưa lên Play nên việc đổi không ảnh hưởng ai | Trước lần upload đầu tiên |
| 2 | **Kiểm tra URL git.** `origin` của repo cũ có nhúng thông tin xác thực. Nếu đó là token thì nó nằm trong `.git/config` | Thu hồi token nếu có, chuyển sang SSH hoặc credential helper | Sớm nhất có thể |
| 3 | **Chống chụp màn hình.** Đã quyết: giữ như app cũ, bản release chặn chụp, bản debug không chặn. Đổi hằng số `SECURE_SCREEN` trong `MainActivity.kt` là tắt được. Lưu ý: phải chụp ảnh cho Play trên bản debug | Xem lại trước khi phát hành | Giai đoạn 8 |
| 4 | **Package id.** Đã đổi sang `com.manganova.manga.reader.org`. Sau khi lên Play thì không đổi được nữa, nên nếu có tên miền riêng thì đổi trước lần upload đầu | Giữ, hoặc đổi theo tên miền thật | Trước lần upload đầu tiên |
| 5 | **Server AI cho bản phát hành.** Người dùng phải tự chạy server. Công cụ `gemini-web2api` mà README nhắc tới là công cụ không chính thức, chỉ dùng khi phát triển | Không nhắc công cụ đó trong app hay trang Play. Nếu muốn AI chạy sẵn cho người dùng thì phải làm máy chủ trung gian, ngoài phạm vi bản này | Trước khi phát hành |

## Hai điều phải tránh

- **Không chép `cookie-manga-extracted/`** của repo cũ sang đây. Đó là gói APK giải nén của một app khác, `.gitignore` của repo cũ ghi rõ là mã và tài sản độc quyền của bên thứ ba. Không có code nào trong `src/` dùng nó.
- **Nhánh nguồn là `feature/first-version`, không phải `main`.** `main` của repo cũ vẫn là app đọc truyện và không chứa bản Mangaka AI. Đừng dùng `main` để so sánh.
