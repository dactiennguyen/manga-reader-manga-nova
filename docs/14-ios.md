# iOS

Bản iOS dùng chung toàn bộ code TypeScript với Android. Phần riêng của iOS nằm trong `ios/`.

## Trạng thái

| Phần | Kết quả |
| --- | --- |
| Build Release cho simulator | Chạy được, Xcode 26.1 |
| iPhone 17 Pro (simulator) | Onboarding, Home, mở file `.manganova` và `.mangaka` từ ngoài app, vẽ, chèn vật liệu, xuất PDF, CBZ, ZIP PNG, ảnh dài, chia sẻ, lưu vào app Tệp |
| iPad Pro 13" (simulator) | Mở được, xoay ngang được |
| Máy thật, Apple Pencil | **Chưa thử** |
| Build `simulator` qua CI | Lệnh build đã chạy thử trên máy, Xcode 26.1 |
| Ad Hoc, TestFlight qua CI | **Chưa chạy**, cần tài khoản Apple Developer |

## Chạy trên máy

Cần macOS, Xcode 26 trở lên và CocoaPods.

```sh
npm install
cd ios && pod install && cd ..
npm run ios
```

Mở bằng Xcode thì mở `ios/Manganova.xcworkspace`, không mở file `.xcodeproj`.

## Khác với Android

| Phần | Android | iOS |
| --- | --- | --- |
| Phiên bản tối thiểu | Android 7.0 | iOS 16.0. SSZipArchive cần mức này, và khóa xoay màn dùng API của iOS 16 |
| Chặn chụp màn hình | `FLAG_SECURE` ở bản release | Không làm được. `setSecure` không làm gì |
| Màn khởi động | `core-splashscreen`, giữ tới khi màn đầu vẽ xong | `LaunchScreen.storyboard`, tự tắt |
| Thanh hệ thống | `setSystemBarsDarkIcons` đổi màu icon | Component `StatusBar` lo. iOS không có thanh điều hướng |
| Lùi màn | Nút Back cứng, chặn bằng `BackHandler` | Vuốt từ mép trái. Đã tắt ở các màn vẽ và màn nhiều bước, vì `BackHandler` không chạy trên iOS |
| Mở file truyện | intent-filter | Khai `com.manganova.project` (`.manganova`) và `com.manganova.legacy-project` (`.mangaka`) trong `Info.plist`. iOS chép file vào `Documents/Inbox` rồi mở bằng URL `file://`. App xóa bản chép đó sau khi nhập |
| Truyện mẫu | Asset `sample/lantern.manganova` | Cùng file đó, Xcode trỏ tới thư mục của Android và đóng vào bundle |
| Phông giao diện | `android/app/src/main/assets/fonts` | Cùng các file đó, Xcode trỏ tới thư mục của Android và khai ở `UIAppFonts` |

## Module native

`specs/NativeFiles.ts` và `specs/NativeScreen.ts` có hai bản: Kotlin cho Android, Objective-C++ cho iOS.

| File | Việc |
| --- | --- |
| `ios/Manganova/NativeFilesModule.mm` | Zip theo thứ tự tên (đọc CBZ cần đúng thứ tự), unzip, ghép ảnh thành PDF, ghép ảnh thành video MP4, bảng chia sẻ có tiêu đề, clipboard. `mimeType` của `shareFile` chỉ dùng trên Android, iOS lấy loại file từ đuôi |
| `ios/Manganova/NativeScreenModule.mm` | Khóa xoay màn, giữ màn hình sáng. Các hàm còn lại không làm gì trên iOS. Trên iPad, iPadOS bỏ qua khóa xoay khi app đang chạy đa nhiệm |

Đổi chữ ký hàm trong `specs/` thì phải sửa cả hai bản. Tên hàm Objective-C phải khớp file sinh ra ở `ios/build/generated/ios/ReactCodegen/ManganovaSpecs/ManganovaSpecs.h` sau khi chạy `pod install`.

Thêm file vào `ios/Manganova/` thì phải thêm vào project Xcode, vì Xcode không tự nhận.

## Icon

`sh scripts/gen-icons.sh` tạo lại icon và chữ M của màn khởi động cho cả Android và iOS. iOS chỉ cần một icon 1024px, không có kênh alpha.

## Phát hành

### Việc của bạn

