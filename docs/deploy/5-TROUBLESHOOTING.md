# 5. Xử lý sự cố

Tra theo triệu chứng. Gần như mọi sự cố đều bắt đầu bằng ba lệnh này (chạy trong `/opt/opengym`):

```bash
docker compose ps
docker compose logs --tail=50 api web
sudo journalctl -u caddy --since "15 min ago"      # hoặc: sudo journalctl -u cloudflared …
```

## Riêng cho bản fork

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| **Cài đặt → Ngôn ngữ** không có Tiếng Việt | Đang chạy image upstream: thiếu file override, hoặc đã từng `docker compose pull` trước khi có override | `docker compose images`: dòng của `web` phải có REPOSITORY `opengym-web`, TAG `local`. Nếu không phải, chép lại override ([bước 2](2-INSTALL.md)), chạy `docker compose up -d --build`, rồi tải lại trang |
| Có Tiếng Việt nhưng một số chữ vẫn tiếng Anh | Chuỗi mới (thường là từ upstream) chưa được dịch | App vẫn chạy đúng. Thêm bản dịch vào `frontend/src/locales/vi.js` trên máy dev |
| `docker compose pull` báo `pull access denied for opengym-api` | Đúng như dự kiến: `opengym-*:local` chỉ có trên máy này | Không dùng `pull`. Cập nhật bằng `git pull && docker compose up -d --build` |
| Cảnh báo `The "http_cf_connecting_ip" variable is not set` | Trong `.env` thiếu dấu nháy đơn | Sửa thành `CF_CONNECTING_IP='$http_cf_connecting_ip'`, rồi `docker compose up -d` |

