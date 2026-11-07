# Dữ liệu và lưu trữ

Mọi dữ liệu có cấu trúc nằm trong một file SQLite qua `op-sqlite`. Chỉ ảnh và file xuất nằm ngoài.

## Vì sao đổi từ MMKV sang SQLite

- Một thao tác có thể chạm nhiều loại bản ghi. `removeCharacter` đụng 6 loại, trong khi MMKV không có transaction giữa các key.
- Tranh hiện được ghi lại cả khung sau mỗi nét. Với SQLite, mỗi nét là một dòng mới.
- `op-sqlite` nhận `ArrayBuffer` trực tiếp. Ghi file nhị phân qua RNFS phải đi qua base64 nên không dùng cách đó để lưu nét.

## Hình dạng dữ liệu

Không chuẩn hóa từng trường. Mỗi thực thể là một dòng tài liệu: cột khóa để truy vấn và cột `doc` chứa JSON đúng theo kiểu trong `src/core/model/types.ts`. Cách này giữ nguyên toàn bộ kiểu và logic cũ, và không cần ORM.

Riêng tranh được tách bảng, vì đó là phần lớn và thay đổi nhiều.

```sql
-- Thực thể: projects, chapters, scenes, characters, relations, world_entries
CREATE TABLE chapters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  doc         TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE pages (
  id          TEXT PRIMARY KEY,
  chapter_id  TEXT NOT NULL REFERENCES chapters(id),
  doc         TEXT NOT NULL,
  art_rev     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE art_panels (
  panel_id         TEXT PRIMARY KEY,
  page_id          TEXT NOT NULL REFERENCES pages(id),
  active_layer_id  TEXT,
  deleted_at       INTEGER
);

CREATE TABLE art_layers (
  id        TEXT PRIMARY KEY,
  panel_id  TEXT NOT NULL REFERENCES art_panels(panel_id),
  pos       INTEGER NOT NULL,
  name      TEXT NOT NULL,
  visible   INTEGER NOT NULL,
  opacity   REAL NOT NULL,
  locked    INTEGER NOT NULL,
  image     TEXT,               -- JSON LayerImage, đường dẫn tương đối
  gen       INTEGER NOT NULL DEFAULT 0,
  head      INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER
);

CREATE TABLE strokes (
  id        TEXT PRIMARY KEY,
  layer_id  TEXT NOT NULL REFERENCES art_layers(id),
  gen       INTEGER NOT NULL,
  seq       INTEGER NOT NULL,
  tool      TEXT NOT NULL,
  color     TEXT NOT NULL,
  size      REAL NOT NULL,
  opacity   REAL NOT NULL,
  flags     INTEGER NOT NULL,   -- bit 0: có lực nhấn
  tone      REAL,
  codec     INTEGER NOT NULL DEFAULT 1,  -- 1: Float32Array phẳng
  points    BLOB NOT NULL,
  UNIQUE (layer_id, gen, seq)
);

CREATE TABLE script_versions (id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, doc TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE assistant_threads (id TEXT PRIMARY KEY, project_id TEXT, doc TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

Cấu hình khi mở: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `auto_vacuum=INCREMENTAL`.

`meta` giữ cài đặt và thông tin onboarding. Đọc đồng bộ bằng `executeSync` để biết giao diện và màn đầu tiên trước khi vẽ khung hình đầu.

## Lưu nét vẽ

Nét vẽ không bao giờ bị sửa, chỉ thêm. Một lớp hiển thị các nét thỏa `gen = layer.gen AND seq < layer.head`.

| Thao tác | Việc làm |
| --- | --- |
| Vẽ một nét | Thêm dòng vào `strokes`, tăng `head`, trong một transaction |
| Hoàn tác nét | `head - 1` |
| Làm lại | `head + 1` |
| Vẽ nét mới sau khi hoàn tác | Ghi đè đuôi cũ: xóa các dòng `seq >= head` của `gen` hiện tại rồi thêm |
| Xóa lớp, di chuyển hoặc co giãn nội dung lớp | Tạo `gen` mới với các nét đã biến đổi. Hoàn tác là trả `gen` và `head` về giá trị cũ |

Vì vậy patch hoàn tác của tranh chỉ là một dòng `art_layers`, tranh không cần xử lý riêng.

`points` là `Float32Array` phẳng, đúng thứ tự `x,y` hoặc `x,y,pressure` như mảng `points` cũ, tính theo đơn vị trang (bề rộng trang là 1000). Cột `flags` cho biết bước nhảy 2 hay 3. Thử 2.000 nét giả lập cho thấy kích thước giảm từ 17,1 xuống 12 byte mỗi điểm. Lợi ích chính không nằm ở dung lượng mà ở chỗ không phải ghi lại cả khung. Cột `codec` để dành nếu sau này cần nén, chưa làm bây giờ.

## Đường dẫn file

```
<filesDir>/mangaka/
├── mangaka.db
├── images/    ảnh người dùng thêm: bìa, bảng thiết kế, ảnh thế giới, ảnh lớp
├── thumbs/    thumbnail, tạo lại được
├── exports/   file đã xuất
└── backups/   bản sao DB trước migration
<cacheDir>/mangaka-tmp/
```

Dữ liệu chỉ lưu **đường dẫn tương đối** với `<filesDir>/mangaka/`, ví dụ `images/abc.jpg`. App cũ lưu đường dẫn tuyệt đối, có chỗ kèm `file://`, nên phải chuẩn hóa khi nhập.

