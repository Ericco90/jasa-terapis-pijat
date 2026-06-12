// js/api.js

// URL Google Apps Script (Diisi setelah publish Web App)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxzA-UeWk9EQsJ8RpoZhKlZrAUCfmnKEORxGprrjjvz4cij3ZmjbpeCzOVryNg9LwXe/exec';

// Mode Simulasi jika GAS_URL kosong
const SIMULATION_MODE = !GAS_URL;

const API = {
    async request(action, data = {}) {
        if (SIMULATION_MODE) {
            return this.simulateRequest(action, data);
        }

        try {
            // Kita gunakan POST untuk keamanan dan pengiriman data yang lebih baik
            // Namun di GAS, terkadang POST dari browser kena CORS jika tidak pakai mode no-cors
            // Pendekatan umum untuk GAS adalah mengirim form data atau JSON via POST
            const response = await fetch(GAS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: action,
                    data: JSON.stringify(data)
                })
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // SIMULASI BACKEND LOKAL
    simulateRequest(action, data) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let response = { success: false, message: 'Unknown action' };
                
                // Ambil DB Mock dari localStorage jika ada
                let mockDB = JSON.parse(localStorage.getItem('mockDB')) || {
                    customers: [{ id: 'C001', nama: 'Budi', no_wa: '08123456789', alamat: 'Jl. Merdeka 1', saldo: 500000 }],
                    therapists: [{ id: 'T001', nama: 'Siti', no_wa: '08987654321', area: 'Jakarta', status: 'Online', rating: 4.8 }],
                    admins: [{ no_wa: 'admin123' }],
                    orders: []
                };

                switch (action) {
                    case 'login':
                        if (data.role === 'customer') {
                            const user = mockDB.customers.find(c => c.no_wa === data.no_wa);
                            if (user) response = { success: true, data: user };
                            else response = { success: false, message: 'Nomor tidak terdaftar' };
                        } else if (data.role === 'therapist') {
                            const user = mockDB.therapists.find(t => t.no_wa === data.no_wa);
                            if (user) response = { success: true, data: user };
                            else response = { success: false, message: 'Nomor tidak terdaftar' };
                        } else if (data.role === 'admin') {
                            const user = mockDB.admins.find(a => a.no_wa === data.no_wa);
                            if (user) response = { success: true, data: { nama: 'Administrator', role: 'admin' } };
                            else response = { success: false, message: 'Akses ditolak' };
                        }
                        break;
                    case 'register':
                        const exists = mockDB.customers.find(c => c.no_wa === data.no_wa);
                        if (exists) {
                            response = { success: false, message: 'Nomor sudah terdaftar' };
                        } else {
                            const newUser = {
                                id: 'C' + Date.now(),
                                nama: data.nama,
                                no_wa: data.no_wa,
                                alamat: data.alamat,
                                saldo: 0,
                                tanggal_daftar: new Date().toISOString()
                            };
                            mockDB.customers.push(newUser);
                            localStorage.setItem('mockDB', JSON.stringify(mockDB));
                            response = { success: true, message: 'Registrasi berhasil', data: newUser };
                        }
                        break;
                    case 'booking':
                        const newOrder = {
                            id: 'ORD-' + Date.now(),
                            tanggal: new Date().toISOString(),
                            customer_id: data.customer_id,
                            nama_customer: data.nama_customer,
                            no_wa: data.no_wa,
                            layanan: data.layanan,
                            harga: data.harga,
                            alamat: data.alamat,
                            jadwal: data.jadwal,
                            catatan: data.catatan,
                            status: 'Menunggu',
                            therapist_id: '', // Diassign kemudian
                            nama_therapist: ''
                        };
                        
                        // Auto Assign Mock
                        const availableTherapist = mockDB.therapists.find(t => t.status === 'Online');
                        if (availableTherapist) {
                            newOrder.therapist_id = availableTherapist.id;
                            newOrder.nama_therapist = availableTherapist.nama;
                            newOrder.status = 'Diproses'; // Langsung diproses jika dapat
                        }

                        mockDB.orders.push(newOrder);
                        
                        // Kurangi Saldo Customer
                        const cIndex = mockDB.customers.findIndex(c => c.id === data.customer_id);
                        if (cIndex >= 0) {
                            mockDB.customers[cIndex].saldo -= data.harga;
                        }

                        localStorage.setItem('mockDB', JSON.stringify(mockDB));
                        response = { success: true, message: 'Booking berhasil', data: newOrder };
                        break;
                    case 'getOrders':
                        let orders = mockDB.orders;
                        if (data.customer_id) orders = orders.filter(o => o.customer_id === data.customer_id);
                        if (data.therapist_id) orders = orders.filter(o => o.therapist_id === data.therapist_id);
                        response = { success: true, data: orders.reverse() }; // Terbaru di atas
                        break;
                    case 'updateOrderStatus':
                        const oIndex = mockDB.orders.findIndex(o => o.id === data.order_id);
                        if (oIndex >= 0) {
                            mockDB.orders[oIndex].status = data.status;
                            localStorage.setItem('mockDB', JSON.stringify(mockDB));
                            response = { success: true, message: 'Status diupdate' };
                        } else {
                            response = { success: false, message: 'Order tidak ditemukan' };
                        }
                        break;
                    case 'updateTherapistStatus':
                        const tIndex = mockDB.therapists.findIndex(t => t.id === data.therapist_id);
                        if (tIndex >= 0) {
                            mockDB.therapists[tIndex].status = data.status;
                            localStorage.setItem('mockDB', JSON.stringify(mockDB));
                            response = { success: true, message: 'Status diupdate' };
                        }
                        break;
                    case 'getCustomers':
                        response = { success: true, data: mockDB.customers };
                        break;
                    case 'getTherapists':
                        response = { success: true, data: mockDB.therapists };
                        break;
                    case 'getDashboardStats':
                        response = {
                            success: true,
                            data: {
                                totalCustomer: mockDB.customers.length,
                                totalTherapist: mockDB.therapists.length,
                                totalOrder: mockDB.orders.length,
                                pendapatan: mockDB.orders.filter(o => o.status === 'Selesai').reduce((sum, o) => sum + parseInt(o.harga), 0)
                            }
                        };
                        break;
                }
                
                console.log(`[Mock API] ${action}:`, response);
                resolve(response);
            }, 800); // Simulasi delay jaringan
        });
    }
};

