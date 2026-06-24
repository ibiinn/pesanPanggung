# 🔐 Fitur Admin - Live Chat

Program live chat ini sekarang dilengkapi dengan fitur admin yang lengkap untuk mengelola pesan dan user!

## 📍 Cara Akses Admin Panel

Buka browser dan pergi ke:
```
http://localhost:3000/admin
```

## 🔑 Password Admin

Default password admin adalah: **`admin123`**

⚠️ **PENTING:** Ganti password default ini! Edit file `server.js` baris 8:
```javascript
const ADMIN_PASSWORD = "admin123"; // Ganti dengan password yang lebih aman
```

## 🛠️ Fitur Admin yang Tersedia

### 1. **Dashboard Admin**
   - Melihat total pesan yang dikirim
   - Melihat total user yang aktif
   - Melihat total user yang di-ban

### 2. **Kelola Pesan**
   - 👁️ Lihat semua pesan real-time
   - 🗑️ Hapus pesan individual
   - 🗑️ **Hapus SEMUA pesan** sekaligus
   - Setiap pesan menampilkan: username, teks pesan, dan waktu

### 3. **Ban User**
   - 🚫 Ban username tertentu (user tidak bisa kirim pesan lagi)
   - ✅ Unban username (untuk membuka akses kembali)
   - User yang di-ban tidak bisa mengirim pesan apapun
   - Lihat daftar semua user yang ter-ban

### 4. **Real-time Updates**
   - Auto-refresh setiap 2 detik
   - Tombol refresh manual untuk update instant
   - Data selalu up-to-date dengan perubahan dari user lain

## 📊 Cara Menggunakan Admin Panel

### Login Admin
1. Buka `http://localhost:3000/admin`
2. Masukkan password admin (`admin123`)
3. Klik "Login"

### Hapus Pesan
1. Lihat daftar pesan di bawah
2. Klik tombol **"Hapus"** pada pesan yang ingin dihapus
3. Konfirmasi penghapusan
4. Pesan akan langsung hilang dari layar display

### Ban User
1. Klik tombol **"Ban"** di samping pesan dari user yang ingin di-ban
2. Konfirmasi tindakan
3. User tersebut tidak bisa mengirim pesan lagi
4. Lihat di section "User yang Di-Ban" untuk melihat daftar

### Unban User
1. Lihat section "⛔ User yang Di-Ban"
2. Klik tombol **"Unban"** di sebelah nama user
3. User bisa kembali mengirim pesan

### Hapus Semua Pesan
1. Klik tombol **"🗑️ Hapus Semua Pesan"**
2. Konfirmasi 2x untuk keamanan
3. Semua pesan akan terhapus

## 🌐 URL Penting

| Halaman | URL | Deskripsi |
|---------|-----|-----------|
| Display Pesan | `http://localhost:3000/` | Layar display untuk menampilkan pesan |
| Form Kirim | `http://localhost:3000/send` | Form untuk user mengirim pesan |
| Admin Panel | `http://localhost:3000/admin` | Panel admin untuk moderasi |

## 📱 Cara Menggunakan Aplikasi Lengkap

### Untuk User Biasa:
1. Buka `http://localhost:3000/send`
2. Masukkan username (max 10 karakter)
3. Tulis pesan (max 20 kata)
4. Centang checkbox persetujuan
5. Klik "kirim sekarang"
6. Pesan akan muncul di layar display (`http://localhost:3000/`)

### Untuk Admin:
1. Buka `http://localhost:3000/admin`
2. Login dengan password admin
3. Kelola pesan dan user sesuai kebutuhan

## ⚙️ Konfigurasi

Anda bisa mengubah beberapa setting di file `server.js`:

- **Password Admin** (baris 8)
- **Kata-kata terlarang** (baris 12-15)
- **Max kata per pesan** (baris 7)
- **Max pesan yang ditampilkan** (baris 123)

## 🔒 Keamanan

- Password admin disimpan di server (tidak terbuka di client)
- Session admin disimpan di localStorage browser
- User banned tidak bisa bypass dengan membuat username baru dengan karakter berbeda
- Semua input di-sanitize untuk mencegah XSS attack

## 📝 Catatan

- Jika admin logout, perlu login lagi untuk akses panel
- Ban user bersifat permanent sampai di-unban
- Menghapus pesan tidak bisa dibatalkan
- Setiap aksi admin akan di-log di console server

## 🐛 Troubleshooting

### Admin panel tidak muncul?
- Pastikan password benar
- Clear browser cache
- Reload halaman

### Tombol ban tidak berfungsi?
- Pastikan sudah login sebagai admin
- Pastikan username ada di daftar pesan
- Refresh data dengan klik tombol "Refresh"

### User tidak bisa kirim pesan setelah di-ban?
- Itu normal! User sudah di-ban, jadi tidak bisa kirim pesan
- Gunakan "Unban" jika ingin buka akses kembali

---

**Selamat menggunakan Admin Panel! 🎉**
