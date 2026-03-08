document.addEventListener('DOMContentLoaded', async () => {
    console.log('CatCast Sender - Renderer started');


    initUI();
    initEventListeners();

    await loadSettings();

    new TooltipManager();

    setTimeout(setupCustomSelects, 100);
    await loadMonitors();

    await loadWindows();

    document.getElementById('minimize-btn')?.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    document.getElementById('maximize-btn')?.addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
        const icon = document.querySelector('#maximize-btn i');
        if (icon.classList.contains('fa-square')) {
            icon.classList.remove('fa-square');
            icon.classList.add('fa-clone');
        } else {
            icon.classList.remove('fa-clone');
            icon.classList.add('fa-square');
        }
    });

    document.getElementById('close-btn')?.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    startAutoRefresh();
});

function initUI() {
    setInterval(() => {
        if (AppState.isStreaming && AppState.streamStartTime) {
            const elapsed = Date.now() - AppState.streamStartTime;
            document.getElementById('stream-time').textContent =
                formatTime(elapsed);
        }
    }, 1000);
}

function initEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);

            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // source selection
    document.querySelectorAll('.source-option').forEach(option => {
        option.addEventListener('click', () => {
            const source = option.dataset.source;
            selectSource(source);
        });
    });

    document.getElementById('start-stream-btn').addEventListener('click', startStreaming);
    document.getElementById('stop-stream-btn').addEventListener('click', stopStreaming);

    document.getElementById('copy-address-btn').addEventListener('click', copyServerAddress);
    document.getElementById('test-connection-btn').addEventListener('click', testConnection);

    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => {
            const urlValue = document.querySelector('.url-value');
            if (urlValue) {
                navigator.clipboard.writeText(urlValue.textContent.trim())
                    .then(() => showToast(t('msg-addr-copied'), 'success'))
                    .catch(() => showToast(t('toast-copy-error'), 'error'));
            }
        });
    }

    document.getElementById('refresh-windows-btn').addEventListener('click', loadWindows);
    document.getElementById('refresh-clients-btn').addEventListener('click', refreshClients);
    document.getElementById('browse-file-btn').addEventListener('click', browseFile);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('reset-settings-btn').addEventListener('click', resetSettings);

    const triggerSummaryUpdate = () => { if (window.updateStreamSummary) window.updateStreamSummary(); };
    document.getElementById('fps-select').addEventListener('change', triggerSummaryUpdate);
    document.getElementById('quality-select').addEventListener('change', triggerSummaryUpdate);

    // theme toggle logic
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const toggle = document.getElementById('theme-toggle');
        const isDark = !toggle.classList.contains('active');

        if (isDark) {
            toggle.classList.add('active');
            applyTheme('light');
        } else {
            toggle.classList.remove('active');
            applyTheme('dark');
        }
    });

    document.getElementById('lang-select').addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });

    document.getElementById('clear-logs-btn').addEventListener('click', clearLogs);
    document.getElementById('export-logs-btn').addEventListener('click', exportLogs);
    document.getElementById('log-level-select').addEventListener('change', filterLogs);

    // audio ui logic
    const audioCheckbox = document.getElementById('audio-checkbox');
    const audioToggleSwitch = document.getElementById('audio-toggle-switch');
    const sidebarAudioBtn = document.getElementById('sidebar-audio-btn');
    const volumeContainer = document.getElementById('volume-container');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    const audioModeSelect = document.getElementById('audio-mode-select');

    const updateSliderFill = (slider) => {
        if (!slider) return;
        const val = slider.value;
        const min = slider.min || 0;
        const max = slider.max || 100;
        const percentage = ((val - min) / (max - min)) * 100;
        slider.style.backgroundSize = `${percentage}% 100%`;
    };

    // function to toggle audio state
    const toggleAudio = (forceState = null) => {
        const newState = forceState !== null ? forceState : !audioCheckbox.checked;
        audioCheckbox.checked = newState;

        if (audioToggleSwitch) {
            if (newState) audioToggleSwitch.classList.add('active');
            else audioToggleSwitch.classList.remove('active');
        }

        if (sidebarAudioBtn) {
            if (newState) {
                sidebarAudioBtn.classList.add('active');
                sidebarAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                sidebarAudioBtn.title = t('sound-on');
                sidebarAudioBtn.dataset.i18nTooltip = 'sound-on';
            } else {
                sidebarAudioBtn.classList.remove('active');
                sidebarAudioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
                sidebarAudioBtn.title = t('sound-off');
                sidebarAudioBtn.dataset.i18nTooltip = 'sound-off';
            }
        }

        if (volumeContainer) volumeContainer.style.display = newState ? 'flex' : 'none';

        // use helper to toggle wrapper for custom select
        if (audioModeSelect) {
            if (window.toggleSelectVisibility) window.toggleSelectVisibility('audio-mode-select', newState);
            else audioModeSelect.style.display = newState ? 'block' : 'none';
        }

        updateAudioVisibility();
    };

    if (audioToggleSwitch) {
        audioToggleSwitch.addEventListener('click', () => toggleAudio());
    }

    if (sidebarAudioBtn) {
        sidebarAudioBtn.addEventListener('click', () => toggleAudio());
    }

    if (volumeSlider) {
        updateSliderFill(volumeSlider);

        volumeSlider.addEventListener('input', (e) => {
            if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
            updateSliderFill(e.target);
        });
    }

    // initial state sync (internal helper)
    window.syncAudioUI = () => {
        toggleAudio(audioCheckbox.checked);
        if (volumeSlider) {
            if (volumeValue) volumeValue.textContent = `${volumeSlider.value}%`;
            updateSliderFill(volumeSlider);
        }
    };

    const updateAudioVisibility = () => {
        const isEnabled = audioCheckbox.checked;
        const mode = audioModeSelect ? audioModeSelect.value : 'tv';

        const outputGroup = document.getElementById('audio-output-group');
        const captureGroup = document.getElementById('audio-capture-group');

        if (outputGroup) {
            outputGroup.style.display = (isEnabled && mode === 'local') ? 'block' : 'none';
        }
        if (captureGroup) {
            captureGroup.style.display = (isEnabled && mode === 'local') ? 'block' : 'none';
        }
    };

    if (audioModeSelect) {
        audioModeSelect.addEventListener('change', updateAudioVisibility);
    }

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    const fpsCard = document.getElementById('fps-stat-card');
    if (fpsCard) {
        fpsCard.addEventListener('click', () => {
            switchPage('settings');
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelector('.nav-item[data-page="settings"]')?.classList.add('active');

            setTimeout(() => {
                const select = document.getElementById('fps-select');
                const customTrigger = select.parentNode.querySelector('.custom-select-trigger');
                if (customTrigger) customTrigger.click();
                select.focus();
                select.closest('.form-group').style.animation = 'highlight 1s';
            }, 100);
        });
    }

    const qualityCard = document.getElementById('quality-stat-card');
    if (qualityCard) {
        qualityCard.addEventListener('click', () => {
            switchPage('settings');
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelector('.nav-item[data-page="settings"]')?.classList.add('active');

            setTimeout(() => {
                const select = document.getElementById('quality-select');
                const customTrigger = select.parentNode.querySelector('.custom-select-trigger');
                if (customTrigger) customTrigger.click();
                select.focus();
                select.closest('.form-group').style.animation = 'highlight 1s';
            }, 100);
        });
    }

    window.electronAPI.onUpdateAvailable(() => {
        showToast(t('toast-update-available'), 'info');
    });

    window.electronAPI.onUpdateDownloaded(() => {
        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast toast-success" style="opacity:1; transform:translateY(0); padding-bottom:15px; pointer-events:auto;">
                <i class="fas fa-check-circle"></i> Gotowa nowa wersja programu! 
                <button onclick="window.electronAPI.installUpdate()" class="btn btn-sm btn-primary" style="margin-left:10px;">Zainstaluj i zrestartuj</button>
                <button onclick="document.getElementById('${toastId}').remove()" class="toast-close"><i class="fas fa-times"></i></button>
            </div>
        `;
        const container = document.getElementById('toast-container');
        if (container) {
            container.insertAdjacentHTML('beforeend', toastHtml);
        } else {
            showToast(t('toast-update-downloaded'), 'success');
        }
    });

    window.electronAPI.onStreamError && window.electronAPI.onStreamError((e, msg) => {
        showToast(`Błąd Transmisji: ${msg}`, 'error');
        stopStreaming();
    });

    window.electronAPI.onClientConnected && window.electronAPI.onClientConnected((e, client) => {
        log('INFO', `Klient połączony: ${client.ip || 'Nieznany'}`);
        if (window.refreshClients) window.refreshClients();
    });

    window.electronAPI.onClientDisconnected && window.electronAPI.onClientDisconnected((e, client) => {
        log('INFO', `Klient rozłączony: ${client.ip || 'Nieznany'}`);
        if (window.refreshClients) window.refreshClients();
    });

    window.electronAPI.onStartStream(async () => {
        await startStreaming();
    });

    window.electronAPI.onStopStream(async () => {
        await stopStreaming();
        if (window.stopLocalAudioSync) window.stopLocalAudioSync();
    });

    // native file streaming commands
    window.electronAPI.onNativeFileStream((event, url) => {
        const img = document.getElementById('stream-preview');
        const placeholder = document.getElementById('preview-placeholder');
        const video = document.getElementById('file-stream-preview');
        const videoContainer = document.getElementById('file-stream-container');

        if (img) img.classList.add('hidden');
        if (placeholder) placeholder.classList.add('hidden');

        if (video) {
            video.src = url;
            video.muted = true;
            video.classList.remove('hidden');
            if (videoContainer) videoContainer.classList.remove('hidden');
            video.play().catch(e => console.error("Error playing file preview:", e));
        }
    });

    const fileVideo = document.getElementById('file-stream-preview');
    if (fileVideo) {
        fileVideo.addEventListener('play', () => {
            window.electronAPI.playbackControl('play', fileVideo.currentTime, fileVideo.duration, fileVideo.paused);
        });
        fileVideo.addEventListener('pause', () => {
            window.electronAPI.playbackControl('pause', fileVideo.currentTime, fileVideo.duration, fileVideo.paused);
        });
        fileVideo.addEventListener('seeked', () => {
            window.electronAPI.playbackControl('seek', fileVideo.currentTime, fileVideo.duration, fileVideo.paused);
        });
    }

    window.electronAPI.onTogglePause(() => {
        togglePause();
    });

    window.electronAPI.onAutoStart(async () => {
        if (AppState.serverConfig.autoStartStream) {
            setTimeout(startStreaming, 2000);
        }
    });

    window.electronAPI.onStreamFrame((event, frameData) => {
        if (!AppState.isStreaming) return;

        const img = document.getElementById('stream-preview');
        const placeholder = document.getElementById('preview-placeholder');
        const video = document.getElementById('file-stream-preview');
        const videoContainer = document.getElementById('file-stream-container');

        if (videoContainer && !videoContainer.classList.contains('hidden')) {
            return; // skip mjpeg parsing if running file natively
        }

        if (img) {
            img.src = `data:image/jpeg;base64,${frameData}`;

            if (img.classList.contains('hidden')) {
                img.classList.remove('hidden');
                if (placeholder) placeholder.classList.add('hidden');
                if (videoContainer) videoContainer.classList.add('hidden');
            }
        }
    });

    const customPlayBtn = document.getElementById('custom-play-pause-btn');
    const customMuteBtn = document.getElementById('custom-mute-btn');
    const customSlider = document.getElementById('custom-progress-slider');
    const customTimeDisplay = document.getElementById('custom-time-display');
    const customControls = document.getElementById('custom-video-controls');

    // helper to format MM:SS
    const formatTime = (secs) => {
        if (isNaN(secs)) return "00:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (customPlayBtn && customSlider && customTimeDisplay && customControls && fileVideo) {
        if (customMuteBtn) {
            customMuteBtn.addEventListener('click', () => {
                fileVideo.muted = !fileVideo.muted;
                if (fileVideo.muted) {
                    customMuteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
                } else {
                    customMuteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                }
            });
            customMuteBtn.innerHTML = fileVideo.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        }

        customPlayBtn.addEventListener('click', () => {
            if (fileVideo.paused) {
                fileVideo.play().catch(e => console.error("Play error:", e));
            } else {
                fileVideo.pause();
            }
        });

        fileVideo.addEventListener('play', () => {
            customPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
            customControls.classList.remove('active');
        });

        fileVideo.addEventListener('pause', () => {
            customPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            customControls.classList.add('active');
        });

        fileVideo.addEventListener('loadedmetadata', () => {
            customSlider.max = fileVideo.duration;
            customTimeDisplay.textContent = `${formatTime(0)} / ${formatTime(fileVideo.duration)}`;
        });

        fileVideo.addEventListener('timeupdate', () => {
            if (!customSlider.matches(':active')) {
                customSlider.value = fileVideo.currentTime;
            }
            customTimeDisplay.textContent = `${formatTime(fileVideo.currentTime)} / ${formatTime(fileVideo.duration)}`;
            const percentage = (customSlider.value / customSlider.max) * 100;
            customSlider.style.setProperty('--value', percentage + '%');
        });

        customSlider.addEventListener('input', (e) => {
            fileVideo.currentTime = e.target.value;
            const percentage = (e.target.value / customSlider.max) * 100;
            customSlider.style.setProperty('--value', percentage + '%');
        });
    }

    const toggleBtn = document.getElementById('toggle-preview-btn');
    const previewContentWrapper = document.getElementById('preview-content-wrapper');
    const previewHiddenMsg = document.getElementById('preview-hidden-message');

    if (toggleBtn && previewContentWrapper) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = previewContentWrapper.classList.contains('hidden');
            if (isHidden) {
                previewContentWrapper.classList.remove('hidden');
                if (previewHiddenMsg) previewHiddenMsg.classList.add('hidden');
                toggleBtn.innerHTML = '<i class="fas fa-eye fa-lg"></i>';
                toggleBtn.classList.remove('text-muted');
            } else {
                previewContentWrapper.classList.add('hidden');
                if (previewHiddenMsg) previewHiddenMsg.classList.remove('hidden');
                toggleBtn.innerHTML = '<i class="fas fa-eye-slash fa-lg"></i>';
                toggleBtn.classList.add('text-muted');
            }
        });
    }

}

// dashboard interaction
const clientsCard = document.getElementById('clients-stat-card');
if (clientsCard) {
    clientsCard.addEventListener('click', () => {
        switchPage('clients');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector('.nav-item[data-page="clients"]')?.classList.add('active');
    });
}

function copyServerAddress() {
    const address = document.getElementById('tv-address').textContent;
    navigator.clipboard.writeText(address)
        .then(() => showToast(t('msg-addr-copied'), 'success'))
        .catch(err => {
            console.error('Błąd kopiowania:', err);
            showToast(t('toast-copy-error'), 'error');
        });
}

function testConnection() {
    showToast(t('toast-test-conn'), 'info');
    setTimeout(() => {
        showToast(t('toast-conn-ok'), 'success');
    }, 1000);
}

function startAutoRefresh() {
    setInterval(() => {
        if (AppState.isStreaming) {
            refreshClients();
        }
    }, 5000);

    setInterval(() => {
        loadMonitors();
    }, 30000);
}