## Passkey và đăng nhập

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Không hiện hộp thoại passkey | Đang mở bằng `http://` hoặc bằng IP | Mở bằng `https://gym.example.com` |
| "verification failed" khi đăng nhập/tạo hồ sơ | `RP_ID`/`ORIGIN` không khớp địa chỉ trên thanh địa chỉ | `docker compose logs api \| grep 'gym-api on'`. Hai giá trị phải đúng dạng ([bước 2](2-INSTALL.md)). Sửa `.env`, chạy `docker compose up -d` (không phải `restart`) |
| Passkey chạy ở `gym.example.com` nhưng không chạy ở `www.gym.example.com` | Hai hostname khác nhau | Chọn một, chuyển hướng cái còn lại về nó |
| Đổi tên miền xong không ai đăng nhập được | Passkey gắn với hostname cũ | Không cứu được passkey cũ. Đổi lại tên miền cũ, hoặc để mọi người đăng ký lại (dữ liệu chuyển bằng **Xuất bản sao lưu (JSON)** rồi **Nhập bản sao lưu** trong Cài đặt) |
| Mọi người cùng bị đăng xuất | `data/secret` mất hoặc đã bị thay, ví dụ do khôi phục nhầm hay chuyển server mà không chép nó | Khôi phục `data/secret` từ bản sao lưu. Nếu không còn bản nào thì mọi người đăng nhập lại |
| App báo máy chủ không còn chấp nhận điện thoại/trình duyệt này | Server trả 401: đã "Đăng xuất trên mọi thiết bị", tài khoản bị khóa, hoặc `secret` đã đổi | Ghép nối lại (**Cài đặt → Ghép nối ứng dụng di động**) hoặc đăng nhập lại. Dữ liệu trên máy không mất |
| Đăng nhập bằng mật khẩu bị khóa với **tất cả** mọi người cùng lúc | Proxy không chuyển IP thật, nên mọi người bị tính là một địa chỉ | Làm phần *IP thật của người dùng* ở [bước 3](3-HTTPS.md). Khóa tự hết sau tối đa 15 phút; khởi động lại api cũng xóa bộ đếm |
| Mất passkey duy nhất | Không có cách tự khôi phục | Với `PASSWORD_LOGIN=1`, admin cấp mã đặt lại trong **Bảng quản trị**. Nếu không bật, người đó phải tạo hồ sơ mới và nhập lại bản xuất JSON. Xem [SELF_HOSTING.md](../SELF_HOSTING.md#which-passkey-providers-work) |

Nếu vẫn không được, hãy đọc thêm danh sách kiểm tra đầy đủ của upstream:
[Passkeys fail even though `RP_ID` looks right](../SELF_HOSTING.md#passkeys-fail-even-though-rp_id-looks-right).

## HTTPS và mạng

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Caddy không xin được chứng chỉ | DNS chưa trỏ đúng IP; cổng 80/443 bị chặn ở UFW **hoặc** ở tường lửa của nhà cung cấp VPS; bản ghi Cloudflare đang ở chế độ proxy (đám mây cam) | `getent hosts gym.example.com` phải ra IP server. Mở cổng ở cả hai lớp tường lửa. Chuyển bản ghi sang *DNS only*. Sửa xong thì `sudo systemctl reload caddy` |
| Trình duyệt báo `502 Bad Gateway` (trang lỗi của Caddy) | Container `web` không chạy, hoặc không nghe ở `127.0.0.1:8080` | `docker compose ps`; `ss -ltn \| grep 8080`. Nếu đã đổi `WEB_PORT` thì sửa Caddyfile cho khớp |
| App báo máy chủ trả lỗi HTTP 502/504 | `web` chạy nhưng `api` không chạy | `docker compose logs api`. Khởi động lại bằng `docker compose up -d` |
| App báo máy chủ trả "thứ khác không phải openGym (HTTP 200)" | Có thứ khác trả lời `/api/*`, ví dụ trang đăng nhập của một proxy xác thực | Chuyển nguyên vẹn `/api/*` tới openGym |
| Từ máy khác vào được `http://<IP>:8080` | `WEB_PORT` chưa có `127.0.0.1:` | Sửa thành `WEB_PORT=127.0.0.1:8080`, chạy `docker compose up -d`, rồi kiểm tra lại bằng `ss -ltn` |
| `port is already allocated` khi `up` | Cổng 8080 đã có chương trình khác dùng | Đặt `WEB_PORT=127.0.0.1:9090`, rồi sửa Caddyfile/tunnel trỏ sang 9090 |
| Upload ảnh/video báo "quá lớn" hoặc dừng giữa chừng | Proxy phía trước giới hạn kích thước hoặc thời gian | Caddy mặc định không giới hạn. Cloudflare Free giới hạn 100 MB. Nếu tăng `MEDIA_VIDEO_MAX_MB` thì tăng `MEDIA_UPLOAD_MAX` cao hơn nó. Xem [SELF_HOSTING.md](../SELF_HOSTING.md#photos-and-videos-of-custom-exercises) |
| Không có mục **Thông báo** trong Cài đặt | Đang dùng chế độ khách hoặc không có HTTPS | Đăng nhập bằng hồ sơ trên `https://`. Trên iPhone, phải mở app từ biểu tượng ngoài màn hình chính |

## Build và container

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Build dừng với `Killed` / mã thoát 137 | Hết RAM khi build frontend | Thêm swap ([bước 1](1-SERVER.md)), rồi chạy lại `docker compose up -d --build` |
| Build lỗi ở `npm ci` hoặc khi tải image gốc (`toomanyrequests`, timeout) | Mạng chập chờn, hoặc Docker Hub giới hạn lượt tải ẩn danh | Chạy lại. Nếu bị giới hạn lượt tải thì `docker login` bằng một tài khoản Docker Hub miễn phí |
| Ảnh/GIF bài tập trống | Service `media` chưa tải xong hoặc tải lỗi | `docker compose logs media`. Chạy lại `docker compose up -d`, hoặc `./scripts/fetch-media.sh` (cần `git` và `bash` trên host) |
| Ổ đĩa đầy | Image/cache build cũ, hoặc ảnh/video người dùng tải lên | Xem mục *Dọn ổ đĩa* ở [4. Vận hành](4-OPERATIONS.md). Giảm `MEDIA_QUOTA_MB` nếu instance mở đăng ký |
| `api` ở trạng thái `unhealthy` / khởi động lại liên tục | API lỗi lúc khởi động. Dòng lỗi cuối trong log sẽ cho biết lý do, ví dụ `data/` không ghi được vì ổ đầy | `docker compose logs api`; `df -h`. Nếu một file trong `data/` bị hỏng, khôi phục từ bản sao lưu |
| Sửa `.env` mà không thấy tác dụng | Dùng `restart` thay vì `up -d` | `docker compose up -d` |

## Khi cần nhờ người khác xem

Gửi kèm kết quả của những lệnh sau:

```bash
cd /opt/opengym
git log -1 --oneline
docker compose version
docker compose ps
docker compose images
docker compose logs --tail=100 api web
grep -vE '^\s*(#|$)' .env      # các dòng cấu hình đang bật
```

**Đừng bao giờ gửi** nội dung trong `data/` (`secret`, `db.json`, `state-*.json`, `audit.log`) hay file sao
lưu. Chúng cho phép đăng nhập vào tài khoản của người khác và chứa dữ liệu cá nhân. Trước khi gửi
`.env`, hãy xem lại: nếu bạn đã đặt `HEVY_API_KEY` hoặc thứ gì riêng tư trong đó thì xóa đi.

Cộng đồng upstream: [Discord](https://discord.gg/e62jY6fwVb) ·
[GitHub Discussions](https://github.com/DuarteSantos8/openGym/discussions). Khi hỏi ở đó, hãy nói rõ bạn
đang chạy **bản fork build từ mã nguồn**, không phải image dựng sẵn.
