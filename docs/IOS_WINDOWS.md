# Cài openGym lên iPhone từ Windows bằng Apple ID miễn phí

Quy trình: GitHub Actions build trên máy Mac của GitHub → tải file `.ipa` chưa ký →
AltStore ký và cài bằng Apple ID của bạn. Bạn không cần sở hữu máy Mac hay mua Apple
Developer Program. Xcode vẫn được dùng trên máy chủ GitHub.

Workflow nằm ở [ios-sideload.yml](../.github/workflows/ios-sideload.yml), chỉ chạy khi
bấm **Run workflow**. GitHub không cần Apple ID, mật khẩu hay chứng chỉ của bạn.

## Cần chuẩn bị

- Tài khoản GitHub và một repo/fork openGym của riêng bạn chứa các thay đổi này.
- iPhone chạy iOS 16.4 trở lên, Apple ID và cáp kết nối với máy Windows. Project native
  đặt mức tối thiểu 15.5, nhưng bản build web hiện nhắm tới WebView từ iOS 16.4.
- AltServer cho Windows, iTunes và iCloud theo
  [hướng dẫn chính thức của AltStore](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows).

Máy chạy GitHub Actions tiêu chuẩn được miễn phí thời gian chạy với repo công khai.
Repo riêng tư dùng hạn mức của tài khoản; vượt hạn mức có thể phát sinh phí nếu đã bật
thanh toán. Artifact cũng có hạn mức lưu trữ riêng; workflow giữ file trong 7 ngày.
Xem [chính sách GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## 1. Tạo file IPA trên GitHub

1. Đưa mã nguồn đã chỉnh sửa lên repo của bạn. Để có tiếng Việt, cần bao gồm cả
   `frontend/src/locales/vi.js` và thay đổi trong `frontend/src/lib/i18n-core.js`.
   Fork nguyên bản của tác giả sẽ chưa có các thay đổi trên máy Windows này.
2. Đảm bảo file `.github/workflows/ios-sideload.yml` và shared scheme
   `frontend/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` có trong repo.
   File workflow phải có trên nhánh mặc định để nút chạy thủ công xuất hiện.
3. Mở tab **Actions**. Nếu đây là fork mới, bật Actions khi GitHub yêu cầu.
4. Chọn **Build iOS for AltStore → Run workflow**, chọn nhánh chứa mã cần build.
5. Khi job thành công, mở phần **Artifacts**, tải `openGym-ios-unsigned-<số lần chạy>`.
6. Giải nén file ZIP tải về để lấy `openGym-<phiên bản>-unsigned.ipa` và file `.sha256`.
   Chuyển file `.ipa` vào ứng dụng **Tệp / Files** trên iPhone, ví dụ qua iCloud Drive.

File IPA chưa ký không cài trực tiếp bằng cách chạm vào nó trong Safari hoặc Files.
Bước tiếp theo dùng AltStore để ký và cài.

Nếu build lỗi, tải artifact `openGym-ios-build-logs-<số lần chạy>` để xem log Xcode và
`Podfile.lock` nếu có. Phần biên dịch iOS chỉ được xác nhận sau khi job macOS chạy thành công;
build web thành công trên Windows chưa xác nhận được phần native.

## 2. Cài AltStore từ Windows

Thực hiện theo [hướng dẫn AltStore cho Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows):

1. Cài iTunes và iCloud từ nguồn mà hướng dẫn AltStore chỉ định, rồi cài AltServer.
2. Kết nối iPhone bằng cáp, mở khóa máy và chọn **Tin cậy / Trust** khi được hỏi.
3. Bật đồng bộ qua Wi-Fi trong iTunes.
4. Mở AltServer ở khay hệ thống Windows, chọn **Install AltStore → iPhone của bạn**.
5. Đăng nhập Apple ID trong AltServer để ký bản cài. Thông tin Apple ID chỉ nhập ở công
   cụ cài trên máy; không đưa vào repo hoặc GitHub Actions.
6. Trên iPhone, xác nhận tin cậy nhà phát triển tại **Cài đặt → Cài đặt chung → VPN &
   Quản lý thiết bị**; tên mục có thể khác theo phiên bản iOS.
7. Với iOS 16 trở lên, bật **Cài đặt → Quyền riêng tư & Bảo mật → Chế độ nhà phát triển**
   và hoàn tất bước khởi động lại/xác nhận trên máy.

## 3. Cài và dùng openGym

1. Giữ AltServer đang chạy, để iPhone kết nối máy tính bằng cáp hoặc cùng mạng Wi-Fi.
2. Mở **AltStore → My Apps → +**, chọn file `openGym-<phiên bản>-unsigned.ipa` trong Files.
3. Chờ AltStore ký và cài, rồi mở **openGym** từ Màn hình chính.
4. Chọn chế độ dùng trên thiết bị nếu chưa cần máy chủ. Lịch tập và dữ liệu lưu trên
   iPhone; Windows không cần bật liên tục để bạn tập luyện. Ảnh động bài tập được tải
   từ CDN khi có mạng.
5. Vào **Settings → Language → Tiếng Việt** nếu ngôn ngữ chưa được tự chọn.

Muốn đồng bộ với máy chủ, xem [kết nối app với máy chủ](MOBILE.md#connecting-the-app-to-your-own-server).
Địa chỉ `localhost:5174` trên Windows không phải địa chỉ máy chủ mà iPhone truy cập được.

## Gia hạn và cập nhật

Với Apple ID miễn phí, ứng dụng cần được ký lại trong vòng **7 ngày**. Mở AltStore →
**My Apps → Refresh All** khi AltServer trên Windows đang chạy và điện thoại kết nối
được với máy tính. Không phải build lại IPA mỗi tuần: ký lại bản đã cài là đủ.
AltStore cũng thử gia hạn tự động trong nền, nhưng nên kiểm tra số ngày còn lại.
Apple giới hạn 3 ứng dụng sideload hoạt động cùng lúc, bao gồm AltStore.
Xem [hướng dẫn gia hạn và giới hạn](https://faq.altstore.io/altstore-classic/your-altstore).

Khi mã nguồn thay đổi, chạy lại workflow và cài IPA mới bằng cùng Apple ID, giữ nguyên
bundle ID để cập nhật đúng ứng dụng. Xuất bản sao lưu trong openGym trước khi đổi Apple ID,
đổi bundle ID hoặc gỡ app, vì các thao tác đó có thể làm mất dữ liệu trên thiết bị.
