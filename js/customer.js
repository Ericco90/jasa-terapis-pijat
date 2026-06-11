// js/customer.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Autentikasi
    const user = checkAuth('customer');
    if (!user) return; // akan diredirect ke login oleh checkAuth

    // Setup UI dengan data user
    const userNameEl = document.getElementById('userName');
    const userInitialEl = document.getElementById('userInitial');
    const userSaldoEl = document.getElementById('userSaldo');
    const totalOrderEl = document.getElementById('totalOrder');
    const historyTable = document.getElementById('historyTable');

    if (userNameEl) userNameEl.textContent = user.nama;
    if (userInitialEl) userInitialEl.textContent = user.nama.charAt(0).toUpperCase();

    // Format Rupiah
    const formatRp = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    };

    if (userSaldoEl) userSaldoEl.textContent = formatRp(user.saldo || 0);

    // Refresh data user di background (agar saldo terbaru dari Admin langsung update)
    API.request('login', { no_wa: user.no_wa, role: 'customer' }).then(res => {
        if (res.success && res.data) {
            // Update objek user yang sedang berjalan
            Object.assign(user, res.data);
            // Update localStorage
            const session = JSON.parse(localStorage.getItem('userSession'));
            session.data = user;
            localStorage.setItem('userSession', JSON.stringify(session));
            // Update UI
            if (userSaldoEl) userSaldoEl.textContent = formatRp(user.saldo || 0);
            if (userNameEl) userNameEl.textContent = user.nama;
        }
    });

    // Mobile Toggle Sidebar
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Global Image Modal Function
    window.showImageModal = (url) => {
        let modal = document.getElementById('imageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'imageModal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.cursor = 'zoom-out';
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.3s ease';
            
            const img = document.createElement('img');
            img.id = 'imageModalImg';
            img.style.maxWidth = '90%';
            img.style.maxHeight = '90%';
            img.style.borderRadius = '12px';
            img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
            img.style.transform = 'scale(0.9)';
            img.style.transition = 'transform 0.3s ease';
            
            modal.appendChild(img);
            
            modal.addEventListener('click', () => {
                modal.style.opacity = '0';
                img.style.transform = 'scale(0.9)';
                setTimeout(() => modal.style.display = 'none', 300);
            });
            
            document.body.appendChild(modal);
        }
        
        const img = document.getElementById('imageModalImg');
        img.src = url;
        modal.style.display = 'flex';
        // Trigger reflow for animation
        setTimeout(() => {
            modal.style.opacity = '1';
            img.style.transform = 'scale(1)';
        }, 10);
    };

    // ==========================================
    // LOGIC DASHBOARD (Ambil Data Order)
    // ==========================================
    if (historyTable) {
        try {
            const response = await API.request('getOrders', { customer_id: user.id });
            if (response.success) {
                const orders = response.data;
                if (totalOrderEl) totalOrderEl.textContent = orders.length;

                const tbody = historyTable.querySelector('tbody');
                tbody.innerHTML = '';

                if (orders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada riwayat booking.</td></tr>';
                } else {
                    orders.forEach(order => {
                        // Tentukan class badge berdasarkan status
                        let badgeClass = 'badge-info';
                        if (order.status === 'Selesai') badgeClass = 'badge-success';
                        else if (order.status === 'Dibatalkan') badgeClass = 'badge-danger';
                        else if (order.status === 'Menunggu') badgeClass = 'badge-warning';

                        let therapistHtml = '<span class="text-muted">Mencari...</span>';
                        if (order.nama_therapist) {
                            let fotoUrl = order.foto_terapis;
                            // Auto-convert Google Drive links to direct image links
                            if (fotoUrl && fotoUrl.includes('drive.google.com/file/d/')) {
                                try {
                                    const fileId = fotoUrl.split('/d/')[1].split('/')[0];
                                    if (fileId) {
                                        // Use thumbnail API which allows embedding
                                        fotoUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
                                    }
                                } catch(e) {}
                            }

                            let fotoHtml = fotoUrl 
                                ? `<img src="${fotoUrl}" alt="Foto" onclick="showImageModal('${fotoUrl}')" style="width:30px; height:30px; border-radius:50%; object-fit:cover; margin-right:8px; vertical-align:middle; cursor:pointer; border: 1px solid var(--color-primary); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">` 
                                : `<div style="display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; background-color:var(--color-primary-light); color:white; margin-right:8px; vertical-align:middle; font-size:12px; font-weight:bold;">${order.nama_therapist.charAt(0)}</div>`;
                            therapistHtml = `<div style="display:flex; align-items:center;">${fotoHtml} <span>${order.nama_therapist}</span></div>`;
                        }

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><span class="text-accent font-bold">${order.order_id}</span></td>
                            <td>${order.layanan}</td>
                            <td>${new Date(order.jadwal).toLocaleString('id-ID')}</td>
                            <td>${therapistHtml}</td>
                            <td>${formatRp(order.harga)}</td>
                            <td><span class="badge ${badgeClass}">${order.status}</span></td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    // ==========================================
    // LOGIC FORM BOOKING
    // ==========================================
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        // Pre-fill alamat dari data user
        document.getElementById('alamat').value = user.alamat || '';
        
        // Initialize elegant Calendar (Flatpickr)
        if (typeof flatpickr !== 'undefined') {
            flatpickr("#jadwal", {
                enableTime: true,
                dateFormat: "Y-m-d\\TH:i",
                minDate: "today",
                time_24hr: true,
                placeholder: "Pilih Tanggal & Waktu..."
            });
        }

        const layananSelect = document.getElementById('layanan');
        const totalHargaEl = document.getElementById('totalHarga');
        let selectedHarga = 0;

        layananSelect.addEventListener('change', (e) => {
            const option = e.target.options[e.target.selectedIndex];
            selectedHarga = parseInt(option.getAttribute('data-harga')) || 0;
            totalHargaEl.textContent = formatRp(selectedHarga);
        });

        const submitBtn = document.getElementById('submitBookingBtn');
        const bookingMsg = document.getElementById('bookingMsg');

        // Geolocation Logic
        const btnLocation = document.getElementById('btnLocation');
        const locationStatus = document.getElementById('locationStatus');
        if (btnLocation) {
            btnLocation.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    locationStatus.textContent = "Browser Anda tidak mendukung fitur lokasi.";
                    locationStatus.className = "text-danger mt-1 d-block";
                    return;
                }
                
                locationStatus.textContent = "Sedang mencari lokasi... Pastikan GPS menyala.";
                locationStatus.className = "text-warning mt-1 d-block";
                
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        document.getElementById('cust_lat').value = position.coords.latitude;
                        document.getElementById('cust_lng').value = position.coords.longitude;
                        locationStatus.innerHTML = `<i class="fa-solid fa-check text-success"></i> Lokasi berhasil didapatkan.`;
                        locationStatus.className = "text-success mt-1 d-block";
                    },
                    (error) => {
                        locationStatus.textContent = "Gagal mengambil lokasi. Pastikan izin lokasi (GPS) diberikan.";
                        locationStatus.className = "text-danger mt-1 d-block";
                    },
                    { enableHighAccuracy: true }
                );
            });
        }

        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (user.saldo < selectedHarga) {
                bookingMsg.textContent = 'Saldo Anda tidak mencukupi untuk layanan ini. Silakan top up (simulasi: hubungi admin).';
                bookingMsg.className = 'mt-4 text-center text-sm font-bold';
                bookingMsg.style.color = 'var(--status-danger)';
                bookingMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                bookingMsg.style.display = 'block';
                return; 
            }

            const payload = {
                customer_id: user.id,
                nama_customer: user.nama,
                no_wa: user.no_wa,
                layanan: layananSelect.options[layananSelect.selectedIndex].text,
                gender_preference: document.getElementById('bookingGender') ? document.getElementById('bookingGender').value : 'Bebas',
                harga: selectedHarga,
                jadwal: document.getElementById('jadwal').value,
                alamat: document.getElementById('alamat').value,
                catatan: document.getElementById('catatan').value,
                lat: document.getElementById('cust_lat').value,
                lng: document.getElementById('cust_lng').value
            };

            const origText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
            submitBtn.disabled = true;
            bookingMsg.style.display = 'none';

            try {
                const response = await API.request('booking', payload);
                if (response.success) {
                    bookingMsg.textContent = 'Booking berhasil dibuat! Terapis akan segera ditugaskan.';
                    bookingMsg.style.color = 'var(--status-success)';
                    bookingMsg.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    bookingMsg.style.display = 'block';
                    
                    // Update user session saldo if affected
                    user.saldo -= selectedHarga;
                    const session = JSON.parse(localStorage.getItem('userSession'));
                    session.data = user;
                    localStorage.setItem('userSession', JSON.stringify(session));

                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 2000);
                } else {
                    bookingMsg.textContent = response.message || 'Gagal booking.';
                    bookingMsg.style.color = 'var(--status-danger)';
                    bookingMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    bookingMsg.style.display = 'block';
                    submitBtn.innerHTML = origText;
                    submitBtn.disabled = false;
                }
            } catch (err) {
                bookingMsg.textContent = 'Terjadi kesalahan jaringan.';
                bookingMsg.style.display = 'block';
                submitBtn.innerHTML = origText;
                submitBtn.disabled = false;
            }
        });
    }

});
