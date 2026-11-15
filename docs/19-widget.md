# Widget trên màn hình chính

Widget giúp người dùng quay lại vẽ mỗi ngày. Nó cho thấy chuỗi ngày vẽ, số nét hôm nay so với mục tiêu, và đề bài hôm nay. Có trên iOS và Android.

## Widget hiện gì

| Phần | Nội dung | Lấy từ đâu trong app |
| --- | --- | --- |
| Ngọn lửa | Tô đặc màu `accent` khi hôm nay đã vẽ, nét mảnh màu `text-muted` khi chưa | Giống `StreakMiniCard` |
| Chuỗi ngày | "5 ngày" | `currentStreak` trong `core/story/activity.ts` |
| Dòng phụ | "Chuỗi ngày vẽ". Khi hôm nay chưa vẽ nét nào thì đổi thành lời nhắc giữ chuỗi | Hai câu có sẵn: `A few strokes today keep your streak going.` và `Fresh start today. One small drawing begins a new streak.` |
| Thanh mục tiêu | Số nét hôm nay so với mục tiêu. Đạt mục tiêu thì chuyển màu `success`. Tắt mục tiêu thì ẩn thanh | `dailyGoal` trong Cài đặt |
| Số nét | "Hôm nay 40/100", hoặc "Hôm nay 40 nét" khi tắt mục tiêu | Như `StreakMiniCard` |
| Đề bài | Thẻ "Đề bài hôm nay" và nội dung đề. Đã bấm Xong thì có dòng "Hôm nay xong rồi" | `dailyPrompt` trong `core/studio/prompts.ts` |

## Kích thước

| Nền tảng | Kích thước | Hiện gì |
| --- | --- | --- |
| iOS | `systemSmall` | Chuỗi ngày và số nét |
| iOS | `systemMedium` | Thêm thẻ đề bài bên phải |
| iOS | Màn khóa `accessoryCircular` | Ngọn lửa, số ngày, vòng tiến độ tới mục tiêu |
| iOS | Màn khóa `accessoryRectangular` | Chuỗi ngày, số nét, dòng phụ |
| Android | Một widget đổi được cỡ, mặc định 4×2 | Từ 220dp chiều ngang trở lên thì hiện thẻ đề bài. Nhỏ hơn thì chỉ hiện chuỗi ngày |

## Bấm vào widget

- Bấm vào widget mở `manganova://widget`: app về Home.
- Bấm vào thẻ đề bài mở `manganova://widget/prompt`: app làm đúng việc của nút "Làm ngay" trên thẻ đề bài ở Home (`features/home/startPrompt.ts`).
- Khi chưa xong onboarding, app không chuyển màn.

Link được xử lý ở `features/home/widgetLink.ts`, trước link phòng chơi và link thẻ mangaka.

## Dữ liệu đi thế nào

Widget không chạy được JavaScript. Vì vậy app tính sẵn mọi thứ, kể cả chữ đã dịch, rồi đưa cho widget một chuỗi JSON.

1. `core/widget/snapshot.ts` dựng snapshot từ truyện, hoạt động vẽ, mục tiêu, đề bài đã xong, theme và ngôn ngữ đang dùng. Phần này là TypeScript thuần và có test ở `__tests__/widget.test.ts`.
2. `features/home/widgetSync.ts` gửi snapshot khi một trong các thứ trên đổi. Vẽ liên tục thì gom lại, gửi sau 3 giây nghỉ. Khi app ra nền, khi quay lại, lúc nửa đêm và khi đổi ngôn ngữ thì gửi ngay. Chuỗi giống lần trước thì không gửi.
3. `specs/NativeWidget.ts` có một hàm `update(snapshot)`.
   - iOS: `ios/Manganova/NativeWidgetModule.mm` ghi vào UserDefaults của App Group `group.com.manganova.manga.reader.org`, rồi gọi `WidgetCenter` qua `WidgetReloader.swift`.
   - Android: `NativeWidgetModule.kt` ghi vào SharedPreferences `widget`, rồi `StreakWidget.kt` vẽ lại mọi widget đang đặt.

## Qua nửa đêm

Snapshot chứa sẵn ba ngày: ngày tạo, ngày hôm sau, và mọi ngày sau đó. Widget so ngày của chính nó với `day` trong snapshot để chọn ngày cần hiện. Nhờ vậy widget vẫn đúng khi app không mở.

