# 1. Chuẩn bị server

Kết quả: một server Ubuntu/Debian có Docker, tường lửa chỉ mở SSH + web, và một tên miền trỏ về nó.
Nếu server của bạn đã có sẵn những thứ này thì chuyển sang [bước 2](2-INSTALL.md).

## Cấu hình nên có

| | Khuyến nghị | Ghi chú |
|---|---|---|
| CPU | 1–2 vCPU, amd64 hoặc arm64 | Cả hai kiến trúc đều build được (`node:22-alpine`, `nginx:alpine` có cả hai) |
| RAM | 2 GB | Khi chạy, hai container khá nhẹ. Lúc cần RAM nhất là khi build frontend. Máy 1 GB thì thêm swap (mục 3) |
| Ổ đĩa | 20 GB | Image và cache build chiếm vài GB, ảnh bài tập khoảng 140 MB, mỗi hồ sơ được tải lên tối đa 200 MB ảnh/video (`MEDIA_QUOTA_MB`) |
| Hệ điều hành | Ubuntu 24.04 LTS hoặc Debian 12 | Các lệnh dưới đây viết cho Ubuntu/Debian |
| Mạng ra ngoài | Truy cập được `github.com` và Docker Hub | Để clone mã nguồn, tải image gốc, tải ảnh bài tập |

## 1. Đăng nhập và tạo user thường

Đừng chạy mọi thứ bằng `root`. Tạo một user có quyền sudo và đăng nhập bằng SSH key:

```bash
ssh root@<IP-server>
adduser deploy
usermod -aG sudo deploy
# Chép SSH key của root (nếu bạn đã thêm key lúc tạo VPS) sang user mới
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Mở **một terminal khác** và thử `ssh deploy@<IP-server>`. Chỉ khi đăng nhập được, hãy tắt đăng nhập
bằng mật khẩu và đăng nhập root:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
EOF
sudo systemctl restart ssh
```

Từ đây trở đi, mọi lệnh chạy bằng user `deploy`.

## 2. Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

Múi giờ server **không** ảnh hưởng tới giờ nhắc lịch tập: trình duyệt của từng người tự báo múi giờ
của họ. Đặt múi giờ chỉ để log và giờ chạy sao lưu dễ đọc:

```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
```

## 3. Swap (máy từ 2 GB RAM trở xuống)

Nếu build hết RAM, tiến trình build bị hệ điều hành giết (`Killed`, mã thoát 137). Thêm 2 GB swap
trước để tránh việc này:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h      # dòng Swap phải hiện 2.0Gi
```

## 4. Cài Docker

Dùng script chính thức của Docker. Tải về trước để có thể đọc nó, rồi mới chạy:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
```

Đăng xuất rồi đăng nhập lại để quyền nhóm `docker` có hiệu lực, sau đó kiểm tra:

```bash
docker run --rm hello-world
docker compose version       # cần Docker Compose v2
```

Muốn cài từ apt repo thay vì script thì xem
[hướng dẫn chính thức](https://docs.docker.com/engine/install/ubuntu/).

> Nhóm `docker` có quyền tương đương root trên máy. Chỉ thêm những người được phép quản trị server.

**Giới hạn dung lượng log.** Mặc định Docker giữ log của container mãi mãi. Giới hạn nó trước khi
tạo container nào, vì thiết lập này chỉ áp dụng cho container tạo sau:

```bash
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
sudo systemctl restart docker
```

## 5. Tường lửa

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp       # Let's Encrypt và chuyển hướng HTTP → HTTPS
sudo ufw allow 443/tcp      # HTTPS
sudo ufw allow 443/udp      # tùy chọn: HTTP/3, Caddy bật sẵn
sudo ufw enable
sudo ufw status
```

- Nếu dùng **Cloudflare Tunnel** ([bước 3, cách B](3-HTTPS.md)) thì không cần mở 80/443: tunnel tự
  kết nối ra ngoài.
- Nhiều nhà cung cấp VPS có thêm tường lửa riêng ở bảng điều khiển (security group). Mở 80/443 ở đó
  nữa.
- **UFW không che được cổng Docker.** Docker tự thêm luật iptables cho cổng được publish, đi vòng
  qua UFW. Vì vậy ở [bước 2](2-INSTALL.md), openGym chỉ được nghe ở `127.0.0.1`. Đừng dựa vào UFW để
  giấu cổng 8080.

## 6. Tên miền

Chọn hostname cho app, ví dụ `gym.example.com`. Chốt luôn ở bước này, vì passkey gắn với đúng
hostname: `gym.example.com` và `www.gym.example.com` là hai host khác nhau, và đổi về sau thì mọi
người phải đăng ký lại.

- **Cách A (Caddy):** ở trang quản lý DNS, tạo bản ghi `A` trỏ `gym.example.com` về IP public của
  server, thêm bản ghi `AAAA` nếu server có IPv6. Nếu DNS nằm ở Cloudflare, để bản ghi ở chế độ
  **DNS only** (đám mây xám).
- **Cách B (Cloudflare Tunnel):** tên miền phải được quản lý trên Cloudflare. Không tạo bản ghi
  bằng tay; tunnel sẽ tự tạo ở bước 3.

Kiểm tra (cách A), đợi tới khi lệnh trả đúng IP server:

```bash
getent hosts gym.example.com
```

## Xong bước 1 khi

- [ ] `ssh deploy@<IP-server>` vào được, `ssh root@...` bị từ chối
- [ ] `docker run --rm hello-world` chạy được mà không cần `sudo`
- [ ] `sudo ufw status` có OpenSSH, 80, 443 (hoặc chỉ OpenSSH nếu dùng Cloudflare Tunnel)
- [ ] Tên miền phân giải ra IP server (cách A)

Tiếp: [2. Cài openGym](2-INSTALL.md)
