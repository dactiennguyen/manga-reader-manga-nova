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

## Đợt 2

| Tính năng | Vào từ đâu | Code chính |
| --- | --- | --- |
| Mẫu truyện có sẵn | Tạo truyện mới → bước Format → Start with | `src/core/story/starters.ts` |
| Thống kê sáng tác | Profile, thẻ ngay dưới bút danh | `src/core/story/activity.ts`, `src/features/profile/StreakCard.tsx` |
| Nhắc vẽ hằng ngày | Profile → Daily drawing reminder | `specs/NativeReminder.ts`, `src/features/profile/reminder.ts` |
| Chữ ký trên ảnh xuất | Export → Sign every image | `drawSignature` trong `src/features/export/exportSheets.ts` |
| Phát lại cả trang | Chia khung → menu → Replay page drawing | `src/features/canvas/ReplaySheet.tsx`, `replayVideo.ts` |

### Mẫu truyện có sẵn

Bốn lựa chọn: Blank, 4-koma strip (2 trang 4 khung), One-shot 8 trang, Webtoon episode (5 dải). Chọn mẫu thì app chọn luôn khổ phù hợp, đổi khổ không hợp thì mẫu quay về Blank.

Khi tạo truyện, `applyStarter` điền tóm tắt và mục tiêu cho chương 1, thêm một cảnh cho mỗi nhịp truyện, và thêm các trang đã chia khung. Chữ được viết vào truyện bằng ngôn ngữ giao diện lúc tạo, vì từ đó nó là nội dung của người dùng.

### Thống kê sáng tác

Mỗi lần nhấc bút, `commitStroke` gọi `noteStrokes`. Số nét theo ngày lưu ở bảng meta, khóa `activity`, ghi chậm 3 giây và ghi ngay khi app vào nền. Giữ 400 ngày gần nhất, còn tổng số nét lưu riêng.

- Chuỗi ngày: số ngày liền nhau có vẽ. Hôm nay chưa vẽ thì chưa mất chuỗi của hôm qua.
- Mục tiêu mỗi ngày: 0 (tắt), 50, 100, 200, 400 nét. Mặc định 100.
- Nét hoàn tác vẫn được đếm, vì đó vẫn là thời gian vẽ.

### Nhắc vẽ hằng ngày

Thông báo cục bộ, không cần server. Giờ chọn trong danh sách 08:00 đến 22:00, mặc định 20:00.

| Nền tảng | Cách làm |
| --- | --- |
| Android | `AlarmManager.setWindow` với cửa sổ 30 phút, nên không cần quyền báo thức chính xác. Mỗi lần báo thì tự hẹn ngày hôm sau. `ReminderReceiver` hẹn lại sau khi máy khởi động. Android 13 trở lên hỏi quyền `POST_NOTIFICATIONS` lúc bật |
| iOS | `UNCalendarNotificationTrigger` lặp mỗi ngày. Hỏi quyền lúc bật |

Chữ của thông báo cố định lúc hẹn, nên `AppRoot` hẹn lại mỗi khi mở app hoặc đổi ngôn ngữ. Người dùng từ chối quyền thì công tắc tự tắt và app báo cách bật lại.

Đã thử trên emulator Android: hộp thoại xin quyền, báo thức được đăng ký, thông báo hiện lúc 20:00 (chỉnh đồng hồ emulator) và tự hẹn sang ngày sau.

Trên máy Xiaomi (MIUI, HyperOS) và một số hãng khác, hệ thống có thể chặn báo thức của app không được phép tự khởi động. Nếu người dùng báo không nhận được nhắc, hướng dẫn họ bật Tự khởi động (Autostart) và tắt tiết kiệm pin cho Manganova.

### Chữ ký trên ảnh xuất

Bút danh in ở góc dưới bên phải của mỗi ảnh: từng trang của PNG, PDF, CBZ; từng trang trong ảnh dài; từng khung của ảnh mạng xã hội. Chữ màu mực có viền mờ màu giấy để đọc được trên cả nền trắng và nền đen. Bật cần có bút danh. Chữ ký là một phần của ảnh nên không dịch.

### Phát lại cả trang

Màn phát lại nhận một "cảnh": một khung, hoặc mọi khung của trang theo thứ tự đọc. Phát hết khung này mới sang khung sau, viền khung luôn hiện. Video vẫn tối đa 240 khung hình, cạnh dài 1080 px.

## Đợt 2: trang vẽ và đặt thoại

| Tính năng | Vào từ đâu | Code chính |
| --- | --- | --- |
| Chọn vùng, dời, co giãn, xoay nét | Thanh công cụ → Select strokes | `src/core/art/selection.ts`, `affine.ts`, `src/features/canvas/useCanvasSelection.ts` |
| Màu vừa dùng và bảng màu lưu sẵn | Hàng màu ở bảng công cụ dưới | `src/core/art/palette.ts`, `src/features/canvas/CanvasColorRow.tsx` |
| Dáng người mẫu để can | Menu trang vẽ → Poses | `src/core/art/poses.ts`, `src/features/canvas/PosesSheet.tsx` |
| Bóng thoại và tiếng động dựng sẵn | Đặt thoại → Presets | `src/core/lettering/presets.ts`, `src/features/lettering/PresetSheet.tsx` |
| Thêm phông chữ | Chọn bóng thoại → dòng Font | `src/core/lettering/fonts.ts`, `src/render/fonts.ts` |

