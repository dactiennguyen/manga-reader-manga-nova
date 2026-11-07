# Design system "Studio"

Bản giới thiệu có hình ảnh ở [12-phong-cach-studio.md](12-phong-cach-studio.md). Tài liệu này là bảng tra token.

Studio thay cho "Mực và Giấy" của app cũ. Hướng thiết kế: một xưởng in nhỏ. Nền mực ấm hoặc giấy kem, panel nổi bo mềm, màu san hô làm màu nhấn, và tranh minh họa in riso cho phần có cảm xúc. Ở màn làm việc, tranh của người dùng vẫn là thứ sáng nhất.

## Nguyên tắc

1. **Tranh là nhân vật chính.** Trang truyện luôn nền trắng, nằm trên nền tối. Không đặt màu nhấn sát mép tranh nếu không cần thiết.
2. **Màu đến từ mực in.** San hô dùng cho hành động chính và trạng thái đang chọn. Xanh ngọc dành riêng cho AI. Tranh minh họa mang thêm các màu mực khác theo thể loại.
3. **Phân tầng bằng độ sáng, không bằng viền.** Bề mặt càng nổi càng sáng. Viền chỉ dùng khi hai bề mặt cạnh nhau khó phân biệt.
4. **Công cụ nổi, không chiếm chỗ.** Ở màn làm việc, thanh công cụ là panel nổi có thể thu gọn.
5. **Mọi giá trị đi qua token.** Style viết bằng class Tailwind (`className`), token khai ở `global.css`: `bg-surface`, `text-text-muted`, `rounded-lg`, `text-title`. Không viết mã màu, cỡ chữ hay bo góc trực tiếp trong màn hình. ESLint chặn việc này (xem [02-kien-truc.md](02-kien-truc.md)).

So với app cũ, những thứ sau bị bỏ: viền mực 2dp, bóng cứng lệch 4dp, chấm halftone, tiêu đề Anton viết hoa, con dấu `完`, thẻ `ComicCard`, bong bóng thoại làm thành phần giao diện.

## Màu

Mặc định là giao diện sáng (nền giấy). Giao diện tối (nền mực) chọn trong Profile. Thanh công cụ ở màn vẽ luôn tối ở cả hai giao diện.

