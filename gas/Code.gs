// gas/Code.gs

// =========================================================================
// KONFIGURASI
// =========================================================================
const FONNTE_TOKEN = "TOKEN_FONNTE_ANDA_DISINI";
const ADMIN_PHONE = "08123456789"; // Ganti dengan nomor Admin

// =========================================================================
// ENTRY POINTS (WEB APP)
// =========================================================================

function doGet(e) {
  return ContentService.createTextOutput("Jasa Massage API is running.")
          .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  // Cek JSON Webhook (jika Fonnte mengirim JSON)
  if (e.postData && e.postData.type === 'application/json') {
    try {
      const payload = JSON.parse(e.postData.contents);
      if (payload.sender && payload.message) {
        return handleWebhookFonnte(payload);
      }
    } catch(err) {}
  }

  // Cek Form Data Webhook (jika Fonnte mengirim Form Data)
  if (e.parameter && e.parameter.sender && e.parameter.message) {
    return handleWebhookFonnte(e.parameter);
  }

  // Jika ini request dari Frontend Web App
  try {
    const action = e.parameter.action;
    const data = JSON.parse(e.parameter.data || '{}');
    
    let result = { success: false, message: 'Action not found' };

    switch (action) {
      case 'register':
        result = registerCustomer(data);
        break;
      case 'booking':
        result = createBooking(data);
        break;
      case 'login':
        result = handleLogin(data);
        break;
      case 'getSpreadsheetUrl':
        result = { success: true, url: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
        break;
      case 'getDashboardStats':
        result = getDashboardStats();
        break;
      case 'getCustomers':
        result = { success: true, data: getRowsData(getSheet('customers')) };
        break;
      case 'getTherapists':
        result = { success: true, data: getRowsData(getSheet('therapists')) };
        break;
      case 'getOrders':
        result = handleGetOrders(data);
        break;
      case 'updateOrderStatus':
        result = updateOrderStatus(data);
        break;
      case 'updateTherapistStatus':
        result = updateTherapistStatus(data);
        break;
      case 'deleteOrder':
        result = deleteOrder(data);
        break;
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// DATABASE HELPER (SPREADSHEET)
// =========================================================================

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Jika sheet kosong (belum ada header), tambahkan header otomatis
  if (sheet.getLastRow() === 0) {
    if (sheetName === 'customers') sheet.appendRow(['customer_id', 'nama', 'no_wa', 'alamat', 'saldo', 'tanggal_daftar']);
    else if (sheetName === 'therapists') sheet.appendRow(['therapist_id', 'nama', 'no_wa', 'area', 'status', 'rating', 'total_order', 'foto', 'titik_latitude', 'titik_longitude']);
    else if (sheetName === 'orders') sheet.appendRow(['order_id', 'tanggal', 'customer_id', 'nama_customer', 'no_wa', 'layanan', 'harga', 'alamat', 'jadwal', 'therapist_id', 'nama_therapist', 'status', 'rating', 'catatan', 'foto_terapis']);
    else if (sheetName === 'transactions') sheet.appendRow(['trx_id', 'tanggal', 'customer_id', 'jenis', 'nominal', 'keterangan']);
    else if (sheetName === 'admins') {
      sheet.appendRow(['no_wa', 'nama', 'role']);
      sheet.appendRow(['admin123', 'Administrator Utama', 'superadmin']); // Default admin
    }
  }
  
  return sheet;
}

function getRowsData(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = data[i][j];
    }
    // Simpan index baris untuk update nanti
    rowObj._rowIndex = i + 1; 
    rows.push(rowObj);
  }
  return rows;
}

// =========================================================================
// WEB API FUNCTIONS
// =========================================================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999; // Jika tidak ada kordinat, anggap sangat jauh
  const R = 6371; // Radius Bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function handleLogin(data) {
  if (data.role === 'admin') {
    const sheet = getSheet('admins');
    const rows = getRowsData(sheet);
    const user = rows.find(r => r.no_wa == data.no_wa);
    
    if (user) {
      return { success: true, data: { nama: user.nama, role: 'admin' } };
    }
    return { success: false, message: 'Akses ditolak. Nomor admin tidak ditemukan di sheet.' };
  }
  
  const sheet = getSheet(data.role === 'customer' ? 'customers' : 'therapists');
  if (!sheet) return { success: false, message: 'Role tidak valid' };
  
  const rows = getRowsData(sheet);
  const user = rows.find(r => r.no_wa == data.no_wa);
  
  if (user) {
    user.id = user.customer_id || user.therapist_id;
    return { success: true, data: user };
  }
  return { success: false, message: 'Nomor tidak terdaftar' };
}