1. Đăng ký Apple Developer Program, 99 USD mỗi năm.
2. Trên App Store Connect, tạo app với bundle id `com.manganova.manga.reader.org`.
3. Tạo chứng chỉ **Apple Distribution**, xuất ra file `.p12` có mật khẩu.
4. Tạo provisioning profile loại **App Store** cho bundle id trên. Muốn cài thẳng lên iPhone mà không qua TestFlight thì tạo thêm một profile loại **Ad Hoc**, chọn các máy đã đăng ký UDID.
5. Trong App Store Connect → Users and Access → Integrations, tạo API key quyền App Manager, tải file `.p8`.

### Build bằng GitHub Actions

Chạy workflow **Build iOS (manual)** ở tab Actions, chọn nhánh và `mode`:

| `mode` | Kết quả | Cần gì |
| --- | --- | --- |
| `simulator` | `Manganova-simulator.zip` chứa `Manganova.app` cho iOS Simulator | Không cần gì |
| `adhoc` | `Manganova.ipa` cài thẳng lên iPhone đã đăng ký, không qua TestFlight | Chứng chỉ, Team ID, profile Ad Hoc |
| `testflight` | IPA được đẩy lên TestFlight | Chứng chỉ, Team ID, profile App Store, API key |

File build nằm ở mục Artifacts của lần chạy, giữ 3 ngày. Trang tóm tắt của lần chạy có lệnh cài. Bỏ chọn `run_checks` để bỏ qua typecheck, lint và test khi chỉ cần build lại nhanh.

Cài bản `simulator`:

```sh
unzip Manganova-simulator.zip
xcrun simctl install booted Manganova.app
```

Cài bản `adhoc`: cắm iPhone vào Mac rồi kéo file `.ipa` vào máy trong Finder, hoặc chạy `xcrun devicectl device install app --device <UDID> Manganova.ipa`. Máy phải nằm trong profile Ad Hoc. Muốn thêm máy thì đăng ký UDID trên developer.apple.com, tạo lại profile Ad Hoc, rồi cập nhật secret. Mỗi năm Apple cho đăng ký tối đa 100 iPhone.

Trước khi ký, workflow đọc profile và dừng sớm, kèm lý do, khi gặp một trong các lỗi sau:
- Profile sai Team ID hoặc sai bundle id.
- Profile đã hết hạn.
- Dùng profile Ad Hoc cho TestFlight, hoặc ngược lại.

### GitHub Secrets

| Secret | Giá trị | Dùng cho |
| --- | --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | `base64 -i cert.p12 \| pbcopy` | `adhoc`, `testflight` |
| `IOS_DIST_CERT_PASSWORD` | Mật khẩu file `.p12` | `adhoc`, `testflight` |
| `IOS_TEAM_ID` | Team ID, 10 ký tự, ở trang Membership | `adhoc`, `testflight` |
| `IOS_ADHOC_PROFILE_BASE64` | `base64 -i adhoc.mobileprovision \| pbcopy`, profile loại **Ad Hoc** | `adhoc` |
| `IOS_PROVISIONING_PROFILE_BASE64` | `base64 -i appstore.mobileprovision \| pbcopy`, profile loại **App Store** | `testflight` |
| `ASC_KEY_ID` | Key ID của API key | `testflight` |
| `ASC_ISSUER_ID` | Issuer ID ở cùng trang | `testflight` |
| `ASC_KEY_P8_BASE64` | `base64 -i AuthKey_XXXX.p8 \| pbcopy` | `testflight` |

Một chứng chỉ Apple Distribution dùng được cho cả `adhoc` và `testflight`. Workflow ghi thông tin ký vào xcconfig riêng của app, vì nếu truyền qua dòng lệnh thì các target Pods cũng nhận và báo lỗi. Cache CocoaPods được lưu ngay sau `pod install`, trước bước ký, nên thông tin ký không lọt vào cache. Mỗi lần đẩy lên TestFlight phải tăng `build_number`.

Phần `adhoc` và `testflight` chưa chạy thật lần nào, vì chưa có tài khoản. Lần đầu chạy có thể phải sửa. Phần `simulator` đã build thử trên máy với đúng lệnh của workflow.

### Trên App Store Connect

- Ảnh chụp iPhone 6.9" (1320×2868) và iPad 13" (2064×2752).
- Privacy Nutrition Labels: khai giống Data safety của Google Play.
- `ITSAppUsesNonExemptEncryption` đã đặt `false`, vì app chỉ dùng HTTPS của hệ thống.
- `PrivacyInfo.xcprivacy` đã nằm trong app.

## Chưa làm

- Thử trên iPhone và iPad thật, nhất là Apple Pencil: lực nhấn, chống tì tay, và cử chỉ chạm bốn ngón của hệ thống.
- Khóa xoay ngang ở màn đọc. Code đã có nhưng chưa thử trên simulator.