| Token | Tối | Sáng | Dùng cho |
| --- | --- | --- | --- |
| `bg` | `#15120E` | `#F6EFE3` | Nền màn hình, nền quanh trang truyện |
| `surface` | `#1F1B16` | `#FFFAF0` | Thẻ, danh sách |
| `raised` | `#29241E` | `#FFFDF7` | Panel nổi, dock, sheet |
| `overlay` | `#332D26` | `#EFE5D4` | Menu, dialog, ô đang nhấn |
| `text` | `#F6EFE3` | `#1C1712` | Chữ chính |
| `textSecondary` | `#CFC5B4` | `#4B4338` | Mô tả, nhãn phụ |
| `textMuted` | `#ACA190` | `#645A4C` | Chú thích, placeholder |
| `accent` | `#FF7A5C` | `#BF3419` | Nút chính, tab đang chọn, tiến độ |
| `onAccent` | `#240D06` | `#FFFAF0` | Chữ và icon trên nền `accent` |
| `ai` | `#63CDC4` | `#0C6A6C` | Nút và kết quả của AI |
| `onAi` | `#06201E` | `#FFFAF0` | Chữ trên nền `ai` |
| `danger` | `#FF9AA6` | `#A51C3A` | Xóa, lỗi |
| `success` | `#86D29A` | `#1D6A40` | Trang đã xong, đã lưu |
| `warning` | `#F4C552` | `#765000` | Trang bị đánh dấu cần sửa |
| `divider` | `#40392F` | `#DDD1BD` | Đường kẻ trang trí |
| `controlBorder` | `#8C8273` | `#887C6B` | Viền ô nhập, checkbox, switch |
| `paper` | `#F6EFE3` | `#F6EFE3` | Nền sau tranh in, giống nhau ở cả hai giao diện |
| `onPaper` | `#1C1712` | `#1C1712` | Chữ đặt trên tranh in |
| `scrim` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.45)` | Nền mờ sau sheet, dialog |

Các token nền mềm (`accentSoft`, `aiSoft`, `dangerSoft`, `successSoft`, `warningSoft`) lấy màu gốc với độ đục 16% trên `surface`.

Độ tương phản đã tính theo WCAG. Các token chữ, `accent`, `ai` và màu trạng thái đều đạt từ 4,5:1 trên cả bốn bề mặt ở cả hai giao diện. Số thấp nhất:

| Cặp | Tỉ lệ |
| --- | --- |
| `accent` trên `overlay`, sáng | 4,52:1 |
| `ai` trên `overlay`, sáng | 5,11:1 |
| `accent` trên `overlay`, tối | 5,30:1 |
| `textMuted` trên `overlay`, tối | 5,35:1 |
| `onAccent` trên `accent`, sáng | 5,43:1 |
| `onAccent` trên `accent`, tối | 7,21:1 |
| `onPaper` trên `paper` | 15,56:1 |
| `controlBorder` trên `overlay`, sáng (phần tử không phải chữ, yêu cầu 3:1) | 3,27:1 |
| `controlBorder` trên `overlay`, tối | 3,60:1 |

Lưu ý khi sửa bảng màu:

- Ở giao diện tối, **không dùng chữ trắng trên nền `accent`**: chỉ đạt 2,56:1. Luôn dùng `onAccent`.
- `divider` chỉ đạt 1,50:1 nên chỉ dùng để trang trí. Viền của một control phải dùng `controlBorder`.
- Đổi màu nào phải chạy lại test tương phản (`__tests__/theme.contrast.test.ts`). Test này đọc thẳng `global.css`.

Bảng màu vẽ (21 ô màu mẫu ở Canvas) và màu của trang truyện là dữ liệu tranh, không phải token giao diện. Chúng không đổi theo giao diện sáng tối.

## Chữ

Dùng một phông giao diện là **Inter**, có đủ dấu tiếng Việt. Phải đóng gói phông vào app. App cũ dùng phông hệ thống cho giao diện nên đây là việc mới.

| Token | Cỡ / dòng | Độ đậm | Dùng cho |
| --- | --- | --- | --- |
| `display` | 28 / 34 | 700 | Tiêu đề màn gốc: Home, Library |
| `title` | 20 / 26 | 600 | Tiêu đề app bar, sheet |
| `heading` | 16 / 22 | 600 | Tiêu đề nhóm, tên thẻ |
| `body` | 16 / 24 | 400 | Nội dung, ô nhập |
| `bodySmall` | 14 / 20 | 400 | Mô tả |
| `label` | 14 / 20 | 500 | Nút, chip, tab |
| `caption` | 12 / 16 | 500 | Chú thích, số liệu nhỏ |
| `mono` | 13 / 18 | 500 | Số trên thanh công cụ: cỡ bút, phần trăm zoom |

- Con số thay đổi liên tục dùng `fontVariant: ['tabular-nums']` để không nhảy chữ.
- Soạn kịch bản dùng `body`, không dùng cỡ nhỏ hơn.
- Không chặn người dùng phóng chữ hệ thống. Chỉ giới hạn `maxFontSizeMultiplier` ở thanh công cụ, mức 1.3.

Phông **trong trang truyện** giữ nguyên, vì đó là dữ liệu tranh: Patrick Hand (thoại), Be Vietnam Pro (chữ thường và đậm), Anton (`display` của bong bóng và SFX). `Bubble.font` trong file `.mangaka` cũ tham chiếu các phông này, nên bỏ đi sẽ làm hỏng truyện đã có.

## Khoảng cách, bo góc, độ nổi

| Nhóm | Token |
| --- | --- |
| Khoảng cách | `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `xxl` 32 · `xxxl` 48 |
| Bo góc | `sm` 8 (chip, ô nhập) · `md` 12 (nút) · `lg` 16 (thẻ) · `xl` 24 (sheet, dock) · `full` |
| Viền | `hairline` (`StyleSheet.hairlineWidth`) · `thin` 1 · `focus` 2 |
| Icon | `xs` 14 · `sm` 16 · `md` 20 · `lg` 24 · `xl` 32 · `xxl` 40 |