function handleGetOrders(data) {
  const orders = getRowsData(getSheet('orders'));
  const therapists = getRowsData(getSheet('therapists'));
  
  let filtered = orders;
  if (data.customer_id) filtered = orders.filter(o => o.customer_id == data.customer_id);
  if (data.therapist_id) filtered = orders.filter(o => o.therapist_id == data.therapist_id);
  
  // Ambil foto terbaru dari tabel therapists berdasarkan nama/id
  filtered.forEach(o => {
    if (o.nama_therapist || o.therapist_id) {
      const t = therapists.find(th => 
        (o.therapist_id && th.therapist_id == o.therapist_id) || 
        (o.nama_therapist && (th.nama == o.nama_therapist || th.Nama == o.nama_therapist))
      );
      if (t) {
        // Timpa dengan foto terbaru dari database terapis
        o.foto_terapis = t.foto || t.Foto || t.FOTO || o.foto_terapis;
      }
    }
  });

  return { success: true, data: filtered.reverse() }; // Terbaru di atas
}

function getDashboardStats() {
  const customers = getRowsData(getSheet('customers'));
  const therapists = getRowsData(getSheet('therapists'));
  const orders = getRowsData(getSheet('orders'));
  const pendapatan = orders.filter(o => o.status === 'Selesai').reduce((sum, o) => sum + parseInt(o.harga || 0), 0);
  const komisi = pendapatan * 0.2;
  
  return {
    success: true, 
    data: {
      totalCustomer: customers.length,
      totalTherapist: therapists.length,
      totalOrder: orders.length,
      pendapatan: pendapatan,
      komisi: komisi
    }
  };
}

