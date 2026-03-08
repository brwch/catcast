// translations
const i18n = {
    'pl': {
        'app-title': 'CatCast Sender',
        'brand-subtitle': 'Sender',
        'status-offline': 'Rozłączony',
        'status-online': 'Aktywny',
        'status-streaming': 'Transmisja',
        'nav-dashboard': 'Pulpit',
        'nav-source': 'Źródło',
        'nav-clients': 'Klienci',
        'nav-settings': 'Ustawienia',
        'nav-logs': 'Logi',
        'header-dashboard': 'Panel Sterowania',
        'desc-dashboard': 'Zarządzaj transmisją i statystykami',
        'stat-clients': 'Klienci',
        'stat-fps': 'FPS',
        'stat-quality': 'Jakość',
        'stat-time': 'Czas',
        'card-server': 'Serwer',
        'lbl-status': 'Status',
        'status-inactive': 'Nieaktywny',
        'lbl-ip': 'IP Lokalny',
        'lbl-tv-addr': 'Adres TV',
        'btn-copy': 'Kopiuj',
        'btn-test': 'Test',
        'btn-web': 'WWW',
        'card-preview': 'Podgląd',
        'preview-no-signal': 'Brak sygnału',
        'header-source': 'Źródło Sygnału',
        'desc-source': 'Wybierz co chcesz transmitować',
        'src-screen': 'Cały Ekran',
        'src-window': 'Okno Aplikacji',
        'src-file': 'Plik Wideo',
        'dtl-screens': 'Dostępne Ekrany',
        'dtl-windows': 'Dostępne Okna',
        'btn-refresh': 'Odśwież',
        'dtl-file': 'Wybór Pliku',
        'btn-select-file': 'Wybierz plik...',
        'lbl-no-file': 'Nie wybrano pliku',
        'header-clients': 'Klienci',
        'header-settings': 'Ustawienia',
        'header-logs': 'Logi Systemowe',
        'btn-start': 'Start',
        'btn-stop': 'Stop',
        'btn-stop': 'Stop',
        'lbl-source-default': 'Ekran 1',
        'lbl-screen': 'Ekran',
        'lbl-speaker': 'Głośnik',
        'lbl-device': 'Urządzenie',
        'lbl-window-short': 'Okno',
        'lbl-file': 'Plik',
        'lbl-file-none': 'Plik (Nie wybrano)',
        'title-toggle-preview': 'Pokaż/Ukryj podgląd',
        'msg-preview-hidden': 'Podgląd wyłączony',

        // context
        'toast-settings-loaded': 'Ustawienia załadowane',
        'toast-settings-error': 'Błąd ładowania ustawień',
        'toast-monitors-error': 'Błąd ładowania monitorów',
        'toast-windows-error': 'Błąd ładowania okien',
        'toast-settings-saved': 'Ustawienia zapisane',
        'toast-save-error': 'Błąd zapisywania ustawień',
        'toast-server-starting': 'Uruchamianie serwera...',
        'toast-stream-started': 'Transmisja rozpoczęta!',
        'toast-server-error': 'Błąd: ',
        'toast-stopping': 'Zatrzymywanie transmisji...',
        'toast-stopped': 'Transmisja zatrzymana',
        'toast-stop-error': 'Błąd zatrzymywania streamu: ',
        'toast-pause-dev': 'Pauza - funkcja w rozwoju',
        'toast-file-error': 'Błąd wybierania pliku',
        'toast-update-available': 'Dostępna aktualizacja!',
        'toast-update-downloaded': 'Aktualizacja pobrana - restartuj aplikację',
        'log-settings-saved': 'Ustawienia zapisane',
        'log-stream-started': 'Transmisja rozpoczęta',
        'log-stream-stopped': 'Transmisja zatrzymana',
        'log-stream-error': 'Błąd streamu: ',
        'status-active': 'Aktywny',
        'status-streaming': 'Transmisja aktywna',
        'file-ready': 'Gotowy do transmisji',
        'file-change': 'Zmień plik',
        'file-clear': 'Usuń plik',
        'clients-empty': 'Brak połączonych klientów',
        'hdr-qr': 'Połącz z TV',
        'btn-confirm': 'Potwierdź',
        'btn-cancel': 'Anuluj',
        'modal-title-confirm': 'Potwierdzenie',
        'confirm-reset': 'Czy na pewno chcesz przywrócić ustawienia domyślne?',
        'confirm-clear-logs': 'Czy na pewno chcesz wyczyścić logi?',
        'toast-logs-cleared': 'Logi wyczyszczone',
        'toast-logs-exported': 'Logi wyeksportowane',
        'toast-copied': 'Adres skopiowany',
        'toast-copy-error': 'Błąd kopiowania',
        'toast-test-conn': 'Testowanie połączenia...',
        'toast-conn-ok': 'Połączenie OK',
        'toast-feature-dev': 'Funkcja w rozwoju',
        'log-app-started': 'Aplikacja uruchomiona',
        'qr-error': 'Błąd generowania QR',
        'col-device': 'Urządzenie',
        'col-status': 'Status',
        'col-actions': 'Akcje',
        'hdr-transmission': 'Transmisja',
        'lbl-quality': 'Jakość Obrazu',
        'opt-low': 'Niska (Wydajność)',
        'opt-medium': 'Średnia (Zalecane)',
        'opt-high': 'Wysoka',
        'opt-ultra': 'Ultra (Jakość)',
        'lbl-fps': 'Płynność (FPS)',
        'lbl-port': 'Port Serwera',
        'hdr-app': 'Aplikacja',
        'lbl-theme': 'Motyw',
        'lbl-lang': 'Język / Language',
        'chk-autostart': 'Uruchom przy starcie systemu',
        'chk-tray': 'Minimalizuj do zasobnika',
        'chk-minimized': 'Uruchom zminimalizowane',
        'chk-dont-show-again': 'Nie pokazuj ponownie',
        'lbl-version': 'Wersja aplikacji:',
        'btn-defaults': 'Przywróć domyślne',
        'btn-save': 'Zapisz zmiany',
        'desc-settings': 'Konfiguracja serwera i aplikacji',
        'opt-log-all': 'Wszystkie',
        'lbl-sound': 'Dźwięk systemowy',
        'btn-disconnect': 'Rozłącz użytkownika',
        'btn-stop-client': 'Zatrzymaj stream dla klienta',
        'sound-on': 'Dźwięk włączony',
        'sound-off': 'Dźwięk wyłączony',
        'guide-step-1': 'Pobierz aplikację <strong>CatCast Receiver</strong><img src="{logo}" class="inline-logo"> na swoim telewizorze.',
        'guide-step-2': 'Upewnij się, że TV i komputer są w tej samej sieci <strong style="white-space: nowrap;">Wi-Fi</strong>.',
        'guide-step-3': 'Uruchom aplikację na TV.',
        'guide-step-4': 'Wpisz w aplikacji na TV poniższy adres:',
        'lbl-connect-addr': 'Adres połączenia',
        'lbl-output-device': 'Urządzenie wyjściowe (Zewnętrzne)',
        'opt-default': 'Domyślne',
        'opt-log-info': 'Info',
        'opt-log-warn': 'Ostrzeżenie',
        'opt-log-error': 'Błąd',
        'msg-addr-copied': 'Adres skopiowany do schowka',
        'lbl-capture-device': 'Urządzenie przechwytywania (System)',
        'opt-tv-speakers': 'Głośniki TV',
        'opt-ext-device': 'Urządzenie zewnętrzne',
        'lbl-sync-delay': 'Opóźnienie synchronizacji',
        'desc-sync-delay': 'Dostosuj, jeśli dźwięk nie pasuje do obrazu TV',
        'warn-capture-default': 'To urządzenie zostanie ustawione jako domyślne na czas streamu.',
        'opt-default-system': 'Domyślne (Systemowe)',
        'toast-client-disconnected': 'Klient został rozłączony',
        'toast-client-not-found': 'Nie znaleziono klienta',
        'toast-disconnect-error': 'Błąd podczas rozłączania klienta',
        'toast-settings-reset': 'Ustawienia zostały zresetowane',
        'btn-clear-logs': 'Wyczyść logi',
        'btn-export-logs': 'Eksportuj logi',
        'tooltip-window-warning': 'Niektóre okna mogą nie być transmitowane poprawnie. Dla najlepszych rezultatów zalecamy udostępnianie całego ekranu.'
    },
    'en': {
        'app-title': 'CatCast Sender',
        'brand-subtitle': 'Sender',
        'status-offline': 'Offline',
        'status-online': 'Active',
        'status-streaming': 'Streaming',
        'nav-dashboard': 'Dashboard',
        'nav-source': 'Source',
        'log-app-started': 'Application started',
        'nav-clients': 'Clients',
        'nav-settings': 'Settings',
        'nav-logs': 'Logs',
        'header-dashboard': 'Control Panel',
        'desc-dashboard': 'Manage transmission and statistics',
        'stat-clients': 'Clients',
        'stat-fps': 'FPS',
        'stat-quality': 'Quality',
        'stat-time': 'Time',
        'card-server': 'Server',
        'lbl-status': 'Status',
        'status-inactive': 'Inactive',
        'lbl-ip': 'Local IP',
        'lbl-tv-addr': 'TV Address',
        'btn-copy': 'Copy',
        'btn-test': 'Test',
        'btn-web': 'Web',
        'card-preview': 'Preview',
        'preview-no-signal': 'No Signal',
        'header-source': 'Signal Source',
        'desc-source': 'Choose what to broadcast',
        'src-screen': 'Entire Screen',
        'src-window': 'App Window',
        'src-file': 'Video File',
        'dtl-screens': 'Available Screens',
        'dtl-windows': 'Available Windows',
        'btn-refresh': 'Refresh',
        'dtl-file': 'File Selection',
        'btn-select-file': 'Select file...',
        'lbl-no-file': 'No file selected',
        'header-clients': 'Clients',
        'header-settings': 'Settings',
        'header-logs': 'System Logs',
        'btn-start': 'Start',
        'btn-stop': 'Stop',
        'lbl-source-default': 'Screen 1',
        'lbl-screen': 'Screen',
        'lbl-speaker': 'Speaker',
        'lbl-device': 'Device',
        'lbl-window-short': 'Window',
        'lbl-file-short': 'File',
        'lbl-file-none': 'File (None selected)',
        'title-toggle-preview': 'Show/Hide preview',
        'msg-preview-hidden': 'Preview disabled',
        'toast-settings-loaded': 'Settings loaded',
        'toast-settings-error': 'Error loading settings',
        'toast-monitors-error': 'Error loading monitors',
        'toast-windows-error': 'Error loading windows',
        'toast-settings-saved': 'Settings saved',
        'toast-save-error': 'Error saving settings',
        'toast-server-starting': 'Starting server...',
        'toast-stream-started': 'Streaming started!',
        'toast-server-error': 'Error: ',
        'toast-stopping': 'Stopping transmission...',
        'toast-stopped': 'Transmission stopped',
        'toast-stop-error': 'Error stopping stream: ',
        'toast-pause-dev': 'Pause - feature in development',
        'toast-file-error': 'Error selecting file',
        'toast-update-available': 'Update available!',
        'toast-update-downloaded': 'Update downloaded - restart app',
        'log-settings-saved': 'Settings saved',
        'log-stream-started': 'Streaming started',
        'log-stream-stopped': 'Transmission stopped',
        'log-stream-error': 'Stream error: ',
        'status-active': 'Active',
        'status-streaming': 'Streaming active',
        'file-ready': 'Ready to stream',
        'file-change': 'Change file',
        'file-clear': 'Clear file',
        'clients-empty': 'No connected clients',
        'hdr-qr': 'Connect with TV',
        'btn-confirm': 'Confirm',
        'btn-cancel': 'Cancel',
        'modal-title-confirm': 'Confirmation',
        'confirm-reset': 'Are you sure you want to reset settings?',
        'confirm-clear-logs': 'Are you sure you want to clear logs?',
        'toast-logs-cleared': 'Logs cleared',
        'toast-logs-exported': 'Logs exported',
        'toast-copied': 'Address copied',
        'toast-copy-error': 'Copy error',
        'toast-test-conn': 'Testing connection...',
        'toast-conn-ok': 'Connection OK',
        'toast-feature-dev': 'Feature in development',
        'qr-error': 'QR Generation Error',
        'col-device': 'Device',
        'col-status': 'Status',
        'col-actions': 'Actions',
        'hdr-transmission': 'Transmission',
        'lbl-quality': 'Image Quality',
        'opt-low': 'Low (Performance)',
        'opt-medium': 'Medium (Recommended)',
        'opt-high': 'High',
        'opt-ultra': 'Ultra (Quality)',
        'lbl-fps': 'Frame Rate (FPS)',
        'lbl-port': 'Server Port',
        'hdr-app': 'Application',
        'lbl-theme': 'Theme',
        'lbl-lang': 'Language',
        'chk-autostart': 'Start on system boot',
        'chk-tray': 'Minimize to tray',
        'chk-minimized': 'Start minimized',
        'chk-dont-show-again': 'Do not show again',
        'lbl-version': 'App Version:',
        'btn-defaults': 'Restore Defaults',
        'btn-save': 'Save Changes',
        'desc-settings': 'Server and application configuration',
        'opt-log-all': 'All',
        'lbl-sound': 'System Sound',
        'btn-disconnect': 'Disconnect User',
        'btn-stop-client': 'Stop stream for client',
        'sound-on': 'Sound On',
        'sound-off': 'Sound Off',
        'guide-step-1': 'Download <strong>CatCast Receiver</strong><img src="{logo}" class="inline-logo"> on your TV.',
        'guide-step-2': 'Ensure TV and PC are on the same <strong style="white-space: nowrap;">Wi-Fi</strong> network.',
        'guide-step-3': 'Launch the app on your TV.',
        'guide-step-4': 'Enter the address below into the TV app:',
        'lbl-connect-addr': 'Connection Address',
        'lbl-output-device': 'Output Device (External)',
        'opt-default': 'Default',
        'opt-log-info': 'Info',
        'opt-log-warn': 'Warning',
        'opt-log-error': 'Error',
        'msg-addr-copied': 'Address copied to clipboard',
        'lbl-capture-device': 'Capture Device (System)',
        'opt-tv-speakers': 'TV Speakers',
        'opt-ext-device': 'External Device',
        'lbl-sync-delay': 'Sync Delay',
        'desc-sync-delay': 'Adjust if audio is out of sync with TV',
        'warn-capture-default': 'This device will be set as default during streaming.',
        'opt-default-system': 'Default (System)',
        'toast-client-disconnected': 'Client disconnected',
        'toast-client-not-found': 'Client not found',
        'toast-disconnect-error': 'Error disconnecting client',
        'toast-settings-reset': 'Settings have been reset',
        'btn-clear-logs': 'Clear logs',
        'btn-export-logs': 'Export logs',
        'tooltip-window-warning': 'Some windows may not stream correctly. For best results, we recommend sharing the entire screen.'
    }
};

