# Kiến trúc

## Chia lớp

```
src/
├── core/       TS thuần: model, layout, art, lettering, story, undo, archive, ai, ports.ts
├── data/       op-sqlite, repo, migration, file
├── render/     Skia: drawPage, drawArt, drawBubble, phông, thumbnail
├── state/      Zustand, bộ đăng ký lịch sử hoàn tác
├── ui/         Bộ thành phần Studio và theme
├── features/   Màn hình, mỗi nhóm một thư mục
├── native/     Gọi TurboModule
└── app/        Điểm ghép: khởi động, điều hướng, nối port với adapter
specs/          Khai báo TurboModule
android/        Kotlin
```

Quy tắc phụ thuộc:

| Lớp | Được import | Không được import |
| --- | --- | --- |
| `core` | `core` | Mọi thứ khác, kể cả `react` và `react-native` |
| `data` | `core`, `native` | `state`, `ui`, `features` |
| `render` | `core` | `state`, `data`, `ui`, `features` |
| `state` | `core` | `data` trực tiếp. Đi qua port |
| `ui` | `core` (chỉ kiểu) | `state`, `data`, `render`, `features` |
| `features` | `core`, `state`, `render`, `ui`, `native` | `data`, `@op-engineering/op-sqlite` |
| `app` | Tất cả | |

Mỗi thư mục có khối `no-restricted-imports` trong `.eslintrc.js`, nên CI báo lỗi khi vi phạm. Ngoài ra thêm luật chặn mã màu dạng `#...`, `fontFamily`, `fontSize` số trong `src/features`, trừ các file bảng màu vẽ khai báo riêng.

Chia như vậy để test được logic mà không cần giả lập React Native. Jest ở lớp `core` chạy thẳng trên Node.

## Luồng dữ liệu

Mọi thay đổi dữ liệu đi qua một đường duy nhất.

```
Màn hình
   │ gọi action
   ▼
state/useStory ──▶ core/story/ops   hàm thuần: (state, args) => ChangeSet
   │
   ▼
applyChangeSet
   ├──▶ cập nhật Zustand (giao diện đổi ngay)
   ├──▶ ghi các dòng bẩn qua repo (một transaction)
   └──▶ đẩy vào ngăn hoàn tác
```

```ts
// src/core/ports.ts
export type RowPatch = {
  table: TableName;
  id: ID;
  before: unknown | null; // null: dòng chưa tồn tại
  after: unknown | null;  // null: dòng bị xóa mềm
};

export type ChangeSet = {
  patches: RowPatch[];
  undoScope?: UndoScope;  // không có: không vào lịch sử
  coalesceKey?: string;   // gộp các lần gõ liên tiếp trong một khối
};

export interface StoryRepo {
  loadAll(): StoryData;
  apply(patches: RowPatch[]): void;
}

export interface ArtRepo {
  loadPanel(panelId: ID): PanelArt | null;
  appendStroke(layerId: ID, stroke: Stroke): void;
  setHead(layerId: ID, gen: number, head: number): void;
}
```

- Khi khởi động, nạp mọi dòng không phải tranh vào Zustand như app cũ, nên các selector vẫn đồng bộ. Tranh nạp theo từng khung.
- Chỉ ghi dòng thay đổi, không tuần tự hóa lại toàn bộ truyện mỗi lần gõ.
- Văn bản ghi sau 500ms ngừng gõ. Nét vẽ ghi ngay khi nhấc bút. Khi app xuống nền, một hàm `flushAll()` ghi hết phần còn chờ, gồm cả tranh. App cũ bỏ sót tranh ở bước này.
- Repo chạy đồng bộ (`executeSync`). Một thay đổi chỉ chạm vài dòng, nên ghi đồng bộ đủ nhanh, và nét vẽ đã nằm trong DB ngay khi nhấc bút.
- Hàm trong `core/story/ops` không có tác dụng phụ. App cũ gọi `deleteArt` ngay trong reducer, đó là nguồn gốc lỗi hoàn tác.
- Tách `useStory` ra thế này cũng cắt được vòng import giữa `useStory` và `projectArchive`.

## Hoàn tác

Mỗi commit lưu ảnh trước và sau của những dòng nó chạm tới. Hoàn tác là áp lại ảnh trước qua đúng đường ghi ở trên. Không có class lệnh, cũng không chụp toàn bộ tài liệu.

