async function startStreaming() {
    try {
        const config = {
            port: parseInt(document.getElementById('port-input').value) || 8080,
            quality: document.getElementById('quality-select').value,
            fps: parseInt(document.getElementById('fps-select').value) || 30,
            captureSource: AppState.selectedSource,
            selectedMonitor: AppState.selectedMonitor,
            monitorBounds: AppState.monitors ? AppState.monitors.find(m => m.id === AppState.selectedMonitor)?.bounds : null,
            selectedWindow: AppState.selectedWindowName,
            selectedFile: AppState.selectedFile,
            enableAudio: document.getElementById('audio-checkbox')?.checked || false,
            audioMode: document.getElementById('audio-mode-select')?.value || 'tv',
            audioCaptureDeviceId: document.getElementById('audio-capture-select')?.value || 'default',
            audioOutputDeviceId: document.getElementById('audio-output-select')?.value || 'default'
        };

        if (config.captureSource === 'file' && !config.selectedFile) {
            showToast(t('lbl-no-file') || 'Nie wybrano pliku wideo', 'error');
            return;
        }

        showToast(t('toast-server-starting'), 'info');

        if (config.enableAudio && config.audioMode === 'local' && config.audioCaptureDeviceId !== 'default') {
            try {
                if (!AppState.originalAudioDevice) {
                    const currentDefault = await window.electronAPI.getSystemDefaultAudio();
                    AppState.originalAudioDevice = currentDefault;
                }

                const success = await window.electronAPI.setSystemDefaultAudio(config.audioCaptureDeviceId);
                if (success) {
                    showToast('Przełączono urządzenie audio', 'success');
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    showToast('Błąd przełączania audio', 'error');
                }
            } catch (err) {
                console.error('[AudioRouter] Failed to switch device:', err);
            }
        }

        const result = await window.electronAPI.startServer(config);

        if (result.success) {
            AppState.isStreaming = true;
            AppState.streamStartTime = Date.now();

            updateServerStatus('streaming');
            updateStreamControls(true);

            if (window.switchPage) {
                window.switchPage('dashboard');
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                const dashNav = document.querySelector('.nav-item[data-page="dashboard"]');
                if (dashNav) dashNav.classList.add('active');
            }

            showToast(t('toast-stream-started'), 'success');
            log('INFO', t('log-stream-started'));

            showQRCode(result.localIP, config.port);

            const currentAudioMode = config.audioMode || 'tv';
            if (config.enableAudio && currentAudioMode === 'local') {
                let outputId = config.audioOutputDeviceId;

                if (outputId === 'default') {
                    try {
                        const browserDevices = await navigator.mediaDevices.enumerateDevices();
                        const audioOutputs = browserDevices.filter(d => d.kind === 'audiooutput');

                        const headphones = audioOutputs.find(d =>
                            d.deviceId !== 'default' &&
                            d.deviceId !== 'communications' &&
                            !d.label.toLowerCase().includes('realtek')
                        );

                        if (headphones) {
                            outputId = headphones.deviceId;
                        } else {
                            console.warn('[AudioRouter] ⚠ Could not find non-Realtek device!');
                            const fallback = audioOutputs.find(d => d.deviceId !== 'default' && d.deviceId !== 'communications');
                            if (fallback) {
                                outputId = fallback.deviceId;
                            }
                        }
                    } catch (e) {
                        console.error('[AudioRouter] Error detecting headphones:', e);
                    }
                }

                window.startLocalAudioSync(config.port, outputId);
            }

        } else {
            throw new Error(result.error || 'Nieznany błąd');
        }

    } catch (error) {
        console.error('Błąd uruchamiania streamu:', error);
        showToast(`${t('toast-server-error')}${error.message}`, 'error');
        log('ERROR', `${t('log-stream-error')}${error.message}`);
    }
}

