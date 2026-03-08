const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const log = require('electron-log');
const { screenCapture } = require('./screen-capturer');
const EventEmitter = require('events');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const { RTSPServer } = require('./rtsp-server');

class StreamingServer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.clients = new Map();
    this.isStreaming = false;
    this.streamInterval = null;
    this.frameCount = 0;
    this.startTime = null;
    this.bestEncoder = config.bestEncoder || null;

    if (!this.bestEncoder) {
      this.determineBestEncoder().catch(err => log.error('Encoder check failed', err));
    } else {
      log.info(`[ENCODER] Zaladowano z cache: ${this.bestEncoder}`);
    }

    this.qualityMap = {
      'low': { bitrate: '4M', maxrate: '5M', scale: '1280:720' },
      'medium': { bitrate: '6M', maxrate: '8M', scale: '1920:1080' },
      'high': { bitrate: '8M', maxrate: '10M', scale: '1920:1080' },
      'ultra': { bitrate: '12M', maxrate: '15M', scale: '1920:1080' }
    };

    this.rtspServer = new RTSPServer({
      rtspPort: config.rtspPort || 8554,
      httpPort: config.httpPort || 8000,
      hostname: config.hostname || this.getLocalIP()
    });

    this.rtspServer.on('started', () => {
      this.emit('rtsp-ready');
    });

    this.rtspServer.on('stream-started', (info) => { });

    this.app = express();
    this.server = http.createServer(this.app);

    this.httpSockets = new Set();
    this.server.on('connection', (socket) => {
      this.httpSockets.add(socket);
      socket.once('close', () => this.httpSockets.delete(socket));
    });

    this.wss = new WebSocket.Server({ server: this.server });

    this.setupWebSocket();
    this.setupRoutes();
  }

  getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  getStreamUrl() {
    const ip = this.getLocalIP();
    return `http://${ip}:8081`;
  }


  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = req.headers['sec-websocket-key'] || Date.now().toString();
      const clientInfo = {
        id: clientId,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: new Date(),
        lastActivity: Date.now(),
        type: 'lg-tv'
      };

      this.clients.set(ws, clientInfo);
      log.info(`📱 Nowy klient: ${clientInfo.ip} (${clientInfo.userAgent})`);

      ws.send(JSON.stringify({
        type: 'welcome',
        server: 'CatCast Sender',
        version: '1.0.0',
        clientId: clientId,
        timestamp: Date.now()
      }));

      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('message', (data) => {
        clientInfo.lastActivity = Date.now();
        const rawMsg = data.toString();

        try {
          const message = JSON.parse(rawMsg);
          this.handleMessage(ws, message, clientInfo);
        } catch (error) {
          error.rawMessage = rawMsg;
          log.error('Błąd parsowania wiadomości:', error, 'Raw:', rawMsg);
        }
      });

      ws.on('pong', () => {
        clientInfo.lastActivity = Date.now();
      });

      ws.on('close', () => {
        clearInterval(heartbeatInterval);
        this.clients.delete(ws);
        log.info(`❌ Klient rozłączony: ${clientInfo.ip}`);
      });

      ws.on('error', (error) => {
        log.error('WebSocket error:', error);
      });

      log.info(`Nowy klient połączony. ID: ${clientId}, IP: ${clientInfo.ip}. Total clients: ${this.clients.size}`);
    });
  }

  setupRoutes() {
    // info page
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>CatCast Sender</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
            .online { background: #4CAF50; color: white; }
            .offline { background: #f44336; color: white; }
          </style>
        </head>
        <body>
          <h1>📺 CatCast Sender</h1>
          <div class="status ${this.isStreaming ? 'online' : 'offline'}">
            Status: ${this.isStreaming ? 'Transmisja aktywna' : 'Transmisja nieaktywna'}
          </div>
          <p>Port: ${this.config.port || 8080}</p>
          <p>Podłączonych klientów: ${this.clients.size}</p>
          <p>FPS: ${this.config.fps || 30}</p>
          <p>Jakość: ${this.config.quality || 'medium'}</p>
        </body>
        </html>
      `);
    });

    // server info (JSON)
    this.app.get('/api/info', (req, res) => {
      res.json({
        server: 'CatCast Sender',
        version: '1.0.0',
        isStreaming: this.isStreaming,
        clients: this.clients.size,
        config: this.config,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        frameCount: this.frameCount
      });
    });

    // clients list
    this.app.get('/api/clients', (req, res) => {
      const clientsList = Array.from(this.clients.values()).map(client => ({
        ...client,
        connectedAt: client.connectedAt.toISOString(),
        lastActivity: client.lastActivity
      }));
      res.json(clientsList);
    });

    // stream file natively via HTTP
    this.app.get('/api/stream-file', (req, res) => {
      if (!this.isStreaming || this.config.captureSource !== 'file' || !this.config.selectedFile) {
        return res.status(404).send('No active file stream.');
      }

      const filePath = this.config.selectedFile;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'video/mp4';
      if (ext === '.mkv') mimeType = 'video/x-matroska';
      else if (ext === '.webm') mimeType = 'video/webm';
      else if (ext === '.avi') mimeType = 'video/x-msvideo';

      res.setHeader('Content-Type', mimeType);

      res.sendFile(filePath, { acceptRanges: true, dotfiles: 'allow' }, (err) => {
        if (err) {
          log.error('Błąd podczas wysyłania pliku przez res.sendFile:', err);
          if (!res.headersSent) {
            res.status(err.status || 500).end();
          }
        }
      });
    });
  }

  handleMessage(ws, message, clientInfo) {
    switch (message.type) {
      case 'hello':
        // log.info(`[PROTO] Handshake from ${message.device} (v${message.version})`);

        if (message.deviceInfo) {
          clientInfo.deviceInfo = message.deviceInfo;
          clientInfo.type = message.deviceInfo.type || 'unknown';
        }
        ws.send(JSON.stringify({
          type: 'ack',
          message: 'connected',
          timestamp: Date.now()
        }));

        if (this.isStreaming) {
          const streamUrl = this.getStreamUrl();
          const streamUrls = {
            rtsp: streamUrl,
            http: streamUrl
          };

          log.info(`[AUTO-START] Sending stream_started to new client ${clientInfo.ip} | URL: ${streamUrl}`);
          ws.send(JSON.stringify({
            type: 'stream_started',
            config: this.config,
            startPaused: this.config.startPaused,
            streamUrls: streamUrls,
            url: streamUrl,
            rtspUrl: streamUrl,
            timestamp: Date.now()
          }));
        }
        break;

      case 'command':
        this.handleCommand(ws, message.command, message, clientInfo);
        break;

      case 'start_stream':
        log.info(`[CMD] START_STREAM execution for ${clientInfo ? clientInfo.ip : 'unknown'}`);
        if (!this.isStreaming) {
          this.startStreaming(message.data || {});
        } else {
          // log.info('Stream is already running, sending info to new client');
          const streamUrl = this.getStreamUrl();
          ws.send(JSON.stringify({
            type: 'stream_started',
            config: this.config,
            startPaused: this.config.startPaused,
            streamUrls: { rtsp: streamUrl, http: streamUrl },
            url: streamUrl,
            rtspUrl: streamUrl,
            timestamp: Date.now()
          }));
        }
        break;

      case 'stop_stream':
        this.stopStreaming();
        ws.send(JSON.stringify({
          type: 'stream_stopped',
          timestamp: Date.now()
        }));
        break;

      case 'playback_control':
        this.handlePlaybackControl(message.action, message.time);
        break;


      case 'change_quality':
        if (data && this.qualityMap[data.value]) {
          const quality = data.quality || data.value || data;
          if (this.qualityMap[quality]) {
            this.config.quality = quality;
            this.broadcast({
              type: 'config_changed',
              config: { quality: quality }
            });
          }
        }
        break;

      case 'change_source':
        const sourceData = data.source || data;
        if (sourceData && ['screen', 'window', 'file'].includes(sourceData.source)) {
          this.config.captureSource = sourceData.source;
          this.config.selectedWindow = sourceData.window;
          this.config.selectedFile = sourceData.file;
          this.broadcast({
            type: 'source_changed',
            source: sourceData
          });
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: message.timestamp
        }));
        break;

      default:
        log.warn(`Unknown command: ${command}`);
    }
  }

  handlePlaybackControl(action, time, total, paused) {
    if (this.config) {
      if (paused !== undefined) this.config.startPaused = paused;
      else if (action === 'pause') this.config.startPaused = true;
      else if (action === 'play') this.config.startPaused = false;
    }

    if (this.config && this.config.captureSource === 'file') {
      if (action === 'seek') {
        this.config.startOffset = time;
        this.isStreaming = false;
        this.stopStreaming(false);
        this.startStreaming(this.config);
      } else if (action === 'play') {
        if (!this.ffmpegProcess) {
          this.config.startOffset = time;
          this.isStreaming = false;
          this.startStreaming(this.config);
        }
      } else if (action === 'pause') {
        // this.stopStreaming(false); // removed to allow instantaneous resuming via TV HTML5 player backpressure
      }
    }

    let safeAction = action;
    if (action === 'seek') safeAction = 'seek_live';

    this.broadcast({
      type: 'playback_control',
      action: safeAction,
      time: time || 0,
      total: total || 0,
      timestamp: Date.now()
    });
  }

  async startStreaming(options = {}) {
    if (this.isStreaming) {
      return;
    }
    this.isStreaming = true; // flag active

    // merge config
    this.config = { ...this.config, ...options };

    this.stopStreaming(false);
    this.isStreaming = true;

    const quality = this.qualityMap[this.config.quality || 'high'];
    const fps = this.config.fps || 60;
    const source = this.config.captureSource || 'screen';

    log.info(`[STREAM] Starting Server. Source: ${source}`);

    log.info(`[STREAM] Quality: ${this.config.quality || 'high'} (${quality.bitrate}) | FPS: ${fps}`);

    const port = this.config.rtspPort || 8554;
    const rtspUrl = `rtsp://0.0.0.0:${port}/live`;

    const args = ['-thread_queue_size', '4096'];
    let useWasapi = false;

    if (source === 'file' && this.config.selectedFile) {
      log.info(`[FFMPEG] Configuring for File Capture: "${this.config.selectedFile}"`);
      if (this.config.startOffset > 0) {
        args.push('-ss', this.config.startOffset.toString());
      }
      args.push(
        '-re', // read input at native frame rate
        '-i', this.config.selectedFile
      );
    } else {
      args.push(
        '-f', 'gdigrab',
        '-framerate', fps.toString(),
        '-draw_mouse', '1',
        '-probesize', '32M',
        '-analyzeduration', '0',
        '-fflags', 'nobuffer'
      );

      if (source === 'window' && this.config.selectedWindow) {
        log.info(`[FFMPEG] Configuring for Window Capture: "${this.config.selectedWindow}"`);
        args.push('-i', `title=${this.config.selectedWindow}`);
      } else {
        if (this.config.monitorBounds) {
          const { x, y, width, height } = this.config.monitorBounds;
          log.info(`[FFMPEG] Capturing Monitor: ${width}x${height} at ${x},${y}`);
          args.push(
            '-offset_x', x.toString(),
            '-offset_y', y.toString(),
            '-video_size', `${width}x${height}`,
            '-i', 'desktop'
          );
        } else {
          log.info('[FFMPEG] Configuring for Full Desktop Capture');
          args.push('-i', 'desktop');
        }
      }
    }

    // enable wasapi for screen capture if requested (disable for file)
    useWasapi = this.config.enableAudio && source !== 'file';

    if (useWasapi) {
      const fs = require('fs');
      const audioExe = path.join(__dirname, 'wasapi_capture.exe').replace('app.asar', 'app.asar.unpacked');
      const audioMode = this.config.audioMode || 'tv';

      if (fs.existsSync(audioExe)) {
        log.info(`[FFMPEG] Enabling WASAPI Audio Capture. Mode: ${audioMode}`);

        const audioArgs = [
          '--sample-rate', '48000',
          '--channels', '2',
          '--bits', '16',
          '--chunk-duration', '0.1'
        ];

        if (this.config.audioCaptureDeviceId && this.config.audioCaptureDeviceId !== 'default') {
          audioArgs.push('--device', this.config.audioCaptureDeviceId);
        }

        this.audioProcess = spawn(audioExe, audioArgs);

        this.audioProcess.stderr.on('data', (d) => {
          const s = d.toString().trim();
          if (s.includes('Error') || s.includes('Warning')) log.info(`[WASAPI] ${s}`);
        });

        this.audioProcess.on('exit', (c) => {
          log.info(`[WASAPI] Exited: ${c}`);
          this.audioProcess = null;
        });

        if (audioMode === 'local') {
          this.audioProcess.stdout.on('data', chunk => this.broadcastAudio(chunk));
        } else {
          args.push(
            '-thread_queue_size', '4096',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'pipe:0'
          );
        }
      }
    }

    const listenUrl = `http://0.0.0.0:8081`;
    const httpStreamUrl = this.getStreamUrl();

    log.info('[STREAM] outputs: Main (NVENC/HTTP), Preview (IS, Stdout)');
    const [w, h] = quality.scale.split(':');
    const videoFilters = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    // setup video encoder arguments
    const encoder = this.bestEncoder || 'libx264';
    let encoderArgs = ['-c:v', encoder];

    if (encoder === 'h264_nvenc') {
      encoderArgs.push(
        '-preset', 'p1',
        '-tune', 'ull',
        '-rc', 'cbr'
      );
    } else if (encoder === 'h264_qsv') {
      encoderArgs.push(
        '-preset', 'veryfast',
        '-vprofile', 'main'
      );
    } else if (encoder === 'h264_amf') {
      encoderArgs.push(
        '-quality', 'speed',
        '-rc', 'cbr'
      );
    } else {
      encoderArgs.push(
        '-preset', 'ultrafast',
        '-tune', 'zerolatency'
      );
    }

    args.push(
      ...encoderArgs,
      '-b:v', quality.bitrate,
      '-maxrate', quality.maxrate,
      '-bufsize', quality.bitrate,
      '-r', fps.toString(),
      '-g', fps.toString(),
      '-strict_gop', '1',
      '-forced-idr', '1',

      // audio enc (map appropriately)
      ...(() => {
        if (source === 'file') {
          return ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-map', '0:v', '-map', '0:a?'];
        } else if (useWasapi && this.config.audioMode === 'tv') {
          return ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-map', '0:v', '-map', '1:a'];
        } else {
          return ['-an', '-map', '0:v'];
        }
      })(),

      '-vf', videoFilters,
      '-pix_fmt', 'yuv420p',
      '-f', 'mpegts',
      '-mpegts_flags', '+initial_discontinuity+resend_headers',
      '-muxdelay', '0',
      '-listen', '1',
      listenUrl
    );

    // low fps, low res
    args.push(
      '-map', '0:v',
      '-update', '1',
      '-r', '2',
      '-s', '480x270',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '5',
      'pipe:1'
    );

    log.info(`[FFMPEG] Launching: ${ffmpeg} ${args.join(' ')}`);

    this.ffmpegProcess = spawn(ffmpeg, args);

    if (this.audioProcess && this.ffmpegProcess.stdin && useWasapi && this.config.audioMode !== 'local') {
      this.audioProcess.stdout.pipe(this.ffmpegProcess.stdin);
      this.ffmpegProcess.stdin.on('error', () => { });
    }

    let jpegBuffer = Buffer.alloc(0);
    const JPG_START = Buffer.from([0xFF, 0xD8]);
    const JPG_END = Buffer.from([0xFF, 0xD9]);

    this.ffmpegProcess.stdout.on('data', (chunk) => {
      jpegBuffer = Buffer.concat([jpegBuffer, chunk]);

      let startIndex = jpegBuffer.indexOf(JPG_START);
      let endIndex = jpegBuffer.indexOf(JPG_END);

      while (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const frameData = jpegBuffer.slice(startIndex, endIndex + 2);
        const base64Data = frameData.toString('base64');

        this.emit('frame', base64Data);

        jpegBuffer = jpegBuffer.slice(endIndex + 2);

        startIndex = jpegBuffer.indexOf(JPG_START);
        endIndex = jpegBuffer.indexOf(JPG_END);
      }

      if (jpegBuffer.length > 5000000) jpegBuffer = Buffer.alloc(0);
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      const str = data.toString();
      if (str.toLowerCase().includes('error') || str.toLowerCase().includes('warning') || str.toLowerCase().includes('fail')) {
        log.warn(`[FFMPEG-DIAG] ${str.trim()}`);
      }

      if (str.includes('frame=') && Math.random() < 0.05) log.debug(`[FFMPEG] ${str.trim()}`);
    });

    this.ffmpegProcess.on('close', (code) => {
      log.info(`[FFMPEG] Process exited: ${code}`);

      if (this.isStreaming && !this.ffmpegProcess.killedIntentionally) {
        if (code !== 0 && code !== null) {
          log.error(`[FFMPEG] Zgadzam sie crash (kod ${code}). Zatrzymuje transmisję.`);
          this.broadcast({ type: 'stream_error', message: `Utracono proces kodowania wideo (Błąd FFmpeg: ${code})` });
          this.emit('stream-error', `Utracono proces kodowania wideo (Błąd FFmpeg: ${code})`);
          this.stopStreaming(true);
        } else {
          log.info('Restarting listener...');
          setTimeout(() => { if (this.isStreaming) this.startStreaming(this.config); }, 1000);
        }
      }
    });

    const streamUrls = { rtsp: httpStreamUrl, http: httpStreamUrl };
    this.broadcast({
      type: 'stream_started',
      config: this.config,
      startPaused: this.config.startPaused,
      streamUrls: streamUrls,
      url: httpStreamUrl,
      rtspUrl: httpStreamUrl,
      timestamp: Date.now()
    });

    log.info(`[STREAM] Active. Source: ${source}`);
  }

  stopStreaming(notifyClients = true) {
    if (notifyClients) {
      this.isStreaming = false;
      this.broadcast({
        type: 'stream_stopped',
        timestamp: Date.now()
      });
      log.info('Transmisja zatrzymana (Listener Stopped) - broadcast sent');
    }

    if (this.ffmpegProcess) {
      log.info('[STREAM] Stopping FFmpeg process...');
      this.ffmpegProcess.killedIntentionally = true;
      try {
        require('child_process').exec(`taskkill /F /T /PID ${this.ffmpegProcess.pid}`);
      } catch (e) {
        this.ffmpegProcess.kill('SIGKILL');
      }
      this.ffmpegProcess = null;
    }

    if (this.audioProcess) {
      log.info('[STREAM] Stopping WASAPI process...');
      this.audioProcess.kill();
      this.audioProcess = null;
    }
  }

  async determineBestEncoder() {
    log.info('[ENCODER] Rozpoczynam wykrywanie wsparcia dla sprzetowego kodowania wideo...');

    const encoders = ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'];

    for (const encoder of encoders) {
      if (encoder === 'libx264') {
        this.bestEncoder = 'libx264';
        log.info('[ENCODER] Brak wsparcia dla sprzetowego kodowania. Uzyje CPU (libx264).');
        break;
      }

      try {
        await new Promise((resolve, reject) => {
          const args = [
            '-f', 'lavfi',
            '-i', 'color=c=black:s=256x256',
            '-pix_fmt', 'nv12',
            '-vframes', '1',
            '-c:v', encoder,
            '-f', 'null',
            '-' // output to nowhere
          ];

          const testProcess = spawn(ffmpeg, args);

          testProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Exit code ${code}`));
            }
          });
          testProcess.on('error', (err) => {
            reject(err);
          });
        });

        this.bestEncoder = encoder;
        log.info(`[ENCODER] Wykryto obslugiwany koder wideo: ${encoder}`);
        break;
      } catch (error) {
        log.info(`[ENCODER] Koder ${encoder} jest nieobslugiwany.`);
      }
    }

    if (this.bestEncoder) {
      this.emit('encoder-determined', this.bestEncoder);
    }
  }

  broadcastAudio(chunk) {
    // wrap audio chunk with timestamp (8 bytes)
    const timestamp = Date.now();
    const header = Buffer.alloc(8);
    header.writeDoubleLE(timestamp, 0);

    const packet = Buffer.concat([header, chunk]);

    for (const [ws, info] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(packet);
      }
    }
  }

  broadcast(data) {
    if (this.clients.size === 0) return;

    // log.debug(`Broadcasting ${data.type} to ${this.clients.size} clients`);

    for (const [ws, info] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      } else {
        log.warn(`Klient ${info.ip} ma zamknięte połączenie (state: ${ws.readyState})`);
      }
    }
  }

  getConnectedClients() {
    return Array.from(this.clients.values());
  }

  disconnectClient(clientId) {
    for (const [ws, info] of this.clients) {
      if (info.id === clientId) {
        log.info(`[SERVER] Forcing disconnect for client: ${info.ip} (${clientId})`);
        ws.close();
        this.clients.delete(ws);
        return true;
      }
    }
    return false;
  }



  async start() {
    return new Promise(async (resolve, reject) => {
      const port = this.config.port || 8080;

      try {
        await this.rtspServer.start();
        log.info('RTSP server started');
      } catch (error) {
        log.error('Failed to start RTSP server:', error);
        return reject(error);
      }

      this.server.listen(port, '0.0.0.0', () => {
        const address = this.server.address();
        log.info(`Serwer uruchomiony na http://${address.address}:${address.port}`);
        resolve({ port: address.port, address: address.address });
      });

      this.server.on('error', (error) => {
        log.error('Błąd serwera:', error);
        reject(error);
      });
    });
  }

  async stop() {
    return new Promise(async (resolve) => {
      for (const [ws] of this.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stream_stopped', timestamp: Date.now() }));
        }
        ws.close();
      }
      this.clients.clear();

      this.stopStreaming();

      await this.rtspServer.stop();

      for (const socket of this.httpSockets) {
        socket.destroy();
      }

      this.server.close(() => {
        log.info('Serwer zatrzymany');
        resolve();
      });
    });
  }
}

module.exports = {
  StreamingServer,
  startStreamingServer: async (config) => {
    const server = new StreamingServer(config);
    await server.start();

    log.info('[SERVER] Auto-starting capture loop...');
    server.startStreaming(config);

    return server;
  }
};