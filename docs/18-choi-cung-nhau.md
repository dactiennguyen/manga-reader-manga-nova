# Chơi cùng nhau trên cùng Wi-Fi

Tài liệu cho lập trình viên làm tiếp phần chơi nhiều người. Mọi thứ chạy trên máy, không có server: một máy mở phòng, các máy khác vào phòng qua mạng Wi-Fi chung.

Cập nhật: 2026-11-11, nhánh `develop`.

## 10 hoạt động

| Hoạt động | Logic (`src/core/nearby`) | Màn hình (`src/features/nearby`) |
| --- | --- | --- |
| Vẽ cùng nhau: một trang, mỗi người một layer mang tên mình, con trỏ có tên, thả cảm xúc | `codraw.ts`, `drawPayload.ts` | `CoDrawScreen`, `codraw/*` |
| Tiếp sức: mỗi người vẽ một khung, chỉ thấy khung ngay trước | `relay.ts`, `relaySession.ts` | `RelayScreen`, `relay/*` |
| Thi vẽ nhanh: cùng đề, bấm giờ, bình chọn (không tự bầu cho mình) | `battle.ts`, `battleSession.ts` | `BattleScreen`, `battle/*` |
| Đoán tranh: lần lượt vẽ một từ bí mật, người khác gõ câu đoán | `guess.ts`, `guessSession.ts` | `GuessScreen`, `guess/*` |
| Cùng viết kịch bản: cả phòng viết kịch bản một chương cùng lúc | `scriptTogether.ts`, `scriptSession.ts` | `ScriptTogetherScreen`, `script/*` |
| Đọc cùng nhau: chủ phòng lật trang, mọi người dán nhãn góp ý | `readTogether.ts`, `reviewNotes.ts` | `ReadTogetherScreen`, `share/TogetherReader.tsx` |
| Lồng tiếng: chia vai, mỗi người thu lời thoại của mình, ghép thành bản nghe | `dub.ts`, `dubClips.ts`, `dubRoom.ts`, `dubPlay.ts` | `DubScreen`, `dub/*` |
| Đổi thẻ nhân vật | `cardSwap.ts` | `CardSwapScreen` |
| Danh thiếp mangaka có QR, thêm bạn bè | `friendLink.ts`, `friends.ts` | `MangakaCardScreen`, `share/FriendSheet.tsx` |
| Gửi cả truyện qua Wi-Fi | `sendStory.ts` | `SendStoryScreen` |

Màn phòng (`RoomScreen`) cho chủ phòng chọn hoạt động. `RoomFollower` đưa mọi máy, kể cả chủ phòng, tới màn của hoạt động đang chạy. Khi đang chơi mà ai đó quay về màn phòng, thanh "Đang chơi: …" có nút Mở để vào lại.

## Cách các máy nói chuyện

- **Mạng hình sao.** Chủ phòng mở một TCP server (`react-native-tcp-socket`). Mọi tin nhắn của khách đều đi qua chủ phòng, và chủ phòng gắn `from` cho từng tin. Lời khách tự khai về mình không bao giờ được tin.
- **Tìm phòng.** Bonjour/NSD (`react-native-zeroconf`), dịch vụ `_manganova._tcp`. Địa chỉ IP lấy từ `@react-native-community/netinfo`.
- **Định dạng.** Mỗi dòng là một JSON `{m, from?, to?}`, được kiểm tra bằng zod trong `schema.ts`. Dữ liệu lớn (truyện, ảnh, tiếng) được chia thành `blob` 48 KB. Có ba đường dừng một blob: người nhận bỏ dở thì sau `BLOB_IDLE_TIMEOUT` blob tự hủy, người gửi gọi `cancel()`, hoặc mạng rớt thì blob báo lỗi chứ không im lặng mất.
- **Giữ kết nối.** Khách ping 3 giây một lần. Không thấy ping trong 10 giây thì coi là mất. Khách rớt mạng được giữ chỗ 8 giây (`REJOIN_GRACE`) để quay lại với đúng màu và vai cũ. Chỉ có thể nhận lại chỗ của một thành viên đang trong thời gian giữ chỗ, hoặc của chính máy đó (cùng địa chỉ IP).
- **Đồng hồ.** Mỗi lần pong, khách đo độ lệch giữa đồng hồ của mình và của chủ phòng (`clockOffset`). Nhờ vậy thi vẽ nhanh bắt đầu cùng lúc trên mọi máy.
- **Phiên bản.** Khi tin nhắn đổi cấu trúc thì tăng `PROTOCOL_VERSION`. Máy cũ khi đó được báo "cập nhật app" thay vì bị lỗi. Bản 2 thêm hai hoạt động mới.
- **Tin gửi từ trong lúc đang xử lý một tin khác.** Chủ phòng xử lý tin của chính mình trước, rồi mới chuyển tin đó cho các máy khác. Vì vậy một tin chủ phòng gửi ngay trong lúc đang xử lý (ví dụ kết thúc lượt ngay khi có người đoán đúng) sẽ tới máy khác **trước** tin gốc. Hãy gửi những tin này sau một microtask, như `soon()` trong `guessSession.ts` và `closeIfDone` trong `battleSession.ts`.

