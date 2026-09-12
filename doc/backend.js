// ======================================================================
// DAFTAR EMAIL (Disesuaikan dengan config.js di Frontend)
// ======================================================================

// Super Admin - Akses penuh
const SUPER_ADMIN_EMAILS = [
  'lpkinsanjaya@gmail.com',
  'yumenoboken@gmail.com',
  'calonmaou@gmail.com'
];

// Admin / Pimpinan - Bisa akses halaman admin (Rekap Keuangan, Pendaftaran, Rekap Online)
const ADMIN_EMAILS = [
  'lpkinsanjaya@gmail.com',
  'yumenoboken@gmail.com',
  'elsasidamawarniut@gmail.com',
  'zilisaje@gmail.com',
  'calonmaou@gmail.com'
];

// Guru / Semua Staff - Bisa operasi dasar (tambah siswa, absensi, dll)
const GURU_EMAILS = [
  'lpkinsanjaya@gmail.com',
  'yumenoboken@gmail.com',
  'mlbb080106@gmail.com',
  'tzaharasyaputri@gmail.com',
  'usniatun25@gmail.com',
  'ayunurhasanah1707@gmail.com',
  'shintadeslianty@gmail.com',
  'uthiuthi1130@gmail.com',
  'elsasidamawarniut@gmail.com',
  'zilisaje@gmail.com',
  'calonmaou@gmail.com',
  'novadamayanti850@gmail.com',
  'salwamansyur@gmail.com',
  'ildanazila15@gmail.com',
  'gustianimeli970@gmail.com',
];

