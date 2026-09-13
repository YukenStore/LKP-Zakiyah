
// Check Authentication & Page Access on Script Load
const currentPage = (window.location.pathname.split('/').pop() || 'index.html').replace('.html', '') + '.html';
const isLoginPage = currentPage === 'index.html';
const userEmail = localStorage.getItem('lkp_user_email');

if (isLoginPage) {
    if (userEmail) {
        window.location.href = 'dashboard.html';
    }
} else {
    if (!userEmail) {
        window.location.href = 'index.html';
    }
}

// Global Logout function
function logout() {
    if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}
window.logout = logout;

// ================= NAV DRAWER / DROPDOWN CONTROLLER (LKP ZAKIYAH) =================
function toggleDropdownMenu(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const drawer = document.getElementById('navDrawer');
    const overlay = document.getElementById('navOverlay');
    if (!drawer) return;

    if (drawer.classList.contains('is-open')) {
        closeDropdownMenu();
    } else {
        openDropdownMenu();
    }
}

function openDropdownMenu() {
    const drawer = document.getElementById('navDrawer');
    const overlay = document.getElementById('navOverlay');
    if (drawer) drawer.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');
}

function closeDropdownMenu() {
    const drawer = document.getElementById('navDrawer');
    const overlay = document.getElementById('navOverlay');
    if (drawer) drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
}

window.toggleDropdownMenu = toggleDropdownMenu;
window.openDropdownMenu = openDropdownMenu;
window.closeDropdownMenu = closeDropdownMenu;

// Inisialisasi Event Listener untuk hamburgerBtn, closeBtn, dan overlay
function initNavigationEvents() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeBtn = document.getElementById('closeDropdownBtn');
    const overlay = document.getElementById('navOverlay');

    if (hamburgerBtn) {
        hamburgerBtn.onclick = toggleDropdownMenu;
    }
    if (closeBtn) {
        closeBtn.onclick = closeDropdownMenu;
    }
    if (overlay) {
        overlay.onclick = closeDropdownMenu;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdownMenu();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigationEvents);
} else {
    initNavigationEvents();
}

// ================= GLOBAL HELPERS =================

// Check Roles
function isSuperAdmin() {
    return CONFIG.SUPER_ADMIN_EMAILS.includes(localStorage.getItem('lkp_user_email'));
}

function isGuruOrAdmin() {
    return CONFIG.GURU_EMAILS.includes(localStorage.getItem('lkp_user_email'));
}

function isAdminStaff() {
    return CONFIG.ADMIN_EMAILS.includes(localStorage.getItem('lkp_user_email'));
}

// Fetch helper with Authentication
async function fetchWithAuth(url, options = {}) {
    const email = localStorage.getItem('lkp_user_email');
    const headers = {
        'X-Admin-Email': email || '',
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 403) {
        alert("⛔ Ditolak Server: Cuma Admin yang boleh mengubah/mengakses data ini!");
        throw new Error("Forbidden: Bukan Admin");
    }

    if (response.status === 401) {
        alert("⛔ Sesi tidak valid, silakan login ulang.");
        localStorage.clear();
        window.location.href = 'index.html';
        throw new Error("Unauthorized");
    }

    return response;
}

// Format Name (Title Case)
function formatNama(nama) {
    if (!nama) return '';
    return nama.toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
        .map(word => word.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-')).join(' ');
}

// Full app refresh and Service Worker unregistration
async function refreshAplikasi() {
    const btn = document.querySelector('button[onclick="refreshAplikasi()"]');
    if (btn) btn.innerHTML = 'Menyegarkan Penuh... ⏳';

    try {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let reg of registrations) await reg.unregister();
        }
        setTimeout(() => { window.location.href = 'index.html?update=' + new Date().getTime(); }, 300);
    } catch (error) {
        console.error('Gagal refresh total:', error);
        window.location.reload();
    }
}

