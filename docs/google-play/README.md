# Đưa Manganova lên Google Play

Thư mục này chứa mọi thứ cần dán vào Play Console, cùng danh sách từng mục phải điền. Làm theo thứ tự từ trên xuống.

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

Ba việc đầu chưa xong, và thiếu việc nào cũng không nộp được.

1. **Tạo upload key.** Bản release hiện ký bằng debug key, Google sẽ từ chối. Tạo khóa rồi cất ngoài repo:

   ```sh
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore ~/keys/manganova-upload.keystore \
     -alias manganova-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Rồi tạo `android/keystore.properties` (đã nằm trong `.gitignore`):

   ```properties
   storeFile=/Users/<bạn>/keys/manganova-upload.keystore
   storePassword=...
   keyAlias=manganova-upload
   keyPassword=...
   ```

   Mất khóa thì phải xin Google đặt lại, nên hãy sao lưu nó và mật khẩu.

2. **Trang chính sách quyền riêng tư.** Play bắt buộc có link này. Trang đã nằm ở `website/privacy.html`, ghi đúng tên Manganova và package. Cách deploy ở `docs/13-website.md`.

3. **Có email liên hệ.** Email này công khai trên trang app, và Play yêu cầu trang chính sách có thông tin liên hệ. Có email rồi thì điền vào `website/privacy.html` và `website/terms.html`.

4. **Build file nộp.** Play nhận AAB, không nhận APK:

   ```sh
   cd android && ./gradlew bundleRelease -PversionName=1.0.0 -PversionCode=1
   # file: android/app/build/outputs/bundle/release/app-release.aab
   ```

   Mỗi lần nộp bản mới phải tăng `versionCode`.

5. **Package không đổi được sau khi đăng.** `com.manganova.manga.reader.org` sẽ đi theo app mãi mãi.

6. **Chặn chụp màn hình.** Bản release đang bật `FLAG_SECURE`, nên người dùng không chụp được màn hình app. Với app sáng tác, nhiều người muốn khoe tranh, nên hãy cân nhắc tắt trước khi đăng: đổi `SECURE_SCREEN` thành `false` trong `MainActivity.kt`.

7. **Server AI phải là `https://`.** Bản release chặn kết nối không mã hóa.

## 3. Tài khoản Play Console

- Đăng ký tại https://play.google.com/console, phí một lần 25 USD.
- Tài khoản **cá nhân** tạo sau 13/11/2023 phải qua **thử nghiệm kín**: tối thiểu 12 người thử liên tục 14 ngày, rồi mới xin được Production access. Kiểm tra lại con số này trong Play Console trước khi lên kế hoạch.

## 4. Tạo app

| Mục | Điền |
| --- | --- |
| App name | `Manganova: Manga Maker` |
| Default language | English (United States) – en-US |
| App or game | App |
| Free or paid | Free (chọn Free rồi không đổi sang Paid được) |
| Declarations | Tick cả hai ô đồng ý |

## 5. Store listing

| Mục | Điền |
| --- | --- |
| Short description | Dòng "Short description" trong `descriptions.txt` |
| Full description | Khối "Full description" trong `descriptions.txt` |
| App icon | `graphics/app-icon-512.png` |
| Feature graphic | `graphics/feature-graphic-1024x500.png` |
| Phone screenshots | `screenshots/phone/01` tới `07`, đúng thứ tự |
| 7-inch và 10-inch tablet | `screenshots/tablet-10/01` tới `07` |
| Video | Bỏ trống |

Alt text gợi ý, theo thứ tự ảnh: `Home screen with ways to start a comic`; `Canvas with a character pinned as a reference`; `Storyboard of manga pages`; `Lettering with speech bubbles`; `Reading a finished page`; `Two-point perspective ruler on the canvas`; `Materials library of line-art backgrounds`.

## 6. Store settings

| Mục | Điền |
| --- | --- |
| App category | Art & Design (hoặc Comics) |
| Tags | Comics, Drawing, Creativity |
| Contact email | Email ở mục 2 |
| Website | Trang chủ của `website/` |

## 7. App content

| Mục | Trả lời |
| --- | --- |
| Privacy policy | Link ở mục 2 |
| App access | All functionality is available without special access |
| Ads | No |
| Content ratings | Hoàn tất bảng IARC theo đúng nội dung thật, không đoán trước kết quả |
| Target audience | Chọn đúng nhóm tuổi app hướng tới. Nhóm dưới 18 có thể kéo theo Families Policy |
| News, COVID-19, Government, Financial, Health | No |
| Advertising ID | No, app không có SDK quảng cáo hay analytics |
| Data safety | Xem mục 8 |

## 8. Data safety

App không có tài khoản, analytics, crash report hay quảng cáo. Dữ liệu ở trên máy, trừ khi người dùng tự cấu hình server AI: khi đó nội dung truyện và câu hỏi được gửi tới server đó sau khi họ bấm nút. Vì Google tính việc truyền dữ liệu ra khỏi máy là "collect", hãy đọc kỹ định nghĩa hiện tại rồi khai theo đúng bản phát hành. Mình không tự kết luận phần này thay bạn. Manifest chỉ xin `INTERNET` và `VIBRATE`, bản khai phải khớp.

## 9. Thử nghiệm và phát hành

1. **Internal testing:** tải `app-release.aab`, thêm email tester, cài và chạy thử bản thật.
2. **Closed testing:** nếu tài khoản thuộc diện bắt buộc.
3. **Production:** chọn AAB, chọn quốc gia, gửi duyệt. Lần đầu có thể mất vài ngày tới một tuần.

Release notes mẫu:

```
<en-US>
First release of Manganova.
• Draw with G-pen, pencil, brush, screentone and layers
• Perspective rulers and symmetry
• Ready-made backgrounds and patterns to drop into panels
• Pin a character on the canvas while you draw
• Letter with bubbles, narration and SFX
• Export PDF, PNG, CBZ or a webtoon image
</en-US>
```

## 10. Những gì Google hay từ chối

- Ảnh có chữ "debug", thanh thông báo lộn xộn, hoặc không phải ảnh thật của app.
- Mô tả hứa làm được điều app không làm. App không tự vẽ tranh, và mô tả đã ghi rõ AI chỉ hỗ trợ chữ.
- Link chính sách chết, hoặc trang không nói về app.
- Data safety mâu thuẫn với quyền trong manifest.

**Về tranh trong ảnh chụp:** truyện mẫu "Lantern Courier" dùng tranh do AI vẽ rồi đưa vào app dưới dạng layer ảnh, không phải vẽ bằng bút trong app. Giao diện trong ảnh là thật. Nếu muốn ảnh quảng cáo phản ánh sát nhất, hãy thay bằng tranh thật của một họa sĩ khi có.

## 11. Cách chụp lại bộ ảnh

Truyện mẫu sinh bằng `__tests__/sampleStory.test.ts`, bỏ qua khi chạy test thường. File đã đóng gói nằm ở `sample/lantern.manganova`.

- Chụp từ bản debug, vì bản release chặn chụp màn hình. Máy ảo `mangaka_test` chạy với `-no-window`: `wm size 1080x1920` với `wm density 420` cho điện thoại, `wm size 1440x2560` với `wm density 340` cho máy tính bảng.
- Nạp truyện: đẩy file vào thư mục cache của app rồi mở bằng intent `VIEW`.
- Thanh trạng thái dùng chế độ demo của Android: đồng hồ 10:00, pin đầy, không thông báo.
- Bỏ kênh alpha để thành PNG 24-bit: `magick in.png -alpha off out.png`.
