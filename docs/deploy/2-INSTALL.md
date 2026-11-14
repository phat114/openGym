# 2. Cài openGym

Kết quả: hai container `api` và `web` chạy, được build từ mã nguồn của fork, và app trả lời ở
`http://127.0.0.1:8080` **trên chính server**. Ở bước này app chưa mở ra internet; việc đó làm ở
[bước 3](3-HTTPS.md).

## 1. Lấy mã nguồn

```bash
sudo mkdir -p /opt/opengym
sudo chown "$USER": /opt/opengym
git clone https://github.com/phat114/openGym.git /opt/opengym
cd /opt/opengym
```

Clone **bản fork**, không phải repo upstream `DuarteSantos8/openGym`. Kiểm tra đúng bản có tiếng Việt:

```bash
ls frontend/src/locales/vi.js      # phải có file này
git log -1 --oneline
```

Nếu sau này repo fork chuyển sang private, hãy thêm một *deploy key* chỉ-đọc cho server
(GitHub → repo → Settings → Deploy keys) và clone bằng địa chỉ `git@github.com:phat114/openGym.git`.

## 2. Bắt compose build từ mã nguồn

```bash
cp docs/deploy/docker-compose.override.yml .
echo docker-compose.override.yml >> .git/info/exclude    # để git status không báo file lạ
docker compose config | grep -E 'image:|pull_policy'
```

Kết quả phải có `opengym-api:local`, `opengym-web:local` và `pull_policy: build`. File này làm gì và vì
sao cần thì xem phần ghi chú ở đầu [docker-compose.override.yml](docker-compose.override.yml). Tóm
lại: nếu thiếu nó, compose sẽ kéo image upstream về, và app chạy được nhưng **không có tiếng Việt**.

## 3. Cấu hình `.env`

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

**Sửa** bốn dòng không có dấu `#` ở đầu file. Đừng thêm dòng trùng tên. Thêm hai dòng cuối:

```bash
RP_ID=gym.example.com
ORIGIN=https://gym.example.com
WEB_PORT=127.0.0.1:8080
RP_NAME=openGym

DEFAULT_LANG=vi
VAPID_SUBJECT=mailto:admin@example.com
```

| Biến | Ý nghĩa |
|---|---|
| `RP_ID` | Hostname trần: không `https://`, không cổng, không `/` ở cuối |
| `ORIGIN` | Địa chỉ đầy đủ người dùng gõ: có `https://`, không `/` ở cuối |
| `WEB_PORT` | `127.0.0.1:8080`: compose ghép thành `127.0.0.1:8080:80`, nên cổng chỉ nghe trên máy này. Caddy/cloudflared trên cùng máy sẽ chuyển tiếp vào đây |
| `RP_NAME` | Tên hiện trong hộp thoại passkey của điện thoại |
| `DEFAULT_LANG` | Màn đăng nhập và hồ sơ chưa từng chọn ngôn ngữ sẽ mở bằng tiếng Việt. Ai tự chọn ngôn ngữ khác trong Cài đặt thì lựa chọn của họ được giữ |
| `VAPID_SUBJECT` | Địa chỉ liên hệ gửi kèm push notification. Không bắt buộc, mặc định là `ORIGIN` |

| | Đúng | Sai |
|---|---|---|
| `RP_ID` | `gym.example.com` | `https://gym.example.com`, `gym.example.com:443`, `gym.example.com/` |
| `ORIGIN` | `https://gym.example.com` | `gym.example.com`, `https://gym.example.com/` |

**Chưa đặt** `ADMIN_UIDS`, `INVITE_ONLY` hoặc `ALLOW_GUEST` lúc này. `INVITE_ONLY=1` không có ngoại lệ cho
tài khoản đầu tiên: bật nó lúc chưa có admin thì không ai tạo được hồ sơ. Các biến này đặt ở
[bước 3](3-HTTPS.md), sau khi bạn đã có tài khoản. Danh sách đầy đủ các biến nằm trong
[`.env.example`](../../.env.example), mỗi biến có giải thích.

## 4. Build và chạy

```bash
docker compose up -d --build
```

Lần đầu sẽ lâu nhất. Docker tải image gốc, chạy `npm ci` và `vite build` cho frontend, và service
`media` tải khoảng 140 MB ảnh/GIF bài tập từ GitHub về `./media`. Theo dõi tiến trình:

```bash
docker compose logs -f media      # chờ dòng "✓ Exercise media ready (… images)."
docker compose ps
```

Kết quả bình thường: `api` và `web` ở trạng thái `Up (health: starting)`. Docker kiểm tra sức khỏe 5 phút
một lần, nên phải sau khoảng 5 phút trạng thái mới chuyển sang `healthy`; app vẫn dùng được trong lúc
chờ. `media` ở trạng thái `exited (0)`. `media` là service chạy một lần, và lần chạy sau nó bỏ qua nếu ảnh
đã có.

Nếu build dừng với `Killed` hoặc mã thoát 137, server đã hết RAM. Thêm swap
([bước 1, mục 3](1-SERVER.md)) rồi chạy lại.

## 5. Kiểm tra

Chạy trên server:

```bash
curl -s http://127.0.0.1:8080/api/health
# {"ok":true,"users":0}

docker compose logs api | grep 'gym-api on'
# gym-api on :3000 (rpID=gym.example.com, origin=https://gym.example.com)

docker compose exec web grep -rl "vi-VN" /usr/share/nginx/html | head -1
# phải in ra một file .js; không in gì nghĩa là bundle không có tiếng Việt

ss -ltn | grep 8080
# chỉ được thấy 127.0.0.1:8080, không được thấy 0.0.0.0:8080 hay *:8080
```

Nếu dòng `gym-api on` không khớp với `.env`, container vẫn đang chạy cấu hình cũ. Chạy
`docker compose up -d`. Lưu ý `docker compose restart` **không** đọc lại `.env`.

## 6. Dữ liệu nằm ở đâu

```
/opt/opengym/
├── .env                          cấu hình
├── docker-compose.override.yml   bắt build từ mã nguồn
├── data/                         ← THỨ DUY NHẤT PHẢI SAO LƯU
│   ├── db.json                   tài khoản, passkey (khóa công khai), đăng ký push, mã mời
│   ├── state-<uid>.json          dữ liệu tập của từng hồ sơ
│   ├── secret                    khóa ký cookie phiên, được tạo ở lần chạy đầu
│   ├── vapid.json                khóa Web Push
│   ├── audit.log                 nhật ký đăng nhập và thao tác admin
│   └── uploads/                  ảnh/video người dùng gắn vào bài tập tự tạo
├── media/                        ảnh/GIF bài tập, tải lại được bất cứ lúc nào
└── coach-auth/                   chỉ dùng khi bật AI Coach với Codex; không sao lưu
```

Container `api` chạy bằng root, nên `data/` thuộc sở hữu root. Muốn đọc hoặc sao lưu nó thì cần `sudo`.

Tiếp: [3. HTTPS và tài khoản đầu tiên](3-HTTPS.md)