// Render error banners inside a target container
function renderErrorState(containerId, message, retryCallbackName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 bg-red-50/50 border border-red-100 rounded-2xl max-w-md mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <p class="text-sm font-bold text-slate-800 mb-1">Gagal Memuat Data</p>
            <p class="text-xs text-slate-500 mb-4">${message || 'Koneksi ke server terputus.'}</p>
            <button onclick="${retryCallbackName}()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-md">
                Coba Lagi 🔄
            </button>
        </div>
    `;
}

// ================= LAYOUT INJECTION =================

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstallApp = document.getElementById('btnInstallApp');
    const installText = document.getElementById('installText');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!isStandalone) {
        if (btnInstallApp) btnInstallApp.style.display = 'flex';
        if (installText) installText.style.display = 'block';
    }
});

window.addEventListener('appinstalled', () => {
    const btnInstallApp = document.getElementById('btnInstallApp');
    const installText = document.getElementById('installText');
    if (btnInstallApp) btnInstallApp.style.display = 'none';
    if (installText) installText.style.display = 'none';
});

// Sidebar & Overlay rendering
function injectSidebar() {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (!placeholder) return;

    const email = localStorage.getItem('lkp_user_email') || 'admin@lkpinsanjaya.com';
    const name = localStorage.getItem('lkp_user_name') || 'Admin LKP';
    const picture = localStorage.getItem('lkp_user_picture');
    const profilePicSrc = picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=c7d2fe&color=4f46e5`;

    const isAdmin = CONFIG.ADMIN_EMAILS.includes(email);

    // Active state highlighting helper
    const getLinkClass = (pageName) => {
        const isActive = currentPage === pageName;
        const baseClass = "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors";
        if (isActive) {
            return `${baseClass} bg-violet-50 text-violet-700 font-semibold`;
        }
        return `${baseClass} text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium`;
    };

    const isSidebarOpen = sessionStorage.getItem('mobile_sidebar_open') === 'true';

    placeholder.outerHTML = `
        <div id="sidebarOverlay" class="fixed inset-0 bg-slate-900/50 z-40 ${isSidebarOpen ? '' : 'hidden'} transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0'} md:hidden"></div>
        
        <aside id="sidebar" class="fixed inset-y-0 left-0 transform ${isSidebarOpen ? '' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col w-64 h-full bg-white border-r border-slate-200 z-50 flex-shrink-0 shadow-2xl md:shadow-none">
            <div class="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                <div class="flex items-center gap-1">
                    <div class="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                        <img src="image/Logo Insan Jaya.png" alt="Logo Insan Jaya" class="w-full h-full object-contain" onerror="this.src='https://via.placeholder.com/150'" />
                    </div>
                    <div class="flex flex-col justify-center">
                        <span class="font-bricolage font-bold text-sm text-slate-900 leading-tight">LKP</span>
                        <span class="font-bricolage font-bold text-sm text-violet-600 leading-tight">INSAN JAYA</span>
                    </div>
                </div>
                <button id="closeSidebarBtn" class="md:hidden p-2 -mr-2 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <nav class="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-1">
                <p class="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-1">Menu Utama</p>
                
                ${isAdmin ? `
                <a href="rekap-online.html" id="navRekapOnline" class="${getLinkClass('rekap-online.html')} flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Pendaftaran Online
                    </div>
                    <span id="badgeNotifMenu" class="hidden bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">0</span>
                </a>
                <a href="pendaftaran.html" id="navPendaftaran" class="${getLinkClass('pendaftaran.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Pendaftaran Baru
                </a>
                <a href="rekap-keuangan.html" class="${getLinkClass('rekap-keuangan.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Rekap Keuangan
                </a>
                ` : ''}
                
                <a href="absensi-siswa.html" class="${getLinkClass('absensi-siswa.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Absensi Siswa
                </a>
                <a href="absensi-karyawan.html" class="${getLinkClass('absensi-karyawan.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Absensi Karyawan
                </a>
                <a href="dashboard.html" class="${getLinkClass('dashboard.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Data Siswa Aktif
                </a>

                <p class="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Akademik</p>
                <a href="laporan.html" class="${getLinkClass('laporan.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Laporan Hasil Belajar
                </a>
                <a href="tryout-tka.html" class="${getLinkClass('tryout-tka.html')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Tryout TKA
                </a>
            </nav>



            <button onclick="refreshAplikasi()" class="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-3 text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-xl font-bold text-sm transition-colors active:scale-[0.98]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Segarkan Aplikasi
            </button>
            
            <div class="p-4 border-t border-slate-100 mt-auto bg-white">
                <p id="installText" style="display: none;" class="text-[10px] text-slate-500 font-medium tracking-wider mt-4 mb-2 text-center">Silakan install aplikasi untuk pengalaman yang lebih baik!</p>
                <button id="btnInstallApp" style="display: none;" class="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-4 text-white bg-slate-800 hover:bg-slate-900 rounded-xl font-bold text-sm transition-colors shadow-md active:scale-[0.98]">
                    <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Install Aplikasi
                </button>
                <div id="iosInstallHint" style="display: none;" class="text-[11px] text-slate-600 font-medium text-center mt-2 mb-4 bg-blue-50/80 p-3 rounded-xl border border-blue-100">
                    🍎 <b>Khusus Pengguna iPhone:</b><br>
                    Tap tombol <svg class="inline w-4 h-4 mx-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> (Bagikan) di bawah Safari, lalu pilih <br><b>"Add to Home Screen"</b> ➕
                </div>

                <div class="flex items-center gap-3 mb-4 px-2">
                    <div class="w-10 h-10 rounded-full bg-violet-100 overflow-hidden flex-shrink-0 border border-violet-200">
                        <img id="userProfilePic" src="${profilePicSrc}" alt="Profile" class="w-full h-full object-cover">
                    </div>
                    <div class="overflow-hidden">
                        <p id="userNameDisplay" class="text-sm font-bold text-slate-800 truncate">${name}</p>
                        <p id="userEmailDisplay" class="text-[10px] font-medium text-slate-500 truncate">${email}</p>
                    </div>
                </div>
                
                <button id="btnLogout" class="flex items-center justify-center gap-2 w-full px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Keluar Akun
                </button>
            </div>
        </aside>
    `;

    // Hook up Event Listeners
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    function toggleSidebar() {
        const isClosed = sidebar.classList.contains('-translate-x-full');
        if (isClosed) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
            }, 10);
            sessionStorage.setItem('mobile_sidebar_open', 'true');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
            sessionStorage.setItem('mobile_sidebar_open', 'false');
        }
    }

    document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebarBtn')?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    // Logout handler
    document.getElementById('btnLogout')?.addEventListener('click', (e) => {
        if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
            localStorage.clear();
            window.location.href = 'index.html';
        }
    });

    // PWA Prompt check
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const btnInstallApp = document.getElementById('btnInstallApp');
    const installText = document.getElementById('installText');
    const iosInstallHint = document.getElementById('iosInstallHint');

    if (deferredPrompt && !isStandalone) {
        if (btnInstallApp) btnInstallApp.style.display = 'flex';
        if (installText) installText.style.display = 'block';
    }

    btnInstallApp?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                if (btnInstallApp) btnInstallApp.style.display = 'none';
                if (installText) installText.style.display = 'none';
            }
            deferredPrompt = null;
        }
    });

    const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIos() && !isStandalone) {
        if (iosInstallHint) iosInstallHint.style.display = 'block';
    }

    // Load Online Registration Notif count badge if admin
    if (isAdmin) {
        // ============================================================================
        // SISTEM NOTIFIKASI IN-APP (POPUP UNGU) + ONESIGNAL PUSH (MOBILE)
        // ============================================================================
        console.log('[NOTIF] Sistem notifikasi dimulai untuk admin:', email);
        
        const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

        // Fungsi untuk menampilkan popup ungu (in-app notification)
        function showBuiltInPopup(title, message) {
            const old = document.getElementById('notifPopupBuiltIn');
            if (old) old.remove();

            const popup = document.createElement('div');
            popup.id = 'notifPopupBuiltIn';
            popup.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 24px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.3);font-family:sans-serif;max-width:350px;animation:slideInNotif 0.5s ease;cursor:pointer;';
            popup.innerHTML = `
                <div style="display:flex;align-items:flex-start;gap:12px;">
                    <div style="font-size:28px;flex-shrink:0;">🔔</div>
                    <div>
                        <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">${title}</div>
                        <div style="font-size:13px;opacity:0.9;">${message}</div>
                    </div>
                </div>
            `;
            popup.onclick = () => popup.remove();
            document.body.appendChild(popup);

            if (!document.getElementById('notifPopupStyle')) {
                const style = document.createElement('style');
                style.id = 'notifPopupStyle';
                style.textContent = '@keyframes slideInNotif{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}';
                document.head.appendChild(style);
            }

            setTimeout(() => { if (popup.parentNode) popup.remove(); }, 8000);
        }
        
        // Polling: cek jumlah pendaftar baru setiap 10 detik
        async function checkNewPendaftaran() {
            try {
                const response = await fetch(`${CONFIG.API_URL}/api/pendaftaran-online/count?t=${Date.now()}`);
                const data = await response.json();
                const currentCount = parseInt(data.count) || 0;
                
                const storedValue = localStorage.getItem('lastPendaftaranCount');
                const isFirstVisit = (storedValue === null);
                const lastCount = isFirstVisit ? currentCount : parseInt(storedValue);
                
                console.log('[NOTIF] Cek count:', { currentCount, lastCount, isFirstVisit });
                
                localStorage.setItem('lastPendaftaranCount', currentCount);

                // Update badge angka merah di sidebar
                const badgeElement = document.getElementById('badgeNotifMenu');
                if (badgeElement) {
                    badgeElement.textContent = currentCount;
                    badgeElement.style.display = currentCount > 0 ? 'block' : 'none';
                }

                // Update App Icon Badge (PC)
                if (currentCount > 0) {
                    if ('setAppBadge' in navigator) navigator.setAppBadge(currentCount).catch(e => {});
                } else {
                    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(e => {});
                }

                // Tampilkan popup ungu jika ada pendaftar baru
                if (!isFirstVisit && currentCount > lastCount) {
                    console.log('[NOTIF] ✅ ADA PENDAFTAR BARU! Menampilkan popup ungu...');
                    
                    notifSound.play().catch(e => console.log('[NOTIF] Browser mencegah autoplay suara'));
                    showBuiltInPopup('📋 Pendaftaran Baru!', 'Ada formulir pendaftaran siswa baru yang masuk. Segera cek di Rekap Online!');

                    // Refresh tabel otomatis jika di halaman rekap-online
                    if (typeof window.fetchData === 'function') {
                        window.fetchData();
                    }
                }
            } catch (error) {
                console.error('[NOTIF] Gagal mengecek notifikasi:', error);
            }
        }

        // Jalankan polling
        console.log('[NOTIF] Memulai polling...');
        checkNewPendaftaran();
        setInterval(checkNewPendaftaran, 10000);

        // ============================================================================
        // ONESIGNAL PUSH NOTIFICATION (untuk notifikasi di HP saat app tertutup)
        // ============================================================================
        // Inject OneSignal SDK
        const osScript = document.createElement('script');
        osScript.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        osScript.defer = true;
        document.head.appendChild(osScript);

        osScript.onload = function() {
            console.log('[NOTIF] OneSignal SDK ter-load, inisialisasi...');
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
                await OneSignal.init({
                    appId: "ba38a67c-b19b-420e-8df6-fbacb19bf98e",
                    serviceWorkerParam: { scope: "/" },
                    serviceWorkerPath: "sw.js",
                    notifyButton: { enable: false }
                });

                // Tag user sebagai admin agar backend bisa kirim push ke admin saja
                await OneSignal.User.addTag("role", "admin");
                console.log('[NOTIF] OneSignal: User di-tag sebagai admin');
            });
        };
    }
}

// Inisialisasi layout dan style global setelah DOM termuat
function injectGlobalStyles() {
    if (!document.getElementById('lkpGlobalStyles')) {
        const style = document.createElement('style');
        style.id = 'lkpGlobalStyles';
        style.textContent = `
            /* Aesthetic Global Scrollbar */
            * {
                scrollbar-width: thin;
                scrollbar-color: #c4b5fd transparent;
            }
            ::-webkit-scrollbar {
                width: 5px;
                height: 5px;
            }
            ::-webkit-scrollbar-track {
                background: transparent;
            }
            ::-webkit-scrollbar-thumb {
                background-color: #c4b5fd;
                border-radius: 10px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background-color: #8b5cf6;
            }
        `;
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    injectSidebar();
    injectGlobalStyles();
});