## Vào phòng

| Cách | Mang theo | Ghi chú |
| --- | --- | --- |
| Danh sách trên Wi-Fi | Tên phòng; mã bí mật chỉ có khi phòng mở | Mặc định phòng **chỉ vào bằng mã**: phòng vẫn hiện, có khóa, bấm vào thì nhập 4 ký tự cuối |
| Mã phòng 10 ký tự (Crockford base32) | 2 số cuối của IP, cổng, mã bí mật 16 bit | Hai số đầu của IP lấy từ máy đang vào phòng. 4 ký tự cuối chứa cả một phần số cổng, nên máy kiểm tra mã ngay tại chỗ trước khi kết nối |
| QR / link `manganova://join?h=&p=&k=&n=` | Đủ địa chỉ | Dùng được cả khi hai máy khác mạng con, ví dụ máy ảo Android |
| Danh thiếp `manganova://friend?d=` | Bạn bè, kèm phòng đang mở nếu có | Thêm bạn; nút "Vào phòng của họ" ẩn khi đã ở chung phòng |

Trong app có trình quét QR (`ScanCodeScreen`): nút "Quét mã QR" nằm ở thẻ vào phòng bằng mã và ở mục Bạn bè trong Danh thiếp. App nhận được cả mã phòng lẫn danh thiếp, và chọn được ảnh chụp mã QR khi máy không có camera, ví dụ Simulator.
- **Camera:** dùng VisionCamera v5. iOS dùng bộ đọc mã có sẵn của hệ thống (`useObjectOutput`). Android dùng plugin ML Kit `react-native-vision-camera-barcode-scanner`, plugin này chỉ được link cho Android (`react-native.config.js`), vì pod iOS của nó kéo theo cả ML Kit.
- **Ảnh:** Skia đọc ảnh ra pixel, rồi `jsQR` (thuần JS) đọc mã (`core/nearby/qrRead.ts`).
- **Quyền camera:** chỉ xin khi máy có camera, nên Simulator và máy không có camera không bị hỏi.

Chủ phòng đổi chế độ thì quảng bá cũ bị gỡ và một quảng bá mới được phát. `roomsFrom` gộp các dòng trùng địa chỉ và ưu tiên dòng có khóa. Vì vậy dù gói "tạm biệt" của mDNS bị mất, phòng vừa khóa cũng không còn vào được chỉ bằng một chạm.

## Đoán tranh

- **Ai biết từ khóa:** chỉ máy của người vẽ. Câu đoán được gửi riêng cho người vẽ (`to`). Máy người vẽ chấm, rồi báo cho cả phòng ai đã đoán đúng (`guess.hit`, không kèm chữ) hoặc ai đã đoán gì (`guess.miss`). Câu đoán sai một chữ được báo riêng cho người đoán (`guess.close`). Từ khóa chỉ lộ khi hết lượt.
- **Ai giữ đồng hồ:** chủ phòng mở lượt, mở bảng vẽ khi người vẽ đã chọn từ, kết thúc lượt khi hết giờ, khi mọi người đã đoán đúng hoặc khi người vẽ rời phòng, và công bố điểm cuối.
- **Cách tính điểm:** dựa vào thứ tự đoán đúng (100, 80, 60, rồi 50 cho những người sau). Người vẽ được 25 điểm cho mỗi người đoán đúng. Mọi máy tự tính ra cùng một kết quả.
- **Từ để vẽ:** 48 từ, nằm trong phần `guessWords` của các file ngôn ngữ. Một bản dịch có thể kèm cách viết khác sau dấu `|`, ví dụ `猫|ねこ|ネコ`. Cách viết đầu được hiển thị, cách nào cũng tính là đúng. Từ khóa tiếng Anh luôn được chấp nhận. Khi so sánh, app bỏ dấu, chữ hoa, khoảng trắng và chuyển katakana thành hiragana.
- **Nét vẽ:** gửi từng đoạn khoảng 70 ms một lần, tính theo đơn vị bảng 1000×1000.

## Cùng viết kịch bản

