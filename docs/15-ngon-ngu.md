# Ngôn ngữ giao diện

App có ba ngôn ngữ giao diện: tiếng Anh, tiếng Việt, tiếng Nhật. Người dùng chọn ở Profile → Language. Mặc định theo ngôn ngữ của máy, không khớp thì dùng tiếng Anh.

Nội dung truyện của người dùng không được dịch. Dịch lời thoại của truyện là tính năng khác, nằm ở màn Lettering.

## Cách hoạt động

Chữ trong code viết bằng tiếng Anh, và chính câu tiếng Anh là khóa. Bản dịch nằm ở `src/core/i18n/catalog/`, mỗi khu vực của app một file.

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
2. Thêm bản dịch vào file của khu vực đó trong `src/core/i18n/catalog/`. Chữ dùng ở nhiều khu vực thì để ở `common.ts`.
3. Chạy `npx jest __tests__/i18nCatalog.test.ts`.

Test này đọc toàn bộ `src/` và báo lỗi khi: một câu chưa có bản dịch, danh mục còn câu không ai dùng, một câu nằm ở hai file, hoặc bản dịch thiếu biến `{...}`.

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

## iOS và Android

`Info.plist` khai `CFBundleLocalizations` gồm `en`, `vi`, `ja`, để App Store hiện đúng ba ngôn ngữ. Android không cần khai gì, vì chữ nằm trong JavaScript chứ không nằm trong `res/values`.

Tên app, màn xin quyền của hệ thống và trang cửa hàng chưa được dịch.