function updateOrderStatus(data) {
  const sheet = getSheet('orders');
  const rows = getRowsData(sheet);
  const order = rows.find(o => o.order_id == data.order_id);
  if (order) {
    // Column status is the 12th column (index 11) -> 1-indexed is 12
    // Let's find exactly which column it is dynamically
    const headers = sheet.getDataRange().getValues()[0];
    const statusColIndex = headers.findIndex(h => h.toString().toLowerCase() === 'status') + 1;
    if (statusColIndex > 0) {
      sheet.getRange(order._rowIndex, statusColIndex).setValue(data.status);

      // LOGIC PENDAPATAN TERAPIS (Potongan 20% hanya pada tarif dasar, ongkir full untuk terapis)
      if (data.status === 'Selesai' && order.status !== 'Selesai') {
        const totalHarga = parseInt(order.harga) || 0;
        const ongkir = parseInt(order.ongkir) || 0;
        const hargaDasar = totalHarga - ongkir;
        const komisiTerapis = (hargaDasar * 0.8) + ongkir; // Terapis mendapat 80% jasa + 100% ongkir

        const sheetTherapists = getSheet('therapists');
        const therapistsData = getRowsData(sheetTherapists);
        const therapist = therapistsData.find(t => t.therapist_id == order.therapist_id);
        
        if (therapist) {
          const tHeaders = sheetTherapists.getDataRange().getValues()[0];
          let saldoColIndex = tHeaders.findIndex(h => h.toString().toLowerCase() === 'saldo') + 1;
          
          if (saldoColIndex === 0) {
            // Buat header saldo otomatis jika belum ada
            saldoColIndex = tHeaders.length + 1;
            sheetTherapists.getRange(1, saldoColIndex).setValue('saldo');
          }
          
          const currentSaldo = parseInt(therapist.saldo) || 0;
          sheetTherapists.getRange(therapist._rowIndex, saldoColIndex).setValue(currentSaldo + komisiTerapis);
        }
        
        // Minta Rating ke Customer
        if (order.no_wa) {
           Utilities.sleep(1000); // Jeda agar tidak dianggap spam oleh Fonnte
           sendWhatsApp(order.no_wa, `*Terima Kasih!*\n\nPesanan Anda (ID: ${order.order_id}) telah selesai dikerjakan oleh Terapis ${order.nama_therapist || ''}.\n\nMohon bantu kami meningkatkan kualitas layanan dengan memberikan nilai Bintang (1-5).\n\nSilakan balas pesan ini dengan format:\n*RATING#${order.order_id}#BINTANG*\n\nContoh jika ingin memberi Bintang 5:\nRATING#${order.order_id}#5`);
        }
      }
      
      // FITUR LIVE TRACKING (OTW)
      if (data.status === 'Dalam Perjalanan' && order.status !== 'Dalam Perjalanan') {
        const sheetTherapists = getSheet('therapists');
        const therapistsData = getRowsData(sheetTherapists);
        const therapist = therapistsData.find(t => t.therapist_id == order.therapist_id);
        if (therapist && order.no_wa) {
           Utilities.sleep(1000);
           const therapistLat = therapist.titik_latitude || '';
           const therapistLng = therapist.titik_longitude || '';
           let mapLink = '';
           if (therapistLat && therapistLng) {
             mapLink = `\n\nCek posisi Terapis (Google Maps): https://www.google.com/maps?q=${therapistLat},${therapistLng}`;
           }
           sendWhatsApp(order.no_wa, `*Pemberitahuan*\n\nBersiaplah! Terapis ${order.nama_therapist || ''} saat ini sedang dalam perjalanan menuju lokasi Anda.${mapLink}`);
        }
      }
    }
    return { success: true, message: 'Status diupdate' };
  }
  return { success: false, message: 'Order tidak ditemukan' };
}

function updateTherapistStatus(data) {
  const sheet = getSheet('therapists');
  const rows = getRowsData(sheet);
  const therapist = rows.find(t => t.therapist_id == data.therapist_id);
  if (therapist) {
    const headers = sheet.getDataRange().getValues()[0];
    const statusColIndex = headers.findIndex(h => h.toString().toLowerCase() === 'status') + 1;
    if (statusColIndex > 0) {
      sheet.getRange(therapist._rowIndex, statusColIndex).setValue(data.status);
    }
    return { success: true, message: 'Status diupdate' };
  }
  return { success: false, message: 'Terapis tidak ditemukan' };
}

function registerCustomer(data) {
  const sheet = getSheet('customers');
  const rows = getRowsData(sheet);
  
  // Cek duplicate WA
  const existing = rows.find(r => r.no_wa == data.no_wa);
  if (existing) {
    return { success: false, message: 'Nomor WhatsApp sudah terdaftar' };
  }

  const customerId = 'C' + new Date().getTime();
  sheet.appendRow([
    customerId,
    data.nama,
    data.no_wa,
    data.alamat,
    0, // saldo awal
    new Date().toISOString()
  ]);

  return { success: true, message: 'Registrasi berhasil', data: { id: customerId, nama: data.nama, no_wa: data.no_wa } };
}

