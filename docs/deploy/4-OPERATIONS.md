# 4. Vận hành

Mọi lệnh `docker compose` trong file này chạy trong `/opt/opengym`.

## Lệnh hằng ngày

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `docker compose ps` |
| Xem log | `docker compose logs -f --tail=100 api` (hoặc `web`) |
| Áp dụng thay đổi trong `.env` | `docker compose up -d` |
| Dừng (dữ liệu giữ nguyên) | `docker compose down` |
| Chạy lại | `docker compose up -d` |
| Xem nhật ký đăng nhập | `sudo tail -f data/audit.log`, hoặc **Bảng quản trị** trong app |

- `docker compose restart` **không** đọc lại `.env`. Sau khi sửa `.env`, luôn dùng `docker compose up -d`.
- Do `pull_policy: build`, mỗi lần `up` compose đều build lại image. Docker dùng cache, nên khi mã nguồn
  không đổi thì việc này nhanh và container không bị tạo lại.

## Sao lưu

**Cần sao lưu gì:** toàn bộ `data/`, cùng `.env` và `docker-compose.override.yml` (hai file nhỏ, để dựng lại
nhanh). Không cần sao lưu `media/` (tải lại được) hay `coach-auth/` (đăng nhập lại provider là xong).

**Bản sao lưu là dữ liệu nhạy cảm.** Nó chứa `data/secret`: ai có file này thì giả được cookie đăng nhập
của **bất kỳ** người dùng nào. Nó cũng chứa toàn bộ lịch sử tập, nhật ký đăng nhập, và ảnh/video người
dùng tải lên. Hãy giữ nó ở nơi chỉ bạn đọc được, và mã hóa nếu gửi sang dịch vụ của bên thứ ba.

### Script sao lưu

```bash
sudo tee /usr/local/bin/opengym-backup >/dev/null <<'EOF'
#!/usr/bin/env bash
# Sao lưu openGym: data/ + .env + override, giữ KEEP_DAYS ngày gần nhất.
set -euo pipefail
umask 077
APP_DIR=/opt/opengym
DEST=/var/backups/opengym
KEEP_DAYS=14
READ_GROUP=""     # vd. "deploy": cho user đó đọc bản sao lưu để rsync về máy khác

mkdir -p "$DEST"
OUT="$DEST/opengym-$(date +%F-%H%M%S).tar.gz"

# API ghi mỗi file bằng cách ghi file tạm rồi đổi tên, nên từng file trong bản sao luôn nguyên vẹn
# dù app đang chạy. tar trả mã 1 khi có file đổi giữa chừng (vd. audit.log vừa có thêm dòng mới),
# và đó không phải lỗi. Mã từ 2 trở lên mới là lỗi thật.
# Ghi ra .part trước, chỉ đổi tên khi thành công: một lần chạy lỗi không để lại file dở trông như
# bản sao lưu tốt.
rc=0
tar -C "$APP_DIR" -czf "$OUT.part" data .env docker-compose.override.yml || rc=$?
if [ "$rc" -gt 1 ]; then echo "tar lỗi (mã $rc)" >&2; rm -f "$OUT.part"; exit "$rc"; fi
mv "$OUT.part" "$OUT"
if [ -n "$READ_GROUP" ]; then chgrp "$READ_GROUP" "$DEST" "$OUT"; chmod 750 "$DEST"; chmod 640 "$OUT"; fi

find "$DEST" -name 'opengym-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') OK $OUT ($(du -h "$OUT" | cut -f1))"
EOF
sudo chmod 700 /usr/local/bin/opengym-backup
```

Chạy thử ngay, rồi xem trong file có gì:

```bash
sudo /usr/local/bin/opengym-backup
LATEST=$(sudo sh -c 'ls -t /var/backups/opengym/opengym-*.tar.gz | head -1')
sudo tar -tzf "$LATEST" | head
# data/  data/db.json  data/secret  data/state-….json  .env  docker-compose.override.yml …
```

Thư mục sao lưu chỉ root đọc được (`umask 077`), nên glob phải chạy bên trong `sudo sh -c`. Nếu viết
`sudo ls /var/backups/opengym/*.tar.gz`, shell của bạn sẽ mở rộng glob trước khi có quyền root, và việc
đó thất bại.

Lên lịch chạy lúc 3:30 sáng mỗi ngày (theo múi giờ của server):