Độ nổi có hai mức: `panel` (dock, thanh công cụ) và `modal` (sheet, dialog, menu). Trên nền tối bóng gần như không thấy, nên phân tầng chủ yếu nhờ đổi `surface` sang `raised`. Khai báo bằng `boxShadow`, không dùng `elevation`.

Lề ngang của màn hình là 16dp, từ 600dp trở lên là 24dp.

## Vùng chạm

- Tối thiểu **48×48dp** cho mọi control. App cũ có Chip, nút nhỏ 34dp, Stepper 36×34dp, ModeBar 40dp, tất cả phải lên 48.
- Control nhìn nhỏ hơn 48 thì giữ kích thước nhìn thấy và mở rộng bằng `hitSlop`. Ví dụ chip cao 36dp có `hitSlop` 6dp trên dưới.
- Hai vùng chạm cách nhau ít nhất 8dp.
- Tay cầm kéo trên trang (đường chia khung, góc bong bóng, đuôi bong bóng) có vùng bắt 24dp mỗi phía, tính theo màn hình chứ không theo độ phóng to.

## Chuyển động

| Token | Thời lượng | Dùng cho |
| --- | --- | --- |
| `instant` | 100ms | Phản hồi khi nhấn |
| `fast` | 160ms | Chip, switch, đóng menu, thả về chỗ khi kéo thả |
| `base` | 220ms | Mở sheet, chuyển tab |
| `slow` | 300ms | Chuyển màn hình |

- Đóng nhanh hơn mở. Chỉ animate `transform` và `opacity`, không animate kích thước.
- Sheet dùng lò xo, kéo tay cầm xuống để đóng được. App cũ có tay cầm nhưng không có cử chỉ.
- Khi AI đang chạy: một vệt sáng chạy qua nút AI, kèm nút Cancel. Thay cho hiệu ứng đường tốc độ.
- Khi hệ thống bật giảm chuyển động (`useReducedMotion`), thay mọi chuyển động bằng đổi độ đục hoặc đổi trạng thái tức thì.
- Rung nhẹ khi: bắt đầu kéo thả, chạm vạch căn, hoàn thành một trang.

## Thành phần

Thư mục: `src/ui/`. Mỗi thành phần một file, không có file tổng hợp 1.000 dòng như `ui.tsx` cũ.

**Cơ bản:** `Text`, `Icon`, `Pressable` (có sẵn ripple, phản hồi nhấn, rung), `Button` (`primary`, `secondary`, `ghost`, `danger`, `ai`), `IconButton`, `Card`, `Divider`, `Badge`, `Tag`.

**Nhập liệu:** `TextField`, `SearchField`, `Chip`, `ChipGroup`, `Segmented`, `Tabs`, `Checkbox`, `Radio`, `Switch`, `Slider`, `Stepper`, `Dropdown`.

**Khung màn hình:** `Screen` (safe area, bàn phím), `AppBar`, `ListItem`, `SectionHeader`, `EmptyState`, `Skeleton`, `ProgressBar`, `Fab`.

**Lớp phủ:** `Sheet`, `Dialog`, `Menu`, `Toast`.

**Công cụ:** `Dock` (thanh tab nổi), `ToolRail` (cột công cụ nổi), `ToolPanel` (panel cỡ bút, màu), `ModeSwitch`.

**Theo miền:** `PageThumb`, `Cover`, `Avatar`, `AiButton`, `AiPreviewSheet`.

Quy tắc bắt buộc cho thành phần tương tác:

