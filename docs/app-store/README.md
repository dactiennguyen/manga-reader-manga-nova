# Đưa Manganova lên App Store

Thư mục này chứa mọi thứ cần đưa lên App Store Connect. Từng ô phải điền nằm ở [huong-dan-dien.html](huong-dan-dien.html): mở file bằng trình duyệt, mỗi ô có nút Copy. Bản Google Play nằm ở [../google-play](../google-play/README.md).

| Link | |
| --- | --- |
| Website (Marketing URL) | https://manganova.pages.dev |
| Hỗ trợ (Support URL) | https://manganova.pages.dev/support |
| Chính sách quyền riêng tư | https://manganova.pages.dev/privacy |
| Điều khoản sử dụng | https://manganova.pages.dev/terms |
| Email liên hệ | mangamarker@gmail.com |
| Bundle ID của app | `com.manganova.manga.reader.org` |
| Bundle ID của widget | `com.manganova.manga.reader.org.widget` |
| App Group | `group.com.manganova.manga.reader.org` |

## 1. Tài sản có sẵn

Yêu cầu ảnh tra ngày 16/11/2026 trên [trang Screenshot specifications của Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).

| Thứ | File | Kích thước | Yêu cầu của Apple |
| --- | --- | --- | --- |
| Icon app | `graphics/app-icon-1024.png` | 1024×1024 PNG, không alpha | Chỉ để tham khảo. App Store lấy icon từ trong build, không tải riêng |
| Ảnh iPhone 6.9" | `screenshots/iphone-6.9/*.png` | 9 ảnh 1320×2868 (01–07 như bộ Play, 08 lịch sáng tác, 09 bài tập vẽ) | Ô "iPhone with Dynamic Island (large display)": 1320×2868, 1290×2796 hoặc 1260×2736 dọc |
| Ảnh iPhone 6.3" | `screenshots/iphone-6.3/*.png` | 9 ảnh 1206×2622, cùng thứ tự | Ô "iPhone with Dynamic Island (medium display)": 1206×2622 hoặc 1179×2556 dọc. **Đây là ô Apple ghi là bắt buộc** |
| Ảnh iPad 13" | `screenshots/ipad-13/*.png` | 8 ảnh 2064×2752 (01–08, không có 09) | Ô "13-inch display": 2064×2752 hoặc 2048×2732 dọc. Bắt buộc vì app chạy trên iPad |
| Mô tả | `descriptions.txt` | Tên 22/30, phụ đề 27/30, quảng bá 167/170, từ khóa 95/100 byte, mô tả 3983/4000 | 30 / 30 / 170 / 100 byte / 4000 |
| Truyện mẫu | `android/app/src/main/assets/sample/lantern.manganova` | | Nằm sẵn trong app, mở từ Home để chụp lại ảnh |

Mỗi ô nhận từ 1 tới 10 ảnh, PNG hoặc JPEG, không có kênh alpha. Ảnh trong thư mục này đã bỏ alpha.

**Vì sao có hai bộ iPhone.** Từ năm 2025 nhiều hướng dẫn chỉ nói tới bộ 6.9". Trang của Apple hiện ghi: "At least one screenshot for iPhone with Dynamic Island (medium display)". Ô đó tự lấy ảnh thu nhỏ từ các ô lớn hơn nếu bạn bỏ trống, nhưng tải đủ cả hai bộ là chắc chắn nhất. Bộ 6.3" chụp thẳng từ simulator iPhone 17 Pro, không phải ảnh thu nhỏ.

Các ô nhỏ hơn (iPhone 6.5", 5.5", iPad 11", 12.9"…) Apple tự thu nhỏ từ ô lớn. Không cần tải.

## 2. Việc bắt buộc trước khi nộp

1. **Apple Developer Program.** 99 USD mỗi năm. Tài khoản cá nhân thì tên người bán trên App Store là họ tên thật của bạn. Muốn hiện tên công ty thì phải đăng ký tổ chức, cần số D-U-N-S.