| Ngăn | Quản lý | Giới hạn |
| --- | --- | --- |
| `script:<chapterId>` | Cảnh và khối. Gõ liên tiếp trong một khối gộp làm một bước | 50 |
| `page:<pageId>` | Cây khung, panel, thứ tự, bong bóng, hiệu ứng, trạng thái xóa của tranh | 50 |
| `panel:<panelId>` | Lớp và nét vẽ | 50 |
| `project:<projectId>` | Chương, trang, nhân vật, thế giới. Hiện thành nút Undo trên Toast | 20 |

Quy tắc:

- Các ngăn quản lý phần dữ liệu riêng, không chồng nhau.
- Dàn khung và Thoại dùng chung ngăn `page`. Ở app cũ, hoàn tác bố cục làm mất hiệu ứng vì `Snapshot` không có `effects` và `height`.
- Thao tác chạm nhiều ngăn (`removeCharacter`, xóa bản ngôn ngữ) xóa các ngăn bị ảnh hưởng. Đây là cách `LetteringScreen` cũ đang làm.
- `artRev` và `updatedAt` không nằm trong patch.
- Lịch sử chỉ ở trong bộ nhớ, còn nguyên khi chuyển màn hoặc xuống nền, mất khi tắt app. Dữ liệu thì luôn bền.
- Lịch sử 20 phiên bản kịch bản (F-04) là tính năng riêng, không liên quan tới ngăn hoàn tác.

Xóa khung không đụng tới tranh. Tranh gắn với `panelId`, nên hoàn tác chỉ cần khôi phục dòng `page` là tranh quay lại. Tranh không còn khung nào trỏ tới sẽ được GC đặt `art_panels.deleted_at` lúc khởi động lạnh ([04-du-lieu.md](04-du-lieu.md#dọn-rác)). Dialog đổi mẫu khung phải nói rõ số khung bị bỏ và rằng Undo sẽ khôi phục được.

## AI

Giữ cách cũ: client tương thích OpenAI, gọi `POST {base}/v1/chat/completions` tới server người dùng cấu hình. Thêm một port để sau này chuyển sang máy chủ trung gian mà không sửa tính năng.

```ts
// src/core/ai/port.ts
export type AiRequest = {
  messages: AiMessage[];
  json?: boolean;
};

export interface AiClient {
  complete(request: AiRequest, signal: AbortSignal): Promise<string>;
}
```

- File prompt (`story`, `writing`, `people`, `translate`, `assistant`) gọi `chat()` trong `core/ai/port.ts`. Lớp `app` đăng ký adapter bằng `configureAi(client)` lúc khởi động, nên `core` không phụ thuộc `data` và phần prompt giữ nguyên.
- `ai/context.ts` đang đọc store. Đổi thành nhận dữ liệu qua tham số.
- Giữ bước sửa JSON và gọi lại tối đa 3 lần.
- Mọi kết quả AI là bản nháp. Người dùng chấp nhận thì mới thành `ChangeSet`.
- `normalizeBaseUrl` đổi mặc định sang `https://`. Bản release chặn `http://`, nên mặc định cũ không dùng được.
- API key lưu trong bảng `meta`, chưa mã hóa, cùng mức với app cũ. Khi có máy chủ trung gian thì key không còn nằm trên máy.

## Native

Giữ hai TurboModule, tổng khoảng 190 dòng Kotlin, không phụ thuộc thư viện ngoài. Chúng làm đúng việc cần làm, và `unzip` đã chặn zip-slip.

| Module | Hàm | Thay đổi |
| --- | --- | --- |
| `NativeFiles` | `zip`, `unzip`, `shareFile` | Giữ nguyên |
| `NativeFiles` | `imagesToPdf` | Thêm tham số `pageWidthPt`. Hiện `PAGE_WIDTH_PT = 516` cố định theo khổ B5, sai với truyện A5 |
| `NativeFiles` | `copyText` | Mới, thay cho việc mở bảng chia sẻ |
| `NativeScreen` | `setOrientation`, `setSecure` | Giữ nguyên |
| `NativeScreen` | `setKeepAwake` | Mới, thay thư viện keep-awake |

`codegenConfig` trong `package.json` chỉ khai Android.

Thêm intent filter để mở file `.mangaka` từ app khác. App cũ chỉ nhập được qua Profile.

## Xử lý lỗi

- Lỗi ghi dữ liệu: hiện Toast và giữ dòng bẩn để thử lại, không bỏ im lặng.
- Lỗi AI: giữ nút Retry và Cancel như app cũ.
- Mỗi nhóm màn có một `ErrorBoundary`, kèm nút quay lại và xuất dự án đang mở.
- `ensureDirs` không được lưu lại promise đã thất bại. App cũ bị kẹt hàng đợi thumbnail vì việc này.
