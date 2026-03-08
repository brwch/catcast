/* --- Local Audio Sync Implementation --- */
let audioCtx = null;
let audioWs = null;
let AUDIO_DELAY_SEC = 5.0;
let basePts = null;
let baseTime = null;
let nextStartTime = 0;
let targetDeviceId = null;
let deviceCheckInterval = null;

// Initial registration for slider
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('audio-delay-slider');
    const label = document.getElementById('audio-delay-value');

    if (slider && label) {
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            AUDIO_DELAY_SEC = val;
            label.textContent = val.toFixed(1) + 's';

            if (audioCtx) {
                basePts = null;
                baseTime = null;
                nextStartTime = audioCtx.currentTime + AUDIO_DELAY_SEC;
            }
        });
    }
});

async function startLocalAudioSync(port, explicitDeviceId = null) {
    if (audioWs) audioWs.close();

    const sliderVal = document.getElementById('audio-delay-slider')?.value;
    if (sliderVal) AUDIO_DELAY_SEC = parseFloat(sliderVal);

    const mode = document.getElementById('audio-mode-select')?.value;
    if (mode !== 'local') return;

    audioWs = new WebSocket(`ws://127.0.0.1:${port}`);

    audioWs.binaryType = 'arraybuffer';

    audioWs.onopen = () => {

        basePts = null;
        baseTime = null;

        targetDeviceId = explicitDeviceId;

        if (!targetDeviceId) {
            targetDeviceId = document.getElementById('audio-output-select')?.value;
        }

        initAudioContext(targetDeviceId);

        if (deviceCheckInterval) clearInterval(deviceCheckInterval);
        deviceCheckInterval = setInterval(() => {
            if (audioCtx && targetDeviceId) {
                const currentSinkId = audioCtx.sinkId || 'default';
                const currentState = audioCtx.state;

                if (currentSinkId !== targetDeviceId) {
                    console.error('[AudioSync] ⚠ DEVICE CHANGED DETECTED!');
                    audioCtx.setSinkId(targetDeviceId).then(() => {
                    }).catch(err => {
                        console.error('[AudioSync] ✗ Failed to restore device:', err);
                    });
                }

                if (currentState === 'suspended') {
                    console.warn('[AudioSync] ⚠ AudioContext is suspended! Resuming...');
                    audioCtx.resume().then(() => {
                    }).catch(err => {
                        console.error('[AudioSync] ✗ Failed to resume:', err);
                    });
                }
            }
        }, 2000);
    };

    audioWs.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
            playAudioChunk(event.data);
        }
    };

    audioWs.onerror = (e) => console.error('[AudioSync] Error:', e);
}

function stopLocalAudioSync() {

    if (deviceCheckInterval) {
        clearInterval(deviceCheckInterval);
        deviceCheckInterval = null;
    }

    if (audioWs) {
        audioWs.close();
        audioWs = null;
    }
    if (audioCtx) {
        try {
            audioCtx.close().catch(e => console.warn('[AudioSync] Context close error:', e));
        } catch (e) {
            console.error('[AudioSync] Error closing audio context:', e);
        }
        audioCtx = null;
    }
}

async function initAudioContext(deviceId) {
    if (audioCtx) {
        await audioCtx.close();
        audioCtx = null;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
    });

    if (deviceId && typeof audioCtx.setSinkId === 'function') {

        try {
            await audioCtx.setSinkId(deviceId);

            if (audioCtx.sinkId !== deviceId) {
                console.error('[AudioSync] ✗ VERIFICATION FAILED! sinkId mismatch!');

                await audioCtx.setSinkId(deviceId);

                if (audioCtx.sinkId !== deviceId) {
                    console.error('[AudioSync] ✗ RETRY FAILED! Using default output.');
                }
            }

        } catch (err) {
            console.error('[AudioSync] ✗ Failed to set sink device:', err);
            console.error('[AudioSync] Will use default output device');
        }
    } else if (deviceId) {
        console.warn('[AudioSync] setSinkId not supported in this browser!');
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

function playAudioChunk(packet) {
    if (!audioCtx) return;

    if (packet.byteLength <= 8) return;

    const view = new DataView(packet);
    const pts = view.getFloat64(0, true);
    const audioData = packet.slice(8);

    if (audioData.byteLength % 2 !== 0) {
        console.warn('[AudioSync] Dropped malformed chunk (odd bytes)');
        return;
    }

    const int16 = new Int16Array(audioData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = audioCtx.createBuffer(2, int16.length / 2, 48000);
    audioBuffer.copyToChannel(float32.filter((_, i) => i % 2 === 0), 0);
    audioBuffer.copyToChannel(float32.filter((_, i) => i % 2 !== 0), 1);

    const now = audioCtx.currentTime;

    if (basePts === null || baseTime === null) {
        basePts = pts;
        baseTime = now;
        nextStartTime = now + AUDIO_DELAY_SEC;
    }

    const timeOffset = (pts - basePts) / 1000.0;
    const scheduledTime = baseTime + timeOffset + AUDIO_DELAY_SEC;

    const gap = scheduledTime - nextStartTime;
    const absGap = Math.abs(gap);

    if (absGap > 0.5) {
        basePts = pts;
        baseTime = now;
        nextStartTime = now + AUDIO_DELAY_SEC;
    }

    let playTime = scheduledTime;
    if (absGap < 0.025) {
        playTime = nextStartTime;
    }

    if (playTime < now) {
        playTime = now;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start(playTime);

    nextStartTime = playTime + audioBuffer.duration;
}

// global expose
window.startLocalAudioSync = startLocalAudioSync;
window.stopLocalAudioSync = stopLocalAudioSync;
window.syncAudioUI = () => { // helper wire up that might be called elsewhere
    // logic resides in renderer.js wiring, but placeholder here if needed
};