function createBooking(data) {
  const sheetOrders = getSheet('orders');
  const sheetTherapists = getSheet('therapists');
  
  const orderId = 'ORD-' + new Date().getTime();
  
  // Logic Auto Assign Terapis
  const therapists = getRowsData(sheetTherapists);
  // Cari terapis yang Online (Mendukung huruf besar/kecil di Google Sheets)
  let availableTherapists = therapists.filter(t => {
    const st = t.status || t.Status || t.STATUS || '';
    return st.toString().trim().toLowerCase() === 'online';
  });
  
  // Filter Gender
  if (data.gender_preference && data.gender_preference !== 'Bebas') {
    availableTherapists = availableTherapists.filter(t => {
      const g = t.gender || t.Gender || t.Jenis_Kelamin || t['Jenis Kelamin'] || '';
      return g.toString().trim().toLowerCase() === data.gender_preference.toLowerCase();
    });
  }
  
  let assignedTherapistId = '';
  let assignedTherapistName = '';
  let assignedTherapistFoto = '';
  let status = 'Menunggu';
  let ongkir = 0;
  let totalHarga = parseInt(data.harga) || 0;

  if (availableTherapists.length > 0) {
    if (data.lat && data.lng) {
      // Sort berdasarkan jarak terdekat (Km) menggunakan Haversine
      availableTherapists.forEach(t => {
        t.distance = calculateDistance(data.lat, data.lng, t.titik_latitude, t.titik_longitude);
      });
      availableTherapists.sort((a, b) => a.distance - b.distance);
      
      // Hitung Ongkir (Gratis 5km pertama, sisanya 1000/km)
      const jarakTerdekat = availableTherapists[0].distance;
      if (jarakTerdekat > 5) {
        ongkir = Math.ceil(jarakTerdekat - 5) * 1000;
        totalHarga += ongkir;
      }
    } else {
      // Fallback: Urutkan berdasarkan total order terkecil jika tidak ada lokasi
      availableTherapists.sort((a, b) => (a.total_order || 0) - (b.total_order || 0));
    }
    
    assignedTherapistId = availableTherapists[0].therapist_id || '';
    assignedTherapistName = availableTherapists[0].nama || availableTherapists[0].Nama || '';
    assignedTherapistFoto = availableTherapists[0].foto || availableTherapists[0].Foto || '';
    status = 'Diproses'; // Langsung terassign
  }

  // Potong Saldo Customer
  const sheetCustomers = getSheet('customers');
  const customersData = getRowsData(sheetCustomers);
  const customer = customersData.find(c => c.customer_id == data.customer_id);
  if (customer) {
    const headersCust = sheetCustomers.getDataRange().getValues()[0];
    const saldoColIndex = headersCust.findIndex(h => h.toString().toLowerCase() === 'saldo') + 1;
    const currentSaldo = parseInt(customer.saldo) || 0;
    if (saldoColIndex > 0) {
      sheetCustomers.getRange(customer._rowIndex, saldoColIndex).setValue(currentSaldo - totalHarga);
    }
  }

  sheetOrders.appendRow([
    orderId,
    new Date().toISOString(),
    data.customer_id,
    data.nama_customer,
    data.no_wa,
    data.layanan,
    totalHarga,
    data.alamat,
    data.jadwal,
    assignedTherapistId,
    assignedTherapistName,
    status,
    '', // rating
    data.catatan,
    assignedTherapistFoto,
    ongkir
  ]);

  // Kirim Notifikasi WA via Fonnte
  if (assignedTherapistName) {
    // Cari kolom WA terapis yang sesungguhnya apa pun nama kolomnya di Google Sheets
    let therapistPhone = '';
    for (let key in availableTherapists[0]) {
      const k = key.toLowerCase().replace(/[^a-z]/g, '');
      if (k.includes('wa') || k.includes('hp') || k.includes('telp')) {
        therapistPhone = availableTherapists[0][key];
        break;
      }
    }
    
    // Ke Terapis
    if (therapistPhone) {
      sendWhatsApp(therapistPhone, `*ORDER BARU MASUK*\n\nID: ${orderId}\nLayanan: ${data.layanan}\nJadwal: ${data.jadwal}\nAlamat: ${data.alamat}\nCustomer: ${data.nama_customer} (${data.no_wa})\nCatatan: ${data.catatan || '-'}\nOngkos Kirim: Rp ${ongkir}\nTotal Tagihan: Rp ${totalHarga}`);
    }
    
    // Ke Customer
    if (data.no_wa) {
      // Delay sedikit agar Fonnte tidak spam API
      Utilities.sleep(1000);
      sendWhatsApp(data.no_wa, `*Booking Berhasil!*\n\nPesanan Anda telah diterima oleh terapis kami.\nNama Terapis: ${assignedTherapistName}\n\nTerapis akan segera menuju lokasi Anda pada waktu yang ditentukan.\n\nBiaya Jasa: Rp ${totalHarga - ongkir}\nBiaya Transport: Rp ${ongkir}\nTotal Saldo Dipotong: Rp ${totalHarga}`);
    }
  } else {
    // Ke Admin jika tidak ada terapis
    sendWhatsApp(ADMIN_PHONE, `*ORDER WAITING*\n\nTidak ada terapis online untuk Order ${orderId}.\nCustomer: ${data.nama_customer}`);
  }

  return { success: true, message: 'Booking berhasil dibuat', order_id: orderId };
}

