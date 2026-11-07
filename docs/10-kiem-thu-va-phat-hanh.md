# Kiểm thử và phát hành

## Các lớp kiểm thử

| Lớp | Công cụ | Phạm vi | Chạy khi |
| --- | --- | --- | --- |
| Lõi | Jest trên Node, không giả lập RN | `src/core`: 17 file test cũ, reducer, ops, undo | Mỗi commit |
| Dữ liệu | Jest, port `Db` dùng `node:sqlite` | Migration thật, repo, GC, nhập `.mangaka` | Mỗi commit |
| Thành phần | React Native Testing Library | `src/ui`, trạng thái và thuộc tính trợ năng | Mỗi commit |
| Luồng | Maestro trên máy ảo | Luồng chính, nhập, xuất | Trước mỗi bản build |
| Ảnh trang | So sánh PNG | `render/` | Khi sửa `render/` |
| Máy thật | Tay | Vẽ, bút, rung, chụm hai ngón | Cuối mỗi giai đoạn |

App cũ không có test thành phần nào, 17 file đều là test logic.

## Test bắt buộc

- `__tests__/theme.contrast.test.ts`: đọc file token, kiểm tra mọi cặp ở [05-design-system.md](05-design-system.md#màu) đạt ngưỡng.
- GC không xóa bất kỳ thứ gì còn được tham chiếu, kể cả: tranh trong khung có `deleted_at` chưa hết hạn, ảnh dùng ở bìa, ảnh trong `LayerImage`, ảnh trong `CharacterSheet`, ảnh của `WorldEntry`.
- Hoàn tác: mỗi thao tác tạo patch, áp ngược, thu về đúng trạng thái trước.
- Đổi mẫu khung, Undo, tranh còn nguyên.
- Nhập file `.mangaka` bản 1 thật, gồm trường hợp id lớp trùng nhau giữa các khung.
- Migration chạy từ mọi phiên bản cũ.

## So sánh ảnh trang

Trang truyện phải giống app cũ, vì người dùng mang truyện cũ sang.

1. Ở giai đoạn 0, dùng app cũ xuất PNG các trang của truyện mẫu sinh bởi `sampleStory.test.ts`, làm ảnh chuẩn.
2. Bản mới dựng cùng trang đó ở cùng độ phân giải.
3. So sánh từng pixel, cho phép sai số nhỏ do khử răng cưa. Ngưỡng chốt sau lần chạy đầu.

Chỉ so sánh nội dung trang. Giao diện app đổi hoàn toàn nên không so sánh.

## Thiết bị thử

- Máy ảo Pixel, API 34 và API 36.
- Một máy Android tầm trung thật, dùng cho mọi số đo.
- Một máy có bút cảm ứng.
- Một máy tính bảng 10 inch hoặc máy ảo tương đương.

## CI

GitHub Actions, chỉ build Android. Có hai workflow:

| Workflow | Chạy khi nào | Làm gì |
| --- | --- | --- |
| `check.yml` | Mỗi lần đẩy code hoặc mở PR | `tsc`, `eslint`, `jest` |
| `build-android.yml` | Bấm tay ở tab Actions, chọn **Build Android (manual)** | Kiểm tra như trên, rồi build APK hoặc AAB |

Tham số của `build-android.yml`:

| Tham số | Ý nghĩa |
| --- | --- |
| `format` | `apk` để cài thẳng lên máy, `aab` để nộp Google Play |
| `architecture` | Chỉ dùng cho APK. AAB luôn gồm cả 4 loại CPU |
| `version_name` | Ví dụ `1.0.1` |
| `version_code` | Phải tăng mỗi lần nộp Play. Để trống thì dùng số lần chạy workflow |

Build xong, file nằm ở mục **Artifacts** của lần chạy và chỉ được giữ 1 ngày, nên hãy tải về ngay.

AAB bắt buộc có upload key, nếu thiếu thì workflow dừng ngay ở bước đầu. APK không có khóa vẫn build được, nhưng ký bằng debug key nên chỉ dùng để thử.

### GitHub Secrets

Vào **Settings → Secrets and variables → Actions** của repo và thêm:

| Secret | Giá trị |
| --- | --- |
| `MANGANOVA_KEYSTORE_BASE64` | Keystore mã hóa base64: `base64 -i ~/keys/manganova-upload.keystore \| pbcopy` |
| `MANGANOVA_KEYSTORE_PASSWORD` | Mật khẩu keystore |
| `MANGANOVA_KEY_ALIAS` | `manganova-upload` |
| `MANGANOVA_KEY_PASSWORD` | Mật khẩu khóa |

## Ký app

Keystore `android/app/manganova-upload.keystore` nằm trong repo public theo quyết định của chủ dự án. Mật khẩu thì không bao giờ commit: nó chỉ nằm ở GitHub Secrets và trên máy phát triển. Ai có cả file lẫn mật khẩu là ký được bản nộp, nên lộ mật khẩu thì phải đổi khóa ngay.

```sh
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/keys/manganova-upload.keystore \
  -alias manganova-upload -keyalg RSA -keysize 2048 -validity 10000
```

Mất upload key thì phải xin Google đặt lại, còn lộ thì phải đổi.

`.gitignore` phải có `*.keystore`, `*.jks`, `keystore.properties`, chỉ trừ hai file keystore của `android/app/`.

`android/app/build.gradle` đọc từ biến môi trường `MANGANOVA_KEYSTORE`, `MANGANOVA_KEYSTORE_PASSWORD`, `MANGANOVA_KEY_ALIAS`, `MANGANOVA_KEY_PASSWORD`, hoặc từ `android/keystore.properties` khi build tại máy. Khi chưa có khóa, bản release ký bằng debug key, và Play sẽ từ chối bản đó.

Trên CI, keystore lấy từ [GitHub Secrets](#github-secrets). Bật Play App Signing khi tải bản đầu tiên lên Play Console.

## Điều kiện phát hành

- [ ] Đi trọn luồng trên máy thật bằng bản release đã bật R8.
- [ ] Nhập được mọi file `.mangaka` từ giai đoạn 0.
- [ ] PDF, ZIP PNG, CBZ, ảnh dài, `.manganova` đều đúng, gồm cả truyện A5.
- [ ] Truyện 300 trang mở, cuộn, xuất được, không tràn bộ nhớ.
- [ ] Mọi màn dùng được bằng TalkBack, trừ phần vẽ trên Canvas.
- [ ] Mọi control đạt 48dp, test tương phản qua.
- [ ] Không còn mã màu, `ToastAndroid`, `Alert` trong `src/features`.
- [ ] GC đã chạy thật trên dữ liệu thử mà không mất gì.
- [ ] Đã xong các việc ở [bảng cần quyết](01-tong-quan.md#việc-bạn-cần-quyết-hoặc-tự-làm).

## Google Play

Tài sản nộp store nằm ở [google-play/](google-play/README.md). Làm theo từng ô ở [huong-dan-dien.html](google-play/huong-dan-dien.html). Website và chính sách quyền riêng tư ở [13-website.md](13-website.md).
