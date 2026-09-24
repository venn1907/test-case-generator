# CP Test Forge

Website tạo input ngẫu nhiên theo cấu trúc bài Competitive Programming, chạy solution bằng compiler self-hosted và xuất bộ test `.in` / `.out` thành ZIP.

## Chạy bằng Docker Desktop trên Windows

Yêu cầu: Docker Desktop trên Windows hoặc Docker Engine trên Linux.

```bash
git clone <repository-url>
cd test-case-generator
docker compose up -d --build
```

Lần đầu Docker cần tải image Piston và cài các runtime GCC, Java, Python, Node.js nên có thể mất vài phút. Xem trạng thái:

```bash
docker compose ps
docker compose logs -f piston-setup piston
```

Mở:

- Website: http://localhost:8080
- Piston API: http://localhost:2000/api/v2/runtimes

Dừng hệ thống (giữ database):

```bash
docker compose down
```

Xóa cả runtime Piston đã tải và dữ liệu compiler:

```bash
docker compose down -v
```

> Không đưa cổng compiler `2000` ra Internet nếu chưa bổ sung firewall và authentication.

### Vì sao mặc định dùng Piston trên Windows?

Docker Desktop trên Windows dùng Linux kernel WSL2 với cgroup v2. Judge0 CE 1.13.1 đóng gói Isolate 1.8.1 chỉ dùng đường dẫn cgroup v1, nên container vẫn khởi động nhưng submission lỗi `No such file or directory @ rb_sysopen - /box/main.cpp`. Piston hỗ trợ cgroup v2 và phù hợp để chạy local trên Docker Desktop.

Judge0 vẫn có sẵn dưới Compose profile cho máy Linux đã cấu hình cgroup v1:

```bash
EXECUTION_ENGINE=judge0 docker compose --profile judge0 up -d --build
```

Trong PowerShell:

```powershell
$env:EXECUTION_ENGINE = "judge0"
docker compose --profile judge0 up -d --build
```

Không dùng profile Judge0 trên Docker Desktop Windows.

## Cách dùng

1. Chọn mẫu hoặc thêm các khối input: biến, mảng, ma trận, đồ thị, cây, văn bản.
2. Dùng tên biến đã khai báo trong các ô kích thước, ví dụ `n`, `m`, hoặc biểu thức `n-1`.
3. Bật **Nhiều test trong mỗi file** để hệ thống tự in `t` rồi lặp các khối ở phần **Mỗi test**.
4. Sinh và kiểm tra từng file input.
5. Dán solution, chọn ngôn ngữ, chạy toàn bộ test.
6. Tải ZIP gồm `001.in`, `001.out`, `002.in`, `002.out`, ...

Seed có thể là số hoặc chuỗi. Seed và cấu hình giống nhau sẽ cho dữ liệu giống nhau.

Các chế độ dữ liệu thường dùng đã có sẵn:

- Mảng: sinh đều hoặc ưu tiên cận biên; hỗ trợ không trùng, tăng, giảm, hoán vị `1..n`, nhị phân, tất cả bằng nhau và chỉ lấy min/max.
- Ma trận: sinh phần tử đều hoặc ưu tiên cận biên; hỗ trợ ma trận ngẫu nhiên, nhị phân, đơn vị và đối xứng.
- Đồ thị: liên thông, có hướng, DAG, hai phía, trọng số, self-loop, đa cạnh và đánh số đỉnh từ `0`.
- Cây: ngẫu nhiên, đường thẳng, hình sao, cây nhị phân, trọng số và đánh số đỉnh từ `0`.
- Biến: ngẫu nhiên đều trong khoảng hoặc ưu tiên sinh các giá trị cận biên.
- Văn bản: nội dung cố định, chuỗi ngẫu nhiên hoặc chuỗi ưu tiên ký tự ở hai đầu tập ký tự.

## Ngôn ngữ mặc định

Các runtime Piston được tự động cài trong lần khởi động đầu tiên:

| Chọn trên web | Package/runtime |
|---|---|
| C++17 | GCC 10.2.0 |
| C | GCC 10.2.0 |
| Java | OpenJDK 15.0.2 |
| Python 3 | Python 3.12.0 |
| JavaScript | Node.js 20.11.1 |

Có thể sửa mapping trong `server/index.js` và danh sách cài đặt trong `server/piston-setup.js`.

## Phát triển không dùng Docker

```bash
npm install
PISTON_URL=http://localhost:2000 npm run dev
```

Trên PowerShell:

```powershell
$env:PISTON_URL = "http://localhost:2000"
npm run dev
```

Website chạy tại http://localhost:3000.

## Kiến trúc

- `public/`: giao diện tĩnh và generator chạy trên trình duyệt.
- `server/`: API Node.js; proxy chạy code sang compiler local và tạo ZIP.
- `docker-compose.yml`: app, Piston; kèm profile Judge0 tùy chọn.
- Dữ liệu cấu hình builder được lưu trong `localStorage`; source code và test không được lưu phía server.

## Giới hạn an toàn

- Tối đa 100 file/lần và 1 MB mỗi input khi gửi chạy.
- Mỗi submission mặc định 5 giây CPU, 15 giây wall time, 256 MB RAM.
- Code được chạy trong sandbox compiler local, không gửi tới dịch vụ bên thứ ba.
- Backend chạy tuần tự từng input để tránh làm đầy hàng đợi trên máy cá nhân.
