async function loadMonitors() {
    try {
        const monitors = await window.electronAPI.getMonitors();
        const container = document.getElementById('monitors-list');

        AppState.monitors = monitors;

        container.innerHTML = monitors.map((monitor, index) => `
            <div class="monitor-card ${index === 0 ? 'selected' : ''}" 
                 data-monitor-id="${monitor.id}"
                 onclick="selectMonitor(${monitor.id})">
                <div class="monitor-preview">
                    <i class="fas fa-desktop"></i>
                </div>
                <div class="monitor-info">
                    <h4>${monitor.label || 'Ekran ' + (index + 1)}</h4>
                    <p>${monitor.size.width} × ${monitor.size.height}</p>
                </div>
            </div>
        `).join('');

        if (monitors.length > 0) {
            AppState.selectedMonitor = 0;
        }

    } catch (error) {
        console.error('Błąd ładowania monitorów:', error);
        showToast(t('toast-monitors-error'), 'error');
    }
}

async function loadWindows() {
    try {
        const windows = await window.electronAPI.getWindows();
        const container = document.getElementById('windows-list');

        let html = '';

        const filteredWindows = windows.filter(win => {
            const name = win.name.toLowerCase();
            const invalid = name.includes('screen 1') ||
                name.includes('entire screen') ||
                name.includes('cały ekran') ||
                name.includes('pulpit') ||
                name.includes('catcast sender');
            return !invalid && win.id !== '0';
        });

        html += filteredWindows.map(win => {
            const safeName = win.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `
            <div class="window-item ${AppState.selectedWindow === win.id ? 'selected' : ''}" 
                 onclick="selectWindow('${win.id}', '${safeName}')" data-window-id="${win.id}">
                <div class="window-thumbnail">
                    <img src="${win.thumbnail}" alt="${win.name}">
                </div>
                <div class="window-label-row">
                    ${win.appIcon ? `<img src="${win.appIcon}" class="app-icon-small">` : ''}
                    <div class="window-name">${win.name}</div>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = html;

    } catch (error) {
        console.error('Błąd ładowania okien:', error);
        showToast(t('toast-windows-error'), 'error');
    }
}

async function browseFile() {
    try {
        const result = await window.electronAPI.selectFile();
        if (result && result.length > 0) {
            const filePath = result[0];
            AppState.selectedFile = filePath;

            const dropArea = document.querySelector('.file-drop-area');
            const fileName = filePath.split('\\').pop() || filePath.split('/').pop();

            dropArea.classList.add('has-file');
            dropArea.innerHTML = `
                <div class="file-preview-content">
                    <i class="fas fa-file-video file-icon-large"></i>
                    <div class="file-name-display">${fileName}</div>
                    <div class="file-hint" data-i18n="file-ready">${t('file-ready')}</div>
                    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
                        <button class="btn btn-sm btn-outline" data-i18n="file-change" onclick="browseFile()">${t('file-change')}</button>
                        <button class="btn btn-sm btn-outline danger" data-i18n="file-clear" onclick="clearSelectedFile()"><i class="fas fa-trash-alt"></i> ${t('file-clear')}</button>
                    </div>
                </div>
            `;

            const oldPreview = document.getElementById('file-preview');
            if (oldPreview) oldPreview.innerHTML = '';

            if (window.updateStreamSummary) window.updateStreamSummary();
        }
    } catch (error) {
        console.error('Błąd wybierania pliku:', error);
        showToast(t('toast-file-error'), 'error');
    }
}

function clearSelectedFile() {
    AppState.selectedFile = null;
    const dropArea = document.querySelector('.file-drop-area');
    dropArea.classList.remove('has-file');
    dropArea.innerHTML = `
        <button id="browse-file-btn" class="btn btn-secondary" onclick="browseFile()">
            <i class="fas fa-folder-open"></i> 
            <span data-i18n="btn-select-file">${t('btn-select-file')}</span>
        </button>
        <span id="selected-file-info" data-i18n="lbl-no-file">${t('lbl-no-file')}</span>
    `;

    const oldPreview = document.getElementById('file-preview');
    if (oldPreview) oldPreview.innerHTML = '';

    if (window.updateStreamSummary) window.updateStreamSummary();
}

function selectSource(source) {
    AppState.selectedSource = source;

    document.querySelectorAll('.source-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.dataset.source === source) {
            opt.classList.add('active');
        }
    });

    document.querySelectorAll('.source-detail').forEach(detail => {
        detail.classList.remove('active');
    });
    document.getElementById(`detail-${source}`).classList.add('active');

    if (window.updateStreamSummary) window.updateStreamSummary();
}

function selectMonitor(monitorId) {
    AppState.selectedMonitor = monitorId;

    document.querySelectorAll('.monitor-card').forEach(card => {
        card.classList.remove('selected');
        if (parseInt(card.dataset.monitorId) === monitorId) {
            card.classList.add('selected');
        }
    });
    if (window.updateStreamSummary) window.updateStreamSummary();
}

function selectWindow(windowId, windowName) {
    AppState.selectedWindow = windowId;
    AppState.selectedWindowName = windowName;

    document.querySelectorAll('.window-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.windowId === windowId || (windowId === null && item.dataset.windowId === "null")) {
            item.classList.add('selected');
        }
    });
    if (window.updateStreamSummary) window.updateStreamSummary();
}

// client management

async function refreshClients() {
    try {
        const clients = await window.electronAPI.getConnectedClients();
        AppState.connectedClients = clients;

        updateClientsTable(clients);
        document.getElementById('connected-clients').textContent = clients.length;
        document.getElementById('clients-count').textContent = clients.length;

    } catch (error) {
        console.error('Błąd odświeżania klientów:', error);
    }
}

function updateClientsTable(clients) {
    const tbody = document.getElementById('clients-table-body');
    const dict = i18n[document.documentElement.lang] || i18n['pl'];

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5" data-i18n="clients-empty">${t('clients-empty')}</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clients.map(client => {
        const truncate = (str, len = 20) => str.length > len ? str.substring(0, len) + '...' : str;

        return `
        <tr>
            <td title="${client.id}" style="cursor: help;">${client.id.substring(0, 8)}...</td>
            <td>${client.ip}</td>
            <td title="${client.userAgent || 'Nieznane'}" style="cursor: help;">
                ${truncate(client.userAgent || 'Nieznane', 25)}
            </td>
            <td>${new Date(client.connectedAt).toLocaleTimeString()}</td>
            <td class="actions-cell" style="text-align: right;">
                 <div class="action-buttons-row" style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="quick-action-btn danger" onclick="kickClient('${client.id}')" title="${t('btn-disconnect')}">
                        <i class="fas fa-user-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

async function kickClient(clientId) {
    try {
        const success = await window.electronAPI.disconnectClient(clientId);
        if (success) {
            showToast(t('toast-client-disconnected'), 'success');
            refreshClients();
        } else {
            showToast(t('toast-client-not-found'), 'error');
        }
    } catch (error) {
        console.error('Błąd rozłączania klienta:', error);
        showToast(t('toast-disconnect-error'), 'error');
    }
}

window.loadMonitors = loadMonitors;
window.loadWindows = loadWindows;
window.browseFile = browseFile;
window.selectSource = selectSource;
window.selectMonitor = selectMonitor;
window.selectWindow = selectWindow;
window.refreshClients = refreshClients;
window.kickClient = kickClient;
window.clearSelectedFile = clearSelectedFile;