2. **Chứng chỉ, App ID và profile.** Làm đúng thứ tự ở [14-ios.md](../14-ios.md#việc-của-bạn):
   - Tạo App Group `group.com.manganova.manga.reader.org`.
   - Tạo hai App ID: app và widget. Bật **App Groups** cho cả hai, chọn cùng group.
   - Tạo chứng chỉ **Apple Distribution**, xuất file `.p12`.
   - Tạo hai profile loại **App Store**: một cho app, một cho widget. Tạo **sau khi** bật App Groups.
   - Tạo API key của App Store Connect, quyền App Manager.
   - Đưa tất cả vào GitHub Secrets theo bảng ở [14-ios.md](../14-ios.md#github-secrets). Workflow `.github/workflows/build-ios.yml`, `mode: testflight`, cần đủ `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_TEAM_ID`, `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_WIDGET_PROFILE_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`.
   - Phần ký và đẩy lên TestFlight chưa chạy thật lần nào. Lần đầu có thể phải sửa.

3. **Trang hỗ trợ và email: xong.** Email `mangamarker@gmail.com`. Apple bắt buộc Support URL có cách liên hệ (điều 1.5), và app có nội dung người dùng gửi cho nhau phải công khai thông tin liên hệ (điều 1.2). Trang hỗ trợ https://manganova.pages.dev/support (`website/support.html`) và `SUPPORT_EMAIL` trong `src/core/model/constants.ts` đã có email. Còn hai việc:
   - Deploy lại website theo [13-website.md](../13-website.md), rồi mở thử link hỗ trợ. Link chết là bị từ chối ngay.
   - Build nộp lên phải làm từ code đã có `SUPPORT_EMAIL`, để nút báo cáo người chơi và câu trả lời AI gửi được email cho bạn.

4. **Trang chính sách và điều khoản cho iOS: xong.** Đã sửa cho cả iOS và có email. Deploy lại website cùng lúc với việc 3. Trước khi nộp, đọc lại một lượt để chắc không còn câu chỉ nói về Android: "Android settings", "Android share sheet", "Google Play may collect data", và hai quyền chỉ có trên Android (chạy khi khởi động, rung). Trang chủ `index.html` cũng nên có nút App Store khi app lên store.

5. **Mã hóa (Export Compliance).** `ios/Manganova/Info.plist` đã có `ITSAppUsesNonExemptEncryption = false`. App chỉ dùng HTTPS của hệ thống, nên được miễn. Với khóa này, App Store Connect không hỏi gì khi tải build lên. Nếu sau này thêm mã hóa riêng (ví dụ TLS cho Chơi cùng nhau) thì vẫn là mã hóa chuẩn, thường vẫn được miễn, nhưng phải đọc lại câu hỏi của Apple. Extension widget không cần khóa này.

6. **Không cần Sign in with Apple.** App không có tài khoản, không đăng nhập bằng Google hay Facebook. Điều 4.8 chỉ áp dụng khi có đăng nhập bằng bên thứ ba. Cũng không cần nút xóa tài khoản (điều 5.1.1(v)).

7. **Build bằng SDK iOS 26.** Từ 28/4/2026 Apple chỉ nhận build làm bằng Xcode 26 trở lên ([trang của Apple](https://developer.apple.com/news/upcoming-requirements/)). Máy đang dùng Xcode 26.1, workflow chạy `macos-26`. Không cần đổi.

8. **Số phiên bản.** `MARKETING_VERSION = 1.0.0`, `CURRENT_PROJECT_VERSION = 1`. Version trên App Store Connect phải là `1.0.0`. Mỗi lần tải build mới phải tăng `build_number`.

9. **Máy thật.** Chưa thử trên iPhone, iPad thật và Apple Pencil ([14-ios.md](../14-ios.md#chưa-làm)). Người duyệt có thể dùng iPad. Hãy cài bản TestFlight lên ít nhất một máy thật và vẽ thử trước khi nộp.

## 3. Các bước trên App Store Connect

Từng ô có ở [huong-dan-dien.html](huong-dan-dien.html). Thứ tự:

1. **Apps → + → New App.** Platform iOS, tên, ngôn ngữ chính English (U.S.), Bundle ID, SKU.
2. **App Information.** Phụ đề, nhóm, quyền nội dung, xếp hạng tuổi.
3. **Pricing and Availability.** Free, mọi quốc gia trừ China mainland (cần số ICP Filing). Bỏ chọn chạy trên Mac và Vision Pro cho tới khi thử.
4. **App Privacy.** Link chính sách, rồi khai "Data Not Collected".
5. **Tải build.** Chạy workflow `testflight`. Đợi build chuyển sang trạng thái sẵn sàng (thường 10 tới 30 phút).
6. **TestFlight.** Thử trên máy thật (mục 7).
7. **Trang phiên bản 1.0.0.** Ảnh, mô tả, từ khóa, link, bản quyền, chọn build, ghi chú cho người duyệt.
8. **Add for Review → Submit.** Chọn "Manually release this version" để tự bấm phát hành sau khi được duyệt.

Ở EU, Apple bắt khai **Digital Services Act**: bạn là "trader" (bán hàng như nghề) hay không. App miễn phí, làm cá nhân thường chọn không phải trader. Chọn trader thì địa chỉ, số điện thoại và email sẽ hiện công khai. Việc này bạn tự quyết.

## 4. Những gì Apple hay từ chối

- **2.3.3 Ảnh chụp.** Ảnh phải là app đang dùng, không chỉ là màn chào. Ảnh trong thư mục này là ảnh thật từ simulator, không khung máy, không chữ quảng cáo. Không dùng ảnh Android cho App Store: thanh trạng thái và phông khác nhau, người duyệt nhận ra.
- **2.1 App chưa xong.** App crash, nút không làm gì, chữ "debug" hay màn đỏ của React Native. Luôn nộp bản Release. Thử trên máy thật trước.
- **1.2 Nội dung do người dùng tạo: đã xử lý.** Chơi cùng nhau cho người dùng gửi tranh, chữ, tiếng thu âm cho nhau. Apple đòi: đồng ý điều khoản trước, báo cáo, chặn, thông tin liên hệ và lọc nội dung. App có đủ, cộng thêm việc mời ra khỏi phòng (chi tiết ở [18-choi-cung-nhau.md](../18-choi-cung-nhau.md#quy-tắc-chơi)):
  - Điều khoản: lần đầu mở Chơi cùng nhau (kể cả khi vào bằng QR hay link) phải bấm **I agree** với quy tắc "không khoan nhượng" (không thù ghét, tình dục, quấy rối, đe dọa; ai cũng chặn và báo cáo được; chủ phòng mời ra được; báo cáo được xem trong 24 giờ; link điều khoản). Chưa đồng ý thì không mở hay vào phòng được. Xem lại ở Profile → **Play together rules**.
  - Báo cáo: chạm tên một người trong danh sách phòng → **Report**, chọn lý do và ghi chú (`features/nearby/safety/MemberSheet.tsx`).
  - Chặn: cùng bảng đó → **Block**. Người bị chặn bị từ chối khi vào phòng. Bỏ chặn ở Profile → **Blocked and reported people**.
  - Mời ra: chủ phòng chọn **Remove from room**. Người đó không vào lại được phòng.
  - Thông tin liên hệ: email trên trang hỗ trợ và trong app (`SUPPORT_EMAIL`).
  - Lọc nội dung: chữ người khác gõ (tên, câu đoán, Điền thoại, Cùng viết kịch bản, nhãn góp ý, thẻ, danh thiếp, truyện nhận qua Wi-Fi) được lọc từ xúc phạm thành `•••` ngay trên máy nhận (`core/nearby/textFilter.ts`). Tranh và tiếng dựa vào chặn, báo cáo và mời ra. Nếu người duyệt hỏi, trả lời: chữ được lọc tự động, mọi nội dung chỉ đi giữa những người trong một phòng riêng trên cùng Wi-Fi, ai cũng chặn và báo cáo được, chủ phòng mời ra được, và báo cáo tới email nhà phát triển.
  - Báo cáo phải được trả lời kịp thời. Hãy kiểm tra hộp thư thường xuyên.
- **4.2 Tính năng tối thiểu.** App này nhiều tính năng, không lo. Chỉ cần người duyệt thấy ngay: ghi chú hướng dẫn mở truyện mẫu.
- **5.1.1 Quyền riêng tư.** Lời xin quyền phải nói rõ dùng để làm gì. `Info.plist` đã có lời cho Camera, Microphone, Local Network, và bản dịch 9 ngôn ngữ. Ảnh dùng trình chọn ảnh của hệ thống nên không xin quyền Ảnh. App không xin quyền lúc mở. Mỗi quyền chỉ hỏi khi dùng tính năng cần nó.
- **5.1.2(i) Gửi dữ liệu cho AI bên thứ ba: đã xử lý.** Từ cuối 2025 Apple đòi nói rõ và xin phép trước khi gửi dữ liệu cá nhân cho AI bên thứ ba. App không có server AI mặc định. Người dùng tự nhập server của họ, và trang chính sách đã giải thích. Profile → AI server giờ ghi rõ chữ nào được gửi (tên truyện và tóm tắt, hồ sơ nhân vật, ghi chú thế giới đánh dấu gửi AI, đoạn kịch bản liên quan, chữ người dùng gõ; không bao giờ gửi tranh, ảnh hay tiếng) và gửi tới đâu (tên server). Phải bật công tắc "Allow Manganova to send this text to {server}" thì mới lưu được. Sự đồng ý gắn với đúng địa chỉ đó: đổi địa chỉ thì phải đồng ý lại. Chưa đồng ý thì `boot.ts` không gửi yêu cầu nào, chỉ báo lỗi chỉ đường tới Profile. Câu trả lời mẫu (khi chưa có server) giữ nguyên.
- **2.3.1 Mô tả đúng sự thật.** Mô tả ghi AI chỉ hỗ trợ chữ và không bao giờ vẽ. Không ghi "Apple Pencil" khi chưa thử trên máy thật: mô tả hiện chỉ ghi "Stylus pressure".
- **Link chết.** Support URL, chính sách hay điều khoản không mở được thì bị từ chối ngay.

**Về tranh trong ảnh chụp:** truyện mẫu "Lantern Courier" dùng tranh do AI vẽ rồi đưa vào app dưới dạng layer ảnh, không phải vẽ bằng bút trong app. Giao diện trong ảnh là thật. Mô tả không nói tranh được vẽ bằng app. Nếu muốn ảnh quảng cáo phản ánh sát nhất, hãy thay bằng tranh thật của một họa sĩ khi có.

## 5. App Privacy (nhãn dinh dưỡng)

Apple tính là "collect" khi dữ liệu rời khỏi máy và **bạn hoặc đối tác của bạn** giữ được nó lâu hơn lúc xử lý yêu cầu. Manganova:

- Không có tài khoản, quảng cáo, analytics hay báo lỗi tự động. `PrivacyInfo.xcprivacy` khai `NSPrivacyCollectedDataTypes` rỗng và `NSPrivacyTracking = false`.
- Tranh, truyện, tiếng thu âm trong Chơi cùng nhau đi thẳng từ máy này sang máy kia, không qua server nào của bạn.
- Chữ gửi cho AI đi tới server do chính người dùng nhập. Bạn không chạy server đó và không phải đối tác của nó.
- Báo cáo chỉ tới bạn khi người dùng tự gửi email.

Đề xuất: **"No, we do not collect data from this app"**. Nhãn sẽ hiện "Data Not Collected". Đây là cách mình đọc định nghĩa của Apple, không phải kết luận của Apple. Nếu sau này thêm analytics, báo lỗi, đăng nhập hay server AI mặc định thì phải khai lại, và sửa cả `PrivacyInfo.xcprivacy` lẫn trang chính sách. Chi tiết ở [trang App privacy details của Apple](https://developer.apple.com/app-store/app-privacy-details/).

Email báo cáo do người dùng tự gửi bằng app Mail của họ, nên không tính là app thu thập.

## 6. Xếp hạng tuổi

Bảng câu hỏi mới của Apple (từ 2025) có các mức 4+, 9+, 13+, 16+, 18+. Định nghĩa tra ở [trang Age ratings của Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions). Đáp án đề xuất nằm ở bước "Age Rating" trong [huong-dan-dien.html](huong-dan-dien.html). Tóm tắt:

- Bạo lực, tình dục, ma túy, cờ bạc, kinh dị, y tế: **None** hoặc **No**. Truyện mẫu có mưa, bến cảng, không có bạo lực.
- **Messaging and Chat: Yes.** Người trong phòng gửi chữ, tranh, tiếng cho nhau.
- **User-Generated Content: No.** Apple định nghĩa là "broad distribution" nội dung người dùng tạo. Nội dung trong phòng chỉ tới vài người cùng Wi-Fi, không công khai. Muốn chắc ăn thì chọn Yes, xếp hạng không đổi nhiều.
- **Unrestricted Web Access: No.** App không có trình duyệt.
- **Parental Controls, Age Assurance: No.**
- Kết quả do hệ thống tính, không tự chọn được. Với các đáp án trên, mức thấp là chuyện bình thường. Ở Brazil, Messaging and Chat có thể nâng mức tuổi riêng cho nước đó. Trang chính sách ghi app không hướng tới trẻ dưới 13, nên **không** chọn Made for Kids.

## 7. TestFlight

1. Chạy workflow **Build iOS (manual)**, `mode: testflight`, `version_name: 1.0.0`, `build_number` tăng mỗi lần.
2. Mở App Store Connect → app → **TestFlight**. Đợi build hết "Processing".
3. Export Compliance: App Store Connect không hỏi, vì `ITSAppUsesNonExemptEncryption = false`. Nếu vẫn hỏi, xem bước 7 trong [huong-dan-dien.html](huong-dan-dien.html).
4. **Internal Testing:** tạo nhóm, thêm chính bạn (tối đa 100 người trong team). Không cần Apple duyệt.
5. Cài app **TestFlight** trên iPhone, iPad, nhận lời mời, cài Manganova.
6. Thử trước khi nộp: mở truyện mẫu, vẽ bằng ngón tay và bằng Apple Pencil, xuất PDF, thêm widget, bật nhắc vẽ, Chơi cùng nhau giữa hai máy (chặn, báo cáo, mời ra).
7. **External Testing** (người ngoài team, tối đa 10.000) cần Apple duyệt bản beta. Phần "Test Information" có sẵn ở [huong-dan-dien.html](huong-dan-dien.html).

## 8. Cách chụp lại bộ ảnh

Ảnh chụp từ **bản Release** cho simulator, nên JS nằm sẵn trong app: không có Metro, LogBox hay menu dev. Ngôn ngữ en-US, theme sáng, truyện mẫu "Lantern Courier" có sẵn trong app. Các script nằm trong thư mục scratchpad của phiên làm việc này, có thể mất. Phần dưới đủ để làm lại bằng tay.

**1. Build và chuẩn bị**

```sh
xcodebuild -workspace ios/Manganova.xcworkspace -scheme Manganova -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/dd-release -quiet build
APP=/tmp/dd-release/Build/Products/Release-iphonesimulator/Manganova.app

# idb để bấm vào app: idb_companion từ brew, client trong venv
python3.13 -m venv idbenv && idbenv/bin/pip install fb-idb
```

Dùng simulator **mới tinh**, để Home còn nút mở truyện mẫu và không lẫn dữ liệu cũ. Lần này đã tạo ba máy rồi xóa sau khi chụp:

| Bộ ảnh | Loại máy | Kích thước gốc |
| --- | --- | --- |
| `iphone-6.9` | iPhone 17 Pro Max | 1320×2868 |
| `iphone-6.3` | iPhone 17 Pro | 1206×2622 |
| `ipad-13` | iPad Pro 13-inch (M5) | 2064×2752 |

```sh
U=$(xcrun simctl create "Shots" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max com.apple.CoreSimulator.SimRuntime.iOS-26-1)
xcrun simctl boot $U && xcrun simctl bootstatus $U -b
xcrun simctl spawn $U defaults write -g AppleLanguages -array en-US
xcrun simctl spawn $U defaults write -g AppleLocale -string en_US
xcrun simctl shutdown $U && xcrun simctl boot $U && xcrun simctl bootstatus $U -b
xcrun simctl ui $U appearance light
xcrun simctl status_bar $U override --time 9:41 --batteryState discharging --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiBars 3 --dataNetwork wifi
xcrun simctl install $U $APP && xcrun simctl launch $U com.manganova.manga.reader.org
```

`--batteryState charged` vẽ thêm tia sét sạc pin, nên dùng `discharging` với mức 100.

**2. Chụp và bỏ alpha**

```sh
xcrun simctl io $U screenshot raw.png
magick raw.png -alpha off 01-home.png
magick identify 01-home.png        # phải đúng kích thước ở bảng trên
```

Tìm nút: `idb ui describe-all --udid $U --json` trả về nhãn và khung theo **point**. Bấm: `idb ui tap --udid $U X Y`, X và Y là số nguyên theo point. Vẽ một nét: `idb ui swipe --udid $U x1 y1 x2 y2 --duration 0.5 --delta 4`.

**3. Thứ tự chụp.** Phải chụp Home trước bước "Draw now", vì sau đó Home có thêm truyện "Untitled story".

1. Onboarding: Skip → "Both" → Next → Adventure, Mystery → Next → Seinen → Done.
2. Home → "Open the sample story" (cuộn xuống) → mở truyện → Go back. Cuộn Home lên đầu. Chụp **01-home**.
3. Library → Lantern Courier → Storyboard. Chụp **03-storyboard**.
4. Page 2 → tab Lettering → chạm bóng thoại "Hana! Your chain's loose!" (khoảng 81% ngang, 49% dọc của ảnh trang). Chụp **04-lettering**.
5. Tab Art → Previous page (trang 1) → chạm khung trên bên phải (khoảng 75% ngang, 24% dọc của trang) → Draw → chạm để tắt mẹo. Nút ghim (Reference boards) → Character reference → Hana Mori. Chụp **02-canvas**.
6. Menu ⋯ → Materials. Chụp **07-materials**. Kéo bảng xuống để đóng.
7. Done → Go back → nút mắt (Preview). Chụp **05-preview**. Chạm giữa màn hình → Close preview → về Home.
8. Home → "Draw now" → G-pen → Rulers → 2-point perspective. Đợi lời nhắc tắt (khoảng 4 giây). Vẽ một khối nhà bằng `idb ui swipe`: một cạnh đứng ở giữa, hai cạnh bên, 8 cặp đường ngang từ cạnh giữa ra hai bên theo hướng hai điểm tụ, rồi 4 đường đứng làm cửa sổ. Thước tự nắn nét. Chụp **06-rulers**.
9. Done → Profile → Creation calendar → Plan a chapter → Lantern Courier · Chapter 1 → 8 pages, In 2 weeks, Skip weekends → Start the plan → Go back. Chụp **08-calendar**.
10. Go back → Drawing lessons → Focus lines → Start practice. Đồ 12 tia theo nét đứt (tâm 450,600 trên trang 900×1200; bước 1 từ bán kính 400 vào 230, mỗi 30°; bước 2 lệch 15°, vào 260 hoặc 300) → Next step → Done. Chụp **09-lessons** (chỉ iPhone).

**Thanh trạng thái trên màn tối.** Bộ ảnh hiện có được chụp trước khi sửa lỗi bên dưới: khi chụp màn vẽ, màn luyện vẽ và bảng Materials trên iPhone đã phải đặt `xcrun simctl ui $U appearance dark` để chữ thành trắng. Từ bản có `UIViewControllerBasedStatusBarAppearance = false`, app tự đổi chữ thành trắng trên các màn tối, không cần mẹo này. Trên iPad, mép trên màn vẽ là nền trắng, nên ảnh 02 và 06 của iPad chụp ở `light`; với bản đã sửa, hãy xem lại chữ thanh trạng thái trên iPad (xem bên dưới).

Xem lại từng ảnh trước khi giữ: không có toast ("Plan saved"…), bàn phím, vòng xoay, chữ bị cắt.

**4. Dọn dẹp:** `xcrun simctl shutdown $U && xcrun simctl delete $U`.

### Lỗi thấy khi chụp (đã sửa)

- **Thanh trạng thái trên màn tối (iOS).** Nguyên nhân: `UIViewControllerBasedStatusBarAppearance = true`, nên native-stack của react-native-screens quyết định và component `StatusBar` không có tác dụng. Sửa: khóa đó thành `false` trong `Info.plist` (người khác làm cùng lúc), nên `StatusBar` trong `AppRoot.tsx` quyết định. Màn nào tối ở cả hai theme thì gọi `useDarkSystemBars()` (`state/useSystemBars.ts`) khi đang được focus: màn vẽ và mọi màn dựng trên nó (Vẽ cùng nhau, lượt vẽ của Tiếp sức, Thi vẽ nhanh), màn luyện vẽ. Theme tối thì chữ trắng ở mọi màn. Chưa thử trên máy: cần xem lại bằng bản build có `Info.plist` mới, nhất là màn vẽ trên iPad nếu trang giấy chạm mép trên.
- **Ngày tháng.** `formatDate` giờ dùng `Intl.DateTimeFormat` theo ngôn ngữ của app: tiếng Anh "Mon, 11/16/2026", tiếng Việt "Thứ 2, 16/11/2026". Nếu `Intl` lỗi thì dùng dạng dự phòng đúng thứ tự (tiếng Anh tháng trước). Ảnh `08-calendar` chụp trước khi sửa nên còn ngày dạng cũ ("16/11/2026"): nên chụp lại trước khi nộp.
- **Màn luyện vẽ.** Dải sáng ở đáy là `NavBarBacking` của `AppRoot` (nền sáng sau thanh điều hướng). Trên các màn tối (`useDarkSystemBars`) nó không còn được vẽ, nên cả màn tối tới mép.

