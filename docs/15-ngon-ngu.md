# Ngôn ngữ giao diện

App có mười ngôn ngữ giao diện: tiếng Anh, tiếng Việt, tiếng Nhật, tiếng Trung giản thể, tiếng Trung phồn thể, tiếng Hàn, tiếng Tây Ban Nha, tiếng Bồ Đào Nha (Brazil), tiếng Indonesia và tiếng Thái. Người dùng chọn ở Profile → Language. Mặc định app theo ngôn ngữ của máy, và dùng tiếng Anh nếu không khớp ngôn ngữ nào.

Tiếng Trung được chọn theo chữ viết, rồi theo vùng. Máy ghi rõ `Hant`, hoặc đặt vùng Đài Loan, Hồng Kông, Ma Cao, thì dùng phồn thể. Các trường hợp còn lại dùng giản thể. Tiếng Quảng Đông (`yue`) dùng phồn thể, trừ khi máy ghi `Hans`. Android đời cũ ghi tiếng Indonesia là `in`; app vẫn nhận đúng.

Nội dung truyện của người dùng không được dịch. Dịch lời thoại của truyện là tính năng khác, nằm ở màn Lettering.

## Nhận ra chữ viết của truyện

Font của bóng thoại và giọng đọc của Nghe chương đều đoán chữ viết bằng một chỗ duy nhất: `src/core/lettering/textScript.ts`.

- Tiếng Việt chỉ được nhận khi có chữ riêng của tiếng Việt (ă đ ơ ư ạ ả ế…). Chữ á é ó ã ê ô cũng có trong tiếng Tây Ban Nha và Bồ Đào Nha, nên không tính.
- Chữ Hán toàn bộ nằm trong JIS X 0208 (cấp 1 và 2) thì có thể là tiếng Nhật. Có một chữ ngoài JIS (你, 们, 說…) thì chắc chắn là tiếng Trung, rồi xem chữ giản thể hay phồn thể để chọn bên nào (`hanVariants.ts`).
- Vẽ truyện (`fontForText`, `fontFamilies`, preset) không đọc ngôn ngữ giao diện, để cùng một truyện hiện giống nhau với mọi người. Chữ Hán có thể là tiếng Nhật thì dùng font Nhật trước, rồi đến font Trung. Tiếng Trung không rõ giản hay phồn thì dùng font phồn thể trước.
- Nghe chương thì có đọc ngôn ngữ giao diện: giao diện tiếng Nhật đọc dòng toàn chữ Hán bằng giọng Nhật.

## Cách hoạt động

Chữ trong code viết bằng tiếng Anh, và chính câu tiếng Anh là khóa. Mỗi ngôn ngữ khác là một file JSON trong `src/core/i18n/locales/`, ví dụ `vi.json`, `ko.json`, `zh-Hant.json`. Trong file, câu được chia theo khu vực của app:

```json
{
  "canvas": { "Undo": "Hoàn tác", "Pen size": "Cỡ bút" },
  "common": { "Cancel": "Hủy" }
}
```

File của một ngôn ngữ chỉ được nạp khi người dùng chọn ngôn ngữ đó (`src/core/i18n/locales/index.ts`).

```ts
import { msg, t, tn } from '../../core/i18n';

t('Start creating');                              // chữ cố định
t('Page {n} of {total}', { n: 2, total: 9 });     // có biến
tn(count, '{count} page', '{count} pages');       // theo số lượng
```

| Hàm | Dùng khi |
| --- | --- |
| `t(text, params?)` | Dịch một câu lúc vẽ màn hình |
| `tn(count, one, other)` | Câu thay đổi theo số lượng. `{count}` được điền sẵn |
| `msg(text)` | Đánh dấu chữ nằm trong hằng số ngoài component. Lúc vẽ thì gọi `t(item.label)` |

Không gọi `t()` ở ngoài component hay ngoài hàm: lúc file được nạp, app chưa biết ngôn ngữ. Không truyền template string vào `t()`, dùng `{name}` và `params`.

Đổi ngôn ngữ thì `AppRoot` vẽ lại toàn bộ màn hình, nên `t()` là hàm thường, không phải hook.

## Thêm hoặc sửa chữ

1. Viết câu tiếng Anh trong code, bọc bằng `t()`.
2. Thêm câu vào **cùng một khu vực** trong cả chín file JSON. Câu dùng ở nhiều khu vực thì để ở `common`.
3. Chạy `npx jest __tests__/i18nCatalog.test.ts`.

Test lấy `vi.json` làm chuẩn về khu vực và khóa. Test báo lỗi khi:

- Có câu chưa được dịch.
- Có câu không còn ai dùng.
- Một câu nằm ở hai khu vực.
- Một ngôn ngữ thiếu câu, thừa câu, hoặc đặt câu sai khu vực so với tiếng Việt.
- Bản dịch thiếu hoặc thừa biến `{...}`.

## Bảng thuật ngữ

Dùng đúng các từ này để cả app thống nhất.

| English | Tiếng Việt | 日本語 |
| --- | --- | --- |
| story | truyện | 作品 |
| chapter | chương | 章 |
| page | trang | ページ |
| panel | khung | コマ |
| script | kịch bản | 脚本 |
| scene | cảnh | シーン |
| outline | dàn ý | プロット |
| storyboard | phân cảnh | ネーム |
| character | nhân vật | キャラクター |
| world | thế giới | 世界観 |
| bubble | bóng thoại | フキダシ |
| lettering | đặt thoại | 写植 |
| dialogue | lời thoại | セリフ |
| narration | lời dẫn | ナレーション |
| sound effect | tiếng động | 効果音 |
| layer | lớp | レイヤー |
| canvas | trang vẽ | キャンバス |
| screentone | tông | トーン |
| ruler | thước | 定規 |
| materials | vật liệu | 素材 |
| cover | bìa | 表紙 |
| note | ghi chú | メモ |
| draft | bản nháp | 下書き |
| export | xuất | 書き出し |
| preview | xem thử | プレビュー |
| library | thư viện | ライブラリ |
| Profile | Hồ sơ | プロフィール |
| Assistant | Trợ lý | アシスタント |
| Trash | Thùng rác | ゴミ箱 |
| AI server | máy chủ AI | AIサーバー |
| undo / redo | hoàn tác / làm lại | 元に戻す / やり直す |

Không dịch: Manganova, PDF, PNG, CBZ, ZIP, MP4, px, AI, tên font, tên ngôn ngữ trong `LOCALE_NAME`.

Tiếng Việt: gọi người dùng là "bạn", câu ngắn, nút bấm không có dấu chấm. Tiếng Nhật: câu dùng thể です・ます, nút bấm dùng cụm danh từ hoặc động từ nguyên dạng.

## Android

Android khai các ngôn ngữ trong `res/xml/locales_config.xml`, để Android 13 trở lên cho chọn ngôn ngữ riêng của app trong Cài đặt. Chữ hệ thống duy nhất của Android là tên kênh thông báo `reminder_channel`, có trong `values-*`. Tiếng Trung dùng `b+zh+Hans` và `b+zh+Hant`, tiếng Indonesia dùng `values-in`.

Tên app, hộp xin quyền của hệ thống và trang cửa hàng chưa được dịch.
