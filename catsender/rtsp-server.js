const EventEmitter = require('events');
const log = require('electron-log');

class RTSPServer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            rtspPort: config.rtspPort || 8554,
            ...config
        };
        this.isRunning = false;
    }

    async start() {
        this.isRunning = true;
        log.info('[RTSP] Server wrapper started (FFmpeg will listen directly)');
        this.emit('started');
        return Promise.resolve();
    }

    async stop() {
        this.isRunning = false;
        log.info('[RTSP] Server wrapper stopped');
        this.emit('stopped');
        return Promise.resolve();
    }

    getStreamUrl() {
        const hostname = this.config.hostname || 'localhost';
        return `rtsp://${hostname}:${this.config.rtspPort}/live`;
    }

    getStatus() {
        return {
            running: this.isRunning,
            rtspPort: this.config.rtspPort,
            urls: {
                rtsp: this.getStreamUrl()
            }
        };
    }
}

module.exports = { RTSPServer };
