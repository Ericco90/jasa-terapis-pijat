// js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    // Cek Autentikasi Admin
    const user = checkAuth('admin');
    if (!user) return;

    // Format Rupiah
    const formatRp = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    };

    // Mobile Sidebar Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // View Navigation Logic
    const navLinks = document.querySelectorAll('.sidebar-link[data-target]');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // remove active from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // add active to clicked
            link.classList.add('active');

            // hide all views
            views.forEach(v => v.classList.remove('active'));
            // show target view
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // close sidebar on mobile
            if(window.innerWidth <= 768) sidebar.classList.remove('show');
            
            // load data depending on view
            if(targetId === 'view-dashboard') loadDashboardStats();
            else if(targetId === 'view-customers') loadCustomers();
            else if(targetId === 'view-therapists') loadTherapists();
            else if(targetId === 'view-bookings') loadBookings();
        });
    });

    // Load Data Functions
    async function loadDashboardStats() {
        try {
            const res = await API.request('getDashboardStats');
            if (res.success) {
                document.getElementById('stat-customers').textContent = res.data.totalCustomer;
                document.getElementById('stat-therapists').textContent = res.data.totalTherapist;
                document.getElementById('stat-bookings').textContent = res.data.totalOrder;
                document.getElementById('stat-revenue').textContent = formatRp(res.data.pendapatan);
                
                const statCommission = document.getElementById('stat-commission');
                if (statCommission) statCommission.textContent = formatRp(res.data.komisi);
            }
        } catch(e) {
            console.error('Failed to load stats', e);
        }
    }

    // Global function to open Google Sheets
    window.openGoogleSheets = async () => {
        try {
            const res = await API.request('getSpreadsheetUrl');
            if (res.success) {
                window.open(res.url, '_blank');
            } else {
                alert('Gagal membuka tautan database.');
            }
        } catch (e) {
            alert('Gagal menyambung ke server.');
        }
    };

    // Global function to delete order
    window.deleteOrder = async (orderId) => {
        if (confirm(`Yakin ingin menghapus pesanan ${orderId} secara permanen? Data yang dihapus tidak bisa dikembalikan.`)) {
            try {
                const res = await API.request('deleteOrder', { order_id: orderId });
                if (res.success) {
                    alert('Pesanan berhasil dihapus dari database.');
                    document.querySelector('.sidebar-link[data-target="view-bookings"]').click();
                } else {
                    alert('Gagal menghapus pesanan: ' + (res.message || 'Error'));
                }
            } catch (e) {
                alert('Error jaringan saat menghapus pesanan.');
            }
        }
    };

    // Global function to export PDF (Native Print)
    window.exportBookingsPDF = () => {
        const printWindow = window.open('', '_blank');
        const tableHtml = document.getElementById('table-bookings').outerHTML;
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Laporan Booking - Jasa Massage</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h2 { text-align: center; margin-bottom: 5px; }
                    .timestamp { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 14px; }
                    th { background-color: #f8f9fa; font-weight: bold; color: #333; }
                    /* Sembunyikan kolom aksi (kolom terakhir) saat diprint */
                    th:last-child, td:last-child { display: none; }
                    /* Styling Badge Status */
                    .badge-success { color: #10b981; font-weight: bold; }
                    .badge-warning { color: #f59e0b; font-weight: bold; }
                    .badge-danger { color: #ef4444; font-weight: bold; }
                    .badge-info { color: #3b82f6; font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>Laporan Riwayat Booking</h2>
                <div class="timestamp">Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
                ${tableHtml}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Beri jeda sebentar agar CSS termuat sebelum jendela print muncul
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    async function loadCustomers() {
        const tbody = document.querySelector('#table-customers tbody');
        try {
            const res = await API.request('getCustomers');
            if (res.success) {
                tbody.innerHTML = '';
                if(res.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada data</td></tr>';
                    return;
                }
                res.data.forEach(c => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${c.id}</td>
                            <td>${c.nama}</td>
                            <td>${c.no_wa}</td>
                            <td>${formatRp(c.saldo)}</td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="openGoogleSheets()"><i class="fa-solid fa-pen"></i> Edit di Sheets</button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
        }
    }

    async function loadTherapists() {
        const tbody = document.querySelector('#table-therapists tbody');
        try {
            const res = await API.request('getTherapists');
            if (res.success) {
                tbody.innerHTML = '';
                if(res.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada data</td></tr>';
                    return;
                }
                res.data.forEach(t => {
                    const statusClass = t.status === 'Online' ? 'badge-success' : 'badge-warning';
                    tbody.innerHTML += `
                        <tr>
                            <td>${t.id}</td>
                            <td>${t.nama}</td>
                            <td>${t.no_wa}</td>
                            <td><span class="badge ${statusClass}">${t.status}</span></td>
                            <td><i class="fa-solid fa-star text-accent"></i> ${t.rating || '5.0'}</td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="openGoogleSheets()"><i class="fa-solid fa-pen"></i> Edit di Sheets</button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data</td></tr>';
        }
    }

    async function loadBookings() {
        const tbody = document.querySelector('#table-bookings tbody');
        try {
            const res = await API.request('getOrders');
            if (res.success) {
                tbody.innerHTML = '';
                if(res.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada data</td></tr>';
                    return;
                }
                res.data.forEach(o => {
                    let badgeClass = 'badge-info';
                    if (o.status === 'Selesai') badgeClass = 'badge-success';
                    else if (o.status === 'Dibatalkan') badgeClass = 'badge-danger';
                    else if (o.status === 'Menunggu') badgeClass = 'badge-warning';

                    tbody.innerHTML += `
                        <tr>
                            <td>${o.order_id}</td>
                            <td>${o.nama_customer}</td>
                            <td>${o.nama_therapist || '-'}</td>
                            <td>${o.layanan}</td>
                            <td>${new Date(o.jadwal).toLocaleString('id-ID')}</td>
                            <td><span class="badge ${badgeClass}">${o.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline" style="color:var(--status-danger); border-color:var(--status-danger);" onclick="deleteOrder('${o.order_id}')"><i class="fa-solid fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data</td></tr>';
        }
    }

    // Load initial data
    loadDashboardStats();
});