async function stopStreaming() {
    try {
        showToast(t('toast-stopping'), 'info');

        const result = await window.electronAPI.stopServer();

        if (result.success) {
            AppState.isStreaming = false;
            AppState.streamStartTime = null;

            window.stopLocalAudioSync();

            if (AppState.originalAudioDevice) {
                try {
                    const restored = await window.electronAPI.setSystemDefaultAudio(AppState.originalAudioDevice);
                    if (restored) {
                        showToast('Urządzenie audio przywrócone', 'success');
                    }
                } catch (err) {
                    console.error('[AudioRouter] Failed to restore device:', err);
                }
            }

            updateServerStatus('offline');
            updateStreamControls(false);

            showToast(t('toast-stopped'), 'info');
            log('INFO', t('log-stream-stopped'));

            if (window.refreshClients) window.refreshClients();

            const img = document.getElementById('stream-preview');
            const placeholder = document.getElementById('preview-placeholder');
            const video = document.getElementById('file-stream-preview');
            const videoContainer = document.getElementById('file-stream-container');

            if (img) {
                img.classList.add('hidden');
                img.src = '';
            }
            if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
                video.classList.add('hidden');
                if (videoContainer) videoContainer.classList.add('hidden');
            }
            if (placeholder) placeholder.classList.remove('hidden');

        } else {
            throw new Error(result.error || 'Nieznany błąd');
        }

    } catch (error) {
        console.error('Błąd zatrzymywania streamu:', error);
        showToast(`${t('toast-stop-error')}${error.message}`, 'error');
        log('ERROR', `${t('log-stream-error')}${error.message}`);
    }
}

function updateStreamControls(isStreaming) {
    const startBtn = document.getElementById('start-stream-btn');
    const stopBtn = document.getElementById('stop-stream-btn');

    startBtn.disabled = isStreaming;
    stopBtn.disabled = !isStreaming;

    if (isStreaming) {
        stopBtn.classList.add('active-state');
    } else {
        stopBtn.classList.remove('active-state');
    }

    if (isStreaming) {
        document.getElementById('current-fps').textContent =
            document.getElementById('fps-select').value;
        document.getElementById('current-quality').textContent =
            document.getElementById('quality-select').value;
    } else {
        document.getElementById('stream-time').textContent = '00:00:00';
    }
}

