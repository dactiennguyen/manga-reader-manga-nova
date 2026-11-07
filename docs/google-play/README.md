# Đưa Manganova lên Google Play

Thư mục này chứa mọi thứ cần đưa lên Play Console. Từng ô phải điền nằm ở [huong-dan-dien.html](huong-dan-dien.html): mở file bằng trình duyệt, mỗi ô có nút Copy.

| Link | |
| --- | --- |
| Website | https://manganova.pages.dev |
| Chính sách quyền riêng tư | https://manganova.pages.dev/privacy |
| Điều khoản sử dụng | https://manganova.pages.dev/terms |

## 1. Tài sản có sẵn

| Thứ | File | Kích thước | Yêu cầu của Google |
| --- | --- | --- | --- |
| Icon app | `graphics/app-icon-512.png` | 512×512 PNG | 512×512, PNG 32-bit |
| Ảnh bìa | `graphics/feature-graphic-1024x500.png` | 1024×500, PNG 24-bit không alpha | 1024×500, JPEG hoặc PNG 24-bit |
| Ảnh điện thoại | `screenshots/phone/01–07*.png`, ảnh dự phòng ở `extra/` | 1080×1920 (9:16) | Tối đa 8 ảnh |
| Ảnh máy tính bảng 10" | `screenshots/tablet-10/01–07*.png`, ảnh dự phòng ở `extra/` | 1440×2560 (9:16) | Dùng được cho cả ô 7" và 10" |
| Mô tả | `descriptions.txt` | Tên 22/30, mô tả ngắn 80/80, mô tả đầy đủ 3571/4000 | 30 / 80 / 4000 ký tự |
| Truyện mẫu | `sample/lantern.manganova` | | Để chụp lại ảnh, không tải lên Play |

Không tải cả thư mục `extra/` cùng 7 ảnh chính. Đó chỉ là ảnh thay thế.

## 2. Việc bắt buộc trước khi nộp

Việc 2 chưa xong, thiếu thì không nộp được.

1. **Upload key đã tạo.** Alias `manganova-upload`, file `android/app/manganova-upload.keystore`. Mật khẩu không nằm trong repo: GitHub Actions lấy từ Secrets, build trên máy lấy từ `android/keystore.properties`, và bản lưu ở `~/keys/`. Hãy sao lưu mật khẩu ra nơi an toàn, vì Secrets không đọc lại được.

2. **Có email liên hệ.** Email này công khai trên trang app, và Play yêu cầu trang chính sách có thông tin liên hệ. Có email rồi thì điền vào `website/privacy.html` và `website/terms.html`, rồi deploy lại theo [13-website.md](../13-website.md).

3. **Trang chính sách quyền riêng tư.** Đã xong, ghi đúng tên Manganova và package. Link ở đầu file này.

4. **Build file nộp.** Play nhận AAB, không nhận APK:

   ```sh
   cd android && ./gradlew bundleRelease -PversionName=1.0.0 -PversionCode=1
   # file: android/app/build/outputs/bundle/release/app-release.aab
   ```

   Mỗi lần nộp bản mới phải tăng `versionCode`.

5. **Package không đổi được sau khi đăng.** `com.manganova.manga.reader.org` sẽ đi theo app mãi mãi.

6. **Chặn chụp màn hình.** Bản release đang bật `FLAG_SECURE`, nên người dùng không chụp được màn hình app. Với app sáng tác, nhiều người muốn khoe tranh, nên hãy cân nhắc tắt trước khi đăng: đổi `SECURE_SCREEN` thành `false` trong `MainActivity.kt`.

7. **Server AI phải là `https://`.** Bản release chặn kết nối không mã hóa.

## 3. Điền Play Console

Từng ô phải điền nằm ở [huong-dan-dien.html](huong-dan-dien.html).

Tài khoản cá nhân tạo sau 13/11/2023 phải có ít nhất 12 người thử kín liên tục 14 ngày rồi mới xin được Production access. Quy định này tra ngày 7/11/2026 trên [trang của Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). App mới phải target API 36 trở lên, và Manganova đang target 36.

Khi app đã lên store, đổi nút "Coming soon" trên website theo [13-website.md](../13-website.md).

## 4. Những gì Google hay từ chối

- Ảnh có chữ "debug", thanh thông báo lộn xộn, hoặc không phải ảnh thật của app.
- Mô tả hứa làm được điều app không làm. App không tự vẽ tranh, và mô tả đã ghi rõ AI chỉ hỗ trợ chữ.
- Link chính sách chết, hoặc trang không nói về app.
- Data safety mâu thuẫn với quyền trong manifest.

**Về tranh trong ảnh chụp:** truyện mẫu "Lantern Courier" dùng tranh do AI vẽ rồi đưa vào app dưới dạng layer ảnh, không phải vẽ bằng bút trong app. Giao diện trong ảnh là thật. Nếu muốn ảnh quảng cáo phản ánh sát nhất, hãy thay bằng tranh thật của một họa sĩ khi có.

## 5. Cách chụp lại bộ ảnh

Truyện mẫu sinh bằng `__tests__/sampleStory.test.ts`, bỏ qua khi chạy test thường. File đã đóng gói nằm ở `sample/lantern.manganova`.

- Chụp từ bản debug, vì bản release chặn chụp màn hình. Máy ảo `mangaka_test` chạy với `-no-window`: `wm size 1080x1920` với `wm density 420` cho điện thoại, `wm size 1440x2560` với `wm density 340` cho máy tính bảng.
- Nạp truyện: đẩy file vào thư mục cache của app rồi mở bằng intent `VIEW`.
- Thanh trạng thái dùng chế độ demo của Android: đồng hồ 10:00, pin đầy, không thông báo.
- Bỏ kênh alpha để thành PNG 24-bit: `magick in.png -alpha off out.png`.
