const AppState = {
    isStreaming: false,
    serverConfig: null,
    selectedSource: 'screen',
    selectedMonitor: 0,
    selectedWindow: null,
    selectedWindowName: null,
    selectedFile: null,
    connectedClients: [],
    logs: [],
    serverStatus: 'offline', // track status persistently
    monitors: [], // store monitors for access
    originalAudioDevice: null // store original device for restore
};

// make it global
window.AppState = AppState;
