# Design system "Studio"

Studio thay cho "Mực và Giấy" của app cũ. Hướng thiết kế: một công cụ vẽ chuyên nghiệp, nền than chì, panel nổi bo mềm, một màu nhấn. Tranh đen trắng là thứ sáng nhất trên màn hình, giao diện lùi về phía sau.

## Nguyên tắc

1. **Tranh là nhân vật chính.** Trang truyện luôn nền trắng, nằm trên nền tối. Không đặt màu nhấn sát mép tranh nếu không cần thiết.
2. **Một màu nhấn.** Xanh điện chỉ dùng cho hành động chính và trạng thái đang chọn. Tím dành riêng cho AI.
3. **Phân tầng bằng độ sáng, không bằng viền.** Bề mặt càng nổi càng sáng. Viền chỉ dùng khi hai bề mặt cạnh nhau khó phân biệt.
4. **Công cụ nổi, không chiếm chỗ.** Ở màn làm việc, thanh công cụ là panel nổi có thể thu gọn.
5. **Mọi giá trị đi qua token.** Style viết bằng class Tailwind (`className`), token khai ở `global.css`: `bg-surface`, `text-text-muted`, `rounded-lg`, `text-title`. Không viết mã màu, cỡ chữ hay bo góc trực tiếp trong màn hình. ESLint chặn việc này (xem [02-kien-truc.md](02-kien-truc.md)).

So với app cũ, những thứ sau bị bỏ: viền mực 2dp, bóng cứng lệch 4dp, chấm halftone, tiêu đề Anton viết hoa, con dấu `完`, thẻ `ComicCard`, bong bóng thoại làm thành phần giao diện.

## Màu

Mặc định là giao diện tối. Giao diện sáng vẫn có, chọn trong Profile. Thanh công cụ ở màn vẽ luôn tối ở cả hai giao diện.

| Token | Tối | Sáng | Dùng cho |
| --- | --- | --- | --- |
| `bg` | `#111214` | `#F4F5F7` | Nền màn hình, nền quanh trang truyện |
| `surface` | `#1A1B1F` | `#FFFFFF` | Thẻ, danh sách |
| `raised` | `#232429` | `#FFFFFF` | Panel nổi, dock, sheet |
| `overlay` | `#2C2E34` | `#ECEEF1` | Menu, dialog, ô đang nhấn |
| `text` | `#F1F2F4` | `#15161A` | Chữ chính |
| `textSecondary` | `#B4B7BF` | `#454852` | Mô tả, nhãn phụ |
| `textMuted` | `#9A9EA7` | `#5F636D` | Chú thích, placeholder |
| `accent` | `#6C98FF` | `#2457D6` | Nút chính, tab đang chọn, tiến độ |
| `onAccent` | `#0B1020` | `#FFFFFF` | Chữ và icon trên nền `accent` |
| `ai` | `#B69CFF` | `#6A3FD8` | Nút và kết quả của AI |
| `onAi` | `#17102E` | `#FFFFFF` | Chữ trên nền `ai` |
| `danger` | `#FF7A7A` | `#C42B2B` | Xóa, lỗi |
| `success` | `#4CD19A` | `#12784F` | Trang đã xong, đã lưu |
| `warning` | `#F5B94A` | `#8A5A00` | Trang bị đánh dấu cần sửa |
| `divider` | `#3A3C44` | `#DADDE2` | Đường kẻ trang trí |
| `controlBorder` | `#7A7E88` | `#7C808A` | Viền ô nhập, checkbox, switch |
| `scrim` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.45)` | Nền mờ sau sheet, dialog |

Các token nền mềm (`accentSoft`, `aiSoft`, `dangerSoft`, `successSoft`, `warningSoft`) lấy màu gốc với độ đục 16% trên `surface`.

Độ tương phản đã tính theo WCAG. Các token chữ, `accent`, `ai` và màu trạng thái đều đạt từ 4,5:1 trên cả bốn bề mặt ở cả hai giao diện. Số thấp nhất:

| Cặp | Tỉ lệ |
| --- | --- |
| `accent` trên `overlay`, tối | 4,89:1 |
| `success` trên `overlay`, sáng | 4,72:1 |
| `danger` trên `overlay`, sáng | 4,85:1 |
| `textMuted` trên `overlay`, tối | 5,06:1 |
| `onAccent` trên `accent`, tối | 6,83:1 |
| `controlBorder` trên `overlay`, tối (phần tử không phải chữ, yêu cầu 3:1) | 3,34:1 |
| `controlBorder` trên `overlay`, sáng | 3,40:1 |

Lưu ý khi sửa bảng màu:

- Ở giao diện tối, **không dùng chữ trắng trên nền `accent`**: chỉ đạt 2,77:1. Luôn dùng `onAccent`.
- `divider` chỉ đạt 1,56:1 nên chỉ dùng để trang trí. Viền của một control phải dùng `controlBorder`.
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
| Icon | `sm` 16 · `md` 20 · `lg` 24 |

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

Icon dùng bộ **Lucide** nét 2dp, xem phiên bản ở [03-stack-va-phien-ban.md](03-stack-va-phien-ban.md). Lucide là nét viền, không dùng lẫn bản tô đặc ở cùng một cấp. Trạng thái đang chọn của tab thể hiện bằng màu và nền, không đổi kiểu icon.

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
