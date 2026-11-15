# Chơi cùng nhau trên cùng Wi-Fi

Tài liệu cho lập trình viên làm tiếp phần chơi nhiều người. Mọi thứ chạy trên máy, không có server: một máy mở phòng, các máy khác vào phòng qua mạng Wi-Fi chung.

Cập nhật: 2026-11-15, nhánh `develop`.

## 12 hoạt động

| Hoạt động | Logic (`src/core/nearby`) | Màn hình (`src/features/nearby`) |
| --- | --- | --- |
| Vẽ cùng nhau: một trang, mỗi người một layer mang tên mình, con trỏ có tên, thả cảm xúc | `codraw.ts`, `drawPayload.ts` | `CoDrawScreen`, `codraw/*` |
| Tiếp sức: mỗi người vẽ một khung, chỉ thấy khung ngay trước | `relay.ts`, `relaySession.ts` | `RelayScreen`, `relay/*` |
| Thi vẽ nhanh: cùng đề, bấm giờ, bình chọn (không tự bầu cho mình) | `battle.ts`, `battleSession.ts` | `BattleScreen`, `battle/*` |
| Đoán tranh: lần lượt vẽ một từ bí mật, người khác gõ câu đoán | `guess.ts`, `guessSession.ts` | `GuessScreen`, `guess/*` |
| Điền thoại: một người vẽ khung có bóng thoại trống, người khác bí mật viết lời, cả phòng bầu bản hài nhất | `fill.ts`, `fillSession.ts` | `FillScreen`, `fill/*` |
| Cùng viết kịch bản: cả phòng viết kịch bản một chương cùng lúc | `scriptTogether.ts`, `scriptSession.ts` | `ScriptTogetherScreen`, `script/*` |
| Đọc cùng nhau: chủ phòng lật trang, mọi người dán nhãn góp ý | `readTogether.ts`, `reviewNotes.ts` | `ReadTogetherScreen`, `share/TogetherReader.tsx` |
| Lồng tiếng: chia vai, mỗi người thu lời thoại của mình, ghép thành bản nghe | `dub.ts`, `dubClips.ts`, `dubRoom.ts`, `dubPlay.ts` | `DubScreen`, `dub/*` |
| Đổi thẻ nhân vật | `cardSwap.ts` | `CardSwapScreen` |
| Danh thiếp mangaka có QR, thêm bạn bè | `friendLink.ts`, `friends.ts` | `MangakaCardScreen`, `share/FriendSheet.tsx` |
| Gửi cả truyện qua Wi-Fi | `sendStory.ts` | `SendStoryScreen` |
| Chia sẻ bút: gửi một bộ bút và tông cho một người | `brushShare.ts` | `brushLibrary/ShareBrushesScreen` |

Màn phòng (`RoomScreen`) cho chủ phòng chọn hoạt động. `RoomFollower` đưa mọi máy, kể cả chủ phòng, tới màn của hoạt động đang chạy. Khi đang chơi mà ai đó quay về màn phòng, thanh "Đang chơi: …" có nút Mở để vào lại.

## Cách các máy nói chuyện

- **Mạng hình sao.** Chủ phòng mở một TCP server (`react-native-tcp-socket`). Mọi tin nhắn của khách đều đi qua chủ phòng, và chủ phòng gắn `from` cho từng tin. Lời khách tự khai về mình không bao giờ được tin.
- **Tìm phòng.** Bonjour/NSD (`react-native-zeroconf`), dịch vụ `_manganova._tcp`. Địa chỉ IP lấy từ `@react-native-community/netinfo`.
- **Định dạng.** Mỗi dòng là một JSON `{m, from?, to?}`, được kiểm tra bằng zod trong `schema.ts`. Dữ liệu lớn (truyện, ảnh, tiếng) được chia thành `blob` 48 KB. Có ba đường dừng một blob: người nhận bỏ dở thì sau `BLOB_IDLE_TIMEOUT` blob tự hủy, người gửi gọi `cancel()`, hoặc mạng rớt thì blob báo lỗi chứ không im lặng mất.
- **Giữ kết nối.** Khách ping 3 giây một lần. Không thấy ping trong 10 giây thì coi là mất. Khách rớt mạng được giữ chỗ 8 giây (`REJOIN_GRACE`) để quay lại với đúng màu và vai cũ. Chỉ có thể nhận lại chỗ của một thành viên đang trong thời gian giữ chỗ, hoặc của chính máy đó (cùng địa chỉ IP).
- **Đồng hồ.** Mỗi lần pong, khách đo độ lệch giữa đồng hồ của mình và của chủ phòng (`clockOffset`). Nhờ vậy thi vẽ nhanh bắt đầu cùng lúc trên mọi máy.
- **Phiên bản.** Khi tin nhắn đổi cấu trúc thì tăng `PROTOCOL_VERSION`. Máy cũ khi đó được báo "cập nhật app" thay vì bị lỗi. Bản 2 thêm hai hoạt động mới. Bản 3 thêm mã an toàn của máy và việc mời người ra khỏi phòng.
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
- **Xcode 26.1:** trình biên dịch Swift crash khi tối ưu VisionCamera ở bản Release. `ios/Podfile` đặt riêng pod này ở chế độ biên dịch từng file. Khi Xcode mới hơn build được thì bỏ đoạn này.

