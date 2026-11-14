# Triển khai openGym lên server

Bộ tài liệu này đưa một VPS Linux trống tới một instance openGym chạy HTTPS trên tên miền
riêng, có sao lưu tự động và quy trình cập nhật. Nó viết cho fork
[`phat114/openGym`](https://github.com/phat114/openGym), bản có giao diện tiếng Việt, và đi theo
một con đường cố định: Ubuntu + Docker Compose build từ mã nguồn + Caddy (hoặc Cloudflare Tunnel)
đứng trước.

Người đọc cần biết SSH và lệnh Linux cơ bản. Không cần biết Node, React hay passkey.

## Đọc theo thứ tự

| Bước | Tài liệu | Xong bước này thì có |
|---|---|---|
| 1 | [Chuẩn bị server](1-SERVER.md) | VPS có Docker, tường lửa, tên miền trỏ về server |
| 2 | [Cài openGym](2-INSTALL.md) | Hai container chạy, app trả lời ở `127.0.0.1:8080` trên server |
| 3 | [HTTPS và tài khoản đầu tiên](3-HTTPS.md) | `https://gym.example.com` mở được trên điện thoại, bạn là admin |
| 4 | [Vận hành](4-OPERATIONS.md) | Sao lưu hằng đêm, cập nhật, khôi phục, chuyển server |
| 5 | [Xử lý sự cố](5-TROUBLESHOOTING.md) | Tra theo triệu chứng |

Trong mọi lệnh, thay `gym.example.com` bằng tên miền của bạn, và `/opt/opengym` bằng thư mục cài
nếu bạn chọn chỗ khác.

## Hệ thống sau khi chạy xong

```
 Điện thoại / trình duyệt
          │  HTTPS :443
          ▼
 Caddy trên host ────────── tự xin và gia hạn chứng chỉ Let's Encrypt
          │  HTTP 127.0.0.1:8080
          ▼
 container web (nginx) ──── trả app tĩnh + ảnh/GIF bài tập (./media)
          │  /api/*  →  api:3000, trong mạng nội bộ Docker
          ▼
 container api (Node) ───── đọc/ghi ./data: tài khoản, passkey, dữ liệu tập, khóa phiên
```

Chỉ `./data` là thứ phải giữ. Mọi thứ khác dựng lại được từ git và từ lần tải ảnh đầu tiên.

## Khác gì so với tài liệu gốc

[SELF_HOSTING.md](../SELF_HOSTING.md) (tiếng Anh) là tài liệu đầy đủ của upstream. Bộ này làm theo
nó, trừ ba điểm vì đây là bản fork:

1. **Build từ mã nguồn, không dùng image dựng sẵn.** `docker-compose.yml` trỏ tới
   `ghcr.io/duartesantos8/opengym-*`. Đó là image của upstream và không có tiếng Việt: upstream
   không có `frontend/src/locales/vi.js`. Fork này cũng chưa publish image riêng. File
   [docker-compose.override.yml](docker-compose.override.yml) đổi tên image thành `opengym-*:local`
   và bắt compose luôn build.
2. **Không chạy `docker compose pull`.** Tài liệu gốc cập nhật bằng
   `git pull && docker compose pull && docker compose up -d`. Với fork, lệnh đó là
   `git pull && docker compose up -d --build`.
3. **Cổng 8080 chỉ nghe ở 127.0.0.1.** Docker mở cổng publish bằng iptables của riêng nó, đi vòng
   qua UFW. Để mặc định thì app lộ ra internet bằng HTTP thường ở cổng 8080.

## Hai thứ không đổi được khi đã có người dùng

- **Tên miền** (`RP_ID`). Passkey gắn với đúng hostname. Đổi tên miền thì passkey cũ hết dùng
  được và mọi người phải đăng ký lại. Hãy chốt tên miền, kể cả có `www.` hay không, trước khi mời ai.
- **`data/secret`**. Đây là khóa ký mọi cookie phiên. Mất nó thì mọi người bị đăng xuất và mọi
  điện thoại đã ghép nối phải ghép lại. Nó nằm trong bản sao lưu, nên hãy giữ bản sao lưu cẩn thận
  như giữ mật khẩu.

## Checklist trước khi mời người dùng

- [ ] `curl https://gym.example.com/api/health` trả `{"ok":true,...}`
- [ ] Log api in đúng `rpID=gym.example.com, origin=https://gym.example.com`
- [ ] Từ một máy khác, `http://<IP-server>:8080` **không** kết nối được
- [ ] **Cài đặt → Ngôn ngữ** có Tiếng Việt
- [ ] Bạn thấy **Bảng quản trị** trong Cài đặt
- [ ] `INVITE_ONLY` / `ALLOW_GUEST` đúng ý bạn
- [ ] Đã chạy sao lưu một lần và giải nén thử được
- [ ] Có ít nhất một bản sao lưu nằm ngoài server
- [ ] Người dùng lấy được mã nguồn của bản fork (xem *Giấy phép* bên dưới)

## Giấy phép

- **Mã nguồn** là AGPL-3.0. Chạy một bản **đã sửa**, như bản fork này, thành dịch vụ mạng thì phải
  cho người dùng lấy được mã nguồn của chính bản đó ([README](../../README.md), mục *License*).
  Repo fork công khai trên GitHub đáp ứng việc này. Lưu ý: liên kết "source code" trong Cài đặt
  (`frontend/src/views/Settings.jsx`) vẫn trỏ về repo upstream, nơi không có phần tiếng Việt.
- **Ảnh và GIF bài tập** không thuộc AGPL. Server tự tải chúng ở lần chạy đầu. Quyền sở hữu đang
  tranh chấp giữa Gym visual và ExerciseDB/AscendAPI. Nếu instance phục vụ mục đích thương mại, ví dụ
  một phòng gym thu phí, hãy đọc [NOTICE.md](../../NOTICE.md) trước.
