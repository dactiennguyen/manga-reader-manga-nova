# Canvas và engine vẽ

Canvas là phần rủi ro nhất về kỹ thuật. App cũ chưa từng được thử trên máy thật, với bút cảm ứng, hay với truyện dài (`docs/status.md`), nên hiện chưa có số đo làm mốc. Mọi ngưỡng ở đây là ước tính ban đầu, giai đoạn 1 sẽ đo.

## Giữ từ app cũ

- Nét vẽ vector theo tọa độ trang, cắt theo đa giác của khung.
- Nét đang vẽ nằm trong `saveLayer` của lớp, nhờ đó tẩy và độ đục đúng ngay khi đang vẽ.
- Giảm điểm theo mức phóng to, cache path bằng `WeakMap`.
- Giới hạn 50 bước hoàn tác và 8 lớp.

Quy tắc cử chỉ phải giữ nguyên:

| Cử chỉ | Hành vi |
| --- | --- |
| Chạm hai ngón | Hoàn tác |
| Chạm ba ngón | Làm lại |
| Chạm đúp hai ngón | Đặt lại khung nhìn |
| Giữ 550ms | Lấy màu |
| Ngón thứ hai đặt xuống khi đang vẽ | Hủy nét |
| Bút cảm ứng ở chế độ tự động | Bút vẽ, ngón tay di chuyển, bỏ qua lòng bàn tay |
| Hai ngón | Phóng to, xoay, có hít về góc và giới hạn mức zoom |

Vị trí công cụ đảo theo tay thuận. Đang vẽ không được rung hay nhảy khung nhìn.

## Sửa so với app cũ

| App cũ | App mới |
| --- | --- |
| Cử chỉ chạy trên luồng JS | Cử chỉ là worklet trên luồng giao diện |
| Pan và zoom gọi `setView`, render lại component khoảng 855 dòng | `ViewState` nằm trong `SharedValue`, không render React |
| Tính lại toàn bộ đường viền nét ở mỗi điểm, O(n²) theo nét | Chỉ tính lại đuôi nét |
| Vẽ lại cả lớp sau mỗi nét | Niêm phong picture theo từng nhóm 128 nét, chỉ ghi lại đuôi |
| Lưu cả khung sau 400ms | Ghi một dòng khi nhấc bút |
| Cache tranh không bao giờ giải phóng | LRU 3 khung, gọi `dispose` khi đẩy ra |
| Một số phiên bản tranh toàn cục, mọi `PageView` vẽ lại | `art_rev` theo từng trang |

## Thiết kế

```
Gesture (worklet, luồng UI)
   │  điểm chạm + lực nhấn
   ▼
Session reducer (worklet, thuần)      src/core/art/session.ts
   │  nét đang vẽ, ViewState
   ▼
SharedValue ───▶ Skia vẽ nét đang vẽ + picture đã niêm phong
   │
   │ nhấc bút: scheduleOnRN(Float32Array)
   ▼
JS: ChangeSet ──▶ ghi strokes, đẩy ngăn panel:<id>
   │ báo đã nhận
   ▼
UI: bỏ nét khỏi danh sách pending
```

- Dùng `useManualGesture` và `usePanGesture` chạy đồng thời qua `useSimultaneousGestures`. Phải giữ Pan vì `TouchData` không có lực nhấn và Manual không có `stylusData`.
- Chuyển logic `Session` của app cũ thành reducer thuần có chỉ thị `'worklet'`, có test. Bộ đếm giữ 550ms chạy trên JS.
- Chép `perfect-freehand` vào `src/core/art/freehand.ts` và thêm chỉ thị `'worklet'`. Thư viện npm không chạy được trong worklet.
- Luồng UI giữ nét đã xong trong danh sách `pending` cho tới khi JS xác nhận, để gạch nhanh không bị nháy.
- `<Canvas opaque>` để dùng SurfaceView. Kiểm tra có chớp khi chuyển màn hay không.

**Điểm phải biết:** ở Skia 2.14, vẽ trên màn hình chạy trên main thread, sự kiện chạm cũng giao trên main thread. Một lần phát lại chậm sẽ làm trễ cả nét đang vẽ. Vì vậy thời gian phát lại là con số phải canh.

## Giới hạn

| Thứ | Giới hạn |
| --- | --- |
| Số điểm mỗi nét | 4.096, vượt thì tự kết thúc nét |
| Số lớp | 8 |
| Bước hoàn tác | 50 |
| Khung giữ trong bộ nhớ | 3 |

## Ngưỡng ở giai đoạn 1

Dùng một khung giả lập 5.000 nét, đo trên một máy tầm trung thật.

| Chỉ số | Ngưỡng ban đầu |
| --- | --- |
| Phát lại picture đã niêm phong, mức 2.000 nét | ≤ 6ms mỗi khung hình |
| Pan và zoom | Không rơi khung hình rõ rệt, không render React |
| Mở khung 5.000 nét | Chốt sau lần đo đầu tiên |
| Nháy khi nhấc bút và gạch nhanh | Không có |
| Ghi một nét | Không chặn nét kế tiếp |

**Nếu không đạt ngưỡng phát lại**, mới thêm ba mặt phẳng raster (dưới lớp đang vẽ, lớp đang vẽ, trên lớp đang vẽ) theo tỉ lệ trang bằng `MakeOffscreen`, tối đa 4.096px mỗi cạnh và khoảng 96MB. Vượt tỉ lệ raster thì dùng lại vector. Đạt ngưỡng thì không làm phần này.

## Không làm

Raster hóa ngoài main thread, tuần tự hóa picture, vẽ front-buffer, dự đoán chuyển động.

Gesture Handler 3.5.0 trên Android không đọc `getHistorical*`, nên các mẫu bút gộp sẽ bị bỏ. Chỉ viết thêm Kotlin để lấy nếu thử với bút thấy nét bị gãy.

## Dựng trang

`src/render/` tách theo từng việc: `drawPage`, `drawArt`, `drawBubble`, `drawEffect`, `thumbs`. Dùng chung cho `PageView`, thumbnail, đọc thử và xuất file. Hàng đợi thumbnail tách khỏi `engine/page.ts` cũ, chỉ chạy theo `art_rev` từng trang.

Kết quả xuất phải khớp app cũ. Xem so sánh ảnh mẫu ở [10-kiem-thu-va-phat-hanh.md](10-kiem-thu-va-phat-hanh.md#so-sánh-ảnh-trang).
