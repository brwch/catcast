async function loadSettings() {
    try {
        const settings = window.__initialSettings || await window.electronAPI.getSettings();
        AppState.serverConfig = settings;

        const theme = settings.theme || 'dark';
        if (theme === 'light') {
            document.getElementById('theme-toggle').classList.add('active');
        } else {
            document.getElementById('theme-toggle').classList.remove('active');
        }
        applyTheme(theme);

        const language = settings.language || 'pl';
        if (document.getElementById('lang-select')) {
            document.getElementById('lang-select').value = language;
        }
        applyLanguage(language);

        document.getElementById('quality-select').value = settings.quality || 'medium';
        document.getElementById('fps-select').value = settings.fps || 30;
        document.getElementById('port-input').value = settings.serverPort || 8080;
        document.getElementById('auto-start-checkbox').checked = (settings.autoStart !== undefined) ? settings.autoStart : false;
        document.getElementById('minimize-to-tray-checkbox').checked = (settings.minimizeToTray !== undefined) ? settings.minimizeToTray : true;
        document.getElementById('start-minimized-checkbox').checked = (settings.startMinimized !== undefined) ? settings.startMinimized : false;

        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        if (volumeSlider) {
            volumeSlider.value = settings.volumeLevel || 100;
            if (volumeValue) volumeValue.textContent = `${volumeSlider.value}%`;
        }

        const audioChk = document.getElementById('audio-checkbox');
        const modeSelect = document.getElementById('audio-mode-select');

        if (audioChk) {
            audioChk.checked = (settings.enableAudio !== undefined) ? settings.enableAudio : false;

            if (modeSelect) {
                const showMode = audioChk.checked;
                if (window.toggleSelectVisibility) window.toggleSelectVisibility('audio-mode-select', showMode);
                else modeSelect.style.display = showMode ? 'block' : 'none';

                modeSelect.value = settings.audioMode || 'tv';
                modeSelect.dispatchEvent(new Event('change'));
            }

            if (modeSelect) {
                const outputGroup = document.getElementById('audio-output-group');
                if (outputGroup) {
                    const isLocal = modeSelect.value === 'local';
                    outputGroup.style.display = (audioChk.checked && isLocal) ? 'block' : 'none';
                    if (settings.audioOutputDeviceId) {
                        document.getElementById('audio-output-select').value = settings.audioOutputDeviceId;
                    }
                }
            }

            if (window.syncAudioUI) window.syncAudioUI();
        }

        if (modeSelect) {
            // one-time init calls this or handle duplication
            modeSelect.addEventListener('change', () => {
                const outputGroup = document.getElementById('audio-output-group');
                console.log('[UI] Audio mode changed to:', modeSelect.value);
                if (outputGroup) {
                    const shouldShow = (modeSelect.value === 'local');
                    outputGroup.style.display = shouldShow ? 'block' : 'none';
                }
            });
        }

        if (modeSelect && audioChk) {
            const showMode = audioChk.checked;
            if (window.toggleSelectVisibility) window.toggleSelectVisibility('audio-mode-select', showMode);
            else modeSelect.style.display = showMode ? 'block' : 'none';
        }

        await loadAudioDevices();

        const localIP = await window.electronAPI.getLocalIP();

        if (window.log) window.log('INFO', t('log-app-started'));

        if (localIP && localIP !== '127.0.0.1') {
            document.getElementById('server-ip').textContent = localIP;
            document.getElementById('tv-address').textContent = `ws://${localIP}:${settings.serverPort || 8080}`;
        } else {
            setTimeout(async () => {
                const retryIP = await window.electronAPI.getLocalIP();
                const validIP = retryIP || '127.0.0.1';
                document.getElementById('server-ip').textContent = validIP;
                document.getElementById('tv-address').textContent = `ws://${validIP}:${settings.serverPort || 8080}`;
            }, 1000);
        }

        if (window.updateServerStatus) updateServerStatus(AppState.serverStatus || 'offline');

    } catch (error) {
        console.error('Błąd ładowania ustawień:', error);
        applyTheme('dark');
        applyLanguage('pl');
        showToast(t('toast-settings-error'), 'error');
    }
}