Chủ phòng đổi chế độ thì quảng bá cũ bị gỡ và một quảng bá mới được phát. `roomsFrom` gộp các dòng trùng địa chỉ và ưu tiên dòng có khóa. Vì vậy dù gói "tạm biệt" của mDNS bị mất, phòng vừa khóa cũng không còn vào được chỉ bằng một chạm.

## Đoán tranh

- **Ai biết từ khóa:** chỉ máy của người vẽ. Câu đoán được gửi riêng cho người vẽ (`to`). Máy người vẽ chấm, rồi báo cho cả phòng ai đã đoán đúng (`guess.hit`, không kèm chữ) hoặc ai đã đoán gì (`guess.miss`). Câu đoán sai một chữ được báo riêng cho người đoán (`guess.close`). Từ khóa chỉ lộ khi hết lượt.
- **Ai giữ đồng hồ:** chủ phòng mở lượt, mở bảng vẽ khi người vẽ đã chọn từ, kết thúc lượt khi hết giờ, khi mọi người đã đoán đúng hoặc khi người vẽ rời phòng, và công bố điểm cuối.
- **Cách tính điểm:** dựa vào thứ tự đoán đúng (100, 80, 60, rồi 50 cho những người sau). Người vẽ được 25 điểm cho mỗi người đoán đúng. Mọi máy tự tính ra cùng một kết quả.
- **Từ để vẽ:** 48 từ, nằm trong phần `guessWords` của các file ngôn ngữ. Một bản dịch có thể kèm cách viết khác sau dấu `|`, ví dụ `猫|ねこ|ネコ`. Cách viết đầu được hiển thị, cách nào cũng tính là đúng. Từ khóa tiếng Anh luôn được chấp nhận. Khi so sánh, app bỏ dấu, chữ hoa, khoảng trắng và chuyển katakana thành hiragana.
- **Nét vẽ:** gửi từng đoạn khoảng 70 ms một lần, tính theo đơn vị bảng 1000×1000.

## Điền thoại

Mỗi lượt một người làm **họa sĩ**: vẽ một khung không chữ trên bảng vuông của Đoán tranh, rồi đặt 1 đến 3 bóng thoại trống (lời nói, suy nghĩ, hét; vẽ bằng `render/drawBubble.ts` của phần lettering). Những người còn lại bí mật viết lời cho từng bóng. Các bản được chiếu lần lượt trên mọi máy, giấu tên người viết, rồi cả phòng bầu bản hài nhất (không tự bầu cho mình). Chủ phòng chọn số vòng, thời gian vẽ và thời gian viết.

