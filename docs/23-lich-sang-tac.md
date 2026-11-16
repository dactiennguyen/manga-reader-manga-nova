# Lịch sáng tác và hạn chót

Người dùng đặt hạn chót cho từng chương: cần xong bao nhiêu trang, trước ngày nào, vẽ vào những thứ nào trong tuần. App chia số trang còn lại thành kế hoạch từng ngày, tính lại khi trang được đánh dấu xong hoặc khi bỏ lỡ một ngày, và nhắc qua thông báo hằng ngày có sẵn, cộng một thông báo riêng vào ngày trước mỗi hạn chót.

## Màn hình

| Màn | Route | Nội dung |
| --- | --- | --- |
| Lịch sáng tác | `Calendar` | Xem theo tháng hoặc theo danh sách 30 ngày tới. Mỗi ngày có dấu: chấm cam là có trang dự kiến, chấm xanh là có vẽ, cờ là hạn chót (đỏ khi quá hạn). Chạm một ngày để xem chương nào dự kiến bao nhiêu trang, đã xong bao nhiêu, số nét đã vẽ. Bên dưới là danh sách kế hoạch các chương và banner cho chương quá hạn |
| Kế hoạch chương | `ChapterPlan { chapterId }` | Thẻ tình trạng (đúng tiến độ, chậm, vượt, quá hạn, xong), thanh tiến độ, trang của hôm nay, lời khuyên của Mori, 7 ngày làm việc tới. Form: số trang cần xong, hạn chót, ngày làm việc trong tuần. Có nút bỏ kế hoạch |
| Tổng kết tuần | `WeekSummary { week? }` | Một tuần từ thứ Hai: trang xong so với dự kiến, số ngày có vẽ, số nét, biểu đồ nét theo ngày, các hạn chót gần nhất, một câu của Mori. Lùi được 16 tuần |

Lối vào:

- Tab Chapters của Project: mỗi chương có nút "Deadline" và một dòng tóm tắt kế hoạch.
- Home: thẻ "Today's plan" khi có kế hoạch chưa xong, và thẻ "Your week in review" một lần mỗi tuần.
- Profile, nhóm Studio: mục "Creation calendar".

Chọn ngày dùng lưới tháng tự vẽ trong `Sheet` (`DatePickerSheet`). Không thêm thư viện chọn ngày native.

## Cách chia trang

Logic nằm ở `src/core/planner/`, không phụ thuộc React.

- Số trang còn lại chia đều cho các ngày làm việc từ hôm nay tới hạn chót. Khi chia không hết, các ngày đầu nhận thêm một trang. Ví dụ 10 trang trong 4 ngày là 3, 3, 2, 2.
- Mục tiêu của hôm nay tính theo số trang lúc đầu ngày. Xong một trang hôm nay thì mục tiêu không đổi, chỉ phần "còn lại" giảm. Làm vượt thì các ngày sau nhẹ đi.
- Bỏ lỡ một ngày thì số trang dồn sang các ngày còn lại.
- Không còn ngày làm việc nào trước hạn chót thì kế hoạch dùng cả ngày nghỉ, và báo cho người dùng.
- Tình trạng so với nhịp đặt ra lúc lưu kế hoạch: chậm khi số trang đã xong chưa tới mức của hết hôm qua, vượt khi đã quá mức của hết hôm nay. Sửa kế hoạch thì nhịp tính lại từ hôm đó.
- Qua hạn chót mà còn trang là quá hạn. Hết trang là xong, kể cả khi đã qua hạn.

Mọi phép tính ngày dùng khóa ngày (`2026-11-15`). Khóa ngày được tính bằng số học UTC trên chính các con số của nó, nên đổi giờ mùa hè không làm lệch ngày. Chỉ `dayKey(now)` đọc đồng hồ máy. Tuần bắt đầu từ thứ Hai, vì app chưa có cài đặt ngày đầu tuần.

## Dữ liệu

Lưu ở bảng `meta`, khóa `planner`, một bản JSON (`src/core/planner/data.ts`). Không cần migration.

| Trường | Ý nghĩa |
| --- | --- |
| `plans` | Kế hoạch theo id chương: số trang, hạn chót, ngày làm việc, ngày bắt đầu nhịp và số trang đã xong trước ngày đó |
| `doneLog` | Id trang → ngày được đánh dấu xong. Trang đã xong trước khi app biết (lần đầu chạy, nhập truyện, nhân bản) có ngày rỗng, nên không tính là việc của hôm nay |
| `planned` | Ngày → id chương → số trang dự kiến của ngày đó. Ngày đã qua không tính lại được, nên phải ghi. Giữ 120 ngày |
| `summarySeen` | Thứ Hai của tuần mà thẻ tổng kết đã được mở hoặc cất |

