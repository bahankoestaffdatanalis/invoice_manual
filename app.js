const { createApp, ref, computed, onMounted, reactive } = Vue;

createApp({
    setup() {
        const searchQuery = ref('');
        const showDropdown = ref(false);
        const allItems = ref([]);
        const selectedItems = ref([]);
        const meta = reactive({
            no_nota: '', jth_tempo: '', memo: '', tanggal: new Date().toISOString().substr(0, 10),
            penerima_nama: '', penerima_alamat1: '', penerima_alamat2: '', sales: '', 
            cetak_oleh: '', cetak_jam: new Date().toTimeString().substr(0, 5)
        });

        // 1. Ambil Data dari API SheetDB
        onMounted(async () => {
            try {
                const res = await fetch('https://sheetdb.io/api/v1/oqgay2m3q2f0s');
                if (!res.ok) throw new Error("Gagal ambil data API");
                const data = await res.json();
                
                // Masukkan data ke allItems agar bisa dicari
                allItems.value = data;
                console.log('Produk berhasil dimuat:', allItems.value.length);
            } catch (e) {
                console.error("Fetch Error:", e);
                alert('Gagal memuat data produk dari SheetDB!');
            }

            // Close dropdown saat klik di luar area cari
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    showDropdown.value = false;
                }
            });
        });

        const filteredItems = computed(() => {
            if (!searchQuery.value || searchQuery.value.trim() === '') return [];
            
            const query = searchQuery.value.toLowerCase().trim();
            const results = allItems.value.filter(item => {
                const barcodeMatch = item.barcode.toLowerCase().includes(query);
                const productMatch = item.produk.toLowerCase().includes(query);
                return barcodeMatch || productMatch;
            });
            
            console.log('Search query:', query, 'Results:', results.length);
            return results.slice(0, 10);
        });

        const onSearchInput = () => {
            showDropdown.value = true;
        };

        const calculateRow = (idx) => {
            const item = selectedItems.value[idx];
            item.disc_rp = (item.qty * item.harga) * (item.disc_p / 100);
            item.jumlah = (item.qty * item.harga) - item.disc_rp;
        };

        const addItem = (item) => {
            // Check if item already exists
            const exists = selectedItems.value.find(i => i.barcode === item.barcode);
            if (exists) {
                alert('Produk sudah ada dalam daftar!');
                return;
            }
            
            selectedItems.value.push({ 
                ...item, 
                qty: 1, 
                disc_p: 0, 
                disc_rp: 0, 
                jumlah: item.harga 
            });
            searchQuery.value = '';
            showDropdown.value = false;
            console.log('Item added:', item.produk);
        };

        const removeItem = (idx) => {
            if (confirm('Hapus item ini?')) {
                selectedItems.value.splice(idx, 1);
            }
        };

        const searchItem = () => {
            if (filteredItems.value.length > 0) {
                addItem(filteredItems.value[0]);
            } else {
                alert('Produk tidak ditemukan!');
            }
        };

        const formatJthTempo = () => {
            if (!meta.jth_tempo || !meta.tanggal) return '@';
            
            const tanggalInvoice = new Date(meta.tanggal);
            const tanggalJthTempo = new Date(meta.jth_tempo);
            
            const diffTime = tanggalJthTempo - tanggalInvoice;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const formattedDate = meta.jth_tempo.split('-').reverse().join('-');
            
            return `${diffDays} Hari (${formattedDate})`;
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
        }

        // Membagi items menjadi beberapa halaman, maksimal 8 item per halaman
        const pages = computed(() => {
            const itemsPerPage = 8;
            const result = [];
            for (let i = 0; i < selectedItems.value.length; i += itemsPerPage) {
                result.push(selectedItems.value.slice(i, i + itemsPerPage));
            }
            return result.length > 0 ? result : [[]];
        });

        return {
            meta, 
            updateAlamat,
            searchQuery, 
            showDropdown,
            selectedItems, 
            onSearchInput,
            searchItem, 
            calculateRow, 
            filteredItems, 
            addItem,
            removeItem,
            formatJthTempo,
            pages,
            grandTotal: computed(() => selectedItems.value.reduce((s, i) => s + i.jumlah, 0)),
            formatNumber: (n) => new Intl.NumberFormat('id-ID').format(n),
            formatCurrency: (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n),
            formatDate: (s) => s ? s.split('-').reverse().join('-') : '',
            formatDateLong: (s) => {
                if(!s) return '';
                const m = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
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