```bash
echo '30 3 * * * root /usr/local/bin/opengym-backup >> /var/log/opengym-backup.log 2>&1' \
  | sudo tee /etc/cron.d/opengym-backup
```

**Ảnh/video chiếm phần lớn dung lượng.** Muốn bỏ chúng ra khỏi bản sao lưu hằng ngày, thêm
`--exclude=data/uploads` vào dòng `tar`. Mọi hồ sơ vẫn nguyên vẹn khi khôi phục. Bài tập nào mất ảnh sẽ
hiện ô trống cho tới khi một thiết bị của chủ nó tải ảnh lên lại, vì mỗi thiết bị giữ bản riêng.

### Đưa một bản ra khỏi server

Bản sao lưu nằm trên cùng ổ đĩa với dữ liệu thì không cứu được khi mất cả server. Chọn một cách:

- **Kéo về từ một máy khác** do bạn quản lý (NAS, máy ở nhà). Đặt `READ_GROUP="deploy"` trong script.
  Từ đó, các bản mới user `deploy` đọc được. Rồi trên máy kia, chạy theo lịch:
  `rsync -a deploy@<IP-server>:/var/backups/opengym/ ./opengym-backups/`.
  Việc này không mở thêm quyền đáng kể: `deploy` đã ở nhóm `docker`, vốn ngang quyền root.
- **Đẩy lên kho lưu trữ đám mây** (S3, Backblaze B2, Google Drive…) bằng `rclone` hoặc `restic`. Mã hóa
  trước khi đẩy lên; `restic` tự mã hóa.

Người dùng cũng có thể tự xuất dữ liệu của mình: **Cài đặt → Xuất bản sao lưu (JSON)**.

## Khôi phục

```bash
cd /opt/opengym
sudo ls -lt /var/backups/opengym                       # chọn bản cần khôi phục
docker compose down
sudo mv data "data.hong-$(date +%F)"                    # giữ lại bản đang hỏng, đừng xóa vội
sudo tar -xzf /var/backups/opengym/opengym-<ngày-giờ>.tar.gz -C /opt/opengym data
docker compose up -d
curl -s http://127.0.0.1:8080/api/health                # số "users" phải khớp với trước khi hỏng
```

Lệnh trên chỉ giải nén `data/`. Cần cả `.env` thì thêm `.env` vào cuối lệnh `tar -xzf`.

## Cập nhật

**Luôn sao lưu trước khi cập nhật.**

### Đưa thay đổi của fork lên server

```bash
cd /opt/opengym
sudo /usr/local/bin/opengym-backup
git pull --ff-only
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:8080/api/health
```

- `--ff-only` từ chối pull nếu server có commit riêng. Đừng sửa mã nguồn trên server: sửa trên máy dev,
  push lên fork, rồi pull về.
- **Không** chạy `docker compose pull`. Nhờ file override, lệnh đó không thay được image của bạn bằng bản
  upstream, nhưng nó cũng không cập nhật được app: image `opengym-*:local` không có trên registry nào.
  Cập nhật luôn là `git pull` rồi build.
- Trình duyệt tự nhận bản mới ở lần tải trang kế tiếp. Phiên bản đang chạy hiện ở cuối trang **Cài đặt**.

### Lấy bản mới từ upstream vào fork

Làm trên **máy dev**, không làm trên server:

```bash
git fetch upstream
git switch -c merge-upstream
git merge upstream/main
# Giải quyết xung đột nếu có (dễ gặp ở frontend/src/lib/i18n-core.js, .env.example, docs/)
cd frontend && npm ci && npm test && npm run build && node scripts/check-locales.mjs
cd ../api && npm ci && npm test
cd .. && git switch main && git merge merge-upstream && git push origin main
```

Sau đó cập nhật server như mục trên.

- Chuỗi giao diện mới của upstream chưa có trong `frontend/src/locales/vi.js` sẽ hiện bằng tiếng Anh cho
  tới khi được dịch. App không lỗi.
- Tại thời điểm viết (06/11/2026), upstream đã đi trước điểm tách fork khoảng 1.500 commit. Lần merge đầu
  sẽ lớn, nên làm trên nhánh riêng như trên và chạy đủ test trước khi đưa lên server.

### Quay về bản cũ