- **Luồng tin nhắn.** Chủ phòng gửi `fill.start` rồi `fill.turn`. Họa sĩ gửi nét vẽ cho cả phòng (`fill.ink`, `fill.undo`, `fill.clear`, giống `guess.ink`), nhưng máy khác chỉ hiện khung khi họa sĩ gửi `fill.done` kèm các bóng thoại. Chủ phòng mở phần viết (`fill.write`). Người viết gửi lời **riêng cho chủ phòng** (`fill.lines`, có `to`), gửi lại được để sửa. Chủ phòng báo cho cả phòng ai đã viết (`fill.wrote`, không kèm chữ), rồi công bố mọi bản cùng lúc, đã xáo trộn và không kèm tên (`fill.reveal`). Sau đó chủ phòng mở bầu chọn (`fill.ballot`). Phiếu bầu gửi cho cả phòng (`fill.vote`). Cuối lượt, chủ phòng công bố tác giả và các phiếu hợp lệ (`fill.result`), hoặc bỏ qua lượt (`fill.skip`), và cuối ván gửi `fill.over`.
- **Ai biết bản nào của mình:** máy người viết tự tạo một mã ngẫu nhiên cho bản của mình (`mine`). Mã này đi kèm lời gửi cho chủ phòng và hiện lại trong `fill.reveal`. Nhờ vậy mỗi máy biết bản nào của mình mà không ai khác biết. Chủ phòng không nhận một mã đã thuộc về người khác.
- **Ai giữ đồng hồ:** chủ phòng. Khi hết giờ vẽ, máy họa sĩ tự gửi khung (thêm một bóng thoại nếu chưa đặt bóng nào). Nếu sau `DONE_GRACE_MS` khung vẫn chưa tới thì chủ phòng bỏ qua lượt. Khi hết giờ viết, máy người viết tự gửi phần đang gõ dở. Chủ phòng chờ thêm `LINES_GRACE_MS` rồi công bố. Mỗi bản hiện `SHOW_MS`, bầu chọn kéo dài tối đa `VOTE_MS`.
- **Không ai phải chờ người đã đi.** Phần viết kết thúc sớm khi mọi người viết còn trong phòng đã gửi. Bầu chọn kết thúc sớm khi mọi người còn trong phòng đã bầu. Họa sĩ rời phòng khi đang vẽ thì lượt bị bỏ qua. Họa sĩ rời phòng sau khi đã gửi khung thì lượt vẫn tiếp tục. Bản của người đã rời phòng vẫn được chiếu và vẫn được tính phiếu. Người vào giữa ván chỉ xem: chủ phòng bỏ qua lời và phiếu của họ.
- **Cách tính điểm:** mỗi phiếu được 100 điểm cho tác giả. Bản nhiều phiếu nhất được thêm 50 điểm, nếu hòa thì mọi bản hòa đều được. Họa sĩ được 25 điểm cho mỗi bản được viết trên khung của mình. Phiếu tự bầu cho mình, phiếu của người ngoài ván và phiếu cho bản không tồn tại đều không được tính. Danh sách tác giả và phiếu của chủ phòng là danh sách cuối cùng, nên mọi máy tính ra cùng một điểm.
- **Lưu lại:** ở màn kết quả, ai cũng lưu được bản đang xem (mặc định là bản thắng) thành một trang mới trong truyện "Điền thoại" (`fill/fillPage.ts`). Nét vẽ thành nét bút chì trên một layer mang tên họa sĩ, bóng thoại thành bóng thoại thật, nên trang vẫn vẽ và sửa chữ tiếp được.
- **Giới hạn:** tối đa 3 bóng thoại mỗi khung, 80 ký tự mỗi lời, 16 bản mỗi lượt. Nét vẽ dùng chung giới hạn với Đoán tranh: 2.000 số mỗi tin, 600 nét mỗi khung. Bóng thoại phải nằm trong bảng 1000×1000.
- **Hình minh họa:** thẻ hoạt động đang tạm dùng hình của Lồng tiếng (`NEARBY_ART.fill`). Cần vẽ một hình riêng.

## Cùng viết kịch bản

- **Thứ tự:** khách gửi mỗi thay đổi riêng cho chủ phòng. Chủ phòng phát lại cho cả phòng dưới dạng `script.apply`, kèm tên người viết. Mọi máy chỉ áp dụng các tin `apply`, theo cùng một thứ tự, nên không cần ghép bản. Khách không tự áp dụng thay đổi của mình trước: nếu làm vậy, khi hai người cùng giành một dòng, cả hai đều tưởng mình đã giữ được.
- **Giữ dòng:** chạm vào một dòng hoặc tiêu đề cảnh là giữ chỗ đó. Chỉ người đang giữ mới gõ được, người khác thấy tên họ và chữ hiện ngay khi họ gõ. Chỗ giữ được nhả khi chuyển sang dòng khác, rời màn hình hoặc rời phòng.
- **Lưu:** chủ phòng lưu vào chương của mình, và kịch bản cũ được giữ lại thành một phiên bản (`snapshotScript`). Mã của các dòng được giữ nguyên, nên bóng thoại đã gắn với dòng không bị mất liên kết. Người vào muộn được chủ phòng gửi bản hiện tại.

## Chia sẻ bút

