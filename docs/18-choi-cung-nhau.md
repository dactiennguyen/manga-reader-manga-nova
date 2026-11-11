# Chơi cùng nhau trên cùng Wi-Fi

Tài liệu cho lập trình viên làm tiếp phần chơi nhiều người. Mọi thứ chạy trên máy, không có server: một máy mở phòng, các máy khác vào phòng qua mạng Wi-Fi chung.

Cập nhật: 2026-11-11, nhánh `develop`.

## 8 hoạt động

| Hoạt động | Logic (`src/core/nearby`) | Màn hình (`src/features/nearby`) |
| --- | --- | --- |
| Vẽ cùng nhau: một trang, mỗi người một layer mang tên mình, con trỏ có tên, thả cảm xúc | `codraw.ts`, `drawPayload.ts` | `CoDrawScreen`, `codraw/*` |
| Tiếp sức: mỗi người vẽ một khung, chỉ thấy khung ngay trước | `relay.ts`, `relaySession.ts` | `RelayScreen`, `relay/*` |
| Thi vẽ nhanh: cùng đề, bấm giờ, bình chọn (không tự bầu cho mình) | `battle.ts`, `battleSession.ts` | `BattleScreen`, `battle/*` |
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
- **Phiên bản.** Khi tin nhắn đổi cấu trúc thì tăng `PROTOCOL_VERSION`. Máy cũ khi đó được báo "cập nhật app" thay vì bị lỗi.

## Vào phòng

| Cách | Mang theo | Ghi chú |
| --- | --- | --- |
| Danh sách trên Wi-Fi | Tên phòng; mã bí mật chỉ có khi phòng mở | Mặc định phòng **chỉ vào bằng mã**: phòng vẫn hiện, có khóa, bấm vào thì nhập 4 ký tự cuối |
| Mã phòng 10 ký tự (Crockford base32) | 2 số cuối của IP, cổng, mã bí mật 16 bit | Hai số đầu của IP lấy từ máy đang vào phòng. 4 ký tự cuối chứa cả một phần số cổng, nên máy kiểm tra mã ngay tại chỗ trước khi kết nối |
| QR / link `manganova://join?h=&p=&k=&n=` | Đủ địa chỉ | Dùng được cả khi hai máy khác mạng con, ví dụ máy ảo Android |
| Danh thiếp `manganova://friend?d=` | Bạn bè, kèm phòng đang mở nếu có | Thêm bạn; nút "Vào phòng của họ" ẩn khi đã ở chung phòng |

Chủ phòng đổi chế độ thì quảng bá cũ bị gỡ và một quảng bá mới được phát. `roomsFrom` gộp các dòng trùng địa chỉ và ưu tiên dòng có khóa. Vì vậy dù gói "tạm biệt" của mDNS bị mất, phòng vừa khóa cũng không còn vào được chỉ bằng một chạm.

## Quyền

| Nền tảng | Quyền | Dùng cho |
| --- | --- | --- |
| iOS | `NSLocalNetworkUsageDescription`, `NSBonjourServices` | Tìm phòng và kết nối |
| iOS | `NSMicrophoneUsageDescription` | Lồng tiếng |
| Android | `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_LOCAL_NETWORK` | Tìm phòng và kết nối |
| Android | `RECORD_AUDIO` | Lồng tiếng |

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
- **QR dùng scheme riêng** (`manganova://`). Một số app camera trên Android không mở được loại link này. Muốn chắc chắn thì cần trình quét QR trong app, hoặc link `https://` kèm App Links.
- **Ghép tiếng thành video** cần native: iOS dùng AVFoundation, Android dùng `AudioJoiner.kt` (MediaMuxer).