- **Thứ tự:** khách gửi mỗi thay đổi riêng cho chủ phòng. Chủ phòng phát lại cho cả phòng dưới dạng `script.apply`, kèm tên người viết. Mọi máy chỉ áp dụng các tin `apply`, theo cùng một thứ tự, nên không cần ghép bản. Khách không tự áp dụng thay đổi của mình trước: nếu làm vậy, khi hai người cùng giành một dòng, cả hai đều tưởng mình đã giữ được.
- **Giữ dòng:** chạm vào một dòng hoặc tiêu đề cảnh là giữ chỗ đó. Chỉ người đang giữ mới gõ được, người khác thấy tên họ và chữ hiện ngay khi họ gõ. Chỗ giữ được nhả khi chuyển sang dòng khác, rời màn hình hoặc rời phòng.
- **Lưu:** chủ phòng lưu vào chương của mình, và kịch bản cũ được giữ lại thành một phiên bản (`snapshotScript`). Mã của các dòng được giữ nguyên, nên bóng thoại đã gắn với dòng không bị mất liên kết. Người vào muộn được chủ phòng gửi bản hiện tại.

## Quyền

| Nền tảng | Quyền | Dùng cho |
| --- | --- | --- |
| iOS | `NSLocalNetworkUsageDescription`, `NSBonjourServices` | Tìm phòng và kết nối |
| iOS | `NSMicrophoneUsageDescription` | Lồng tiếng |
| Android | `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_LOCAL_NETWORK` | Tìm phòng và kết nối |
| Android | `RECORD_AUDIO` | Lồng tiếng |
| iOS | `NSCameraUsageDescription` | Quét mã QR trong app |
| Android | `CAMERA` (`uses-feature` không bắt buộc) | Quét mã QR trong app |

## Báo cáo câu trả lời AI

Đây là yêu cầu của Google Play cho app có nội dung do AI tạo. Mọi chỗ AI viết chữ đều có nút cờ (`features/aiReport/ReportButton.tsx`). Người dùng chọn lý do và ghi chú, báo cáo được lưu trên máy (`state/useAiReports.ts`). Câu trả lời đã báo cáo trong Trợ lý được thu gọn lại, và Hồ sơ có danh sách các báo cáo.

Khi `SUPPORT_EMAIL` trong `core/model/constants.ts` có giá trị, khung báo cáo hiện thêm lựa chọn gửi email cho nhà phát triển. Đường link mailto bị giới hạn theo độ dài sau khi mã hóa (`MAIL_URL_MAX`), vì chữ Nhật hay Thái sau khi mã hóa dài gấp 9 lần. **Phải điền email này trước khi phát hành.**

## Thử trên máy

- **Hai iOS Simulator trên cùng máy Mac** thấy nhau qua Bonjour như hai điện thoại thật.
- **Máy ảo Android** nằm sau NAT (10.0.2.x): không thấy danh sách phòng, và mã phòng 10 ký tự cũng không dùng được. Hãy vào phòng bằng link:
  `adb shell "am start -a android.intent.action.VIEW -d 'manganova://join?h=<IP máy Mac>&p=<cổng>&k=<mã>' com.manganova.manga.reader.org"`.
  Cổng và mã giải ra được từ mã phòng. Cách này đã thử với phòng do iPhone làm chủ, nét vẽ đồng bộ hai chiều.
- **Log JS:** RN 0.88 không in log ra Metro. Trên Android, đọc bằng `adb logcat | grep ReactNativeJS`.
- **Fast Refresh** có thể đưa màn hình về Home trong khi phòng vẫn chạy, và một server cũ có thể còn sống sau khi JS tải lại. Trước khi tin vào một lỗi "phòng đã đóng", hãy khởi động lại app.

## Giới hạn đã biết

- **Chủ phòng trên iOS không chạy ngầm được.** Chủ phòng chuyển sang app khác lâu hơn khoảng 10 giây thì khách mất kết nối, kèm thông báo rõ ràng.
- **Dữ liệu trong phòng không mã hóa.** Mã bí mật chỉ có 16 bit và chỉ dùng để chặn người vào nhầm, không chống được người cố tình nghe lén trên cùng mạng. Nếu cần bảo mật thật thì phải thêm TLS (thư viện có hỗ trợ) hoặc mã hóa bằng khóa trao đổi qua QR.
- **QR dùng scheme riêng** (`manganova://`). Một số app camera trên Android không mở được loại link này. Trình quét trong app khắc phục việc đó. Muốn app camera nào cũng mở được thì cần link `https://` kèm App Links.
- **Cùng viết kịch bản** giới hạn một chương khoảng 180.000 ký tự, để cả kịch bản vừa một tin nhắn.
- **Ghép tiếng thành video** cần native: iOS dùng AVFoundation, Android dùng `AudioJoiner.kt` (MediaMuxer).