// =========================================================================
// FONNTE WHATSAPP INTEGRATION
// =========================================================================

function deleteOrder(data) {
  const sheet = getSheet('orders');
  const rows = getRowsData(sheet);
  const order = rows.find(o => o.order_id == data.order_id);
  
  if (order) {
    sheet.deleteRow(order._rowIndex);
    return { success: true, message: 'Pesanan berhasil dihapus' };
  }
  return { success: false, message: 'Pesanan tidak ditemukan' };
}

function sendWhatsApp(target, message) {
  if (FONNTE_TOKEN === "TOKEN_FONNTE_ANDA_DISINI") return; // Skip jika belum diset
  if (!target) return;

  const targetClean = String(target).replace(/[^0-9]/g, ''); // Hapus spasi atau - dari nomor HP

  const url = "https://api.fonnte.com/send";
  const payload = {
    "target": targetClean,
    "message": message
  };

  const options = {
    "method": "post",
    "headers": {
      "Authorization": FONNTE_TOKEN
    },
    "payload": payload
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error("Fonnte Send Error:", e);
  }
}

// Fungsi Pemicu Izin Akses (Harus Dijalankan Manual Satu Kali)
function testFonnte() {
  sendWhatsApp(ADMIN_PHONE, "Pesan Uji Coba dari Google Apps Script untuk membuka Izin Akses.");
}

