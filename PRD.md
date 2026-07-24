# PRD — FutureBoxes

Ứng dụng mobile đa nền tảng (React Native) cho phép người dùng gửi tin nhắn/kỷ niệm/mục tiêu cho chính mình trong tương lai thông qua các "hộp thời gian" (time capsule) bị khóa cho đến đúng ngày đã chọn.

- Phiên bản: 1.0 (MVP)
- Ngày: 2026-07-24
- Tác giả: agent-ba

---

## Mục lục
1. [Executive Summary](#1-executive-summary)
2. [Đối tượng người dùng & User Stories](#2-đối-tượng-người-dùng--user-stories)
3. [Khái niệm & Mô hình dữ liệu cốt lõi](#3-khái-niệm--mô-hình-dữ-liệu-cốt-lõi)
4. [Feature Table (MoSCoW & Dependencies)](#4-feature-table-moscow--dependencies)
5. [Acceptance Criteria](#5-acceptance-criteria)
6. [Non-functional Requirements](#6-non-functional-requirements)
7. [Assumptions & Constraints](#7-assumptions--constraints)
8. [Câu hỏi mở cần người dùng xác nhận](#8-câu-hỏi-mở-cần-người-dùng-xác-nhận)

---

## 1. Executive Summary

### Tầm nhìn
FutureBoxes giúp người dùng "trò chuyện với chính mình trong tương lai": ghi lại cảm xúc, mục tiêu, kỷ niệm hoặc quyết định của hiện tại, khóa lại, và chỉ được mở khi đến đúng thời điểm đã chọn. Trải nghiệm cốt lõi là cảm giác chờ đợi và bất ngờ khi mở hộp, cùng khoảnh khắc phản tư (reflection) so sánh kỳ vọng lúc gửi với thực tế lúc mở.

### Mục tiêu sản phẩm (MVP)
- Cho phép tạo, khóa và mở hộp thời gian một cách đáng tin cậy (không mở được trước hạn).
- Tạo khoảnh khắc cảm xúc khi mở hộp: đọc lại lời nhắn, trả lời câu hỏi phản tư (Yes/No), hiệu ứng chúc mừng.
- Hoạt động hoàn toàn offline, không cần tài khoản, bảo vệ quyền riêng tư (dữ liệu nằm trên thiết bị).

### Metrics đo thành công
| Metric | Mục tiêu |
|---|---|
| Tỉ lệ user tạo ≥1 hộp trong lần dùng đầu | ≥ 60% |
| Tỉ lệ hộp được mở khi đến hạn (trên tổng hộp tới hạn) | ≥ 70% |
| Tỉ lệ hộp có trả lời câu hỏi phản tư khi mở | ≥ 50% |
| Retention D7 (mở lại app trong 7 ngày) | ≥ 30% |
| Crash-free sessions | ≥ 99% |

### Phạm vi MVP
Cốt lõi là **một loại hộp thời gian thống nhất** với các **template dựng sẵn** (lời nhắn tự do, mục tiêu, kỷ niệm có ảnh, nhật ký quyết định). Các template chỉ khác nhau ở nội dung gợi ý và câu hỏi phản tư mặc định — cùng chung một cơ chế tạo/khóa/mở. Đây là quyết định thiết kế quan trọng để tránh làm phình 4 loại hộp riêng biệt.

---

## 2. Đối tượng người dùng & User Stories

**Người dùng chính:** cá nhân muốn ghi lại và phản tư về bản thân theo thời gian (học sinh/sinh viên, người đặt mục tiêu, người viết nhật ký). Một người = một thiết bị, gửi cho chính mình.

Các user story tiêu biểu (bám sát ideas.txt):
- US-1: Là người dùng, tôi ghi cảm xúc hôm nay ("Đang ôn thi ngập đầu...") và gửi cho chính mình 1 tuần sau, để sau này đọc lại và trả lời "Kết quả tốt chứ?".
- US-2: Là người dùng, tôi đặt mục tiêu giảm cân trong 1 tháng, và sau 1 tháng hộp mở ra hỏi "Đã giảm cân chưa?".
- US-3: Là người dùng, tôi lưu ảnh + ghi chú về một khoảnh khắc đáng nhớ và chọn thời điểm mở lại kèm lời nhắn.
- US-4: Là người dùng, khi đứng trước quyết định quan trọng (vd chuyển việc), tôi ghi lại lý do và sau 1 tháng/1 năm mở ra đánh giá quyết định đúng/sai.
- US-5: Là người dùng, tôi muốn được thông báo khi một hộp đã đến ngày mở.

---

## 3. Khái niệm & Mô hình dữ liệu cốt lõi

**Time Capsule (Hộp thời gian)** — thực thể trung tâm:

| Thuộc tính | Mô tả |
|---|---|
| `title` | Tiêu đề ngắn (bắt buộc) |
| `message` | Nội dung lời nhắn cho tương lai (bắt buộc) |
| `photoUri` | Ảnh đính kèm (tùy chọn, 0..1 ở MVP) |
| `templateType` | `free` \| `goal` \| `memory` \| `decision` (mặc định `free`) |
| `reflectionQuestion` | Câu hỏi Yes/No khi mở (tùy chọn, template gợi ý sẵn) |
| `openDate` | Ngày/giờ được phép mở (bắt buộc, phải ở tương lai) |
| `createdAt` | Thời điểm tạo (immutable) |
| `status` | `locked` \| `ready` \| `opened` (dẫn xuất từ openDate + hành động mở) |
| `openedAt` | Thời điểm user thực sự mở (null nếu chưa mở) |
| `reflectionAnswer` | `yes` \| `no` \| null (chỉ set khi đã mở & có câu hỏi) |
| `notificationId` | Identifier của local notification đã lên lịch (để hủy khi xóa hộp, tùy chọn) |

Vòng đời trạng thái: `locked` → (đến `openDate`) `ready` → (user bấm mở) `opened`.

---

## 4. Feature Table (MoSCoW & Dependencies)

| # | Tính năng | Mô tả ngắn | MoSCoW | Phụ thuộc |
|---|---|---|---|---|
| F1 | Tạo hộp thời gian | Nhập tiêu đề, lời nhắn, chọn ngày mở; validate ngày ở tương lai | **Must** | F7 |
| F2 | Khóa & bảo vệ trước hạn | Sau khi tạo, nội dung immutable; không thể xem/mở nội dung trước `openDate` | **Must** | F1 |
| F3 | Danh sách hộp (Home) | Liệt kê hộp theo trạng thái, hiển thị đếm ngược tới ngày mở | **Must** | F1, F7 |
| F4 | Mở hộp khi tới hạn | Khi `status=ready`, cho phép mở, hiển thị lời nhắn + ngày đã gửi | **Must** | F2, F3 |
| F5 | Câu hỏi phản tư (Yes/No) + hiệu ứng | Khi mở, hỏi Yes/No; chọn Yes hiện hiệu ứng chúc mừng (confetti) | **Must** | F4 |
| F6 | Thông báo cục bộ khi hộp tới hạn | Local notification lên lịch tại `openDate` | **Must** | F1 |
| F7 | Lưu trữ cục bộ (offline) | Persist toàn bộ dữ liệu hộp + ảnh trên thiết bị | **Must** | — |
| F8 | Đính kèm ảnh | Chọn ảnh từ thư viện/chụp, lưu cùng hộp | **Should** | F1, F7 |
| F9 | Template hộp | 4 preset (free/goal/memory/decision) prefill gợi ý & câu hỏi phản tư | **Should** | F1 |
| F10 | Xóa hộp | Xóa hộp (kèm confirm); xóa cả ảnh & notification liên quan | **Should** | F3, F6, F7 |
| F11 | Xem lại hộp đã mở | Truy cập lại nội dung + câu trả lời phản tư của hộp đã mở | **Should** | F4 |
| F12 | Onboarding ngắn | 2–3 màn giới thiệu khái niệm khi mở app lần đầu | **Could** | — |
| F13 | Tài khoản & đồng bộ cloud | Đăng nhập, backup/sync đa thiết bị | **Could** | F7 |
| F14 | Tìm kiếm / lọc / nhãn | Lọc theo trạng thái/template, tìm theo tiêu đề | **Could** | F3 |
| F15 | Nhắc nhở mục tiêu giữa kỳ | Nhắc định kỳ trước ngày mở (vd giữa chặng mục tiêu) | **Could** | F6 |
| F16 | Chia sẻ hộp cho người khác / social | Gửi hộp tới người dùng khác, feed cộng đồng | **Won't** (MVP) | — |
| F17 | Đính kèm audio/video | Ghi âm/quay video làm nội dung hộp | **Won't** (MVP) | — |
| F18 | Mở sớm / hủy khóa | Cho phép mở trước hạn | **Won't** (MVP) | — |

Ghi chú phụ thuộc: F1 là gốc; F2→F4→F5 là chuỗi trải nghiệm mở hộp; F7 là nền tảng cho hầu hết tính năng lưu trữ; F6 độc lập tương đối nhưng gắn với vòng đời hộp (tạo/xóa).

---

## 5. Acceptance Criteria

### F1 — Tạo hộp thời gian
- Bắt buộc nhập `title` và `message`; nút "Khóa hộp" disabled nếu thiếu.
- `openDate` bắt buộc, phải **> thời điểm hiện tại**; chọn ngày quá khứ/hiện tại → báo lỗi, không cho lưu.
- Cho chọn ngày qua date picker; hỗ trợ mốc nhanh (1 tuần / 1 tháng / 1 năm).
- Sau khi bấm "Khóa hộp", hộp được tạo với `status=locked`, `createdAt=now`, và lên lịch notification (F6).
- Hủy giữa chừng không tạo hộp và không mất dữ liệu app khác.

### F2 — Khóa & bảo vệ trước hạn
- Khi `now < openDate`, UI **không** hiển thị `message`/`photo`; chỉ hiển thị metadata (tiêu đề, ngày mở, đếm ngược).
- Nội dung hộp là immutable sau khi tạo (không có chức năng sửa nội dung trong MVP).
- Không tồn tại đường dẫn UI nào mở được nội dung khi `now < openDate`.

### F3 — Danh sách hộp (Home)
- Hiển thị tất cả hộp, phân nhóm/ghi rõ trạng thái: Đang khóa / Sẵn sàng mở / Đã mở.
- Mỗi hộp khóa hiển thị đếm ngược (vd "còn 5 ngày") cập nhật đúng theo thời gian thực khi vào màn.
- Hộp đạt `openDate` chuyển sang "Sẵn sàng mở" mà không cần khởi động lại app (đánh giá lại trạng thái khi màn hình focus).
- Trạng thái rỗng (chưa có hộp) hiển thị hướng dẫn tạo hộp đầu tiên.

### F4 — Mở hộp khi tới hạn
- Chỉ hộp `status=ready` mới bấm mở được; hộp `locked` không có hành động mở.
- Khi mở: hiển thị `message`, `photo` (nếu có), `createdAt` ("Bạn đã gửi vào ngày ...").
- Sau khi mở lần đầu, `status=opened`, `openedAt=now` được lưu.

### F5 — Câu hỏi phản tư (Yes/No) + hiệu ứng
- Nếu hộp có `reflectionQuestion`, sau khi hiển thị nội dung sẽ hiện câu hỏi với 2 lựa chọn Yes/No.
- Chọn **Yes** → hiệu ứng chúc mừng (confetti/animation) + lưu `reflectionAnswer=yes`.
- Chọn **No** → phản hồi động viên nhẹ nhàng + lưu `reflectionAnswer=no`.
- Câu trả lời lưu 1 lần; xem lại (F11) hiển thị lại câu trả lời đã chọn.
- Hộp không có câu hỏi phản tư thì bỏ qua bước này.

### F6 — Thông báo cục bộ khi tới hạn
- Khi tạo hộp, lên lịch local notification tại `openDate`.
- Nội dung notification không lộ nội dung hộp (chỉ "Một hộp thời gian đã sẵn sàng để mở").
- Chạm notification mở app vào màn danh sách/hộp tương ứng.
- Xóa hộp (F10) → hủy notification đã lên lịch.
- Nếu chưa cấp quyền notification, app vẫn hoạt động; trạng thái "ready" vẫn được nhận diện trong app (không phụ thuộc notification).

### F7 — Lưu trữ cục bộ
- Dữ liệu hộp và ảnh persist qua các lần đóng/mở app và khởi động lại thiết bị.
- Không gửi dữ liệu ra ngoài thiết bị (không backend ở MVP).
- Đọc danh sách hộp phổ biến hoàn tất < 300ms với ≤ 500 hộp.

### F8 — Đính kèm ảnh
- Cho chọn 1 ảnh từ thư viện hoặc chụp mới; xin quyền phù hợp.
- Ảnh lưu trong vùng lưu trữ app; hiển thị lại đúng khi mở hộp.
- Hủy chọn ảnh vẫn tạo được hộp (ảnh là tùy chọn).

### F9 — Template hộp
- Khi tạo, người dùng chọn 1 trong 4 template; template prefill placeholder/gợi ý nội dung và `reflectionQuestion` mặc định (vd goal → "Bạn đã đạt mục tiêu chưa?").
- Người dùng có thể chỉnh sửa nội dung/câu hỏi mà template gợi ý trước khi khóa.

### F10 — Xóa hộp
- Xóa yêu cầu xác nhận.
- Xóa gỡ bản ghi hộp, ảnh liên quan và hủy notification đã lên lịch.

### F11 — Xem lại hộp đã mở
- Hộp `opened` truy cập lại được nội dung đầy đủ và câu trả lời phản tư.
- Không cho trả lời lại câu hỏi phản tư (giữ nguyên câu trả lời đầu tiên) ở MVP.

---

## 6. Non-functional Requirements

### Performance
- Cold start ≤ 3s trên thiết bị tầm trung.
- Chuyển màn & đếm ngược mượt (60fps mục tiêu), không giật khi có ≤ 500 hộp.
- Ảnh được nén/scale hợp lý để tránh phình bộ nhớ.

### Security & Privacy
- Dữ liệu local-only; không thu thập/gửi dữ liệu cá nhân ra server ở MVP.
- Chỉ xin quyền cần thiết (notification, thư viện ảnh/camera) đúng lúc dùng.
- Không có nội dung nhạy cảm nào lộ ra ở notification hay preview trước hạn.
- (Could) Tùy chọn khóa app bằng biometric/PIN khi thêm F13.

### Khuyến nghị công nghệ (đã tra tài liệu hiện hành qua Context7 — 2026-07)
Đây là khuyến nghị định hướng; phiên bản khóa cứng sẽ chốt ở giai đoạn Design.

| Nhu cầu | Thư viện đề xuất | Lý do / ghi chú tài liệu hiện hành |
|---|---|---|
| Nền tảng | **Expo (SDK 54/55)** trên React Native | Đa nền tảng iOS/Android một codebase; hệ sinh thái module (notifications, image-picker, file-system) đồng bộ, giảm rủi ro native. |
| Thông báo tới hạn (F6) | **expo-notifications** | Hỗ trợ trigger theo ngày cụ thể: `scheduleNotificationAsync({ trigger: { type: SchedulableTriggerInputTypes.DATE, date } })` — khớp chính xác với `openDate`. Trả về `identifier` → lưu vào `notificationId` để hủy bằng `cancelScheduledNotificationAsync(identifier)` khi xóa hộp (F10). Đây là local notification, không cần server. |
| Lưu metadata hộp (F7) | **react-native-mmkv** | Key-value đồng bộ, nhanh (~30x AsyncStorage), hỗ trợ mã hóa AES-128/256 (`storage.encrypt(...)`) cho quyền riêng tư. Lưu object bằng `JSON.stringify` (MMKV không lưu object trực tiếp). Lưu ý: MMKV tối ưu cho **giá trị nhỏ**; không dùng để nhét ảnh nhị phân (có `trim()`/`byteSize` để kiểm soát kích thước). |
| Lưu ảnh (F8) | **expo-file-system** cho file ảnh + **expo-image-picker** để chọn/chụp | Chuẩn Expo hiện hành: chọn ảnh bằng image-picker, copy vào thư mục app qua file-system, chỉ lưu **`photoUri` (đường dẫn)** trong MMKV — không nhồi binary vào key-value store. |
| (Nếu cần truy vấn/quan hệ phức tạp về sau) | SQLite (`expo-sqlite`) | Chỉ cân nhắc khi thêm tìm kiếm/lọc nâng cao (F14) hoặc số hộp rất lớn; MVP dùng MMKV là đủ. |

Nguyên tắc: **metadata hộp → MMKV (JSON, có thể mã hóa); ảnh → file system, chỉ lưu URI**. Tách rõ để không vi phạm giới hạn kích thước của key-value store.

### Scalability & Maintainability
- Kiến trúc tách lớp: UI (agent-uiux) và business/persistence (agent-react); logic vòng đời trạng thái tập trung một nơi (một hàm dẫn xuất `status` từ `openDate` + `openedAt`) để mọi màn dùng chung.
- Mô hình dữ liệu đủ tổng quát để thêm template mới mà không đổi schema.
- Lưu trữ cục bộ: MMKV cho metadata (mã hóa được), file system cho ảnh; cân nhắc SQLite nếu sau này cần truy vấn nâng cao — quyết định phiên bản cụ thể ở giai đoạn Design.
- Sẵn sàng mở rộng lên cloud sync (F13) mà không phá vỡ mô hình entity.

### Usability
- Luồng tạo hộp ≤ 4 bước, hoàn thành < 60s.
- Ngôn ngữ tiếng Việt, giọng điệu ấm áp, cá nhân.
- Trạng thái rỗng, lỗi quyền, lỗi validate đều có thông báo rõ ràng.

### Reliability
- Không cho mở hộp trước hạn trong mọi trường hợp (bất biến cốt lõi).
- Đổi thời gian hệ thống về quá khứ không được làm mất trạng thái `opened` đã lưu; trạng thái mở dựa trên `openedAt` đã ghi, không tính lại ngược.

---

## 7. Assumptions & Constraints

Các quyết định dưới đây được đưa ra để viết PRD MVP mạch lạc do không có kênh hỏi trực tiếp người dùng trong ngữ cảnh hiện tại. Cần người dùng xác nhận (xem mục 8).

- **A1 — Không tài khoản, offline-first:** MVP không đăng nhập, không backend; toàn bộ dữ liệu trên thiết bị. Tài khoản & cloud sync là Could (F13).
- **A2 — Một loại hộp thống nhất + template:** 4 "loại hộp" trong ideas.txt được gộp thành 1 entity + 4 template, không phải 4 luồng riêng.
- **A3 — Không mở sớm/không sửa nội dung sau khóa:** đây là bất biến làm nên giá trị sản phẩm (F18 = Won't). Cho phép **xóa** hộp (F10).
- **A4 — Notification cục bộ:** dùng local notification (expo-notifications, trigger `DATE` tại `openDate`), không cần push server. Lưu `notificationId` trả về để hủy khi xóa hộp. App vẫn nhận diện trạng thái ready độc lập với notification.
- **A5 — Câu hỏi phản tư dạng Yes/No** (đúng theo ideas.txt). Câu hỏi mở/nhiều lựa chọn là Could tương lai.
- **A6 — Không giới hạn số lượng hộp** ở MVP (chỉ ràng buộc bởi dung lượng thiết bị).
- **A7 — 1 ảnh/hộp** ở MVP; ảnh lưu dưới dạng file (expo-file-system) và chỉ lưu URI trong store, không lưu binary vào MMKV. Nhiều ảnh/audio/video là Won't (F17).
- **A8 — Đa nền tảng bằng React Native** (iOS + Android), theo yêu cầu dự án.
- **A9 — `openDate` tính theo local timezone của thiết bị**; không xử lý đổi múi giờ phức tạp ở MVP.

Ràng buộc kỹ thuật: nền tảng React Native; hạn chế thư viện native nặng; hiệu ứng chúc mừng (confetti) và date picker nên dùng thư viện RN phổ biến, quyết định phiên bản cụ thể ở giai đoạn Design.

---

## 8. Câu hỏi mở cần người dùng xác nhận

Những điểm sau ảnh hưởng scope, đề nghị người dùng xác nhận trước khi sang giai đoạn Design:

1. **Tài khoản/cloud (A1, F13):** MVP có cần đăng nhập & đồng bộ đa thiết bị không, hay offline-only là đủ? (Ảnh hưởng lớn tới kiến trúc & thời gian.)
2. **Cho phép xóa/sửa hộp (A3, F10):** Đồng ý cho **xóa** nhưng **không sửa** nội dung sau khi khóa? Có cần cho sửa `openDate` trước hạn không?
3. **Loại hộp must-have cho MVP (A2, F9):** Đủ 4 template ngay, hay MVP chỉ cần "lời nhắn tự do" + "mục tiêu Yes/No", còn memory/decision để sau?
4. **Notification (A4, F6):** Local notification khi tới hạn có phải Must không? (Đang đặt Must.)
5. **Ảnh (A7, F8):** Đính kèm ảnh là Must hay Should cho MVP? (Đang đặt Should.)
6. **Giới hạn & timezone (A6, A9):** Có cần giới hạn số hộp / xử lý đổi múi giờ không?
