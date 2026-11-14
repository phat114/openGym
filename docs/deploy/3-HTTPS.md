# 3. HTTPS và tài khoản đầu tiên

Passkey chỉ hoạt động trên HTTPS (`localhost` là ngoại lệ duy nhất), nên đây là bước bắt buộc chứ
không phải tùy chọn. Chọn **một** trong hai cách:

| | Cách A: Caddy | Cách B: Cloudflare Tunnel |
|---|---|---|
| Hợp với | VPS có IP public | Server không có IP public, hoặc bạn không muốn mở cổng nào |
| Cổng phải mở | 80, 443 | Không cổng nào |
| Chứng chỉ | Caddy tự xin và gia hạn với Let's Encrypt | Cloudflare lo |
| Điều kiện | Bản ghi DNS trỏ về server ([bước 1](1-SERVER.md)) | Tên miền quản lý trên Cloudflare |

Cả hai đều chạy **trên host** (không chạy trong Docker) và chuyển tiếp vào `127.0.0.1:8080`.

## Cách A — Caddy

Cài từ repo chính thức ([hướng dẫn gốc](https://caddyserver.com/docs/install#debian-ubuntu-raspbian)):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Ghi đè `/etc/caddy/Caddyfile`:

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
gym.example.com {
	reverse_proxy 127.0.0.1:8080 {
		# Chuyển IP thật của người dùng vào trong (xem "IP thật của người dùng" bên dưới)
		header_up CF-Connecting-IP {remote_host}
	}
}
EOF
sudo systemctl reload caddy
sudo journalctl -u caddy -f      # chờ dòng "certificate obtained successfully"
```

Caddy tự chuyển hướng `http://` sang `https://` và tự gia hạn chứng chỉ, không cần cron. Caddy mặc định
không giới hạn dung lượng request, nên video upload tới 40 MB (mặc định của app) đi qua được. Nếu sau
này bạn thêm `request_body { max_size … }`, hãy để giá trị từ 48MB trở lên.

Nếu không xin được chứng chỉ, xem [Xử lý sự cố](5-TROUBLESHOOTING.md). Nguyên nhân thường là DNS chưa
trỏ đúng, cổng 80/443 bị chặn ở tường lửa của nhà cung cấp VPS, hoặc bản ghi Cloudflare đang bật
proxy (đám mây cam).

**HSTS (tùy chọn, làm sau khi mọi thứ đã chạy):** thêm dòng
`header Strict-Transport-Security "max-age=31536000"` vào trong khối `gym.example.com { … }`. Từ đó trình
duyệt sẽ từ chối mọi kết nối không phải HTTPS tới tên miền này trong một năm, nên chỉ bật khi chắc
chắn sẽ giữ HTTPS.

## Cách B — Cloudflare Tunnel

1. Vào Cloudflare Zero Trust → **Networks → Tunnels → Create a tunnel**, chọn loại **Cloudflared**.
2. Cloudflare đưa cho bạn một lệnh cài connector cho Debian/Ubuntu. Chạy lệnh đó **trên server**, để
   cloudflared chạy như một service của host. Nếu chạy cloudflared trong một container Docker,
   `localhost` sẽ là chính container đó và không tới được app.
3. Thêm **Public hostname**: `gym.example.com` → Service **HTTP** → `localhost:8080`.
   Cloudflare tự tạo bản ghi DNS.

Gói Free của Cloudflare giới hạn mỗi request 100 MB, cao hơn mức tối đa của app nên không cần chỉnh gì.

## IP thật của người dùng

Đứng sau Caddy hoặc tunnel, mọi request tới container `web` đều đến từ cùng một địa chỉ (chính proxy
đó). nginx trong container ghi đè `X-Forwarded-For` bằng địa chỉ ấy, nên API thấy mọi người dùng như
một người. Việc này ảnh hưởng tới hai chỗ:

- **Đăng nhập bằng mật khẩu** (`PASSWORD_LOGIN=1`): API chặn đoán mật khẩu theo địa chỉ. Nếu mọi người
  chung một địa chỉ, một kẻ đoán sai liên tục có thể khóa đăng nhập mật khẩu của **tất cả mọi người**
  tới 15 phút. Passkey không bị ảnh hưởng.
- **Nhật ký hoạt động** khi bật `AUDIT_IP`: mọi dòng ghi cùng một địa chỉ.

API ưu tiên tin header `CF-Connecting-IP`. Container `web` mặc định xóa header này, nên phải cho nó đi
qua. Thêm vào `.env`:

```bash
CF_CONNECTING_IP='$http_cf_connecting_ip'
```

Sau đó chạy `docker compose up -d`.

- **Dấu nháy đơn là bắt buộc.** Không có nháy, compose hiểu `$http_cf_connecting_ip` là một biến môi
  trường chưa đặt và thay bằng chuỗi rỗng. Header khi đó vẫn bị xóa, và compose in cảnh báo
  `The "http_cf_connecting_ip" variable is not set`. Ví dụ trong `.env.example` gốc viết không có
  nháy, nên gặp đúng lỗi này.
- **Cách A:** dòng `header_up CF-Connecting-IP {remote_host}` trong Caddyfile ở trên là thứ điền IP
  thật vào header. Caddy **ghi đè** header này, nên client không giả được.
- **Cách B:** Cloudflare tự đặt header này và cũng ghi đè giá trị client gửi lên.
- **Thiết lập này chỉ an toàn vì cổng 8080 chỉ nghe ở `127.0.0.1`.** Nếu cổng mở ra ngoài, ai cũng gửi
  thẳng được một `CF-Connecting-IP` giả. Khi đó đừng bật thiết lập này.

## Kiểm tra từ bên ngoài

Chạy trên máy của bạn, không phải trên server:

```bash
curl -s https://gym.example.com/api/health      # {"ok":true,"users":0}
curl -m 5 http://<IP-server>:8080/               # phải lỗi hoặc hết thời gian chờ
```

## Tạo tài khoản đầu tiên và làm admin

1. Mở `https://gym.example.com` trên điện thoại hoặc máy tính → **Tạo hồ sơ mới** → tạo passkey.
2. Vào **Cài đặt → Tài khoản → ID tài khoản** và chạm vào để sao chép. Cách khác là xem trên server:

   ```bash
   sudo python3 -c 'import json; [print(u["id"], u.get("name","")) for u in json.load(open("/opt/opengym/data/db.json"))["users"]]'
   ```

3. Thêm vào `.env`, rồi chọn chế độ truy cập:

   ```bash
   ADMIN_UIDS=<id-vừa-chép>     # nhiều admin thì cách nhau bằng dấu phẩy

   # Nhóm kín (khuyên dùng cho phòng tập, nhóm bạn):
   INVITE_ONLY=1      # tạo hồ sơ mới phải có mã mời
   ALLOW_GUEST=0      # bỏ nút "Tiếp tục không cần tài khoản"
   ```

4. Áp dụng thay đổi. Dùng `up -d` chứ không dùng `restart`:

   ```bash
   cd /opt/opengym && docker compose up -d
   ```

5. Tải lại app. **Cài đặt** giờ có **Bảng quản trị**: xem người dùng, khóa tài khoản, tạo mã mời, xem
   nhật ký hoạt động.

Từ lúc tên miền chạy cho tới khi bật `INVITE_ONLY=1`, bất kỳ ai biết địa chỉ đều tạo được hồ sơ. Hãy
làm bước 1–4 liền một lượt. Nếu lỡ có hồ sơ lạ, xóa nó trong **Bảng quản trị**.

### Đăng nhập bằng mật khẩu (tùy chọn)

Nếu người dùng gặp khó với passkey (máy cũ, Firefox, không quen dùng), có thể bật thêm đăng nhập bằng
tên và mật khẩu:

```bash
PASSWORD_LOGIN=1
```

Passkey vẫn là mặc định và an toàn hơn. Mật khẩu có thể bị lừa lấy, dùng lại hoặc đoán. openGym không
gửi email, nên khi ai đó quên mật khẩu, admin cấp **mã đặt lại** một lần từ **Bảng quản trị**. Nếu bật
tùy chọn này, hãy làm thêm phần *IP thật của người dùng* ở trên. Đánh đổi đầy đủ:
[SELF_HOSTING.md → Password sign-in](../SELF_HOSTING.md#password-sign-in-optional).

## Đưa lên điện thoại

- **Cài như app (PWA):** iOS: Safari → Chia sẻ → *Thêm vào MH chính*. Android: Chrome → ⋮ → *Thêm
  vào màn hình chính*.
- **Thông báo** (hết giờ nghỉ, nhắc ngày tập): **Cài đặt → Thông báo**. Trên iOS chỉ hoạt động khi
  mở app từ biểu tượng ngoài màn hình chính. Phía server không cần cấu hình gì.
- **App Android/iOS gốc** kết nối với server này: trên trình duyệt đã đăng nhập, vào
  **Cài đặt → Ghép nối ứng dụng di động** rồi nhập mã vào app. Chi tiết:
  [MOBILE.md](../MOBILE.md#connecting-the-app-to-your-own-server). Cài app lên iPhone từ Windows:
  [IOS_WINDOWS.md](../IOS_WINDOWS.md).
- **Thêm passkey thứ hai** (**Cài đặt → Tài khoản → Thêm thiết bị khác**) để mất một điện thoại không
  có nghĩa là mất hồ sơ. Hãy nhắc người dùng làm việc này.

Đến đây instance đã chạy. Làm nốt [checklist](README.md#checklist-trước-khi-mời-người-dùng), rồi thiết lập
sao lưu ở [4. Vận hành](4-OPERATIONS.md) **trước khi** mời người dùng.
