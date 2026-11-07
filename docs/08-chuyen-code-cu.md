# Chuyển code cũ

Repo cũ có khoảng 29.900 dòng TypeScript trong `src/`. Nguyên tắc: chép được thì chép, sửa nhẹ được thì sửa, chỉ viết lại những chỗ thiết kế sai.

## Bốn mức xử lý

| Mức | Nghĩa | Khối lượng |
| --- | --- | --- |
| **Chép** | Không có import RN, Skia, MMKV. Chỉ đổi đường dẫn import | 20 file, 2.838 dòng |
| **Tách** | Phần thuần chép sang `core`, phần còn lại thành adapter | Khoảng 15 file |
| **Đổi giao diện** | Giữ logic màn hình, thay thành phần và style | Phần lớn `features/` |
| **Viết lại** | Thiết kế mới | Store, Canvas, trạng thái Lettering, danh sách Script, bộ thành phần |

## Chép

Đã kiểm tra: 20 file này không có import nào ngoài các file trong chính danh sách, trừ `lib/ai/client` ghi bên dưới.

| File cũ | Vị trí mới |
| --- | --- |
| `src/model/types.ts`, `constants.ts`, `paginate.ts` | `src/core/model/` |
| `src/engine/layout.ts` | `src/core/layout/` |
| `src/engine/artMath.ts` | `src/core/art/` |
| `src/engine/translation.ts` | `src/core/lettering/` |
| `src/lib/id.ts`, `time.ts`, `format.ts`, `async.ts` | `src/core/util/` |
| `src/lib/ai/story.ts`, `writing.ts`, `people.ts`, `translate.ts`, `assistant.ts` | `src/core/ai/` |
| `src/features/preview/spreads.ts` | `src/core/preview/` |
| `src/components/reorder.ts` | `src/core/reorder/` |
| `src/features/script/scriptTools.ts`, `aiDrafts.ts` | `src/core/script/` |
| `src/features/characters/characterFill.ts` | `src/core/story/` |

