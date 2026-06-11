// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // LOGIC UNTUK LOGIN
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const loginBtn = document.getElementById('loginBtn');
        const errorMsg = document.getElementById('errorMsg');

        // Note: we use 'submitEvent' instead of 'submit' because we dispatched it manually in login.html
        // to bypass default form submission while keeping HTML5 validation
        loginForm.addEventListener('submitEvent', async (e) => {
            e.preventDefault();
            
            const no_wa = document.getElementById('no_wa').value;
            // role from global variable in login.html
            const role = typeof currentRole !== 'undefined' ? currentRole : 'customer';

            // Loading state
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
            loginBtn.disabled = true;
            errorMsg.style.display = 'none';

            try {
                const response = await API.request('login', { no_wa, role });
                
                if (response.success) {
                    // Simpan sesi ke localStorage
                    localStorage.setItem('userSession', JSON.stringify({
                        role: role,
                        data: response.data
                    }));
                    
                    // Redirect sesuai role
                    if (role === 'customer') window.location.href = 'customer/dashboard.html';
                    else if (role === 'therapist') window.location.href = 'therapist/dashboard.html';
                    else if (role === 'admin') window.location.href = 'admin/dashboard.html';
                } else {
                    errorMsg.textContent = response.message || 'Gagal login';
                    errorMsg.style.display = 'block';
                }
            } catch (error) {
                errorMsg.textContent = 'Terjadi kesalahan jaringan.';
                errorMsg.style.display = 'block';
            } finally {
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
            }
        });

        // Also handle native submit for completeness
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loginForm.dispatchEvent(new Event('submitEvent'));
        });
    }

    // ==========================================
    // LOGIC UNTUK REGISTER (CUSTOMER)
    // ==========================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const registerBtn = document.getElementById('registerBtn');
        const errorMsg = document.getElementById('errorMsg');
        const successMsg = document.getElementById('successMsg');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nama = document.getElementById('reg_nama').value;
            const no_wa = document.getElementById('reg_no_wa').value;
            const alamat = document.getElementById('reg_alamat').value;

            // Loading state
            const originalText = registerBtn.innerHTML;
            registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mendaftar...';
            registerBtn.disabled = true;
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';

            try {
                const response = await API.request('register', { nama, no_wa, alamat });
                
                if (response.success) {
                    successMsg.style.display = 'block';
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                } else {
                    errorMsg.textContent = response.message || 'Gagal registrasi';
                    errorMsg.style.display = 'block';
                    registerBtn.innerHTML = originalText;
                    registerBtn.disabled = false;
                }
            } catch (error) {
                errorMsg.textContent = 'Terjadi kesalahan jaringan.';
                errorMsg.style.display = 'block';
                registerBtn.innerHTML = originalText;
                registerBtn.disabled = false;
            }
        });
    }

});

// Fungsi Global untuk Logout
function logout() {
    localStorage.removeItem('userSession');
    window.location.href = '../login.html'; // relative to dashboard folders
}

// Cek Sesi (Dipanggil di file dashboard masing-masing)
function checkAuth(expectedRole) {
    const session = JSON.parse(localStorage.getItem('userSession'));
    if (!session || session.role !== expectedRole) {
        window.location.href = '../login.html';
        return null;
    }
    return session.data;
}
