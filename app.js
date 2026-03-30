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
            jth_tempo: new Date().toISOString().substr(0, 10), 
            memo: '', 
            tanggal: new Date().toISOString().substr(0, 10),
            penerima_nama: '', 
            penerima_alamat1: '', 
            penerima_alamat2: '', 
            sales: '[NONE]', 
            cetak_oleh: '', 
            cetak_jam: new Date().toTimeString().substr(0, 5)
        });

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

        const filteredItems = computed(() => {
            if (!searchQuery.value || searchQuery.value.trim() === '') return [];
            const query = searchQuery.value.toLowerCase().trim();
            return allItems.value.filter(item => {
                const b = item.barcode ? String(item.barcode).toLowerCase() : '';
                const p = item.produk ? String(item.produk).toLowerCase() : '';
                return b.includes(query) || p.includes(query);
            }).slice(0, 10);
        });

        const addItem = (item, customQty = 1) => {
            const exists = selectedItems.value.find(i => i.barcode === item.barcode);
            if (exists) {
                exists.qty = Number(exists.qty) + Number(customQty);
                calculateRow(selectedItems.value.indexOf(exists));
                return;
            }
            const hargaFix = Number(item.harga.toString().replace(/[^0-9.-]+/g,"")) || 0;
            const qtyFix = Number(customQty) || 1;
            selectedItems.value.push({ 
                ...item, qty: qtyFix, disc_p: 0, disc_rp: 0, 
                harga: hargaFix, jumlah: hargaFix * qtyFix
            });
            searchQuery.value = '';
            showDropdown.value = false;
        };

        const calculateRow = (idx) => {
            const item = selectedItems.value[idx];
            const qty = Number(item.qty) || 0;
            const harga = Number(item.harga) || 0;
            const discP = Number(item.disc_p) || 0;
            item.disc_rp = (qty * harga) * (discP / 100);
            item.jumlah = (qty * harga) - item.disc_rp;
        };

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

        const handleFileUpload = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            importStatus.value = { type: 'info', message: 'Memproses file...' };
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let text = e.target.result;
                    if (text.charCodeAt(0) === 0xFEFF) text = text.substr(1);
                    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
                    let successCount = 0, failCount = 0;
                    const failedBarcodes = [];
                    const startIndex = lines[0].toLowerCase().includes('barcode') ? 1 : 0;
                    const delimiter = lines[startIndex] && lines[startIndex].includes(';') ? ';' : ',';
                    for (let i = startIndex; i < lines.length; i++) {
                        const parts = lines[i].split(delimiter).map(p => p.trim());
                        if (parts.length < 2) continue;
                        let barcode = parts[0].replace(/^["']|["']$/g, '').trim();
                        let qtyRaw = parts[1].replace(/^["']|["']$/g, '').trim().replace(',', '.');
                        const qty = parseFloat(qtyRaw) || 1;
                        let discP = 0;
                        if (parts.length >= 3) {
                            let discRaw = parts[2].replace(/^["']|["']$/g, '').trim().replace(',', '.');
                            discP = Math.max(0, Math.min(100, parseFloat(discRaw) || 0));
                        }
                        const product = allItems.value.find(item => String(item.barcode).trim() === String(barcode).trim());
                        if (product) {
                            const existingItem = selectedItems.value.find(i => i.barcode === product.barcode);
                            if (existingItem) {
                                existingItem.qty = Number(existingItem.qty) + Number(qty);
                                existingItem.disc_p = discP;
                                calculateRow(selectedItems.value.indexOf(existingItem));
                            } else {
                                const hargaFix = Number(product.harga.toString().replace(/[^0-9.-]+/g,"")) || 0;
                                const qtyFix = Number(qty) || 1;
                                const discPFix = Number(discP) || 0;
                                const discRp = (qtyFix * hargaFix) * (discPFix / 100);
                                selectedItems.value.push({ 
                                    ...product, qty: qtyFix, disc_p: discPFix, 
                                    disc_rp: discRp, harga: hargaFix, jumlah: (qtyFix * hargaFix) - discRp
                                });
                            }
                            successCount++;
                        } else {
                            failCount++;
                            failedBarcodes.push(barcode);
                        }
                    }
                    if (successCount > 0 && failCount === 0) {
                        importStatus.value = { type: 'success', message: `✓ Berhasil import ${successCount} item` };
                    } else if (successCount > 0 && failCount > 0) {
                        importStatus.value = { type: 'warning', message: `⚠ Import ${successCount} berhasil, ${failCount} gagal (${failedBarcodes.slice(0,5).join(', ')}${failedBarcodes.length > 5 ? '...' : ''})` };
                    } else {
                        importStatus.value = { type: 'error', message: `✗ Semua barcode tidak ditemukan. Contoh: ${failedBarcodes.slice(0,3).join(', ')}` };
                    }
                    setTimeout(() => { importStatus.value = null; }, 8000);
                } catch (error) {
                    importStatus.value = { type: 'error', message: `✗ Error: ${error.message}` };
                }
            };
            reader.readAsText(file);
        };

        const clearFile = () => {
            document.getElementById('csvFile').value = '';
            importStatus.value = null;
        };

        const clearAllItems = () => {
            if (selectedItems.value.length === 0) { alert('Tidak ada item yang perlu dihapus.'); return; }
            if (confirm(`Apakah Anda yakin ingin menghapus semua ${selectedItems.value.length} item?`)) {
                selectedItems.value = [];
            }
        };

        const formatJthTempo = () => {
            if (!meta.jth_tempo || !meta.tanggal) return '@';
            const tglInv = new Date(meta.tanggal);
            const tglJth = new Date(meta.jth_tempo);
            const diffDays = Math.ceil((tglJth - tglInv) / (1000 * 60 * 60 * 24));
            return `${diffDays} Hari (${meta.jth_tempo.split('-').reverse().join('-')})`;
        };

        const pages = computed(() => {
            const itemsPerPage = 8;
            const res = [];
            for (let i = 0; i < selectedItems.value.length; i += itemsPerPage) {
                res.push(selectedItems.value.slice(i, i + itemsPerPage));
            }
            return res.length > 0 ? res : [[]];
        });

        const grandTotal = computed(() => {
            return selectedItems.value.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0);
        });

        const getGlobalItemNumber = (pageIdx, itemIdx) => (pageIdx * 8) + itemIdx + 1;

        // Download PDF: render setiap pasang 2 nota sebagai 1 halaman A4
        const downloadPDF = async () => {
            const allPages = document.querySelectorAll('.invoice-page');
            if (allPages.length === 0) { alert('Tidak ada invoice untuk di-download.'); return; }

            const { jsPDF } = window.jspdf;
            // Gunakan jsPDF langsung jika tersedia, fallback ke html2pdf
            // A4: 210mm x 297mm
            const pdfDoc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const A4_WIDTH_MM = 210;
            const A4_HEIGHT_MM = 297;
            const NOTA_HEIGHT_MM = 148; // A5 landscape = setengah A4

            let isFirstPage = true;

            for (let i = 0; i < allPages.length; i += 2) {
                const nota1 = allPages[i];
                const nota2 = allPages[i + 1] || null;

                if (!isFirstPage) {
                    pdfDoc.addPage();
                }
                isFirstPage = false;

                // Render nota pertama (atas)
                const canvas1 = await html2canvas(nota1, { 
                    scale: 2, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    width: nota1.offsetWidth,
                    height: nota1.offsetHeight
                });
                const img1 = canvas1.toDataURL('image/jpeg', 0.98);
                pdfDoc.addImage(img1, 'JPEG', 0, 0, A4_WIDTH_MM, NOTA_HEIGHT_MM);

                // Render nota kedua (bawah) jika ada
                if (nota2) {
                    const canvas2 = await html2canvas(nota2, { 
                        scale: 2, 
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        width: nota2.offsetWidth,
                        height: nota2.offsetHeight
                    });
                    const img2 = canvas2.toDataURL('image/jpeg', 0.98);
                    pdfDoc.addImage(img2, 'JPEG', 0, NOTA_HEIGHT_MM, A4_WIDTH_MM, NOTA_HEIGHT_MM);
                }
            }

            pdfDoc.save('Invoice.pdf');
        };

        return {
            meta, searchQuery, showDropdown, selectedItems, filteredItems, importStatus,
            updateAlamat, addItem, calculateRow, formatJthTempo, pages, grandTotal,
            getGlobalItemNumber, handleFileUpload, clearFile, clearAllItems,
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
            downloadPDF
        };
    }
}).mount('#app');