### Chọn vùng

- Khoanh một vòng trên lớp đang chọn. Nét nào có hơn một nửa số điểm nằm trong vòng thì được chọn. Hình chữ nhật, elip và đường thẳng được xét theo đường viền, không theo hai góc.
- Kéo bên trong khung để dời, kéo góc để co giãn, kéo tay cầm phía trên để xoay. Có nút xoay 90°, lật, phóng to, thu nhỏ, xóa.
- Apply, chạm ra ngoài khung, đổi công cụ hay bấm Done đều áp dụng thay đổi, gộp thành một bước hoàn tác (`rewriteLayer`). Chỉ nút Cancel mới bỏ thay đổi.
- Lúc kéo, luồng giao diện chỉ phát lại các picture đã ghi sẵn dưới một ma trận, không dựng lại path. Nét chỉ được tính lại khi áp dụng.
- Xoay một hình chữ nhật thì nó thành một vùng tô kín đúng hình nét viền. Xoay một elip thì nó thành đường cong 64 điểm.
- Ảnh nhập vào lớp không nằm trong vùng chọn; công cụ Move vẫn lo phần đó.

### Bảng màu

8 màu vừa dùng gần nhất và tối đa 24 màu lưu sẵn, lưu trong cài đặt (`recentColors`, `savedColors`), dùng chung cho mọi truyện. Truyện đen trắng chỉ hiện các màu xám.

### Dáng người mẫu

13 dáng (đứng, đi, chạy, ngồi, quỳ, nhảy, đấm, đá, chỉ tay, khoanh tay, ngoái lại, nằm, bán thân), vẽ bằng code từ tọa độ khớp, khoảng 7,5 đầu. Chọn một dáng thì app thêm một lớp mới mang tên dáng, độ mờ 60%, nằm ngay dưới lớp đang vẽ. Lớp và nét trong đó là một bước hoàn tác (`addLayer` nhận nét ban đầu). Không có file ảnh nào.

### Bóng thoại và tiếng động dựng sẵn

10 kiểu bóng thoại và 19 tiếng động chia 5 nhóm. Chữ tiếng động theo ngôn ngữ giao diện (BOOM / ẦM / ドカーン), nằm trong danh mục dịch. Chạm một mẫu là bóng thoại được đặt vào giữa khung đang chọn, hoặc khung đầu tiên theo thứ tự đọc, và được chọn sẵn để kéo hay sửa chữ. Thêm hai lần liền nhau thì bóng sau lệch 28 px để không che bóng trước. Hình xem trước được vẽ bằng chính `drawBubble`.

`SFX_STYLES` chỉ được thêm vào cuối, vì bóng thoại lưu vị trí của kiểu trong danh sách.

### Phông chữ

| Khóa | Phông | Tiếng Việt | Tiếng Nhật |
| --- | --- | --- | --- |
| `hand` | Patrick Hand | Có | Không |
| `sans`, `sansBold` | Be Vietnam Pro | Có | Không |
| `display` | Anton | Có | Không |
| `comic` | Bangers | Có | Không |
| `casual` | Mali Medium | Có | Không |
| `rounded` | M PLUS Rounded 1c Medium | Có | Có |
| `marker` | Yusei Magic | Thiếu nhiều dấu | Có |
| `heavy` | Dela Gothic One | Có | Có |

Năm phông mới nặng 9,3 MB, đều theo giấy phép SIL OFL 1.1, đã ghi trong `src/assets/fonts/FONT-LICENSES.txt` và màn About. Khi một phông thiếu chữ, Skia dùng danh sách dự phòng: phông chữ đậm lùi về Dela Gothic One, phông chữ thường lùi về M PLUS Rounded 1c, Yusei Magic lùi về Patrick Hand cho tiếng Việt. Tên phông lạ trong file nhập vào thì vẽ bằng `hand` nhưng vẫn giữ nguyên giá trị đã lưu.

Thêm một phông: thêm file, một dòng `SOURCES` trong `src/render/fonts.ts`, các bảng trong `src/core/lettering/fonts.ts`, `FONT-LICENSES.txt`, màn About, và bảng `FILES` trong hai test phông.

### Đã thử

- Emulator Android: dáng người mẫu, chọn vùng (khoanh, kéo, xoay 90°, áp dụng, hoàn tác), lưu màu vào bảng màu, mẫu truyện one-shot, thông báo nhắc vẽ.
- Simulator iPhone, bản Release: bảng mẫu bóng thoại và tiếng động, chèn tiếng động, bộ chọn phông.
- Điện thoại thật Redmi Note 10S (Android 13, tiếng Việt): giới thiệu, chọn sở thích, truyện mẫu, bảng mẫu tiếng động bằng tiếng Việt, chọn vùng trên lớp 150 nét (kéo vẫn cập nhật liền tay), phóng to, thẻ thống kê, hộp thoại xin quyền thông báo.
- Sửa sau khi thử trên điện thoại: câu mô tả ở màn giới thiệu bị cắt khi dài (cho 3 dòng), thanh nút của vùng chọn quá rộng nên nút Xóa bị khuất (chia hai hàng, có chữ), truyện tạo nhanh mang tên tiếng Anh (giờ theo ngôn ngữ giao diện), màu vừa dùng trùng màu có sẵn hiện hai lần.
- Chưa thử: tiếng Nhật trong bóng thoại trên máy thật, thông báo nhắc vẽ hiện thật trên máy Xiaomi.