function handleWebhookFonnte(data) {
  const sender = data.sender;
  const message = data.message.toUpperCase().trim();
  
  const sheetCustomers = getSheet('customers');
  const customers = getRowsData(sheetCustomers);
  const user = customers.find(c => c.no_wa == sender);

  let replyMessage = "";

  if (message === "DAFTAR") {
    replyMessage = "Untuk mendaftar, silakan kunjungi website kami atau balas pesan ini dengan format:\nREG#NamaLengkap#AlamatLengkap";
  } 
  else if (message.startsWith("REG#")) {
    const parts = message.split("#");
    if (parts.length >= 3) {
      registerCustomer({nama: parts[1], alamat: parts[2], no_wa: sender});
      replyMessage = `Registrasi berhasil untuk ${parts[1]}. Ketik LAYANAN untuk melihat menu pijat.`;
    } else {
      replyMessage = "Format salah. Gunakan: REG#NamaLengkap#AlamatLengkap";
    }
  }
  else if (message === "LAYANAN") {
    replyMessage = "*Daftar Layanan Jasa Massage:*\n1. Pijat Tradisional - Rp100.000\n2. Refleksi - Rp120.000\n3. Full Body Massage - Rp150.000\n4. Aromatherapy - Rp180.000\n\nUntuk booking, ketik BOOKING.";
  }
  else if (message.startsWith("RATING#")) {
    const parts = message.split("#");
    if (parts.length >= 3) {
      const orderId = parts[1].trim();
      const bintang = parseInt(parts[2].trim());
      
      if (bintang >= 1 && bintang <= 5) {
        const sheetOrders = getSheet('orders');
        const orders = getRowsData(sheetOrders);
        const orderToRate = orders.find(o => o.order_id.toString().toUpperCase() === orderId);
        
        if (orderToRate) {
           const headers = sheetOrders.getDataRange().getValues()[0];
           const ratingColIndex = headers.findIndex(h => h.toString().toLowerCase() === 'rating') + 1;
           if (ratingColIndex > 0) {
             sheetOrders.getRange(orderToRate._rowIndex, ratingColIndex).setValue(bintang);
             replyMessage = `Terima kasih! Penilaian ${bintang} Bintang Anda untuk Terapis ${orderToRate.nama_therapist || ''} telah kami terima.`;
             
             // Kalkulasi ulang rata-rata rating terapis
             const sheetTherapists = getSheet('therapists');
             const therapistsData = getRowsData(sheetTherapists);
             const therapist = therapistsData.find(t => t.therapist_id == orderToRate.therapist_id);
             if (therapist) {
               orderToRate.rating = bintang; // Paksa update data memori agar terhitung
               let totalBintang = 0;
               let countRating = 0;
               orders.forEach(o => {
                  if (o.therapist_id == orderToRate.therapist_id && o.rating) {
                     totalBintang += parseInt(o.rating);
                     countRating++;
                  }
               });
               if (countRating === 0) { totalBintang = bintang; countRating = 1; }
               const avgRating = (totalBintang / countRating).toFixed(1);
               const tHeaders = sheetTherapists.getDataRange().getValues()[0];
               const tRatingCol = tHeaders.findIndex(h => h.toString().toLowerCase() === 'rating') + 1;
               if (tRatingCol > 0) {
                 sheetTherapists.getRange(therapist._rowIndex, tRatingCol).setValue(avgRating);
               }
             }
           }
        } else {
           replyMessage = `Maaf, Order ID ${orderId} tidak ditemukan.`;
        }
      } else {
         replyMessage = "Format salah. Bintang harus angka 1 sampai 5. Contoh: RATING#ORD-123#5";
      }
    } else {
      replyMessage = "Format salah. Gunakan: RATING#ID_ORDER#BINTANG";
    }
  }
  else if (message === "BOOKING") {
    replyMessage = "Silakan kunjungi website kami untuk melakukan booking dengan jadwal yang akurat, atau hubungi admin di nomor ini.";
  }
  else if (message === "SALDO") {
    if (user) {
      replyMessage = `Halo ${user.nama}, saldo Anda saat ini adalah Rp${user.saldo}.`;
    } else {
      replyMessage = "Nomor Anda belum terdaftar. Ketik DAFTAR untuk registrasi.";
    }
  }
  else if (message === "RIWAYAT") {
    replyMessage = "Kunjungi website dashboard customer Anda untuk melihat detail riwayat order terbaru.";
  }
  else if (message === "BANTUAN") {
    replyMessage = "*Menu Bantuan Bot:*\n- DAFTAR\n- LAYANAN\n- BOOKING\n- SALDO\n- RIWAYAT";
  } 
  else {
    // Default reply
    replyMessage = "Maaf, perintah tidak dikenali. Ketik BANTUAN untuk melihat menu.";
  }

  // Kirim balasan menggunakan Fonnte API kembali
  sendWhatsApp(sender, replyMessage);
  
  return ContentService.createTextOutput(JSON.stringify({ status: true, message: "Webhook processed" })).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// UTILITIES UNTUK GOOGLE SHEETS
// =========================================================================

function setupPilihanOtomatis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('therapists');
  if (!sheet) return 'Sheet therapists tidak ditemukan!';
  
  const headers = sheet.getDataRange().getValues()[0];
  const genderColIndex = headers.findIndex(h => h.toString().toLowerCase() === 'gender') + 1;
  const statusColIndex = headers.findIndex(h => h.toString().toLowerCase() === 'status') + 1;
  
  // Buat Dropdown Gender (Pria / Wanita)
  if (genderColIndex > 0) {
    const genderRange = sheet.getRange(2, genderColIndex, sheet.getMaxRows() - 1, 1);
    const ruleGender = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pria', 'Wanita'], true)
      .setAllowInvalid(false)
      .build();
    genderRange.setDataValidation(ruleGender);
  }
  
  // Buat Dropdown Status (Online / Offline)
  if (statusColIndex > 0) {
    const statusRange = sheet.getRange(2, statusColIndex, sheet.getMaxRows() - 1, 1);
    const ruleStatus = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Online', 'Offline'], true)
      .setAllowInvalid(false)
      .build();
    statusRange.setDataValidation(ruleStatus);
  }
  
  return 'Berhasil membuat Dropdown Otomatis di Google Sheets!';
}
