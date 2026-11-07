# Hướng dẫn chuyển màn hình

Bảng tra khi chuyển một màn từ app cũ sang. Quy tắc chung ở [08-chuyen-code-cu.md](08-chuyen-code-cu.md), hành vi dễ mất ở [06-man-hinh.md](06-man-hinh.md).

## Đổi import

| Cũ | Mới |
| --- | --- |
| `model/*` | `core/model/*` |
| `store/useStory` | `state/useStory` (cùng tên action) |
| `store/hooks`, `features/project/useStoryData` | `state/hooks` |
| `store/useSettings`, `useAssistant`, `scriptHistory` | `state/...` |
| `app/routes` | `state/navigation` |
| `lib/ai/*` | `core/ai/*`, lỗi và `normalizeBaseUrl` ở `core/ai/port` |
| `lib/ai/client` `aiConfigured`, `useAiConfigured` | `state/useSettings` |
| `lib/ai/useAiTask` | `state/useAiTask` |
| `lib/ai/client` `testConnection` | `appServices().testAiConnection` |
| `lib/projectArchive` | `appServices().exportProject`, `importProject` |
| `lib/files`, `lib/screen` | `native/files`, `native/screen` |
| `lib/haptics` | `haptic` trong `ui` |
| `engine/artStore` | `state/artStore` |
| `engine/layout`, `artMath`, `translation` | `core/layout/layout`, `core/art/artMath`, `core/lettering/translation` |

## Đổi thành phần

| Cũ | Mới |
| --- | --- |
| `useTheme()`, `StyleSheet` | `className` Tailwind. Cần giá trị màu thật thì `useColor('accent')` |
| `Header` | `AppBar` |
| `ComicCard` | `Card` |
| `SectionTitle` | `SectionHeader` |
| `MenuSheet` | `Menu` |
| `TabBar` | `Tabs` |
| `DropdownButton` | `Dropdown` |
| `ProgressLine` | `ProgressBar` |
| `Halftone`, `SpeechBubble` | Bỏ |
| `<Text style={font.x}>` | `<Text variant="x" tone="y">` |
| `Alert`, `ToastAndroid` | `confirm`, `toast`, `snackbar` trong `ui` |
| `setTimeout` chờ Sheet đóng | `onClosed` của `Sheet` |

`IconButton` bắt buộc có `accessibilityLabel`. Màn dùng Dock thêm `bottomInset={useDockInset()}` vào `Screen`.

## Ảnh

Đường dẫn lưu ở dạng tương đối (`images/x.jpg`). `pickImage` đã trả dạng này. Hiển thị thì qua `fileUri(path)` trong `core/util/paths`.

## Hoàn tác

- `undoStory(scope)`, `redoStory(scope)`, `useUndoState(scope)` trong `state/useStory`.
- Mỗi action đã có ngăn mặc định ở `core/story/scopes.ts`.
- Gộp nhiều action thành một bước, hoặc chọn ngăn và khóa gộp: `undoable({ undoScope, coalesceKey, typing }, fn)`.
- `typing: true` ghi sau 500ms ngừng gõ.

## Trước khi xong một màn

- `npx tsc --noEmit`, `npx jest`, `npx eslint` trên thư mục của màn.
- File màn hình không quá 300 dòng. Phép tính và reducer nằm ở `core`, có test.
- Mọi control có role, nhãn, vùng chạm 48dp.
