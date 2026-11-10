# Tính năng bổ sung

Bốn tính năng thêm sau bản đầu, chạy trên cả Android và iOS. Ngôn ngữ giao diện có tài liệu riêng ở [15-ngon-ngu.md](15-ngon-ngu.md).

| Tính năng | Vào từ đâu | Code chính |
| --- | --- | --- |
| Truyện mẫu | Home khi thư viện trống, hoặc menu của Library | `src/features/home/sampleStory.ts` |
| Câu trả lời mẫu của AI | Mọi công cụ AI khi chưa có server | `src/core/ai/demo.ts` |
| Xuất ảnh mạng xã hội | Export → Social posts | `exportSocial` trong `src/features/export/runExport.ts` |
| Phát lại quá trình vẽ | Canvas → menu → Replay drawing | `src/features/canvas/ReplaySheet.tsx` |

## Truyện mẫu

File `android/app/src/main/assets/sample/lantern.manganova` nằm sẵn trong app. Android đọc nó như một asset. Project Xcode trỏ tới cùng file đó và đóng vào bundle.

Bấm "Open the sample story" thì app chép file ra thư mục tạm rồi nhập như một file `.manganova` bình thường. Id của truyện đã nhập được lưu ở bảng meta, khóa `sampleProjectId`. Lần sau bấm thì mở lại truyện đó. Nếu người dùng đã xóa truyện thì app nhập lại.

Truyện mẫu là truyện thường: sửa được, xóa được, xuất được.

Đổi truyện mẫu: sinh bằng `__tests__/sampleStory.test.ts` với `SEED_OUT` và `SEED_INKS`, nén thư mục thành zip, đặt đè lên file trên. Tranh trong truyện mẫu hiện tại là ảnh nhập vào lớp, không phải nét vẽ.

## Câu trả lời mẫu của AI

AI của app gọi tới server do người dùng tự cấu hình. Chưa có server thì mọi công cụ AI đều không dùng được, nên người mới (và người duyệt app của Apple, Google) không thử được gì.

Khi ô địa chỉ server còn trống và công tắc Profile → AI → Sample answers đang bật (mặc định bật), `boot.ts` chuyển mọi yêu cầu AI sang `createDemoClient`. Client này trả về câu trả lời soạn sẵn, đúng định dạng JSON mà từng công cụ đọc.

| Việc | Cách làm |
| --- | --- |
| Nhận ra công cụ nào đang gọi | Theo câu chữ của prompt. `__tests__/aiDemo.test.ts` chạy mọi công cụ qua client mẫu, nên đổi prompt mà quên sửa `demo.ts` thì test báo lỗi |
| Cho người dùng biết đây là câu mẫu | Toast "Sample answer…" (tối đa 20 giây một lần), ghi chú ở đầu màn Assistant, và một dòng ở cuối mỗi câu trả lời của trợ lý |
| Dịch thoại | Không có câu mẫu. Màn dịch vẫn yêu cầu server thật, vì câu mẫu không thể thay cho bản dịch |
| Tắt | Tắt công tắc, hoặc điền địa chỉ server |

`useAiConfigured()` trả về true khi có server hoặc đang bật câu mẫu. Chỗ nào cần server thật thì dùng `useAiServerSet()`.

## Xuất ảnh mạng xã hội

Định dạng `social` xuất mỗi khung thành một ảnh PNG, theo thứ tự đọc, đặt giữa một khung nền trắng:

| Lựa chọn | Kích thước |
| --- | --- |
| Square | 1080×1080 |
| 4:5 | 1080×1350 |
| 9:16 | 1080×1920 |

Mỗi trang chỉ vẽ một lần, rồi cắt từng khung ra. `socialPageWidth` tính bề rộng cần vẽ để khung bị phóng to nhất vẫn nét, tối đa 3600 px. Nhiều ảnh thì đóng thành ZIP, một ảnh thì ra file PNG. Bìa và trang thông tin không áp dụng cho định dạng này.

## Phát lại quá trình vẽ

Nét vẽ lưu ở dạng vector, nên app dựng lại được từng bước mà không phải ghi hình lúc vẽ.

- Thứ tự phát: từng lớp, từ lớp dưới lên, trong mỗi lớp theo thứ tự nét. Ảnh nhập vào lớp tính là một bước. Lớp đang ẩn không phát. Nét đã hoàn tác không còn trong dữ liệu nên không xuất hiện.
- Xem trong app: `ReplaySheet` vẽ lại khung ở từng bước bằng Skia.
- Video: `makeReplayVideo` vẽ tối đa 240 khung hình JPEG, cạnh dài 1080 px, rồi gọi `framesToVideo` của module native để ra file MP4 (H.264). Khung cuối giữ thêm 1,2 giây. Ít nét thì phát chậm (6 hình mỗi giây), nhiều nét thì tới 30.
- File video nằm ở thư mục cache, mỗi lần chỉ giữ một file. Người dùng bấm Share hoặc Save để lấy ra.

`framesToVideo(framePaths, outPath, fps)` thêm vào `specs/NativeFiles.ts`:

| Nền tảng | Cách mã hóa |
| --- | --- |
| Android | `FrameVideoEncoder.kt`: `MediaCodec` vẽ từng ảnh lên input surface, `MediaMuxer` ghi MP4. Thời điểm của từng khung hình được đặt lúc ghi, vì canvas trên surface bị đóng dấu theo đồng hồ thật |
| iOS | `AVAssetWriter` với pixel buffer trong `NativeFilesModule.mm` |

Đã chạy thử trên emulator Android và simulator iPhone 17 Pro. Chưa thử trên máy thật.
