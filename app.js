const { createApp, ref, computed, onMounted, reactive } = Vue;

createApp({
    setup() {
        const searchQuery = ref('');
        const showDropdown = ref(false);
        const allItems = ref([]);
        const selectedItems = ref([]);
        const importStatus = ref(null);
        const meta = reactive({
            no_nota: '', 
            jth_tempo: '', 
            memo: '', 
            tanggal: new Date().toISOString().substr(0, 10),
            penerima_nama: '', 
            penerima_alamat1: '', 
            penerima_alamat2: '', 
            sales: '', 
            cetak_oleh: '', 
            cetak_jam: new Date().toTimeString().substr(0, 5)
        });

        // 1. Ambil Data dari API SheetDB
        onMounted(async () => {
            try {
                const res = await fetch('https://sheetdb.io/api/v1/oqgay2m3q2f0s');
                if (!res.ok) throw new Error("Gagal ambil data API");
                const data = await res.json();
                
                allItems.value = data;
                console.log('Produk berhasil dimuat:', allItems.value.length);
            } catch (e) {
                console.error("Fetch Error:", e);
                alert('Gagal memuat data produk dari SheetDB!');
            }

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    showDropdown.value = false;
                }
            });
        });

        // 2. Filter Pencarian
        const filteredItems = computed(() => {
            if (!searchQuery.value || searchQuery.value.trim() === '') return [];
            const query = searchQuery.value.toLowerCase().trim();
            
            return allItems.value.filter(item => {
                const b = item.barcode ? String(item.barcode).toLowerCase() : '';
                const p = item.produk ? String(item.produk).toLowerCase() : '';
                return b.includes(query) || p.includes(query);
            }).slice(0, 10);
        });

        // 3. Tambah Item dengan Konversi Angka (PENTING)
        const addItem = (item, customQty = 1) => {
            const exists = selectedItems.value.find(i => i.barcode === item.barcode);
            if (exists) {
                // Jika sudah ada, update qty-nya
                exists.qty = Number(exists.qty) + Number(customQty);
                calculateRow(selectedItems.value.indexOf(exists));
                return;
            }
            
            // Memastikan harga adalah angka murni
            const hargaFix = Number(item.harga.toString().replace(/[^0-9.-]+/g,"")) || 0;
            const qtyFix = Number(customQty) || 1;

            selectedItems.value.push({ 
                ...item, 
                qty: qtyFix, 
                disc_p: 0, 
                disc_rp: 0, 
                harga: hargaFix,
                jumlah: hargaFix * qtyFix
            });
            searchQuery.value = '';
            showDropdown.value = false;
        };

        // 4. Kalkulasi Baris
        const calculateRow = (idx) => {
            const item = selectedItems.value[idx];
            const qty = Number(item.qty) || 0;
            const harga = Number(item.harga) || 0;
            const discP = Number(item.disc_p) || 0;

            item.disc_rp = (qty * harga) * (discP / 100);
            item.jumlah = (qty * harga) - item.disc_rp;
        };

        // 5. Update Alamat Otomatis
        const updateAlamat = () => {
            const alamatMap = {
                'Bahankoe BJM': 'Jl. Aes Nasution, Banjarmasin',
                'Bahankoe BJB': 'Jl. Panglima Batur, Banjarbaru',
                'Bahankoe PAL7': 'Jl. A. Yani No.KM 7, Banjarmasin',
                'Bahankoe KMB': 'Jl. Anang Adenansi, Banjarmasin',
                'Bahankoe GASU': 'Jl. Gatot Subroto, Banjarmasin',
                'Bahankoe MTP': 'Jl. A. Yani KM. 37,5, Martapura'
            };
            meta.penerima_alamat1 = alamatMap[meta.penerima_nama] || '';
        };

        // 6. IMPORT CSV FUNCTION - SUPPORT DELIMITER ; DAN ,
        const handleFileUpload = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            importStatus.value = { type: 'info', message: 'Memproses file...' };

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let text = e.target.result;
                    
                    // Remove BOM jika ada
                    if (text.charCodeAt(0) === 0xFEFF) {
                        text = text.substr(1);
                    }
                    
                    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
                    
                    let successCount = 0;
                    let failCount = 0;
                    const failedBarcodes = [];

                    // Skip header jika ada
                    const startIndex = lines[0].toLowerCase().includes('barcode') ? 1 : 0;

                    // Deteksi delimiter (prioritas: semicolon > comma)
                    const delimiter = lines[startIndex] && lines[startIndex].includes(';') ? ';' : ',';

                    console.log('Delimiter detected:', delimiter);
                    console.log('Total lines:', lines.length);
                    console.log('Starting from line:', startIndex);

                    for (let i = startIndex; i < lines.length; i++) {
                        const line = lines[i];
                        const parts = line.split(delimiter).map(p => p.trim());
                        
                        if (parts.length < 2) {
                            console.log('Skipping line (not enough parts):', line);
                            continue;
                        }

                        const barcode = parts[0].replace(/^["']|["']$/g, ''); // Remove quotes
                        const qty = Number(parts[1]) || 1;

                        console.log(`Processing: barcode="${barcode}", qty=${qty}`);

                        // Cari produk berdasarkan barcode di API
                        const product = allItems.value.find(item => {
                            const itemBarcode = String(item.barcode).trim();
                            const searchBarcode = String(barcode).trim();
                            return itemBarcode === searchBarcode;
                        });

                        if (product) {
                            console.log('Product found:', product.produk);
                            addItem(product, qty);
                            successCount++;
                        } else {
                            console.log('Product NOT found for barcode:', barcode);
                            failCount++;
                            failedBarcodes.push(barcode);
                        }
                    }

                    console.log('Success:', successCount, 'Failed:', failCount);

                    // Status message
                    if (successCount > 0 && failCount === 0) {
                        importStatus.value = { 
                            type: 'success', 
                            message: `✓ Berhasil import ${successCount} item` 
                        };
                    } else if (successCount > 0 && failCount > 0) {
                        importStatus.value = { 
                            type: 'warning', 
                            message: `⚠ Import ${successCount} berhasil, ${failCount} gagal (barcode tidak ditemukan: ${failedBarcodes.slice(0, 5).join(', ')}${failedBarcodes.length > 5 ? '...' : ''})` 
                        };
                    } else {
                        importStatus.value = { 
                            type: 'error', 
                            message: `✗ Semua barcode tidak ditemukan di database. Contoh barcode yang gagal: ${failedBarcodes.slice(0, 3).join(', ')}` 
                        };
                    }

                    // Clear status setelah 8 detik
                    setTimeout(() => {
                        importStatus.value = null;
                    }, 8000);

                } catch (error) {
                    console.error('Import error:', error);
                    importStatus.value = { 
                        type: 'error', 
                        message: `✗ Error: ${error.message}` 
                    };
                }
            };

            reader.readAsText(file);
        };

        const clearFile = () => {
            document.getElementById('csvFile').value = '';
            importStatus.value = null;
        };

        const formatJthTempo = () => {
            if (!meta.jth_tempo || !meta.tanggal) return '@';
            const tglInv = new Date(meta.tanggal);
            const tglJth = new Date(meta.jth_tempo);
            const diffDays = Math.ceil((tglJth - tglInv) / (1000 * 60 * 60 * 24));
            return `${diffDays} Hari (${meta.jth_tempo.split('-').reverse().join('-')})`;
        };

        // PAGINATION: Membagi items menjadi halaman-halaman dengan max 8 item per halaman
        const pages = computed(() => {
            const itemsPerPage = 8;
            const res = [];
            for (let i = 0; i < selectedItems.value.length; i += itemsPerPage) {
                res.push(selectedItems.value.slice(i, i + itemsPerPage));
            }
            return res.length > 0 ? res : [[]];
        });

        // Menghitung Grand Total secara eksplisit sebagai angka
        const grandTotal = computed(() => {
            return selectedItems.value.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0);
        });

        // Fungsi untuk mendapatkan nomor item global (untuk pagination)
        const getGlobalItemNumber = (pageIdx, itemIdx) => {
            return (pageIdx * 8) + itemIdx + 1;
        };

        return {
            meta, 
            searchQuery, 
            showDropdown, 
            selectedItems,
            filteredItems,
            importStatus,
            updateAlamat, 
            addItem, 
            calculateRow, 
            formatJthTempo, 
            pages,
            grandTotal,
            getGlobalItemNumber,
            handleFileUpload,
            clearFile,
            onSearchInput: () => { showDropdown.value = true; },
            searchItem: () => { if (filteredItems.value.length > 0) addItem(filteredItems.value[0]); },
            removeItem: (idx) => { if (confirm('Hapus item?')) selectedItems.value.splice(idx, 1); },
            formatNumber: (n) => new Intl.NumberFormat('id-ID').format(n),
            formatCurrency: (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n),
            formatDate: (s) => s ? s.split('-').reverse().join('-') : '',
            formatDateLong: (s) => {
                if(!s) return '';
                const m = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                const d = new Date(s);
                return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
            },
            printInvoice: () => window.print(),
            downloadPDF: () => {
                const element = document.getElementById('invoice-container');
                html2pdf().set({ 
                    margin: 0, 
                    filename: 'Invoice.pdf', 
                    jsPDF: { format: 'a5', orientation: 'landscape' } 
                }).from(element).save();
            }
        };
    }
}).mount('#app');