- `usePlanner` (`src/state/usePlanner.ts`) theo dõi `useStory`. Trang nào chuyển sang xong thì ghi ngày hôm nay.
- Xóa chương hoặc truyện: kế hoạch bị ẩn ngay, vì chương không còn sống. Lần mở app sau, `prunePlanner` xóa hẳn. Không xóa ngay trong phiên vì người dùng còn hoàn tác được việc xóa chương.
- Kế hoạch không đi theo file `.manganova`. Hạn chót là của người làm, không phải của truyện, và truyện nhập vào có id mới.

## Nhắc nhở

Hai loại thông báo, cùng bật tắt bằng công tắc nhắc vẽ ở Profile và cùng giờ nhắc (`syncReminder` trong `src/features/profile/reminder.ts`).

Thông báo hằng ngày:

- Có kế hoạch thì nội dung thông báo nói về ngày thông báo sẽ hiện: hôm nay nếu chưa tới giờ nhắc, ngày mai nếu đã qua.
- Hạn chót rơi vào ngày đó hoặc ngày hôm sau: "Chapter 3 is due 11/20/2026. 4 pages to go." Ghi rõ ngày (theo thứ tự của ngôn ngữ app, `formatDate` dùng `Intl`), để câu vẫn đúng nếu thông báo lặp lại mà người dùng chưa mở app.
- Không thì số trang của ngày đó: "Today: 2 pages of Chapter 3." Nhiều chương thì cộng lại.
- Không có kế hoạch, hoặc hôm nay đã xong phần của mình, thì giữ câu nhắc giữ chuỗi như cũ.

Thông báo một lần trước hạn chót:

- Mỗi kế hoạch còn trang và chưa quá hạn có một thông báo vào giờ nhắc của ngày trước hạn chót: "Chapter 3 is due tomorrow. 4 pages to go." Thông báo này đã hẹn sẵn, nên vẫn hiện dù người dùng không mở app nhiều ngày, khi câu của thông báo hằng ngày đã cũ.
- Bỏ qua khi thời điểm đó đã qua, kế hoạch đã xong, hoặc chương đó đã được thông báo hằng ngày nhắc tên vào đúng ngày đó (`dueNear`), để không nói hai lần.
- Chỉ giữ 20 thông báo gần nhất (`MAX_DEADLINE_REMINDERS`), vì iOS chỉ giữ 64 thông báo đang chờ.
- Logic thuần là `deadlineReminders` trong `src/core/planner/words.ts`.

Hẹn lại:

- Cả hai được hẹn lại khi mở app, đổi ngôn ngữ, sửa kế hoạch và khi app vào nền. Chữ và giờ giống lần trước thì không hẹn lại.
- Thông báo một lần luôn được thay **cả bộ** (`replaceOnce` trong `specs/NativeReminder.ts`), vì kế hoạch đổi, xong hay bị bỏ bất cứ lúc nào. Tắt nhắc vẽ thì hủy cả thông báo hằng ngày lẫn mọi thông báo một lần.
- `replaceOnce` không hỏi quyền. Nó chỉ chạy sau khi thông báo hằng ngày được hẹn thành công, tức là quyền đã có.

| Nền tảng | Thông báo một lần |
| --- | --- |
| iOS | `UNCalendarNotificationTrigger` không lặp, theo ngày giờ địa phương. Id có tiền tố `once-reminder:`, nên thay bộ một lần không đụng tới thông báo hằng ngày |
| Android | Mỗi thông báo một `AlarmManager.setWindow` cửa sổ 30 phút như thông báo hằng ngày, nên không cần quyền báo thức chính xác. Danh sách lưu trong SharedPreferences `reminder`, khóa `once`. `ReminderReceiver` đăng ký lại sau khi máy khởi động và bỏ những cái đã qua giờ lúc máy tắt, vì "ngày mai" có thể không còn đúng |

## Kiểm thử

- `__tests__/planner.test.ts`: chia trang, bỏ qua cuối tuần, bỏ lỡ ngày, chậm và vượt, hạn chót đã qua, hết trang, ngày hạn chót, dùng ngày nghỉ, ranh giới tuần, lịch và tổng kết tuần, câu nhắc, thông báo một lần trước hạn chót.
- `__tests__/plannerStore.test.ts`: ghi ngày xong trang, lưu và bỏ kế hoạch, dọn kế hoạch của chương đã xóa.
- `__tests__/plannerDst.test.ts`: chạy lại các phép tính ngày trong một tiến trình Jest con với múi giờ New York, Berlin và Sydney, quanh mỗi lần đổi giờ năm 2026. Jest chép `process.env` cho từng file, nên đặt `TZ` trong file test không có tác dụng.