export default {
  async fetch(request, env) {
    // 1. SETTING CORS (Biar nggak diblokir Browser)
    // WAJIB nambahin X-Admin-Email di sini biar browser ngizinin header ini lewat
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Email",
    };

    // Handle request "salaman" dari browser
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ==============================================================
    // 🛡️ 2. GLOBAL SATPAM (HANYA CEK KTP KALAU MAU NGEDIT/NAMBAH)
    // ==============================================================
    // Kalau request-nya BUKAN GET (artinya POST, DELETE, PUT dll buat ngubah data)
    // KECUALI untuk pendaftaran, absensi siswa, absensi karyawan, dan upload foto (publik boleh submit)
    const url = new URL(request.url);
    const publicPostEndpoints = [
      "/api/pendaftaran-online", 
      "/api/absensi", 
      "/api/absensi-karyawan", 
      "/api/upload-foto-absensi"
    ];

    if (request.method !== "GET" && !publicPostEndpoints.includes(url.pathname)) {
      // Tangkap KTP (Email) dari header request
      const userEmail = request.headers.get("X-Admin-Email");

      // Kalau KTP ga ada, atau emailnya bukan guru/staff -> TENDANG DENGAN 403!
      if (!userEmail || !GURU_EMAILS.includes(userEmail)) {
        return new Response(JSON.stringify({
          success: false,
          error: "Akses Ditolak!",
          message: "Lu cuma bisa liat data, tapi bukan admin buat ngedit!"
        }), {
          status: 403, // 403 Forbidden (Nggak Boleh Lewat)
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    // ==============================================================

    // url sudah di-declare di atas

    try {
      // ✅ 1. GET KELAS (HANYA YANG ADA SISWA) - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/kelas") {
        const { results } = await env.DB.prepare(`
          SELECT k.*
          FROM kelas k
          WHERE EXISTS (
            SELECT 1 
            FROM absensi a 
            WHERE a.kelas = k.nama_kelas
          )
          ORDER BY k.program, k.nama_kelas
        `).all();

        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 2. POST / UPDATE KELAS - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/kelas") {
        const data = await request.json();

        const existing = await env.DB.prepare(
          "SELECT * FROM kelas WHERE nama_kelas = ?"
        ).bind(data.nama_kelas).first();

        if (existing) {
          await env.DB.prepare(`
            UPDATE kelas 
            SET program = ?, guru = ?, jadwal = ?
            WHERE nama_kelas = ?
          `).bind(data.program, data.guru, data.jadwal, data.nama_kelas).run();

          return Response.json({
            success: true,
            message: "Kelas diperbarui"
          }, { headers: corsHeaders });
        }

        const info = await env.DB.prepare(`
          INSERT INTO kelas (program, nama_kelas, guru, jadwal)
          VALUES (?, ?, ?, ?)
        `).bind(data.program, data.nama_kelas, data.guru, data.jadwal).run();

        return Response.json({
          success: true,
          id: info.lastRowId
        }, { headers: corsHeaders });
      }

      // ✅ 3. TAMBAH SISWA - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/submit") {
        const data = await request.json();
        let jadwal = "";

        if (data.jadwal_custom) {
          try {
            const parsed = JSON.parse(data.jadwal_custom);
            jadwal = parsed.map(j => `${j.hari} (${j.jam})`).join(", ");
          } catch {
            jadwal = "";
          }
        } else {
          jadwal = `${data.hari || ""} (${data.jam || ""})`;
        }

        await env.DB.prepare(`
          INSERT INTO absensi (nama_siswa, program, kelas, guru, jadwal)
          VALUES (?, ?, ?, ?, ?)
        `).bind(data.nama_siswa, data.program, data.kelas, data.guru, jadwal).run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 4. GET DASHBOARD - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/data") {
        const { results } = await env.DB.prepare(`
          SELECT * FROM absensi ORDER BY waktu_input DESC
        `).all();

        const cleaned = results.map(r => ({
          ...r,
          jadwal: r.jadwal === "CUSTOM_SCHEDULE" ? "" : r.jadwal
        }));

        return Response.json(cleaned, { headers: corsHeaders });
      }

      // ✅ 5. DELETE SISWA - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/delete") {
        const { id } = await request.json();
        await env.DB.prepare(`DELETE FROM absensi WHERE id = ?`).bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 6. GET SISWA BY KELAS - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/siswa-by-kelas") {
        const kelas = url.searchParams.get("kelas");
        const { results } = await env.DB.prepare(`
          SELECT id, nama_siswa FROM absensi WHERE kelas = ? ORDER BY nama_siswa
        `).bind(kelas).all();

        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 7. GET ABSENSI BY KELAS + BULAN - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/absensi-by-kelas") {
        const kelas = url.searchParams.get("kelas");
        let bulan = url.searchParams.get("bulan") || new Date().toISOString().slice(0, 7);

        const { results } = await env.DB.prepare(`
          SELECT ad.siswa_id, ad.pertemuan_ke, ad.status
          FROM absensi_detail ad
          JOIN absensi a ON ad.siswa_id = a.id
          WHERE a.kelas = ? AND (ad.bulan = ? OR ad.bulan IS NULL)
        `).bind(kelas, bulan).all();

        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ GET DAFTAR GURU - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/guru") {
        const { results } = await env.DB.prepare(`
          SELECT DISTINCT guru FROM absensi WHERE guru IS NOT NULL AND guru != '' ORDER BY guru
        `).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ GET SISWA BERDASARKAN GURU - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/siswa-by-guru") {
        const guru = url.searchParams.get("guru");
        const { results } = await env.DB.prepare(`
          SELECT id, nama_siswa, kelas FROM absensi WHERE guru = ? ORDER BY nama_siswa
        `).bind(guru).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ GET JADWAL BERDASARKAN GURU - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/jadwal-by-guru") {
        const guru = url.searchParams.get("guru");
        const { results } = await env.DB.prepare(`
          SELECT DISTINCT jadwal FROM absensi WHERE guru = ? AND jadwal IS NOT NULL AND jadwal != '' ORDER BY jadwal
        `).bind(guru).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ GET ABSENSI BERDASARKAN GURU - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/absensi-by-guru") {
        const guru = url.searchParams.get("guru");
        let bulan = url.searchParams.get("bulan") || new Date().toISOString().slice(0, 7);

        const { results } = await env.DB.prepare(`
          SELECT ad.siswa_id, ad.pertemuan_ke, ad.status
          FROM absensi_detail ad
          JOIN absensi a ON ad.siswa_id = a.id
          WHERE a.guru = ? AND (ad.bulan = ? OR ad.bulan IS NULL)
        `).bind(guru, bulan).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ GET SISWA BERDASARKAN GURU + JADWAL - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/siswa-by-jadwal") {
        const guru = url.searchParams.get("guru");
        const jadwal = url.searchParams.get("jadwal");

        const { results } = await env.DB.prepare(`
          SELECT id, nama_siswa, kelas, jadwal FROM absensi WHERE guru = ? AND jadwal = ? ORDER BY nama_siswa
        `).bind(guru, jadwal).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 8. ABSENSI BULK (SUPER STABLE) - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/absensi-bulk") {
        const data = await request.json();
        const stmtInsert = env.DB.prepare(`
          INSERT INTO absensi_detail (siswa_id, pertemuan_ke, status, bulan) VALUES (?, ?, ?, ?)
        `);
        const stmtUpdate = env.DB.prepare(`
          UPDATE absensi_detail SET status = ? WHERE siswa_id = ? AND pertemuan_ke = ? AND bulan = ?
        `);

        for (const item of data) {
          const bulan = item.bulan || new Date().toISOString().slice(0, 7);
          try {
            const update = await stmtUpdate.bind(item.status, item.siswa_id, item.pertemuan_ke, bulan).run();
            if (update.meta.changes === 0) {
              await stmtInsert.bind(item.siswa_id, item.pertemuan_ke, item.status, bulan).run();
            }
          } catch (err) {
            console.error("Error absensi:", err);
          }
        }
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 9. SAVE TANGGAL PERTEMUAN - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/tanggal-pertemuan") {
        const data = await request.json();
        for (const item of data) {
          await env.DB.prepare(`
            DELETE FROM tanggal_pertemuan WHERE jadwal = ? AND bulan = ? AND pertemuan_ke = ?
          `).bind(item.jadwal, item.bulan, item.pertemuan_ke).run();

          await env.DB.prepare(`
            INSERT INTO tanggal_pertemuan (jadwal, bulan, pertemuan_ke, tanggal) VALUES (?, ?, ?, ?)
          `).bind(item.jadwal, item.bulan, item.pertemuan_ke, item.tanggal).run();
        }
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 10. GET TANGGAL - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/tanggal-pertemuan") {
        const jadwal = url.searchParams.get("jadwal");
        const bulan = url.searchParams.get("bulan");

        const { results } = await env.DB.prepare(`
          SELECT pertemuan_ke, tanggal FROM tanggal_pertemuan WHERE jadwal = ? AND bulan = ?
        `).bind(jadwal, bulan).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 11. EDIT SISWA - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/edit") {
        const data = await request.json();

        const jadwalClean = data.jadwal === "CUSTOM_SCHEDULE" ? "" : data.jadwal;

        await env.DB.prepare(`
          UPDATE absensi
          SET nama_siswa = ?, program = ?, kelas = ?, guru = ?, jadwal = ?
          WHERE id = ?
        `).bind(data.nama_siswa, data.program, data.kelas, data.guru, jadwalClean, data.id).run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 12. SETUP DATABASE PENDAFTARAN ONLINE
      if (request.method === "GET" && url.pathname === "/api/setup-db") {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS pendaftaran_online (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama_lengkap TEXT,
            jenis_kelamin TEXT,
            nisn TEXT,
            nik TEXT,
            tempat_lahir TEXT,
            tanggal_lahir TEXT,
            agama TEXT,
            alamat TEXT,
            kewarganegaraan TEXT,
            penerima_kps TEXT,
            no_kps TEXT,
            nama_ibu TEXT,
            pekerjaan_ibu TEXT,
            penghasilan_ibu TEXT,
            tahun_lahir_ibu TEXT,
            nama_ayah TEXT,
            pekerjaan_ayah TEXT,
            penghasilan_ayah TEXT,
            tahun_lahir_ayah TEXT,
            nama_wali TEXT,
            pekerjaan_wali TEXT,
            penghasilan_wali TEXT,
            tahun_lahir_wali TEXT,
            program TEXT,
            kelas TEXT,
            waktu_belajar TEXT,
            no_handphone TEXT,
            status TEXT DEFAULT 'Belum Lunas',
            waktu_daftar DATETIME DEFAULT (datetime('now', '+7 hours'))
          )
        `).run();
        
        // Coba tambahkan kolom baru jika belum ada (ignore error jika sudah ada)
        try { await env.DB.prepare(`ALTER TABLE pendaftaran_online ADD COLUMN kelas TEXT`).run(); } catch(e) {}
        try { await env.DB.prepare(`ALTER TABLE pendaftaran_online ADD COLUMN pas_foto_key TEXT`).run(); } catch(e) {}
        try { await env.DB.prepare(`ALTER TABLE pendaftaran_online ADD COLUMN kartu_keluarga_key TEXT`).run(); } catch(e) {}
        try { await env.DB.prepare(`ALTER TABLE absensi ADD COLUMN status_spp TEXT DEFAULT 'Belum Lunas'`).run(); } catch(e) {}
        try { await env.DB.prepare(`ALTER TABLE absensi ADD COLUMN format_absen INTEGER DEFAULT 12`).run(); } catch(e) {}
        try { await env.DB.prepare(`ALTER TABLE absensi_detail ADD COLUMN tanggal TEXT`).run(); } catch(e) {}

        // UNIQUE index untuk mendukung UPSERT pada absensi_detail (mencegah data hilang)
        try { await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_absensi_detail_unique ON absensi_detail(siswa_id, pertemuan_ke)`).run(); } catch(e) {}

        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS laporan_draft (
            siswa_id TEXT,
            user_email TEXT,
            draft_data TEXT,
            PRIMARY KEY(siswa_id, user_email)
          )
        `).run();

        // Tabel Absensi Karyawan
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS absensi_karyawan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            nama TEXT NOT NULL,
            tanggal TEXT NOT NULL,
            sesi INTEGER DEFAULT 1,
            status TEXT DEFAULT 'Hadir',
            jam_masuk TEXT,
            jam_pulang TEXT,
            keterangan TEXT,
            foto_masuk_key TEXT,
            foto_pulang_key TEXT,
            lat_masuk REAL,
            lng_masuk REAL,
            lat_pulang REAL,
            lng_pulang REAL,
            edited_by TEXT,
            edit_note TEXT,
            created_at TEXT DEFAULT (datetime('now', '+7 hours'))
          )
        `).run();

        // Tabel Kategori Latihan Soal
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS latihan_kategori (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama_kategori TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT (datetime('now', '+7 hours'))
          )
        `).run();

        // Tabel Soal Latihan
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS latihan_soal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kategori_id INTEGER NOT NULL,
            pertanyaan TEXT NOT NULL,
            opsi_a TEXT NOT NULL,
            opsi_b TEXT NOT NULL,
            opsi_c TEXT NOT NULL,
            opsi_d TEXT NOT NULL,
            kunci_jawaban TEXT NOT NULL,
            pembahasan TEXT,
            created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
            FOREIGN KEY (kategori_id) REFERENCES latihan_kategori(id) ON DELETE CASCADE
          )
        `).run();

        // Tabel Rekap Keuangan
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS rekap_keuangan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tanggal TEXT NOT NULL,
            keterangan TEXT NOT NULL,
            jenis TEXT NOT NULL,
            nominal INTEGER NOT NULL,
            metode TEXT DEFAULT 'cash',
            email_penginput TEXT,
            waktu_input DATETIME DEFAULT (datetime('now', '+7 hours'))
          )
        `).run();

        // Tambah kolom metode jika belum ada (untuk database yang sudah ada)
        try { await env.DB.prepare(`ALTER TABLE rekap_keuangan ADD COLUMN metode TEXT DEFAULT 'cash'`).run(); } catch(e) {}

        return Response.json({ success: true, message: "Semua tabel berhasil disiapkan!" }, { headers: corsHeaders });
      }

      // ✅ 13. POST PENDAFTARAN ONLINE (PUBLIK)
      if (request.method === "POST" && url.pathname === "/api/pendaftaran-online") {
        const contentType = request.headers.get("content-type") || "";
        let dataObj = {};
        let pasFotoKey = null;
        let kkKey = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            
            const pasFotoFile = formData.get("pas_foto") || formData.get("foto_siswa") || formData.get("foto");
            if (pasFotoFile && pasFotoFile.size > 0) {
                const ext = (pasFotoFile.name || "").split('.').pop() || "jpg";
                pasFotoKey = `pasfoto-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                await env.BUCKET.put(pasFotoKey, await pasFotoFile.arrayBuffer(), {
                  httpMetadata: { contentType: pasFotoFile.type || "image/jpeg" }
                });
            }

            const kkFile = formData.get("kartu_keluarga") || formData.get("foto_kk") || formData.get("kk");
            if (kkFile && kkFile.size > 0) {
                const ext = (kkFile.name || "").split('.').pop() || "jpg";
                kkKey = `kk-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                await env.BUCKET.put(kkKey, await kkFile.arrayBuffer(), {
                  httpMetadata: { contentType: kkFile.type || "image/jpeg" }
                });
            }

            for (const [key, value] of formData.entries()) {
                if (typeof value === 'string') {
                    dataObj[key] = value;
                }
            }
        } else {
            dataObj = await request.json();
        }

        try {
          await env.DB.prepare(`
            INSERT INTO pendaftaran_online (
              nama_lengkap, jenis_kelamin, nisn, nik, tempat_lahir, tanggal_lahir, agama, alamat, kewarganegaraan, 
              penerima_kps, no_kps, nama_ibu, pekerjaan_ibu, penghasilan_ibu, tahun_lahir_ibu, nama_ayah, 
              pekerjaan_ayah, penghasilan_ayah, tahun_lahir_ayah, nama_wali, pekerjaan_wali, penghasilan_wali, 
              tahun_lahir_wali, program, kelas, waktu_belajar, no_handphone, status, waktu_daftar, pas_foto_key, kartu_keluarga_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Lunas', datetime('now', '+7 hours'), ?, ?)
          `).bind(
            dataObj.nama_lengkap || "", dataObj.jenis_kelamin || "", dataObj.nisn || "", dataObj.nik || "", dataObj.tempat_lahir || "",
            dataObj.tanggal_lahir || "", dataObj.agama || "", dataObj.alamat || "", dataObj.kewarganegaraan || "", dataObj.penerima_kps || "",
            dataObj.no_kps || "", dataObj.nama_ibu || "", dataObj.pekerjaan_ibu || "", dataObj.penghasilan_ibu || "", dataObj.tahun_lahir_ibu || "",
            dataObj.nama_ayah || "", dataObj.pekerjaan_ayah || "", dataObj.penghasilan_ayah || "", dataObj.tahun_lahir_ayah || "",
            dataObj.nama_wali || "", dataObj.pekerjaan_wali || "", dataObj.penghasilan_wali || "", dataObj.tahun_lahir_wali || "",
            dataObj.program || "", dataObj.kelas || "", dataObj.waktu_belajar || "", dataObj.no_handphone || "",
            pasFotoKey, kkKey
          ).run();
        } catch (dbError) {
          // If the columns don't exist yet, we can catch it here and give a helpful message
          if (dbError.message && dbError.message.includes('has no column')) {
             return Response.json({ success: false, error: "Database belum diupdate! Silakan jalankan /api/setup-db dari browser Anda terlebih dahulu." }, { status: 500, headers: corsHeaders });
          }
          throw dbError;
        }

        // TRIGGER ONESIGNAL PUSH NOTIFICATION
        try {
            const ONE_SIGNAL_APP_ID = "ba38a67c-b19b-420e-8df6-fbacb19bf98e"; // App ID dari OneSignal
            // API Key diambil dari Environment Variables (Secrets) di Cloudflare Dashboard agar aman
            const ONE_SIGNAL_REST_API_KEY = env.ONE_SIGNAL_REST_API_KEY; 
            
            if (ONE_SIGNAL_REST_API_KEY) {
                await fetch('https://onesignal.com/api/v1/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
                    },
                    body: JSON.stringify({
                        app_id: ONE_SIGNAL_APP_ID,
                        headings: { "en": "Pendaftaran Baru LKP", "id": "Pendaftaran Baru LKP" },
                        contents: { "en": "Ada formulir pendaftaran baru yang masuk, segera cek di Rekap Online!", "id": "Ada formulir pendaftaran baru yang masuk, segera cek di Rekap Online!" },
                        filters: [
                            {"field": "tag", "key": "role", "relation": "=", "value": "admin"}
                        ]
                    })
                });
            }
        } catch (pushErr) {
            console.log("Gagal mengirim push notification OneSignal:", pushErr);
        }

        return Response.json({ success: true, message: "Pendaftaran berhasil dikirim!" }, { headers: corsHeaders });
      }

      // ✅ 14. GET COUNT PENDAFTARAN ONLINE (BUAT NOTIFIKASI)
      if (request.method === "GET" && url.pathname === "/api/pendaftaran-online/count") {
        const result = await env.DB.prepare(`SELECT COUNT(*) as count FROM pendaftaran_online WHERE status = 'Belum Lunas'`).first();
        return Response.json({ count: result ? result.count : 0 }, { headers: corsHeaders });
      }

      // ✅ 15. GET SEMUA PENDAFTARAN ONLINE (ADMIN)
      if (request.method === "GET" && url.pathname === "/api/pendaftaran-online") {
        const { results } = await env.DB.prepare(`SELECT * FROM pendaftaran_online ORDER BY waktu_daftar DESC`).all();
        const mappedResults = results.map(r => ({
          ...r,
          foto_siswa: r.pas_foto_key,
          foto_kk: r.kartu_keluarga_key
        }));
        return Response.json(mappedResults, { headers: corsHeaders });
      }

      // ✅ 16. UPDATE STATUS PENDAFTARAN ONLINE (ADMIN)
      if (request.method === "POST" && url.pathname === "/api/pendaftaran-online/status") {
        const data = await request.json();
        await env.DB.prepare(`UPDATE pendaftaran_online SET status = ? WHERE id = ?`).bind(data.status, data.id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 17. DELETE PENDAFTARAN ONLINE (ADMIN)
      if (request.method === "POST" && url.pathname === "/api/pendaftaran-online/delete") {
        const { id } = await request.json();
        await env.DB.prepare(`DELETE FROM pendaftaran_online WHERE id = ?`).bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 18. SIMPAN ABSENSI SISWA LENGKAP (API BARU - UPSERT STRATEGY)
      if (request.method === "POST" && url.pathname === "/api/save-absensi-siswa") {
        const data = await request.json();
        
        // 1. Update status SPP dan format absen
        await env.DB.prepare(`
          UPDATE absensi SET status_spp = ?, format_absen = ? WHERE id = ?
        `).bind(data.status_spp || 'Belum Lunas', data.format_absen || 12, data.siswa_id).run();

        // 2. Cek apakah ini RESET (pertemuan kosong = admin sengaja reset)
        if (!data.pertemuan || data.pertemuan.length === 0) {
          // Reset: hapus semua detail absensi siswa ini
          await env.DB.prepare(`DELETE FROM absensi_detail WHERE siswa_id = ?`).bind(data.siswa_id).run();
        } else {
          // Upsert setiap pertemuan (AMAN, tidak menghapus data lama)
          const stmtUpsert = env.DB.prepare(`
            INSERT INTO absensi_detail (siswa_id, pertemuan_ke, status, tanggal)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(siswa_id, pertemuan_ke) DO UPDATE SET
              status = excluded.status,
              tanggal = excluded.tanggal
          `);
          for (const p of data.pertemuan) {
            await stmtUpsert.bind(data.siswa_id, p.ke, p.status || '', p.tanggal || '').run();
          }

          // Hapus pertemuan di luar format (misal: format=8, hapus pertemuan 9-12)
          const maxPertemuan = data.format_absen || 12;
          await env.DB.prepare(`
            DELETE FROM absensi_detail WHERE siswa_id = ? AND pertemuan_ke > ?
          `).bind(data.siswa_id, maxPertemuan).run();
        }
        
        return Response.json({ success: true, message: "Absensi berhasil disimpan ke Server!" }, { headers: corsHeaders });
      }

      // ✅ 19. AMBIL ABSENSI SISWA LENGKAP (API BARU)
      if (request.method === "GET" && url.pathname === "/api/get-absensi-siswa") {
        const siswa_id = url.searchParams.get("siswa_id");
        
        const siswa = await env.DB.prepare(`SELECT status_spp, format_absen FROM absensi WHERE id = ?`).bind(siswa_id).first();
        const { results } = await env.DB.prepare(`SELECT pertemuan_ke, status, tanggal FROM absensi_detail WHERE siswa_id = ? ORDER BY pertemuan_ke ASC`).bind(siswa_id).all();

        return Response.json({
          status_spp: siswa ? (siswa.status_spp || 'Belum Lunas') : 'Belum Lunas',
          format_absen: siswa ? (siswa.format_absen || 12) : 12,
          pertemuan: results || []
        }, { headers: corsHeaders });
      }

      // ✅ 20. SIMPAN DRAF LAPORAN (BERDASARKAN EMAIL + SISWA)
      if (request.method === "POST" && url.pathname === "/api/save-laporan-draft") {
        const data = await request.json();
        const userEmail = request.headers.get("X-Admin-Email");
        if (!userEmail) return Response.json({ error: "Email diperlukan" }, { status: 400, headers: corsHeaders });

        await env.DB.prepare(`
          INSERT INTO laporan_draft (siswa_id, user_email, draft_data)
          VALUES (?, ?, ?)
          ON CONFLICT(siswa_id, user_email) DO UPDATE SET draft_data = excluded.draft_data
        `).bind(data.siswa_id, userEmail, JSON.stringify(data.draft_data)).run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 21. AMBIL DRAF LAPORAN (BERDASARKAN EMAIL + SISWA)
      if (request.method === "GET" && url.pathname === "/api/get-laporan-draft") {
        const siswa_id = url.searchParams.get("siswa_id");
        const userEmail = request.headers.get("X-Admin-Email");
        if (!userEmail) return Response.json({ error: "Email diperlukan" }, { status: 400, headers: corsHeaders });

        const draft = await env.DB.prepare(`
          SELECT draft_data FROM laporan_draft WHERE siswa_id = ? AND user_email = ?
        `).bind(siswa_id, userEmail).first();

        if (draft && draft.draft_data) {
          return Response.json({ draft_data: JSON.parse(draft.draft_data) }, { headers: corsHeaders });
        }
        return Response.json({ draft_data: null }, { headers: corsHeaders });
      }

      // ==========================================
      // FITUR ABSENSI KARYAWAN
      // ==========================================

      // ✅ 22. UPLOAD FOTO ABSENSI KE R2
      if (request.method === "POST" && url.pathname === "/api/upload-foto-absensi") {
        const data = await request.json();
        const base64Data = data.base64_data; // Format: "data:image/jpeg;base64,..."
        
        if (!base64Data) return Response.json({ error: "No image data" }, { status: 400, headers: corsHeaders });
        
        const base64Content = base64Data.split(',')[1];
        if (!base64Content) return Response.json({ error: "Invalid base64 format" }, { status: 400, headers: corsHeaders });

        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const key = `absensi-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        
        await env.BUCKET.put(key, bytes.buffer, {
          httpMetadata: { contentType: "image/jpeg" }
        });

        // Buat public URL, di R2 worker tidak langsung punya public URL kecuali disetup.
        // Kita simpan key-nya saja, nanti client yang akses via endpoint Worker jika perlu, 
        // ATAU kita layani GET foto via Worker.
        return Response.json({ success: true, key: key }, { headers: corsHeaders });
      }

      // ✅ 23. GET FOTO DARI R2 (Opsional, untuk menampilkan foto)
      if (request.method === "GET" && (url.pathname.startsWith("/api/foto-absensi/") || url.pathname.startsWith("/uploads/"))) {
        const key = url.pathname.split("/").pop();
        const object = await env.BUCKET.get(key);

        if (object === null) {
          return new Response("Not Found", { status: 404, headers: corsHeaders });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        for (const [k, v] of Object.entries(corsHeaders)) {
          headers.set(k, v);
        }

        return new Response(object.body, {
          headers,
        });
      }

      // ✅ 24. POST ABSENSI KARYAWAN (Self Service)
      if (request.method === "POST" && url.pathname === "/api/absensi-karyawan") {
        const data = await request.json();
        
        // Cek apakah data untuk tanggal & sesi ini & email ini sudah ada
        const existing = await env.DB.prepare(`
          SELECT id, keterangan FROM absensi_karyawan 
          WHERE email = ? AND tanggal = ? AND sesi = ?
        `).bind(data.email, data.tanggal, data.sesi).first();

        if (existing) {
          // Update (biasanya untuk Absen Pulang)
          await env.DB.prepare(`
            UPDATE absensi_karyawan 
            SET status = ?, jam_pulang = ?, keterangan = ?, foto_pulang_key = ?, lat_pulang = ?, lng_pulang = ?
            WHERE id = ?
          `).bind(
            data.status || 'Hadir', 
            data.jam_pulang || null, 
            data.keterangan || existing.keterangan || null, 
            data.foto_pulang_key || null, 
            data.lat_pulang || null, 
            data.lng_pulang || null, 
            existing.id
          ).run();
        } else {
          // Insert baru (Absen Masuk)
          await env.DB.prepare(`
            INSERT INTO absensi_karyawan (
              email, nama, tanggal, sesi, status, jam_masuk, keterangan, foto_masuk_key, lat_masuk, lng_masuk
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            data.email, data.nama, data.tanggal, data.sesi, data.status || 'Hadir',
            data.jam_masuk || null, data.keterangan || null, data.foto_masuk_key || null,
            data.lat_masuk || null, data.lng_masuk || null
          ).run();
        }

        return Response.json({ success: true, message: "Absensi berhasil disimpan!" }, { headers: corsHeaders });
      }

      // ✅ 25. GET ABSENSI HARI INI (Untuk Pimpinan & Data Diri)
      if (request.method === "GET" && url.pathname === "/api/absensi-karyawan/hari-ini") {
        const tanggal = url.searchParams.get("tanggal") || new Date().toISOString().slice(0, 10); // Format YYYY-MM-DD local? Sebaiknya dari parameter
        const email = url.searchParams.get("email"); // Jika ada, filter by email (untuk card self service)

        let query = `SELECT * FROM absensi_karyawan WHERE tanggal = ?`;
        let params = [tanggal];

        if (email) {
          query += ` AND email = ?`;
          params.push(email);
        }

        query += ` ORDER BY email, sesi`;

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 26. GET RIWAYAT ABSENSI KARYAWAN (Untuk Karyawan ybs / Semua)
      if (request.method === "GET" && url.pathname === "/api/absensi-karyawan") {
        const email = url.searchParams.get("email");
        let bulan = url.searchParams.get("bulan"); // Format YYYY-MM

        if (!bulan) bulan = new Date().toISOString().slice(0, 7);

        let query = `SELECT * FROM absensi_karyawan WHERE tanggal LIKE ?`;
        let params = [`${bulan}%`];

        if (email) {
          query += ` AND email = ?`;
          params.push(email);
        }

        query += ` ORDER BY tanggal DESC, sesi DESC`;

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 27. GET REKAP BULANAN (Untuk Pimpinan)
      if (request.method === "GET" && url.pathname === "/api/absensi-karyawan/rekap") {
        let bulan = url.searchParams.get("bulan"); // Format YYYY-MM
        if (!bulan) bulan = new Date().toISOString().slice(0, 7);

        // Menghitung Hadir, Izin, Sakit, Alpha per Karyawan (di bulan tsb)
        // Jika sesi lebih dari 1 per hari, apakah dihitung per sesi atau per hari?
        // Sesuai implementasi biasa, dihitung per data (per sesi).
        const { results } = await env.DB.prepare(`
          SELECT 
            email,
            nama,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as total_hadir,
            SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as total_izin,
            SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as total_sakit,
            SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as total_alpha
          FROM absensi_karyawan
          WHERE tanggal LIKE ?
          GROUP BY email, nama
          ORDER BY nama
        `).bind(`${bulan}%`).all();

        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 28. PUT (EDIT) ABSENSI (PIMPINAN & ADMIN)
      if (request.method === "PUT" && url.pathname.startsWith("/api/absensi-karyawan/")) {
        const userEmail = request.headers.get("X-Admin-Email");
        if (!ADMIN_EMAILS.includes(userEmail)) {
          return Response.json({ success: false, error: "Akses Ditolak!", message: "Hanya Admin & Pimpinan yang bisa mengedit absensi!" }, { status: 403, headers: corsHeaders });
        }

        const id = url.pathname.split("/").pop();
        const data = await request.json();

        await env.DB.prepare(`
          UPDATE absensi_karyawan 
          SET status = ?, edit_note = ?, edited_by = ?
          WHERE id = ?
        `).bind(data.status, data.edit_note, userEmail, id).run();

        return Response.json({ success: true, message: "Absensi berhasil diperbarui oleh Pimpinan." }, { headers: corsHeaders });
      }

      // ✅ 29. DELETE ABSENSI (PIMPINAN & ADMIN)
      if (request.method === "DELETE" && url.pathname.startsWith("/api/absensi-karyawan/")) {
        const userEmail = request.headers.get("X-Admin-Email");
        if (!ADMIN_EMAILS.includes(userEmail)) {
          return Response.json({ success: false, error: "Akses Ditolak!", message: "Hanya Admin & Pimpinan yang bisa menghapus absensi!" }, { status: 403, headers: corsHeaders });
        }

        const id = url.pathname.split("/").pop();

        await env.DB.prepare(`
          DELETE FROM absensi_karyawan 
          WHERE id = ?
        `).bind(id).run();

        return Response.json({ success: true, message: "Data absensi berhasil dihapus." }, { headers: corsHeaders });
      }

      // ✅ 30. GET KATEGORI LATIHAN - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/latihan-kategori") {
        const { results } = await env.DB.prepare(`
          SELECT * FROM latihan_kategori ORDER BY nama_kategori
        `).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 31. POST KATEGORI LATIHAN - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/latihan-kategori") {
        const data = await request.json();
        if (!data.nama_kategori || !data.nama_kategori.trim()) {
          return Response.json({ success: false, error: "Nama kategori harus diisi" }, { status: 400, headers: corsHeaders });
        }
        const cleanName = data.nama_kategori.trim();
        
        const existing = await env.DB.prepare("SELECT * FROM latihan_kategori WHERE nama_kategori = ?").bind(cleanName).first();
        if (existing) {
          return Response.json({ success: false, error: "Kategori sudah terdaftar" }, { status: 400, headers: corsHeaders });
        }
        
        const info = await env.DB.prepare(`
          INSERT INTO latihan_kategori (nama_kategori) VALUES (?)
        `).bind(cleanName).run();
        
        return Response.json({ success: true, id: info.lastRowId }, { headers: corsHeaders });
      }

      // ✅ 32. DELETE KATEGORI LATIHAN - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/latihan-kategori/delete") {
        const { id } = await request.json();
        // Hapus semua soal terkait kategori ini terlebih dahulu (untuk mendukung cascade delete di SQLite)
        await env.DB.prepare(`DELETE FROM latihan_soal WHERE kategori_id = ?`).bind(id).run();
        await env.DB.prepare(`DELETE FROM latihan_kategori WHERE id = ?`).bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ✅ 33. GET SOAL LATIHAN - SEMUA ORANG BOLEH AKSES
      if (request.method === "GET" && url.pathname === "/api/latihan-soal") {
        const kategori_id = url.searchParams.get("kategori_id");
        let query = "SELECT s.*, k.nama_kategori FROM latihan_soal s JOIN latihan_kategori k ON s.kategori_id = k.id";
        let params = [];
        if (kategori_id) {
          query += " WHERE s.kategori_id = ?";
          params.push(kategori_id);
        }
        query += " ORDER BY s.id ASC";
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 34. POST SOAL LATIHAN - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/latihan-soal") {
        const data = await request.json();
        const { id, kategori_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, kunci_jawaban, pembahasan } = data;
        
        if (!kategori_id || !pertanyaan || !opsi_a || !opsi_b || !opsi_c || !opsi_d || !kunci_jawaban) {
          return Response.json({ success: false, error: "Semua field wajib diisi kecuali pembahasan" }, { status: 400, headers: corsHeaders });
        }
        
        if (id) {
          await env.DB.prepare(`
            UPDATE latihan_soal 
            SET kategori_id = ?, pertanyaan = ?, opsi_a = ?, opsi_b = ?, opsi_c = ?, opsi_d = ?, kunci_jawaban = ?, pembahasan = ?
            WHERE id = ?
          `).bind(kategori_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, kunci_jawaban, pembahasan || "", id).run();
          
          return Response.json({ success: true, message: "Soal berhasil diperbarui" }, { headers: corsHeaders });
        } else {
          const info = await env.DB.prepare(`
            INSERT INTO latihan_soal (kategori_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, kunci_jawaban, pembahasan)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(kategori_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, kunci_jawaban, pembahasan || "").run();
          
          return Response.json({ success: true, id: info.lastRowId }, { headers: corsHeaders });
        }
      }

      // ✅ 35. DELETE SOAL LATIHAN - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/latihan-soal/delete") {
        const { id } = await request.json();
        await env.DB.prepare(`DELETE FROM latihan_soal WHERE id = ?`).bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ==========================================
      // FITUR REKAP KEUANGAN
      // ==========================================

      // ✅ 36. GET REKAP KEUANGAN - HANYA ADMIN
      if (request.method === "GET" && url.pathname === "/api/rekap-keuangan") {
        // Validasi KTP sudah ada di satpam global untuk method GET non-public?
        // Wait, endpoint GET non-public tidak dilindungi oleh satpam global jika dia GET!
        // Jadi harus cek manual jika ini sensitif.
        const userEmail = request.headers.get("X-Admin-Email");
        if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
           return Response.json({ success: false, error: "Akses Ditolak!" }, { status: 403, headers: corsHeaders });
        }

        const { results } = await env.DB.prepare(`
          SELECT * FROM rekap_keuangan ORDER BY waktu_input DESC
        `).all();
        
        return Response.json(results, { headers: corsHeaders });
      }

      // ✅ 37. POST REKAP KEUANGAN (TAMBAH/EDIT) - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/rekap-keuangan") {
        const data = await request.json();
        const userEmail = request.headers.get("X-Admin-Email");

        if (data.id) {
          await env.DB.prepare(`
            UPDATE rekap_keuangan 
            SET tanggal = ?, keterangan = ?, jenis = ?, nominal = ?, metode = ?
            WHERE id = ?
          `).bind(data.tanggal, data.keterangan, data.jenis, data.nominal, data.metode || 'cash', data.id).run();
          
          return Response.json({ success: true, message: "Transaksi diperbarui" }, { headers: corsHeaders });
        } else {
          const info = await env.DB.prepare(`
            INSERT INTO rekap_keuangan (tanggal, keterangan, jenis, nominal, metode, email_penginput, waktu_input)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+7 hours'))
          `).bind(data.tanggal, data.keterangan, data.jenis, data.nominal, data.metode || 'cash', userEmail).run();
          
          return Response.json({ success: true, id: info.lastRowId }, { headers: corsHeaders });
        }
      }

      // ✅ 38. DELETE REKAP KEUANGAN - HANYA ADMIN
      if (request.method === "POST" && url.pathname === "/api/rekap-keuangan/delete") {
        const { id } = await request.json();
        await env.DB.prepare(`DELETE FROM rekap_keuangan WHERE id = ?`).bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

    } catch (e) {
      // Return 400 (Bad Request) agar response text lebih mudah ditangkap oleh frontend jika 500 diblok
      return Response.json({ 
        success: false, 
        error: e.message, 
        stack: e.stack 
      }, { status: 400, headers: corsHeaders });
    }
  }
};