function updateServerStatus(status) {
    AppState.serverStatus = status;

    const indicator = document.getElementById('status-indicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('span');
    const serverStatus = document.getElementById('server-status');

    dot.className = 'status-dot';

    switch (status) {
        case 'online':
        case 'active':
            text.textContent = t('status-active');
            dot.classList.add('online');
            serverStatus.textContent = t('status-active');
            serverStatus.style.color = '#10b981';
            break;
        case 'offline':
            text.textContent = t('status-offline');
            dot.classList.add('offline');
            serverStatus.textContent = t('status-inactive');
            serverStatus.style.color = '#ef4444';
            break;
        case 'streaming':
            text.textContent = t('status-streaming');
            dot.classList.add('streaming');
            serverStatus.textContent = t('status-streaming');
            serverStatus.style.color = 'var(--primary)';
            break;
    }
}

function updateStreamSummary() {
    const sourceEl = document.getElementById('summary-source');
    const resEl = document.getElementById('summary-res');
    const fpsEl = document.getElementById('summary-fps');

    const lang = document.documentElement.lang || 'pl';
    const dict = i18n[lang] || i18n['pl'];

    let sourceText = dict['lbl-screen'];
    let iconClass = 'fa-desktop';

    switch (AppState.selectedSource) {
        case 'screen':
            sourceText = `${dict['lbl-screen']} ${parseInt(AppState.selectedMonitor) + 1 || 1}`;
            iconClass = 'fa-desktop';
            const mon = AppState.monitors && AppState.monitors[AppState.selectedMonitor];
            if (mon) resEl.textContent = `${mon.size.width}x${mon.size.height}`;
            break;
        case 'window':
            sourceText = AppState.selectedWindowName || dict['lbl-window-short'];
            iconClass = 'fa-window-maximize';
            resEl.textContent = 'Auto';
            break;
        case 'file':
            if (AppState.selectedFile) {
                sourceText = AppState.selectedFile.split('\\').pop();
            } else {
                sourceText = dict['lbl-file-none'];
            }
            iconClass = 'fa-file-video';
            resEl.textContent = 'Original';
            break;
    }

    sourceEl.textContent = sourceText;
    const iconContainer = document.querySelector('.summary-row i');
    if (iconContainer) iconContainer.className = `fas ${iconClass}`;

    const fps = document.getElementById('fps-select')?.value || 30;
    fpsEl.textContent = `${fps} FPS`;
}


function showQRCode(ip, port) {
    if (AppState.serverConfig && AppState.serverConfig.dontShowQrModal === true) {
        return; // skip if user opted out
    }

    const url = `ws://${ip}:${port}`;
    const container = document.getElementById('qr-content');

    if (container) {
        const isLight = document.body.classList.contains('light-theme');
        const logoSrc = isLight ? 'assets/icons/blackcat.svg' : 'assets/icons/whitecat.svg';

        container.innerHTML = `
            <div class="guide-container">
            <div class="guide-steps">
                <div class="guide-step">
                    <div class="step-num">1</div>
                    <div class="step-content">${t('guide-step-1').replace('{logo}', logoSrc)}</div>
                </div>
                <div class="guide-step">
                    <div class="step-num">2</div>
                    <div class="step-content">${t('guide-step-2')}</div>
                </div>
                <div class="guide-step">
                    <div class="step-num">3</div>
                    <div class="step-content">${t('guide-step-3')}</div>
                </div>
                 <div class="guide-step">
                    <div class="step-num">4</div>
                    <div class="step-content">${t('guide-step-4')}</div>
                </div>
            </div>

            <div class="url-box-premium">
                <div class="url-label">${t('lbl-connect-addr')}</div>
                <div class="url-value">ws://${ip}:${port}</div>
            </div>
        </div>
        `;
    }

    document.getElementById('qr-modal').classList.add('active');

    const guideModal = document.getElementById('qr-modal');
    const copyBtn = document.getElementById('copy-url-btn');
    if (copyBtn) copyBtn.focus();

    const dontShowCb = document.getElementById('dont-show-qr-checkbox');
    if (dontShowCb) {
        dontShowCb.checked = AppState.serverConfig && AppState.serverConfig.dontShowQrModal === true;
        dontShowCb.onchange = (e) => {
            if (!AppState.serverConfig) AppState.serverConfig = {};
            AppState.serverConfig.dontShowQrModal = e.target.checked;
            if (window.saveSettings) {
                window.saveSettings();
            }
        };
    }

    const handleGuideKeydown = (e) => {
        if (e.key === 'Escape') {
            closeGuide();
        }
    };

    document.addEventListener('keydown', handleGuideKeydown);

    function closeGuide() {
        guideModal.classList.remove('active');
        document.removeEventListener('keydown', handleGuideKeydown);
    }

    const closeBtns = guideModal.querySelectorAll('.modal-close');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeGuide();
        }, { once: true });
    });
}

// log functions
function log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, level, message };

    AppState.logs.push(logEntry);
    updateLogsDisplay();
}

function updateLogsDisplay() {
    const container = document.getElementById('logs-content');
    const levelFilter = document.getElementById('log-level-select').value;

    const filteredLogs = levelFilter === 'all'
        ? AppState.logs
        : AppState.logs.filter(log => log.level.toLowerCase() === levelFilter.toLowerCase());

    container.innerHTML = filteredLogs.slice(-100).map(log => `
            <div class="log-entry">
            <span class="log-time">${log.timestamp}</span>
            <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
            <span class="log-message">${log.message}</span>
        </div>
            `).join('');

    container.scrollTop = container.scrollHeight;
}

function clearLogs() {
    showConfirmation(t('modal-title-confirm'), t('confirm-clear-logs'), () => {
        AppState.logs = [];
        updateLogsDisplay();
        showToast(t('toast-logs-cleared'), 'info');
    });
}

function exportLogs() {
    const logsText = AppState.logs.map(log =>
        `[${log.timestamp}] ${log.level}: ${log.message} `
    ).join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `catcast-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    showToast(t('toast-logs-exported'), 'success');
}

function filterLogs() {
    updateLogsDisplay();
}

function togglePause() {
    if (!AppState.isStreaming) return;
    showToast(t('toast-pause-dev'), 'warning');
}

window.startStreaming = startStreaming;
window.stopStreaming = stopStreaming;
window.updateStreamControls = updateStreamControls;
window.updateServerStatus = updateServerStatus;
window.updateStreamSummary = updateStreamSummary;
window.log = log;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs;
window.filterLogs = filterLogs;
window.togglePause = togglePause;
window.showQRCode = showQRCode;
