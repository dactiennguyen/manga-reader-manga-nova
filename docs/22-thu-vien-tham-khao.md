# Thư viện tham khảo

Nơi ghim ảnh để vẽ theo. Ảnh nằm trong từng bảng, mỗi bảng có một loại: Nhân vật, Bối cảnh, Tư thế hoặc Khác. Khi vẽ, mở một bảng thành cửa sổ nổi cạnh trang.

## Mở từ đâu

| Chỗ | Mở gì |
| --- | --- |
| Profile, nhóm Studio, dòng "Thư viện tham khảo" | Danh sách mọi bảng |
| Library, menu ⋯ | Danh sách mọi bảng |
| Project, menu ⋯ | Danh sách, lọc sẵn theo truyện này (bỏ lọc bằng chip tên truyện) |
| Character, tab Design, mục "Thư viện tham khảo" | Bảng của nhân vật này. Nút "Bảng mới" tạo bảng đã liên kết và đặt tên theo nhân vật |
| Canvas, nút ghim trên thanh trên, hoặc menu ⋯ | Sheet chọn bảng, ảnh nhân vật, một ảnh từ thư viện Ảnh hoặc từ Tệp. Mục "Thêm ảnh tham khảo" trong menu ⋯ mở thẳng thư viện Ảnh |

Route: `RefBoards` (`projectId?`, `characterId?`) và `RefBoard` (`boardId`). Code ở `src/features/refBoards/`, logic thuần ở `src/core/refBoards/`.

## Danh sách bảng

- Mỗi thẻ có ảnh bìa ghép từ tối đa 4 ảnh đầu, tên, loại, số ảnh và truyện hoặc nhân vật đã liên kết.
- Chip lọc theo loại, có đếm số. Ô tìm kiếm tìm trong tên bảng, loại, tên truyện, tên nhân vật, ghi chú và thẻ của ảnh. Tìm không cần gõ dấu.
- Nhấn giữ một thẻ để sửa hoặc xóa. Xóa bảng hỏi lại, rồi xóa luôn ảnh của bảng khỏi máy.
- Màn trống dùng `EmptyState` với nút "Bảng mới".

## Trong một bảng

- Ảnh xếp kiểu masonry: mỗi ảnh vào cột đang ngắn nhất. Điện thoại 2 cột, máy tính bảng nhiều hơn. Ảnh quá cao hoặc quá rộng bị cắt về tỉ lệ 0,6 đến 1,8.
- Thêm ảnh: từ thư viện Ảnh, từ Tệp (chọn nhiều ảnh một lần, tối đa 20, và không quá số chỗ còn trống của bảng), hoặc từ truyện (ảnh trong bảng tạo hình nhân vật và mục thế giới). Bảng đã liên kết truyện thì chỉ hiện ảnh của truyện đó.
- Thư viện Ảnh dùng `react-native-image-picker` (`launchImageLibrary`, `pickPhotosToCache` trong `src/native/files.ts`). iOS mở PHPicker, Android mở trình chọn ảnh của hệ thống. Cả hai chạy ngoài app nên **không hỏi quyền** và không cần `NSPhotoLibraryUsageDescription`: app không bật `includeExtra`, tùy chọn duy nhất của thư viện cần quyền Ảnh. Ảnh HEIC được đổi sang JPEG (`assetRepresentationMode: 'compatible'`). Android bản cũ không có trình chọn ảnh thì thư viện mở trình chọn file, không giữ giới hạn số ảnh, nên app cắt bớt.
- Tệp dùng `@react-native-documents/picker` như trước, cho ảnh nằm trong iCloud Drive, Google Drive hay thư mục Tải về.
- Nhấn giữ một ảnh: sửa ghi chú và thẻ, chuyển lên đầu, lên trước, ra sau, gỡ khỏi bảng.
- Menu ⋯ có "Sắp xếp lại ảnh": danh sách với nút lên, xuống cho từng ảnh.
- Có thẻ thì hiện hàng chip để lọc ảnh theo thẻ.
- Nhấn một ảnh mở màn xem toàn màn hình: chụm hai ngón hoặc chạm hai lần để phóng to, vuốt ngang hoặc bấm mũi tên để đổi ảnh, chạm một lần để ẩn thanh.
- Một bảng giữ tối đa 300 ảnh. Thẻ: tối đa 8, ngăn bằng dấu phẩy.

