# Màn hình và điều hướng

Giữ cấu trúc của app cũ: một native stack, bên trong có tab. Quy tắc nghiệp vụ và mô tả chi tiết của từng màn vẫn theo `docs/screens/` và `docs/features.md` của repo cũ. Tài liệu này chỉ ghi phần **đổi** và phần **dễ làm mất**.

## Route

Tab: `Home`, `Library`, `Assistant`, `Profile`. Nút (+) ở giữa Dock mở `NewProject`, không phải tab.

| Route | Tham số | Thư mục | Màn cũ | Mức thay đổi |
| --- | --- | --- | --- | --- |
| `Welcome` | | `onboarding` | 1 | Vẽ lại |
| `Preferences` | `edit?` | `onboarding` | 3 | Đổi giao diện |
| `Home` | | `home` | 4 | Đổi giao diện |
| `Library` | | `library` | 5 | Đổi giao diện |
| `NewProject` | `idea?`, `draft?` | `project` | 6 | Đổi giao diện |
| `Project` | `projectId` | `project` | 7 | Đổi giao diện |
| `Outline` | `projectId` | `outline` | 8 | Đổi giao diện, giữ kéo thả |
| `Script` | `chapterId`, `blockId?` | `script` | 9 | Viết lại danh sách |
| `Character` | `characterId` | `characters` | 10 | Đổi giao diện |
| `World` | `projectId` | `world` | 11 | Đổi giao diện |
| `WorldEntry` | `entryId` | `world` | 11 | Đổi giao diện |
| `Storyboard` | `chapterId` | `storyboard` | 12 | Đổi giao diện, tách controller kéo thả |
| `PanelLayout` | `pageId`, `mode?` | `page` | 13 | Chuyển sang ngăn hoàn tác `page` |
| `Canvas` | `pageId`, `panelId` | `canvas` | 14 | Viết lại |
| `Lettering` | `pageId` | `lettering` | 16 | Viết lại phần trạng thái |
| `Preview` | `projectId`, `chapterId?` | `preview` | 17 | Đổi giao diện, tách trạng thái đọc |
| `Export` | `projectId`, `chapterId?` | `export` | 18 | Đổi giao diện |
| `Assistant` | | `assistant` | 19 | Đổi giao diện |
| `Profile` | | `profile` | 20 | Đổi giao diện |
| `Trash` | | `profile` | | Đổi giao diện |
| `About` | | `profile` | | Đổi giao diện |

Bỏ các tham số không ai dùng: `NewProject.blankCanvas`, `Project.tab`, `World.type`, `World.view`, `Preview.pageId`. Dàn khung và Thoại vẫn chuyển qua lại bằng `replace` trong `ModeSwitch`.

Thêm deep link cho intent `.manganova` và `.mangaka`. Không có deep link nào khác.

## Hành vi dễ mất khi viết lại

Đây là những chi tiết nằm trong code, không có trong tài liệu sản phẩm. Viết lại phải giữ.

### Lettering

- Thứ tự ưu tiên khi chạm: đuôi, xoay, góc, thân bong bóng.
- Vạch căn hít khi kéo.
- Thả đuôi vào trong bong bóng thì đuôi bị bỏ.
- Hoàn tác gộp theo thẻ, sửa liên tiếp một thuộc tính là một bước.
- Đóng ô sửa chữ thì đồng bộ chữ ngược về kịch bản.
- Thay 21 `useState` bằng một reducer thuần trong `core/lettering`.

### PanelLayout

- Tay cầm đường chia có vùng bắt 24px.
- Vuốt ngoài trang để đổi trang, theo đúng hướng đọc phải sang trái.
- Chạm đúp ở chế độ Art thì mở Canvas.
- Extend và Shorten phải vào lịch sử. App cũ bỏ sót.
- Dựng cây cử chỉ một lần, không tạo lại mỗi lần render.

### Storyboard, Outline

- Nhấc thẻ sau 280ms, sai số 10px.
- Cuộn tự động ở mép: `EDGE_SIZE` 72, `EDGE_SPEED` 14. Thả về chỗ trong 160ms (`Sortable.tsx:9-13`).
- Giữ yên không di chuyển thì mở menu.
- **Bẫy khi đổi giao diện:** phép tính sắp xếp phản chiếu kích thước bố cục, nên đổi style mà không đổi hằng số thì thả sai chỗ. Ở code cũ là `GridSpec` (`StoryboardGrid.tsx:141, 366`), `THUMB_META_H`, `HEAD_H` (`OutlineDrag.tsx:42`). Bản mới định nghĩa kích thước một chỗ, dùng chung cho cả style và phép tính.
- Mũi tên "Move earlier" và "Move later" theo hướng đọc. App cũ sai icon (`StoryboardScreen.tsx:258, 367, 373`).

### Preview

- FlatList đảo chiều, phối hợp `Gesture.Native` với pager.
- Vùng chạm 25% và 75% để lật trang.
- Giữ vị trí khi xoay máy. Trang đôi khi xoay ngang. `getItemLayout`.
- Lấy `useZoom.ts` làm mẫu cho cách viết hook cử chỉ.
- **Sửa:** ẩn thanh trạng thái và khóa xoay chỉ áp dụng khi màn đang được focus. App cũ để rò sang Edit và Export.

### Script

- Enter tạo khối mới. Sau khối Bối cảnh là khối Hành động.
- Tìm và thay thế, Thay tất cả hoàn tác được. Thống kê, chia sẻ `.txt`. Chuyển khối sang cảnh khác.
- Link "Shorten with AI" dưới thoại dài.
- Ảo hóa danh sách **theo cảnh, không theo khối**, vì `TextInput` bị tái sử dụng dễ mất focus. App cũ render tất cả trong `ScrollView`.
- Tách khối `ops` (dòng 224–430) thành controller.
- Bỏ các `setTimeout` 250ms chờ Sheet đóng. Dùng callback `onClosed` của `Sheet`.

### Home

- Thẻ Continue đi theo `lastOpened` qua `resumeTarget`.

## Tổ chức một tính năng

```
src/features/lettering/
├── LetteringScreen.tsx     ghép giao diện, không chứa logic
├── useLetteringGestures.ts
├── useLetteringController.ts
└── components/
```

Giới hạn 300 dòng mỗi file màn hình. Reducer và phép tính nằm ở `core`, có test.

## Trợ năng

- Mọi control theo quy tắc ở [05-design-system.md](05-design-system.md#thành-phần).
- Trang truyện là ảnh Skia, screen reader không đọc được. Gán `accessibilityLabel` kiểu "Page 3, 4 panels, done" cho `PageThumb`.
- Canvas không thể dùng được hoàn toàn với screen reader, nhưng các nút công cụ vẫn phải có nhãn.