`allowBackup` giữ `false`. Người dùng sao lưu bằng file `.mangaka`.

## Dọn rác

| Thứ | Quy tắc |
| --- | --- |
| Truyện trong Thùng rác | Giữ theo `LIMITS.trashDays` như app cũ, hết hạn thì xóa hẳn |
| Dòng có `deleted_at` khác | Xóa hẳn sau 7 ngày |
| `gen` cũ, đuôi nét làm lại | Xóa khi không còn tham chiếu nào. Lịch sử chỉ ở trong bộ nhớ nên lúc khởi động không còn ai cần |
| File trong `images/`, `thumbs/` | Quét đánh dấu: file không dòng nào trỏ tới thì xóa |
| File trong `exports/` | Xóa theo truyện khi truyện bị xóa hẳn. Thêm nút xóa trong lịch sử xuất. App cũ không bao giờ xóa các file này |

GC chỉ chạy lúc khởi động lạnh, sau khi nạp xong dữ liệu. Nó cũng xử lý luôn phần `deleteProjectForever` của app cũ để sót lại.

**GC xóa nhầm tranh đang dùng là rủi ro nặng nhất của thiết kế này.** Từ giai đoạn 2 cho tới giai đoạn 7, GC chỉ chạy chế độ giả (`dryRun`), ghi log thứ sẽ xóa. Chỉ bật thật ở giai đoạn 7, sau khi có test cho mọi đường đi và đã đối chiếu log trên dữ liệu thật.

## Migration

- Dùng `PRAGMA user_version` và một danh sách bước TS có thứ tự trong `src/data/migrations/`.
- Trước khi chạy, sao lưu file DB sang `backups/`, giữ 2 bản gần nhất.
- Mỗi bước chạy trong transaction. Lỗi thì dừng, khôi phục bản sao, hiện màn hình báo lỗi kèm nút xuất dữ liệu.
- Mỗi migration có test chạy trên `node:sqlite` qua port `Db`.

## File `.mangaka`

Đây là cách duy nhất mang truyện từ app cũ sang.

**Bản 1 (app cũ):** file ZIP gồm `story.json` (`version: 1`, `app: 'mangaka'`, các thực thể, `art`) và `images/N.ext`. Không có lịch sử kịch bản, hội thoại trợ lý, cài đặt, thumbnail.

**Bản 2 (app mới):** cùng cấu trúc, nhưng tranh tách thành `art/<panelId>.json`. App cũ dồn tất cả nét vào một chuỗi JSON, dễ tràn bộ nhớ với truyện dài.

App mới ghi bản 2, đọc được cả hai. **Giữ bộ nhập bản 1 vĩnh viễn.**

Khi nhập:

1. Kiểm tra toàn bộ cấu trúc bằng `zod`. `parseProjectBundle` cũ chỉ kiểm tra id và danh sách cấp đầu.
2. Đổi toàn bộ id sang id mới, gồm cả `layer.id` và `activeLayerId`. **Bẫy:** id lớp lặp lại giữa các khung, nên không dùng nguyên được làm khóa chính của `art_layers`.
3. Kiểm tra `points` có độ dài chia hết cho bước nhảy (2 hoặc 3).
4. Chuẩn hóa đường dẫn ảnh về dạng tương đối.
5. Ghi tất cả trong một transaction. Lỗi thì không để lại gì.
6. Trùng tên thì thêm hậu tố (F-28).

Thao tác nhập chưa từng được thử trên máy thật ở app cũ (`docs/status.md`). Xem bước kiểm tra ở [09-lo-trinh.md](09-lo-trinh.md#giai-đoạn-0-bảo-toàn-dữ-liệu-cũ).