Năm file AI đang import `./client`. Đổi sang nhận `AiClient` qua tham số ([02-kien-truc.md](02-kien-truc.md#ai)), phần prompt và phân tích kết quả giữ nguyên.

## Tách

| File cũ | Vấn đề | Cách xử lý |
| --- | --- | --- |
| `src/model/selectors.ts` | Import `artStore` | Truyền hàm tra tranh qua tham số |
| `src/lib/ai/client.ts` | Đọc store cài đặt | Thành adapter của `AiClient` trong `src/data/` |
| `src/lib/ai/context.ts` | Đọc store | Nhận dữ liệu qua tham số |
| `src/lib/ai/useAiTask.ts` | Hook React, chưa có test | Chuyển sang `src/state/` |
| `src/lib/projectArchive.ts` | Trộn logic thuần (dòng 95–289) với I/O | Phần thuần sang `core/archive`, I/O sang `data` |
| `src/engine/art.ts` | Trộn Skia và phép tính | Helper thuần sang `core/art`, phần vẽ sang `render` |
| `src/engine/lettering.ts` | Trộn hình học và Skia | Hình học sang `core/lettering`, phần vẽ sang `render` |
| `src/engine/page.ts` | Trộn render, thumbnail, store, file, MMKV | Tách thành `render/drawPage` và `render/thumbs` |
| `src/engine/images.ts`, `fonts.ts` | Skia, RN | Sang `render` |
| `src/features/canvas/canvasShared.ts` | Import icon | Tách phần hằng số sang `core/art` |
| `src/features/page/pageEdit.ts` | Lịch sử riêng | Bỏ `usePageHistory`, giữ các phép biến đổi |
| `src/features/lettering/script.ts` | Đồng bộ thoại với kịch bản | Sang `core/lettering` |
| `src/lib/files.ts` | RNFS, picker, native | Sang `data`, bỏ phần cache promise lỗi |
| `src/lib/storage.ts` | MMKV | Bỏ, thay bằng repo |
| `src/lib/keyboard.ts`, `haptics.ts`, `screen.ts` | RN, native | Sang `native` hoặc `ui`. `keyboard` thay bằng `keyboard-controller` |

## Viết lại

| File cũ | Thay bằng |
| --- | --- |
| `src/store/useStory.ts` (1.159 dòng) | `core/story/ops` thuần, `state/useStory` mỏng. Logic từng action vẫn lấy từ file cũ |
| `src/engine/artStore.ts` | `ArtRepo` trên SQLite, cache LRU |
| `src/store/scriptHistory.ts`, `useAssistant.ts`, `useSettings.ts` | Dùng bảng riêng và `meta` |
| `src/features/canvas/CanvasScreen.tsx` | [07-canvas.md](07-canvas.md). Chuyển `Session` thành reducer, không viết mới quy tắc cử chỉ |
| `src/features/lettering/LetteringScreen.tsx` | Reducer, hook cử chỉ, controller |
| `src/features/script/ScriptScreen.tsx` | Controller và danh sách ảo hóa theo cảnh |
| `src/components/ui.tsx`, `comic.tsx`, `Sheet.tsx`, `Dropdown.tsx`, `ai.tsx`, `icons.tsx` | `src/ui/` theo [05-design-system.md](05-design-system.md) |
| `src/theme/index.ts` | `src/ui/theme/` |

Giữ gần như nguyên logic: `src/features/preview/useZoom.ts`, `src/features/outline/OutlineDrag.tsx`, `src/components/Sortable.tsx`, `src/features/storyboard/StoryboardGrid.tsx`. Đây là phần cử chỉ sạch nhất của app cũ, viết bằng Reanimated worklet.

Bỏ: `scripts/gen-icons.py`, `MaterialIcons-Regular.codepoints`, phần iOS, icon launcher cũ.

`docs/google-play/` và `website/` không chép ở bước code. Chúng được cập nhật ở giai đoạn phát hành, vì ảnh chụp phải làm lại theo giao diện mới.

## Test

17 file test trong `__tests__/` chép sang cùng lúc với code chúng kiểm tra. Đây là lưới an toàn chính của bản viết lại.

- Test của phần Chép phải chạy qua **không sửa gì ngoài đường dẫn import**.
- `story.test.ts` đổi để gọi `core/story/ops`, nhưng giữ nguyên các khẳng định.
- `projectArchive.test.ts` thêm các ca: id lớp trùng, `points` sai bước nhảy, file bản 1 thật.
- `sampleStory.test.ts` là script sinh truyện mẫu cho ảnh Play, chạy khi đặt `SEED_OUT`. Giữ lại để dùng làm dữ liệu test.

## Lỗi cũ phải sửa

Đã xác minh bằng cách đọc code, chưa chạy trên máy. Đường dẫn tính từ repo cũ. Cột cuối là chỗ bản mới xử lý.

| # | Lỗi | Vị trí | Cách sửa |
| --- | --- | --- | --- |
| 1 | Hoàn tác bố cục khôi phục khung nhưng mất tranh | `useStory.ts:951-953`, `pageEdit.ts:138` | Xóa mềm, patch dòng |
| 2 | Dialog nói tranh được giữ, nhưng đổi sang mẫu ít khung hơn vẫn xóa | `PanelLayoutScreen.tsx:195`, `useStory.ts:999-1013` | Xóa mềm, sửa nội dung dialog |
| 3 | Xuống nền không ghi tranh | `AppRoot.tsx:29-33`, `CanvasScreen.tsx:248` | Ghi khi nhấc bút, `flushAll()` |
| 4 | Hoàn tác bố cục làm mất hiệu ứng, Extend và Shorten không vào lịch sử | `pageEdit.ts:8`, `useStory.ts:955`, `PanelLayoutScreen.tsx:530, 535` | Ngăn `page` |
| 5 | Xóa hẳn truyện để sót ảnh, thumbnail, lịch sử, hội thoại | `useStory.ts:356` | GC đánh dấu |
| 6 | File xuất không bao giờ bị xóa | `src/features/export/` | Xóa theo truyện |
| 7 | Địa chỉ AI mặc định `http://`, bản release chặn | `lib/ai/client.ts:23-25` | Mặc định `https://` |
| 8 | PDF luôn rộng khổ B5, truyện A5 sai kích thước | `NativeFilesModule.kt:145` | Tham số `pageWidthPt` |
| 9 | Một số action không cập nhật `project.updatedAt`, sắp xếp Thư viện bị lệch | `useStory.ts:646, 666, 967, 1030, 1093` | `applyChangeSet` tự cập nhật |
| 10 | Promise lỗi bị cache, hàng đợi thumbnail kẹt vĩnh viễn | `lib/files.ts:27-31`, `engine/page.ts:262-263` | Không cache lỗi, `finally` |
| 11 | Kiểm tra file nhập quá sơ sài | `lib/projectArchive.ts:259-289` | `zod` |
| 12 | Vòng import `useStory` với `projectArchive` | `useStory.ts:17`, `projectArchive.ts:15` | Tách lớp |
| 13 | Trạng thái Preview rò sang màn khác | `PreviewScreen.tsx:188-195, 372` | Gắn theo focus |
| 14 | Chữ không đạt tương phản: số trên Chip đang chọn, chữ trắng trên `accent` | `ui.tsx:436` | Token mới, test tương phản |
| 15 | Sai icon "Move earlier" | `StoryboardScreen.tsx:258, 367, 373` | Theo hướng đọc |
| 16 | Tay cầm Sheet không có cử chỉ | `Sheet.tsx` | Sheet mới |
| 17 | R8 tắt, còn comment cũ về `UpdateCheckWorker` | `android/app/build.gradle:60, 118` | Bật R8 |
