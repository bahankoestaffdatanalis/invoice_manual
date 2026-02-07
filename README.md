# Update Import CSV - Invoice CV NIO UTAMAN

## Perubahan yang Dilakukan

### 1. **Pembacaan Barcode sebagai TEXT**
   - Barcode sekarang dibaca sebagai text murni
   - Leading zeros (nol di depan) tetap terjaga
   - Contoh: barcode `0012345` tidak akan berubah jadi `12345`

### 2. **Qty dengan Format Apapun (Float Support)**
   - Qty bisa dalam format integer atau desimal
   - Mendukung koma (`,`) atau titik (`.`) sebagai pemisah desimal
   - Contoh: `5`, `5.5`, `5,5`, `"3.75"`, `'2,25'`
   - Koma akan otomatis dikonversi ke titik untuk parsing
   - Jika qty tidak valid, otomatis menjadi `1`

### 3. **Kolom Disc % (Opsional, Float Support)**
   - Ditambahkan support untuk kolom ke-3: disc %
   - Format CSV bisa: `barcode;qty` atau `barcode;qty;disc%`
   - Disc % juga support desimal: `10`, `10.5`, `10,25`
   - Koma otomatis dikonversi ke titik
   - Disc % akan otomatis dibatasi antara 0-100
   - Jika tidak ada kolom disc, default = 0

### 4. **Support Multi-Delimiter**
   - Mendukung delimiter `;` (semicolon) dan `,` (comma)
   - Prioritas: semicolon > comma
   - Otomatis terdeteksi dari baris pertama data

## Format CSV yang Didukung

### Format 1: Barcode + Qty (tanpa disc)
```csv
barcode;qty
8992993524811;5
8992772100489;3
8992752016786;10
```

### Format 2: Barcode + Qty + Disc % (dengan disc, float support)
```csv
barcode;qty;disc
8992993524811;5.5;10.25
8992772100489;3,5;15.5
8992752016786;10;5
8997020980011;2.75;12,5
```

### Format 3: Dengan header (akan di-skip otomatis)
```csv
barcode;qty;disc%
8992993524811;5;10
8992772100489;3;15
```

### Format 4: Menggunakan comma sebagai delimiter
```csv
barcode,qty,disc
8992993524811,5,10
8992772100489,3,15
```

## Contoh Penggunaan

1. **Import tanpa discount:**
   ```
   8992993524811;5
   8992772100489;3.5
   ```

2. **Import dengan discount:**
   ```
   8992993524811;5.5;10.25
   8992772100489;3,5;15.5
   ```

3. **Mixed format qty dan disc (semua valid):**
   ```
   8992993524811;5.5;10.25
   8992772100489;"3,5";15.5
   8992752016786;'10';5
   8997020980011;2.75;12,5
   ```

4. **Koma vs Titik sebagai desimal (semua valid):**
   ```
   8992993524811;5.5;10.25
   8992772100489;5,5;10,25
   ```

## Fitur Tambahan

### Handling Duplicate Barcode
- Jika barcode sudah ada di list, qty akan ditambahkan
- Disc % akan di-update dengan nilai terakhir

### Error Handling
- Barcode tidak ditemukan: ditampilkan di pesan warning
- Format qty invalid: otomatis jadi 1
- Disc % diluar range 0-100: otomatis dibatasi

### Status Import
Setelah import, akan muncul status:
- ✓ **Success** - Semua item berhasil
- ⚠ **Warning** - Sebagian berhasil, sebagian gagal
- ✗ **Error** - Semua gagal

## File yang Diupdate

1. **app.js** - Logic pembacaan CSV diperbaiki
2. **index.html** - Instruksi format CSV diupdate
3. **contoh_import.csv** - File contoh untuk testing

## Cara Testing

1. Upload file `contoh_import.csv` 
2. Pastikan semua item masuk dengan qty dan disc yang benar
3. Cek di tabel bahwa disc % teraplikasi dengan benar
4. Verifikasi perhitungan disc RP dan jumlah

## Notes

- Delimiter prioritas: `;` > `,`
- Barcode selalu dibaca sebagai text (preserve leading zeros)
- Qty dan disc % support float (desimal)
- Koma (`,`) atau titik (`.`) sebagai pemisah desimal keduanya didukung
- Koma otomatis dikonversi ke titik saat parsing
- Disc % opsional, default = 0
- Disc % dibatasi antara 0-100
- File CSV harus encoding UTF-8

## Contoh Kasus Penggunaan Float

**Kasus 1: Qty Desimal (misal produk curah/kiloan)**
```csv
barcode;qty;disc
8992993524811;2.5;0
8992772100489;1,75;5
```
Hasil: Produk 1 qty = 2.5, Produk 2 qty = 1.75

**Kasus 2: Disc Desimal (misal diskon 12.5%)**
```csv
barcode;qty;disc
8992993524811;10;12.5
8992772100489;5;7,25
```
Hasil: Disc 12.5% dan 7.25%