```bash
cd /opt/opengym
git log --oneline -5                      # tìm commit đang chạy tốt trước đó
git checkout <commit>
docker compose up -d --build
```

Nếu bản mới đã kịp ghi dữ liệu theo định dạng mới, bản cũ có thể đọc sai. Khi đó hãy khôi phục luôn bản
sao lưu chụp ngay trước lúc cập nhật. Sửa xong thì `git checkout main` để lần `git pull` sau chạy bình
thường.

## Dọn ổ đĩa

Mỗi lần build để lại image cũ và cache:

```bash
df -h /opt/opengym
sudo du -sh /opt/opengym/data/uploads
docker system df
docker image prune -f                      # image không còn container nào dùng
docker builder prune -f --filter until=168h  # cache build cũ hơn 7 ngày
```

App tự từ chối upload khi ổ đĩa còn dưới 512 MB trống (`MEDIA_MIN_FREE_MB`). Ổ đầy hoàn toàn thì không
ai lưu được buổi tập nữa, nên đừng để tới mức đó.

## Giám sát

- `docker compose ps`: Docker tự kiểm tra sức khỏe container 5 phút một lần, và cột trạng thái hiện
  `healthy` hoặc `unhealthy`.
- Một dịch vụ giám sát bên ngoài (Uptime Kuma, UptimeRobot…) gọi `https://gym.example.com/api/health`.
  Kết quả đúng là HTTP 200 và có `"ok":true`.
- **Bảng quản trị → nhật ký hoạt động**: nhiều lần đăng nhập thất bại liên tiếp là dấu hiệu có người dò
  tài khoản.

## Chuyển sang server mới

Nếu giữ nguyên tên miền và `data/secret`, passkey, phiên đăng nhập và điện thoại đã ghép nối đều tiếp
tục hoạt động.

1. Server mới: làm [bước 1](1-SERVER.md), rồi ở [bước 2](2-INSTALL.md) làm mục 1–2 (clone, override).
   **Chưa** chạy `up`.
2. Server cũ: `docker compose down`, rồi `sudo /usr/local/bin/opengym-backup`.
3. Chép file sao lưu sang server mới. File thuộc root, nên trước tiên chép nó ra thư mục home:
   `sudo cp /var/backups/opengym/opengym-….tar.gz ~ && sudo chown "$USER" ~/opengym-….tar.gz`. Sau đó
   `scp` sang server mới và giải nén vào `/opt/opengym`:
   `sudo tar -xzf opengym-….tar.gz -C /opt/opengym`. Lệnh này lấy lại cả `data/`, `.env` và override.
   Xóa bản chép trong home ở cả hai server khi đã xong.
4. Server mới: `docker compose up -d --build`, rồi cài Caddy hoặc tunnel như [bước 3](3-HTTPS.md).
5. Trỏ DNS sang IP mới. Caddy trên server mới tự xin chứng chỉ khi DNS đã trỏ tới.
6. Để server cũ **dừng** vài ngày rồi mới xóa. Đừng chạy cả hai cùng lúc: mỗi bên sẽ nhận một phần dữ
   liệu và không gộp lại được.

## Thay đổi cấu hình thường gặp

Sửa `.env`, rồi chạy `docker compose up -d`.

| Muốn | Biến |
|---|---|
| Thêm admin | `ADMIN_UIDS=id1,id2` |
| Chỉ cho người có mã mời tạo hồ sơ | `INVITE_ONLY=1` |
| Bỏ chế độ khách | `ALLOW_GUEST=0` |
| Cho đăng nhập bằng mật khẩu | `PASSWORD_LOGIN=1`, xem [bước 3](3-HTTPS.md) |
| Phiên đăng nhập ngắn hơn (mặc định 90 ngày) | `SESSION_DAYS=30` |
| Ghi địa chỉ IP vào nhật ký | `AUDIT_IP=net` (chỉ dải mạng) hoặc `AUDIT_IP=full` |
| Giảm dung lượng upload mỗi hồ sơ (mặc định 200 MB) | `MEDIA_QUOTA_MB=50` |
| Tắt upload ảnh/video | `MEDIA_UPLOADS=0` |
| Bật AI Coach | Xem [AI_COACH.md](../AI_COACH.md) |

Giải thích đầy đủ từng biến nằm trong [`.env.example`](../../.env.example) và
[SELF_HOSTING.md](../SELF_HOSTING.md).