## Cửa sổ nổi khi vẽ

Theo quy tắc "trang dẫn đầu": cửa sổ nhỏ (rộng 176dp), nằm phía đối diện thanh công cụ, ngay dưới thanh trên.

- Chỉ che đúng khung của nó. Vẽ ở ngoài khung vẫn như bình thường.
- Kéo ở bất kỳ đâu để di chuyển. Vuốt nhanh sang ngang trên ảnh, hoặc bấm mũi tên, để đổi ảnh trong bảng.
- Kéo góc dưới phải để đổi cỡ, từ 160dp tới 70% bề rộng vùng vẽ.
- Nút độ đục đổi vòng 100, 75, 50, 25%. Chỉ ảnh mờ đi, nút vẫn rõ. Nút lật ngang lật ảnh.
- Nút thu gọn biến cửa sổ thành một thẻ nhỏ ở mép màn hình. Kéo thẻ lên xuống được, chạm để mở lại.
- Vị trí, cỡ, độ đục, lật, bảng và ảnh đang xem được nhớ tới khi tắt app (`session` trong `useRefBoards`, không ghi xuống đĩa).
- Ảnh nhân vật và "Thêm ảnh tham khảo" cũng mở trong cửa sổ này.
- Đang mở một bảng mà thêm hay gỡ ảnh ở màn khác thì cửa sổ cập nhật theo.

## Dữ liệu

Migration 3 thêm hai bảng. Bước này tự đủ (`CREATE TABLE IF NOT EXISTS`), nên đổi số được nếu nhánh khác thêm migration trước.

```sql
CREATE TABLE ref_boards (id TEXT PRIMARY KEY, project_id TEXT, character_id TEXT, doc TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE ref_images (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES ref_boards(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  doc TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

`doc` là JSON theo kiểu `RefBoard` và `RefImage` trong `src/core/refBoards/model.ts`. Ảnh lưu cỡ điểm ảnh để xếp masonry mà không phải đọc file.

Liên kết truyện và nhân vật là tùy chọn, không có khóa ngoại. Truyện bị xóa hẳn hoặc nhân vật bị xóa thì bảng vẫn còn, chỉ mất liên kết (`boardLink` bỏ qua liên kết hỏng). Liên kết nhân vật cần liên kết truyện: bỏ truyện thì bỏ luôn nhân vật.

## File ảnh

- Ảnh của bảng nằm ở `refs/<boardId>/`, không nằm trong `images/`. Dọn rác chỉ được quét `images/` và `thumbs/` (`SWEPT_DIRS` trong `src/data/gc.ts`), nên không bao giờ xóa nhầm ảnh tham khảo.
- Ảnh lấy từ máy (thư viện Ảnh hay Tệp) được chuyển từ cache vào thư mục của bảng. Ảnh lấy từ nhân vật hay thế giới được **chép**, nên xóa nhân vật không làm hỏng bảng và xóa bảng không làm mất ảnh nhân vật.
- Gỡ một ảnh xóa file của nó. Xóa bảng xóa cả thư mục `refs/<boardId>/`.

## File `.manganova`

Quyết định: file xuất của một truyện mang theo các bảng **đã liên kết với truyện đó**, kèm ảnh. Bảng không liên kết ở lại trên máy.

- Trường mới `refBoards` trong `story.json`, dạng `[{ board, images }]`. Ảnh đi chung thư mục `images/N.ext` với ảnh khác của truyện.
- Khi nhập: đổi id như mọi thực thể, liên kết nhân vật đi theo nhân vật mới. Nhân vật không có trong file thì bỏ liên kết. Ảnh được chuyển từ `images/` sang `refs/<boardId>/`.
- Dữ liệu hỏng trong `refBoards` bị bỏ qua (`cleanBoardBundles`), truyện vẫn nhập được. App bản cũ đọc file mới vẫn được vì nó bỏ qua trường lạ.
- Truyện gửi cho bạn qua "Chơi cùng nhau" **không** mang bảng theo (`exportProject(id, { refBoards: false })`): ảnh tham khảo thường là ảnh chụp hoặc ảnh tải về, chỉ nên ở máy của mình.

## Chưa làm

- Sắp xếp bằng kéo thả trong lưới masonry. Hiện dùng nút lên, xuống.