// ==========================================
// BRAND SETTINGS SYNC (White-label Engine)
// ==========================================
window.applyBrandSettings = function() {
    const brandName = localStorage.getItem('brand_name') || 'Jasa Massage';
    const brandLogo = localStorage.getItem('brand_logo') || '';
    
    // Update text
    document.querySelectorAll('.brand-text').forEach(el => {
        el.textContent = brandName;
    });
    
    // Update Page Title (Replace fallback names with dynamic name)
    document.title = document.title.replace(/RelaxMassage|Jasa Massage/g, brandName);
    
    // Update Icons/Logos
    document.querySelectorAll('.brand-icon').forEach(el => {
        if (brandLogo) {
            if (el.tagName === 'I') {
                const img = document.createElement('img');
                img.src = brandLogo;
                img.className = 'brand-icon brand-logo-img';
                img.alt = brandName;
                img.style.maxHeight = '28px';
                img.style.verticalAlign = 'middle';
                el.parentNode.replaceChild(img, el);
            } else if (el.tagName === 'IMG') {
                el.src = brandLogo;
            }
        } else {
            if (el.tagName === 'IMG') {
                const i = document.createElement('i');
                i.className = 'fa-solid fa-spa brand-icon';
                el.parentNode.replaceChild(i, el);
            }
        }
    });
};

// 1. Terapkan secara instan (0ms) dari LocalStorage saat file dimuat
applyBrandSettings();

// 2. Cek database di background untuk pembaharuan
setTimeout(() => {
    API.request('getSettings').then(res => {
        if (res.success && res.data) {
            let changed = false;
            const newName = res.data.brand_name || 'Jasa Massage';
            const newLogo = res.data.brand_logo || '';
            
            if (localStorage.getItem('brand_name') !== newName) {
                localStorage.setItem('brand_name', newName);
                changed = true;
            }
            if (localStorage.getItem('brand_logo') !== newLogo) {
                localStorage.setItem('brand_logo', newLogo);
                changed = true;
            }
            if (changed) applyBrandSettings();
        }
    }).catch(e => console.log('Gagal sync settings'));
}, 500);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Resolve path assuming the app runs at the root domain
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('PWA ServiceWorker registered');
        }).catch(err => {
            console.log('PWA ServiceWorker registration failed: ', err);
        });
    });
}
