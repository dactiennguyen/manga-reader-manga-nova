# Website

Trang tĩnh bằng HTML và CSS, không cần build. Nó cung cấp các link mà Play Console cần:

| Trang | File | Điền vào đâu trong Play Console |
| --- | --- | --- |
| Giới thiệu | `index.html` | Store settings → Website |
| Chính sách quyền riêng tư | `privacy.html` | App content → Privacy policy (bắt buộc) |
| Điều khoản sử dụng | `terms.html` | Không bắt buộc, trang giới thiệu đã có link |

## Deploy

Trang chạy trên Cloudflare Pages, project `manganova`:

```sh
npx wrangler pages deploy website --project-name manganova --branch main --commit-dirty=true
```

Pages tự bỏ đuôi `.html`, nên link dùng dạng `/privacy` và `/terms`. Sau khi app lên store, không đổi các link này.

## Việc cần sửa trước khi nộp

1. **Email liên hệ.** Mục Contact ở `privacy.html` và `terms.html` đang trỏ tới email trên trang Google Play. Có email thật rồi thì thay câu đó bằng địa chỉ email, và khai đúng địa chỉ ấy ở Play Console.
2. **Nút Google Play.** Khi app đã lên store, thay `<span class="button soon">` trong `index.html` bằng link `https://play.google.com/store/apps/details?id=com.manganova.manga.reader.org`.

## Ảnh

- `img/*.webp` lấy từ `docs/google-play/screenshots/phone`, rộng 540px. Chụp lại ảnh thì tạo lại các file này.
- `img/art/` chép từ `src/assets/art`.
- Ảnh truyện mẫu được vẽ ngoài app, và trang đã ghi rõ điều đó ở dưới phần tính năng. Giữ dòng ghi chú này.

## Xem thử trên máy

```sh
python3 -m http.server 8000 --directory website
```

Link `/privacy` chỉ chạy trên Pages. Trên máy, mở `http://localhost:8000/privacy.html`.
