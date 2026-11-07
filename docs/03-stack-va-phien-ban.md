# Stack và phiên bản

Tra trên npm ngày 2026-11-07. Ghim đúng phiên bản trong bảng khi khởi tạo, chỉ nâng có chủ đích.

## Nền tảng

Các giá trị này lấy từ template chính thức `@react-native-community/template@0.88.1`.

| Thứ | Phiên bản | Ghi chú |
| --- | --- | --- |
| `react-native` | **0.88.1** | Bản ổn định mới nhất, phát hành 2026-10-27 |
| `react` | **19.3.0** | Ghim đúng bản template dùng. npm đã có 19.3.1 nhưng đừng tự nâng |
| Node | ^22.13 hoặc ^24.3 | Theo `engines` của `react-native` |
| JDK | 17 | Theo repo cũ, kiểm tra lại ở giai đoạn 1 |
| Gradle | 9.4.1 | |
| Kotlin | 2.2.0 | |
| Android | min 24, target 36, compile 37 | Target 36 đáp ứng yêu cầu Play hiện tại |
| NDK | 27.1.12297006 | |
| Cờ build | `newArchEnabled`, `hermesEnabled`, `edgeToEdgeEnabled` đều `true` | |

## Thư viện chạy trong app

| Việc | Thư viện | Phiên bản |
| --- | --- | --- |
| Vẽ, dựng trang, xuất ảnh | `@shopify/react-native-skia` | 2.14.0 |
| Hoạt ảnh, chạy trên luồng giao diện | `react-native-reanimated` + `react-native-worklets` | 4.7.1 + 0.13.1 |
| Cử chỉ | `react-native-gesture-handler` | 3.5.0 |
| Dữ liệu | `@op-engineering/op-sqlite` | 19.0.5 |
| Trạng thái | `zustand` | 5.1.0 |
| Kiểm tra dữ liệu nhập | `zod` | 4.6.7 |
| Điều hướng | `@react-navigation/native` + `native-stack` + `bottom-tabs` | 7.5.1 + 7.21.0 + 7.21.0 |
| Nền của điều hướng | `react-native-screens`, `react-native-safe-area-context` | 4.30.1, 5.11.1 |
| Danh sách lớn | `@shopify/flash-list` | 2.3.3 |
| Bàn phím | `react-native-keyboard-controller` | 1.23.0 |
| File | `@dr.pogodin/react-native-fs` | 2.41.0 |
| Chọn file, ảnh | `@react-native-documents/picker` | 12.0.3 |
| SVG, icon | `react-native-svg`, `phosphor-react-native` | 15.16.1, 3.0.6 |
| Style | `uniwind` + `tailwindcss` | 1.13.2 + 4.3.5 |

`perfect-freehand` 1.2.3 không cài qua npm mà chép mã nguồn vào `src/core/art/freehand.ts`, giữ giấy phép MIT. Lý do ở [07-canvas.md](07-canvas.md).

`reanimated` và `worklets` khai báo rõ hỗ trợ RN 0.86–0.88. Skia yêu cầu RN ≥ 0.78. Các thư viện còn lại khai peer `*`, nghĩa là **chưa có gì chứng minh chúng chạy được trên 0.88.1**. Giai đoạn 1 build release với đủ thư viện để kiểm tra việc này.

**Tailwind:** dùng Uniwind thay vì NativeWind vì NativeWind bản ổn định (4.x) vẫn ở Tailwind 3, bản 5 còn là RC. Uniwind chạy Tailwind 4, khai rõ hỗ trợ RN ≥ 0.81 và có theme sáng tối bằng biến CSS. Token nằm ở `global.css`, không có file theme TS riêng.

**Đã chạy thật ngày 2026-11-07** trên máy ảo Android 16, bản release bật R8: Skia, Reanimated, Gesture Handler, op-sqlite (blob, transaction, WAL), Uniwind (đổi theme), hai TurboModule. Chưa thử trên máy thật.

Hai thay đổi API dễ vấp:

- Skia 2.14: `SkPath` là bất biến, không còn `moveTo`. Dựng bằng `Skia.PathBuilder.Make()...build()`.
- Gesture Handler 3: dùng hook `usePanGesture({ onUpdate })`. `Gesture.Pan()` đã deprecated.

## Công cụ phát triển

Giữ theo template, **không nâng lên bản mới nhất trên npm**:

| Thứ | Dùng | Mới nhất | Vì sao không nâng |
| --- | --- | --- | --- |
| TypeScript | ^6.0.3 | 7.0.2 | `typescript-eslint` 8.72.1 chỉ nhận `<6.1.0` |
| ESLint | ^8.19 | 10.14.0 | `@react-native/eslint-config` chỉ nhận 8 hoặc 9 |
| Jest | ^29.6.3 | 30.5.2 | Theo `@react-native/jest-preset` của template |
| Prettier | 2.8.8 | 3.9.10 | Theo template |

Thêm hai công cụ: `@testing-library/react-native` 14.1.0 cho test thành phần (bản này cần gói peer `test-renderer` ^1.0.0, khác với `react-test-renderer` của template) và Maestro 2.x cho test luồng trên máy ảo, cài ngoài npm.

## Thay đổi so với app cũ

| Bỏ | Thay bằng | Lý do |
| --- | --- | --- |
| `react-native-mmkv`, `react-native-nitro-modules` | Bảng `meta` trong SQLite | Bớt hai thư viện native. Cài đặt rất nhỏ, đọc đồng bộ bằng `executeSync` |
| `@sayem314/react-native-keep-awake` | Thêm một hàm trong `NativeScreen` | Một dòng Kotlin, không đáng một thư viện |
| `ToastAndroid`, `Alert` | `Toast`, `Dialog` tự vẽ | Đổi được giao diện |
| Font Material Icons | Phosphor | Có `regular`, `fill`, `duotone` trong một bộ, nên trạng thái đang chọn đổi kiểu icon mà vẫn cùng họ |

Không dùng Drizzle, vì dữ liệu lưu dạng dòng tài liệu nên ORM không có việc gì để làm. Không dùng thư viện bottom sheet: `Sheet` tự viết bằng Reanimated và Gesture Handler vừa đủ, và phải khớp token Studio.

## Khởi tạo project

Thư mục `manga-reader-ai` đã có `docs/`, nên tạo ở thư mục tạm rồi chuyển vào:

```sh
cd /Volumes/D/OUTSOURCE
npx @react-native-community/cli@20.2.0 init MangakaAI \
  --version 0.88.1 \
  --package-name com.mangakaai.app \
  --title "Mangaka AI" \
  --directory manga-reader-ai-init \
  --skip-git-init

rsync -a manga-reader-ai-init/ manga-reader-ai/
rm -rf manga-reader-ai-init manga-reader-ai/ios

cd manga-reader-ai
git init
```

Sau đó:

1. Xóa script `ios` và gói `@react-native-community/cli-platform-ios`, `@react-native/new-app-screen`.
2. Thêm `plugins: ['react-native-worklets/plugin']` vào `babel.config.js`, plugin này phải đứng cuối.
3. Thêm dòng `import 'react-native-gesture-handler';` ở đầu `index.js`.
4. Trong `android/gradle.properties`, đặt `reactNativeArchitectures=arm64-v8a,x86_64` khi phát triển. Bản phát hành dùng AAB đủ kiến trúc, trừ khi đo thấy nên bỏ `armeabi-v7a`.
5. Bật R8 cho release (`enableProguardInReleaseBuilds = true`). App cũ đang tắt.
6. Đóng gói Inter và các phông trong trang vào `android/app/src/main/assets/fonts`, và vào `src/assets/fonts` cho Skia.