// translation helper
function t(key, defaultText = '') {
    const lang = document.documentElement.lang || 'pl';
    const dict = i18n[lang] || i18n['pl'];
    return dict[key] || defaultText || key;
}

function applyLanguage(lang) {
    document.documentElement.lang = lang; // store in html

    const dict = i18n[lang] || i18n['pl'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key]) {
            if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                el.placeholder = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });


    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.dataset.i18nTooltip;
        if (dict[key]) {
            el.setAttribute('data-tooltip', dict[key]);
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        if (dict[key]) {
            el.title = dict[key];
        }
    });

    if (window.updateServerStatus && AppState.serverStatus) {
        updateServerStatus(AppState.serverStatus);
    }

    // force refresh of settings header
    const settingsHeader = document.querySelector('#page-settings .page-header h2');
    if (settingsHeader && dict['header-settings']) settingsHeader.textContent = dict['header-settings'];
    const settingsDesc = document.querySelector('#page-settings .page-header p');
    if (settingsDesc && dict['desc-settings']) settingsDesc.textContent = dict['desc-settings'];

    if (window.updateStreamSummary) {
        updateStreamSummary();
    }

    const dropArea = document.querySelector('.file-drop-area');
    if (dropArea && dropArea.classList.contains('has-file')) {
        const hint = dropArea.querySelector('.file-hint');
        if (hint) hint.textContent = t('file-ready');
        const btn = dropArea.querySelector('button');
        if (btn) btn.textContent = t('file-change');
    }

    const emptyRow = document.querySelector('.empty-row td');
    if (emptyRow && (AppState.connectedClients.length === 0)) {
        emptyRow.textContent = t('clients-empty');
    }

    const startBtnText = document.querySelector('#start-stream-btn span');
    if (startBtnText && dict['btn-start']) startBtnText.textContent = dict['btn-start'];

    const stopBtnText = document.querySelector('#stop-stream-btn span');
    if (stopBtnText && dict['btn-stop']) stopBtnText.textContent = dict['btn-stop'];

    const sourceLabel = document.querySelector('#summary-source');
    if (sourceLabel && dict['lbl-source-default'] && (sourceLabel.textContent.includes('Ekran') || sourceLabel.textContent.includes('Screen'))) {
        sourceLabel.textContent = dict['lbl-source-default'];
    }

    if (window.updateCustomSelectsLanguage) {
        window.updateCustomSelectsLanguage();
    }
}

window.t = t;
window.applyLanguage = applyLanguage;