async function saveSettings() {
    try {
        const settings = {
            serverPort: parseInt(document.getElementById('port-input').value) || 8080,
            quality: document.getElementById('quality-select').value,
            fps: parseInt(document.getElementById('fps-select').value) || 30,
            autoStart: document.getElementById('auto-start-checkbox').checked,
            minimizeToTray: document.getElementById('minimize-to-tray-checkbox').checked,
            startMinimized: document.getElementById('start-minimized-checkbox').checked,
            enableAudio: document.getElementById('audio-checkbox')?.checked || false,
            audioMode: document.getElementById('audio-mode-select')?.value || 'tv',
            audioOutputDeviceId: document.getElementById('audio-output-select')?.value || 'default',
            audioCaptureDeviceId: document.getElementById('audio-capture-select')?.value || 'default',
            volumeLevel: parseInt(document.getElementById('volume-slider')?.value) || 100,
            theme: document.getElementById('theme-toggle').classList.contains('active') ? 'light' : 'dark',
            language: document.getElementById('lang-select').value,
            dontShowQrModal: AppState.serverConfig?.dontShowQrModal || false
        };

        await window.electronAPI.saveSettings(settings);
        AppState.serverConfig = { ...AppState.serverConfig, ...settings };

        applyTheme(settings.theme);

        showToast(t('toast-settings-saved'), 'success');
        if (window.log) window.log('INFO', t('log-settings-saved'));

    } catch (error) {
        console.error('Błąd zapisywania ustawień:', error);
        showToast(t('toast-save-error'), 'error');
    }
}

async function resetSettings() {
    showConfirmation(t('modal-title-confirm'), t('confirm-reset'), async () => {
        try {
            document.getElementById('quality-select').value = 'medium';
            document.getElementById('fps-select').value = 30;
            document.getElementById('port-input').value = 8080;
            document.getElementById('auto-start-checkbox').checked = false;
            document.getElementById('minimize-to-tray-checkbox').checked = true;
            if (AppState.serverConfig) {
                AppState.serverConfig.dontShowQrModal = false;
                AppState.serverConfig.bestEncoder = null;
            }
            // reset audio UI
            const audioChk = document.getElementById('audio-checkbox');
            const audioModeSelect = document.getElementById('audio-mode-select');

            if (audioChk) {
                audioChk.checked = false;
                audioChk.dispatchEvent(new Event('change'));
                if (window.syncAudioUI) window.syncAudioUI();
            }

            if (audioModeSelect) {
                audioModeSelect.value = 'tv';
                audioModeSelect.dispatchEvent(new Event('change'));
                if (window.toggleSelectVisibility) window.toggleSelectVisibility('audio-mode-select', false);
            }

            // reset audio devices
            const outSelect = document.getElementById('audio-output-select');
            const capSelect = document.getElementById('audio-capture-select');
            if (outSelect) outSelect.value = 'default';
            if (capSelect) capSelect.value = 'default';

            if (window.refreshCustomSelect) {
                window.refreshCustomSelect('audio-output-select');
                window.refreshCustomSelect('audio-capture-select');
            }

            const langSelect = document.getElementById('lang-select');
            if (langSelect) {
                langSelect.value = 'pl'; // default per main.js
                applyLanguage('pl');
            }

            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.classList.remove('active');
                applyTheme('dark');
            }

            setTimeout(async () => {
                await saveSettings();
                showToast(t('toast-settings-reset'), 'success');
            }, 100);

        } catch (error) {
            console.error('Błąd resetowania ustawień:', error);
            showToast(t('toast-save-error'), 'error');
        }
    });
}

async function loadAudioDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        const select = document.getElementById('audio-output-select');

        if (!select) return;

        const currentSelection = select.value;

        select.innerHTML = `<option value="default" data-i18n="opt-default">${t('opt-default')}</option>`;

        audioOutputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${t('lbl-speaker', 'Speaker')} ${device.deviceId}`;
            select.appendChild(option);
        });

        if (window.refreshCustomSelect) window.refreshCustomSelect('audio-output-select');

        if (window.electronAPI && window.electronAPI.getAudioDevices) {
            const sysDevices = await window.electronAPI.getAudioDevices();
            const selectCapture = document.getElementById('audio-capture-select');

            if (selectCapture && Array.isArray(sysDevices)) {
                const currentCap = selectCapture.value;
                selectCapture.innerHTML = `<option value="default" data-i18n="opt-default-system">${t('opt-default-system')}</option>`;

                sysDevices.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = (d.name || `${t('lbl-device', 'Device')} ${d.id}`) + (d.default ? ' [Default]' : '');
                    selectCapture.appendChild(opt);
                });

                if (AppState.serverConfig && AppState.serverConfig.audioCaptureDeviceId) {
                    selectCapture.value = AppState.serverConfig.audioCaptureDeviceId;
                } else if (currentCap) {
                    selectCapture.value = currentCap;
                }

                if (window.refreshCustomSelect) window.refreshCustomSelect('audio-capture-select');
            }
        }

        if (AppState.serverConfig && AppState.serverConfig.audioOutputDeviceId) {
            select.value = AppState.serverConfig.audioOutputDeviceId;
        } else if (currentSelection) {
            select.value = currentSelection;
        }

        if (window.refreshCustomSelect) {
            window.refreshCustomSelect('audio-output-select');
        }

    } catch (error) {
        console.error('Error loading audio devices:', error);
    }
}

window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.loadAudioDevices = loadAudioDevices;