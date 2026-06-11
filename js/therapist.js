// js/therapist.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Autentikasi
    const user = checkAuth('therapist');
    if (!user) return;

    // Setup UI
    const userNameEl = document.getElementById('userName');
    const userInitialEl = document.getElementById('userInitial');
    const userRatingEl = document.getElementById('userRating');
    const statusSwitch = document.getElementById('statusSwitch');
    const statusLabel = document.getElementById('statusLabel');
    const totalOrderEl = document.getElementById('totalOrder');
    const orderList = document.getElementById('orderList');

    if (userNameEl) userNameEl.textContent = user.nama;
    
    // Setup Avatar (Foto Terapis)
    const setAvatar = (userData) => {
        if (!userInitialEl) return;
        let fotoUrl = userData.foto || userData.Foto || userData.FOTO || '';
        if (fotoUrl && fotoUrl.includes('drive.google.com/file/d/')) {
            try {
                const fileId = fotoUrl.split('/d/')[1].split('/')[0];
                if (fileId) fotoUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
            } catch(e) {}
        }
        
        if (fotoUrl) {
            userInitialEl.innerHTML = `<img src="${fotoUrl}" alt="Avatar" onclick="showImageModal('${fotoUrl}')" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:2px solid var(--color-primary); cursor:pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">`;
            // Remove text content color properties if needed, but innerHTML replaces it
        } else {
            userInitialEl.textContent = userData.nama ? userData.nama.charAt(0).toUpperCase() : 'T';
        }
    };
    
    setAvatar(user);
    if (userRatingEl) userRatingEl.textContent = user.rating || '5.0';

    // Format Rupiah
    const formatRp = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    };

    const userSaldoEl = document.getElementById('userSaldo');
    if (userSaldoEl) userSaldoEl.textContent = formatRp(user.saldo || 0);

    // Refresh data user di background (agar saldo terbaru langsung update)
    API.request('login', { no_wa: user.no_wa, role: 'therapist' }).then(res => {
        if (res.success && res.data) {
            Object.assign(user, res.data);
            const session = JSON.parse(localStorage.getItem('userSession'));
            session.data = user;
            localStorage.setItem('userSession', JSON.stringify(session));
            if (userSaldoEl) userSaldoEl.textContent = formatRp(user.saldo || 0);
            if (userNameEl) userNameEl.textContent = user.nama;
            if (userRatingEl) userRatingEl.textContent = user.rating || '5.0';
            setAvatar(user); // Update avatar if changed
        }
    });

    // Initialize Status
    if (user.status === 'Online') {
        statusSwitch.checked = true;
        statusLabel.textContent = 'Online';
        statusLabel.className = 'font-bold text-success';
        statusLabel.style.color = 'var(--status-success)';
    }

    // Toggle Status
    statusSwitch.addEventListener('change', async (e) => {
        const isOnline = e.target.checked;
        const newStatus = isOnline ? 'Online' : 'Offline';
        
        statusLabel.textContent = newStatus;
        statusLabel.style.color = isOnline ? 'var(--status-success)' : 'var(--text-muted)';
        
        try {
            await API.request('updateTherapistStatus', { therapist_id: user.id, status: newStatus });
            user.status = newStatus;
            const session = JSON.parse(localStorage.getItem('userSession'));
            session.data = user;
            localStorage.setItem('userSession', JSON.stringify(session));
        } catch (err) {
            console.error('Failed to update status', err);
            // Revert UI on error
            e.target.checked = !isOnline;
            statusLabel.textContent = isOnline ? 'Offline' : 'Online';
        }
    });

    // Mobile Sidebar Toggle
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

    // Load Orders
    async function loadOrders() {
        try {
            const response = await API.request('getOrders', { therapist_id: user.id });
            if (response.success) {
                const orders = response.data;
                const completedOrders = orders.filter(o => o.status === 'Selesai');
                if (totalOrderEl) totalOrderEl.textContent = completedOrders.length;

                orderList.innerHTML = '';
                if (orders.length === 0) {
                    orderList.innerHTML = '<div class="text-center text-muted p-4">Belum ada order.</div>';
                    return;
                }

                orders.forEach(order => {
                    let actionButtons = '';
                    let statusColor = 'var(--status-info)';
                    
                    if (order.status === 'Menunggu' || order.status === 'Diproses') {
                        actionButtons = `
                            <button class="btn btn-sm" style="background-color: var(--status-warning); color: white;" onclick="updateOrderStatus('${order.order_id}', 'Dalam Perjalanan')">
                                <i class="fa-solid fa-car"></i> OTW
                            </button>
                            <button class="btn btn-sm" style="background-color: var(--status-success); color: white;" onclick="updateOrderStatus('${order.order_id}', 'Selesai')">
                                <i class="fa-solid fa-check"></i> Selesai
                            </button>
                            <button class="btn btn-sm btn-outline" style="color: var(--status-danger); border-color: var(--status-danger);" onclick="updateOrderStatus('${order.order_id}', 'Dibatalkan')">
                                Batal
                            </button>
                        `;
                    } else if (order.status === 'Dalam Perjalanan') {
                        actionButtons = `
                            <button class="btn btn-sm" style="background-color: var(--status-success); color: white;" onclick="updateOrderStatus('${order.order_id}', 'Selesai')">
                                <i class="fa-solid fa-check"></i> Selesai
                            </button>
                        `;
                        statusColor = 'var(--status-warning)';
                    } else if (order.status === 'Selesai') {
                        statusColor = 'var(--status-success)';
                    } else if (order.status === 'Dibatalkan') {
                        statusColor = 'var(--status-danger)';
                    }

                    const card = document.createElement('div');
                    card.className = 'order-card';
                    card.style.borderLeftColor = statusColor;
                    card.innerHTML = `
                        <div class="flex justify-between items-start mb-4 flex-wrap gap-2">
                            <div>
                                <h4 class="font-bold text-lg mb-1">${order.layanan}</h4>
                                <div class="text-sm text-muted"><i class="fa-solid fa-clock"></i> ${new Date(order.jadwal).toLocaleString('id-ID')}</div>
                            </div>
                            <span class="badge" style="background-color: ${statusColor}; color: white;">${order.status}</span>
                        </div>
                        <div class="grid" style="grid-template-columns: 1fr; gap: 0.5rem; margin-bottom: 1rem;">
                            <div class="text-sm"><i class="fa-solid fa-user text-muted mr-2"></i> ${order.nama_customer} (${order.no_wa})</div>
                            <div class="text-sm"><i class="fa-solid fa-location-dot text-muted mr-2"></i> ${order.alamat}</div>
                            ${order.catatan ? `<div class="text-sm text-warning"><i class="fa-solid fa-note-sticky text-muted mr-2"></i> Catatan: ${order.catatan}</div>` : ''}
                        </div>
                        <div class="flex justify-between items-center mt-4 pt-4" style="border-top: 1px solid var(--border-color);">
                            <div class="font-bold text-accent">${formatRp(order.harga)}</div>
                            <div class="flex gap-2">${actionButtons}</div>
                        </div>
                    `;
                    orderList.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Failed to load orders', err);
            orderList.innerHTML = '<div class="text-center text-danger p-4">Gagal memuat data order.</div>';
        }
    }

    loadOrders();

    // Global function for buttons
    window.updateOrderStatus = async (orderId, status) => {
        if(confirm(`Ubah status order menjadi ${status}?`)) {
            try {
                const res = await API.request('updateOrderStatus', { order_id: orderId, status: status });
                if(res.success) {
                    loadOrders(); // reload
                } else {
                    alert('Gagal mengupdate status');
                }
            } catch(e) {
                alert('Error jaringan');
            }
        }
    };
});
