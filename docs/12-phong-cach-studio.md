# Phong cách Studio

![Mangaka AI ở phong cách Studio](style/hero.png)

**Một xưởng vẽ về đêm: bàn tối, đèn tập trung vào trang giấy.** Mọi thứ khác lùi lại để tranh của bạn là thứ sáng nhất trên màn hình.

Tài liệu này giải thích cảm giác của style và lý do đằng sau từng quyết định. Bảng tra token đầy đủ nằm ở [05-design-system.md](05-design-system.md).

## Bốn ý tưởng

| Ý tưởng | Nghĩa là gì | Nhìn thấy ở đâu |
| --- | --- | --- |
| **Trang truyện dẫn đầu** | Giấy trắng là mảng sáng lớn nhất. Giao diện không cạnh tranh với nó | Canvas, Lettering, Preview |
| **Một màu nhấn** | Xanh điện chỉ dành cho hành động chính và trạng thái đang chọn. Tím chỉ dành cho AI | Nút chính, tab đang chọn, thanh tiến độ |
| **Chiều sâu bằng độ sáng** | Bề mặt càng nổi càng sáng. Gần như không dùng viền hay bóng | Thẻ, dock, sheet |
| **Công cụ nổi** | Thanh công cụ là panel nổi, thu gọn được và không chiếm chỗ của tranh | Thanh bên Canvas, thẻ bong bóng |

## Logo

<img src="style/logo.png" alt="Logo Mangaka AI" width="160" />

Logo là một trang truyện bị cắt bởi đường chia chéo, kèm một bong bóng thoại:

- **Nửa trên màu giấy:** trang truyện là nhân vật chính.
- **Nửa dưới xanh điện:** màu nhấn duy nhất của app.
- **Đường chia chéo:** thứ làm nên một trang manga, cũng chính là đường chia khung trong PanelLayout.
- **Bong bóng cắt âm bản:** lời thoại, phần "viết" của công việc.

Logo đọc được ở 48px, và có bản đơn sắc cho Themed Icons của Android 13 trở lên. File gốc ở `assets/icon/`. Sửa xong chạy `sh scripts/gen-icons.sh`, cần `rsvg-convert` và `magick`. Trong app dùng component `BrandMark`.

## Màu

![Bảng màu tối](style/palette-dark.svg)

Bốn tầng bề mặt chênh nhau rất ít, đủ để thấy tầng mà không gây chú ý. Đó là lý do một panel `raised` tách khỏi nền `bg` mà không cần viền.

Ở giao diện tối, chữ trên nền `accent` luôn dùng `on-accent`, không dùng trắng. Chữ trắng trên `accent` chỉ đạt 2,77:1.

![Bảng màu sáng](style/palette-light.svg)

Giao diện sáng giữ nguyên cấu trúc, và màu nhấn đậm hơn để đạt độ tương phản trên nền trắng. Đổi màu nào cũng phải chạy `__tests__/theme.contrast.test.ts`.

## Chữ

Giao diện dùng một phông duy nhất là **Inter**, có đủ dấu tiếng Việt. Thứ bậc đến từ cỡ chữ và độ đậm, không đến từ màu sắc hay phông thứ hai.

| Vai trò | Ví dụ | Token |
| --- | --- | --- |
| Tên màn gốc | Library | `display` 28, đậm |
| Thanh tiêu đề, sheet | Storyboard | `title` 20, nửa đậm |
| Tên nhóm, tên thẻ | Recent stories | `heading` 16, nửa đậm |
| Nội dung | Dòng mô tả, ô nhập | `body` 16 |
| Nút, chip, tab | Keep drawing | `label` 14, vừa |
| Số liệu nhỏ | 2/4 pages | `caption` 12, vừa |

Phông **trong trang truyện** là dữ liệu tranh, không thuộc giao diện: Patrick Hand cho thoại, Be Vietnam Pro cho chữ thường, Anton cho SFX.

## Icon

![Bộ icon](style/icons.svg)

App dùng một bộ duy nhất là **Phosphor**, vì bộ này có nhiều độ đậm cùng một họ hình. Mọi icon khai ở `src/ui/icons.ts` và đặt tên theo ý nghĩa, ví dụ `UndoIcon`, nên đổi hình chỉ sửa một dòng.

![Độ đậm của icon](style/icon-weights.svg)

Độ đậm mang ý nghĩa, không phải trang trí:

- **`regular`** cho mọi icon ở trạng thái thường.
- **`fill`** cho mục đang chọn, nhờ vậy trạng thái không chỉ dựa vào màu. Người mù màu vẫn nhận ra.
- **`duotone`** cho icon lớn minh họa, như ở màn trống.

Các component dùng chung đã tự đổi độ đậm. Chỉ cần truyền `selected` hoặc `active`.

Cỡ icon theo thang `ICON`: `xs` 14, `sm` 16, `md` 20, `lg` 24, `xl` 32, `xxl` 40.

## Trong màn hình thật

| Màn | Điều cần để ý |
| --- | --- |
| <img src="style/screens/canvas.png" alt="Canvas" width="220" /> | **Canvas.** Tranh chiếm gần hết màn hình. Công cụ đang chọn là ngòi bút tô đặc, các công cụ khác giữ nét mảnh |
| <img src="style/screens/lettering.png" alt="Lettering" width="220" /> | **Lettering.** Thẻ thuộc tính nổi trên trang, và trang tự đẩy lên để bong bóng đang chọn luôn nhìn thấy, gồm cả đuôi và tay cầm |
| <img src="style/screens/storyboard.png" alt="Storyboard" width="220" /> | **Storyboard.** Trang trắng nổi trên nền tối. Thứ tự đọc từ phải sang trái được ghi ngay đầu màn |
| <img src="style/screens/project.png" alt="Project" width="220" /> | **Project.** Truyện chưa có ảnh bìa dùng bìa chữ: tên truyện và một vạch màu nhấn, không để ô trống |
| <img src="style/screens/light.png" alt="Giao diện sáng" width="220" /> | **Giao diện sáng.** Cùng cấu trúc, cùng thứ bậc. Màu nhấn đậm hơn để đủ tương phản |

## Nên và không nên

| Nên | Không nên |
| --- | --- |
| Dành màu nhấn cho một hành động chính mỗi màn | Tô màu nhấn lên nhiều nút cùng lúc |
| Tách bề mặt bằng độ sáng | Thêm viền quanh mọi thẻ |
| Đặt công cụ vào một hàng nếu còn chỗ | Để công cụ đè lên tranh |
| Làm màn trống có icon và bước tiếp theo | Để lại khoảng trống hoặc một ô xám |
| Dùng `fill` cho mục đang chọn | Chỉ đổi màu để báo trạng thái |
| Dùng token qua `className` | Viết mã màu, cỡ chữ hay bo góc trong màn hình |

## Giữ style về sau

Dự án có hai skill trong `.claude/skills/`:

- **`mangaka-ui`** dùng khi dựng hoặc chỉnh màn hình. Có sẵn các bước kiểm tra trên máy.
- **`mangaka-icons`** dùng khi thêm hay đổi icon.

Bảng màu và bảng icon trong tài liệu này được sinh từ code, nên sẽ không lệch với app:

```sh
python3 scripts/gen-style-assets.py
```

Kiểm tra giao diện phải chụp từ bản debug, vì bản release bật `FLAG_SECURE` nên ảnh chụp ra đen.