- Có `accessibilityRole`, `accessibilityLabel` nếu chỉ có icon, và `accessibilityState` cho chọn, tắt bật, vô hiệu. Ở app cũ, 40 trên 81 `Pressable` không có role lẫn label.
- Tab dùng role `tab`, không dùng `button`.
- Có đủ trạng thái: bình thường, đang nhấn, đang chọn, vô hiệu, đang tải.
- Không dùng màu làm tín hiệu duy nhất. Trạng thái trang (trống, phác, xong) có cả icon.
- `Toast` và `Dialog` là thành phần tự vẽ, thay cho `ToastAndroid` và `Alert`. App cũ gọi hai thứ này 79 và 28 lần, không đổi được giao diện.
- Một `Slider` duy nhất. App cũ có hai (`Slider`, `ToolSlider`).

Icon dùng bộ **Phosphor**, khai một chỗ ở `src/ui/icons.ts` và đặt tên theo ý nghĩa, ví dụ `UndoIcon`. Mặc định dùng `regular`. Mục đang chọn dùng `fill`, nên trạng thái không chỉ dựa vào màu. Icon lớn minh họa dùng `duotone`. Quy tắc đầy đủ ở skill `mangaka-icons`, cách áp dụng phong cách ở skill `mangaka-ui` (thư mục `.claude/skills/`). Xem phiên bản ở [03-stack-va-phien-ban.md](03-stack-va-phien-ban.md)

## Bố cục các màn chính

### Màn gốc (Home, Library, Assistant, Profile)

```
┌──────────────────────────┐
│ Home                  ◐  │  display, không có nút quay lại
│                          │
│ ┌──────────────────────┐ │  thẻ Continue: bìa + tiến độ
│ │ ▓▓  The Parcel       │ │
│ │ ▓▓  Ch.1 · 2/4 pages │ │
│ └──────────────────────┘ │
│                          │
│ ╭──────────────────────╮ │  Dock nổi, cách đáy 12dp
│ │ ⌂   ▦   [+]   ✦   ◯  │ │  nút + nền accent
│ ╰──────────────────────╯ │
└──────────────────────────┘
```

Dock thay cho thanh tab của app cũ, nhưng vẫn giữ 4 tab và nút (+) mở `NewProject`. Danh sách có thêm `paddingBottom` bằng chiều cao dock để không bị che.

### Canvas

```
┌──────────────────────────┐
│ ✓  Panel 3      ↶ ↷ ▤ ⋯  │  thanh trên nổi, nền `raised`
│ ╭──╮                     │
│ │✎ │  ┌───────────────┐  │  ToolRail nổi bên trái
│ │▱ │  │               │  │  (bên phải nếu thuận tay trái)
│ │◇ │  │   trang trắng │  │
│ │⌖ │  │               │  │
│ ╰──╯  └───────────────┘  │
│ ╭──────────────────────╮ │  ToolPanel nổi: màu, cỡ, độ đục
│ │ ● ○ ◐  Size ──●─ 6   │ │  thu gọn được
│ ╰──────────────────────╯ │
└──────────────────────────┘
```

Ở app cũ thanh dưới chiếm cả chiều ngang và nối liền với mép. Ở đây mọi thanh đều nổi, tranh tràn ra sau chúng. Chạm hai lần vào vùng trống của tranh ẩn hoặc hiện tất cả panel. Khi đang vẽ một nét, panel mờ đi 60% nếu nét đi vào vùng của panel.

### Storyboard

Lưới trang trên nền `bg`. Thẻ trang không có viền, tranh trắng tự nổi. Dưới mỗi trang là số trang và icon trạng thái. Từ 600dp trở lên, số cột tăng theo bề rộng (app cũ luôn 2 cột).

### Soạn kịch bản

Giống trình soạn thảo chữ: nền `bg`, không chia thẻ từng khối. Loại khối phân biệt bằng lề và nhãn nhỏ. Thanh công cụ nằm ngay trên bàn phím, gồm đổi loại khối và nút AI.

## Màn hình lớn

Chiều rộng từ 600dp trở lên:

- `Dock` đổi thành rail dọc bên trái.
- `Sheet` và `Dialog` giới hạn rộng 560dp.
- Văn bản dài giới hạn rộng 680dp.
- Library và Storyboard tăng số cột theo bề rộng.

Không làm giao diện hai cột (master-detail) ở bản đầu.