Gửi một bộ bút và tông (tệp `.mnbrush`, xem [Canvas](07-canvas.md#kho-bút-và-tông)) cho một người trong phòng. Giống gửi truyện nhưng nhỏ hơn nhiều.

- **Luồng tin nhắn.** Người gửi gửi `brushes.offer` (tên bộ, số bút, số tông) riêng cho người nhận. Người nhận bấm Nhận thì gửi `brushes.accept`, bấm Để sau thì gửi `brushes.cancel` (`declined`). Có `accept` thì người gửi mới gửi blob `brushes` có `meta.offer`. Máy nhận kiểm tra tệp rồi gửi `brushes.done`, tệp hỏng thì gửi `brushes.cancel` (`failed`).
- **Không nhập gì ngay.** Tệp nhận được chờ ở thẻ "Xem và nhập". Người nhận tự chọn cái muốn giữ ở màn nhập.
- **Blob không ai nhận thì bỏ qua.** Blob `brushes` không khớp một lời mời đã nhận bị bỏ.
- **Giới hạn.** Schema chặn blob `brushes` quá 8 phần (`BRUSH_BLOB_CHUNKS_MAX`), tên bộ quá 40 ký tự và số bút, tông quá 60. Máy nhận đọc lại tệp bằng `parseBrushFile`.
- **Ai nhận được.** Chỉ máy đang mở màn Chia sẻ bút. Chủ phòng chọn hoạt động này cho cả phòng, hoặc bấm "Mở cho mọi người" khi tự mở từ một bộ. Khách tự mở thì thấy lời nhắc nhờ chủ phòng.
- **Hình minh họa:** thẻ hoạt động đang tạm dùng hình của Gửi truyện (`NEARBY_ART.brushes`). Cần vẽ một hình riêng.
- `PROTOCOL_VERSION` vẫn là 3 vì bản 3 chưa phát hành.

## Quyền

| Nền tảng | Quyền | Dùng cho |
| --- | --- | --- |
| iOS | `NSLocalNetworkUsageDescription`, `NSBonjourServices` | Tìm phòng và kết nối |
| iOS | `NSMicrophoneUsageDescription` | Lồng tiếng |
| Android | `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_LOCAL_NETWORK` | Tìm phòng và kết nối |
| Android | `RECORD_AUDIO` | Lồng tiếng |
| iOS | `NSCameraUsageDescription` | Quét mã QR trong app |
| Android | `CAMERA` (`uses-feature` không bắt buộc) | Quét mã QR trong app |

## Mời ra, chặn và báo cáo

Người dùng gửi tranh, chữ và tiếng cho nhau, nên app có đủ ba việc App Store (điều 1.2) và Google Play đòi hỏi với nội dung do người dùng tạo. Chạm vào tên một người trong danh sách phòng để mở bảng thao tác (`features/nearby/safety/MemberSheet.tsx`).

- **Mời ra khỏi phòng (chỉ chủ phòng).** Chủ phòng gửi `refused: removed` cho người đó rồi đóng kết nối. Mọi máy thấy người đó rời phòng. Người bị mời ra không vào lại được phòng này: chủ phòng giữ lại mã an toàn, mã thành viên và địa chỉ của họ.
- **Chặn.** Mỗi máy có một mã ngẫu nhiên (`Member.key`), tạo một lần và giữ mãi (`state/useNearbySafety.ts`). Danh sách chặn lưu trên máy theo mã này, không theo tên.
  - Chủ phòng từ chối ngay khi người bị chặn xin vào phòng. Nếu người đó đang ở trong phòng thì bị mời ra luôn.
  - Khách vừa vào phòng do người mình đã chặn làm chủ thì bị đưa ra ngay, kèm thông báo.
  - Khách ở cùng phòng với người mình đã chặn thì thấy thông báo, có nút rời phòng.
  - Bỏ chặn ở Hồ sơ → Người đã chặn và báo cáo.
- **Báo cáo.** Chọn lý do và ghi chú, có thể chặn luôn. Báo cáo lưu trên máy. Khi `SUPPORT_EMAIL` có giá trị thì gửi được cho nhà phát triển qua email.

Trên iOS, hộp xác nhận không mở được khi một bảng đang mở, nên bảng đóng trước rồi mới hỏi.

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
- **Đoán tranh và Điền thoại** không gửi lại nét vẽ cho người vào lại sau khi rớt mạng: nét vẽ trong lúc họ vắng sẽ không có trên máy họ. Người vào giữa ván chỉ xem từ ván sau.
- **Ghép tiếng thành video** cần native: iOS dùng AVFoundation, Android dùng `AudioJoiner.kt` (MediaMuxer).