| Ngày | Chuỗi ngày | Số nét | Đề bài |
| --- | --- | --- | --- |
| Ngày tạo | Như trong app | Số nét hôm nay | Đề hôm nay |
| Hôm sau | Giữ nguyên nếu hôm đó đã vẽ, về 0 nếu chưa | 0, kèm lời nhắc | Đề của hôm sau, đã tính sẵn |
| Sau nữa | 0 | 0, kèm lời nhắc | "Mở Manganova để xem đề bài hôm nay." |

- iOS: timeline có ba mục, lúc này và hai lần nửa đêm kế tiếp.
- Android: một alarm không đánh thức máy chạy lúc 0:00:05. Widget cũng vẽ lại khi đổi giờ, đổi múi giờ, và mỗi giờ một lần để phòng hờ.

Ngày luôn tính theo lịch Gregory và giờ của máy, giống `dayKey()` trong app. Máy dùng lịch Phật giáo (tiếng Thái) vẫn ra đúng ngày.

## Màu và theme

Màu lấy từ token Studio trong `global.css`: nền `bg` (giấy kem), thẻ `surface`, chữ `text`, `text-secondary`, `text-muted`, màu nhấn `accent`, `success`, và `divider` cho rãnh của thanh mục tiêu. Đổi token thì sửa cả ba chỗ:

- `global.css`
- `ios/ManganovaWidget/StreakWidget.swift` (`WidgetPalette`)
- `android/app/src/main/res/values/widget_colors.xml`

Widget theo theme chọn trong Profile. Chọn "Theo hệ thống" thì widget theo chế độ tối của máy. Trên Android 11 trở xuống, widget lấy chế độ tối lúc vẽ, nên có thể trễ tới lần vẽ sau.

Icon ngọn lửa là glyph `Flame` của Phosphor, cùng glyph với `StreakIcon` trong app. iOS dùng file SVG trong `ios/ManganovaWidget/Assets.xcassets`. Android dùng `ic_widget_flame.xml` (fill) và `ic_widget_flame_outline.xml` (regular). Chữ dùng phông hệ thống, vì đóng Inter vào widget làm app nặng thêm khoảng 1 MB.

## Ngôn ngữ

- Chữ trong widget đến từ app, đã dịch bằng `t()`. Chỉ có một chuỗi mới, nằm ở nhóm `widget` trong các file `src/core/i18n/locales/*.json`. Các chuỗi khác dùng lại chuỗi đã có.
- Tên, mô tả trong danh sách widget, chữ khi app chưa gửi gì, và chữ mẫu cho ảnh xem trước là chữ native:
  - Android: `widget_*` trong `res/values*/strings.xml`.
  - iOS: `ios/ManganovaWidget/<ngôn ngữ>.lproj/Localizable.strings`.
- Cả hai đủ 10 ngôn ngữ. Thêm ngôn ngữ thì thêm ở cả hai chỗ.

## File

| File | Việc |
| --- | --- |
| `src/core/widget/snapshot.ts` | Dựng snapshot, chọn ngày cần hiện |
| `src/core/widget/link.ts` | Hai link của widget |
| `src/features/home/widgetSync.ts` | Gửi snapshot khi dữ liệu đổi |
| `src/features/home/widgetLink.ts` | Mở Home hoặc đề bài khi bấm widget |
| `src/native/widget.ts`, `specs/NativeWidget.ts` | Cầu sang native |
| `ios/ManganovaWidget/` | Extension WidgetKit (SwiftUI): `StreakWidget.swift`, `WidgetSnapshot.swift`, ảnh, chữ, entitlements |
| `ios/Manganova/NativeWidgetModule.mm`, `WidgetReloader.swift` | Module native trên iOS |
| `android/.../StreakWidget.kt` | `AppWidgetProvider`, vẽ `RemoteViews`, alarm nửa đêm |
| `android/.../res/layout/widget_streak_*.xml`, `res/xml/widget_streak_info.xml` | Layout và khai báo widget |

## Ký app trên iOS

Extension có bundle id riêng `com.manganova.manga.reader.org.widget` và cần profile riêng. App và extension đều cần App Group. Các bước ở [iOS](14-ios.md#phát-hành).

## Chưa làm

- Chưa thử widget trên máy thật và simulator. App và extension mới chỉ build được.
- Ad Hoc và TestFlight có extension chưa chạy thật, vì chưa có tài khoản Apple.
