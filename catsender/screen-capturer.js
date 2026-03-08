const { desktopCapturer, screen } = require('electron');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const log = require('electron-log');
const ffmpeg = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const { exec } = require('child_process');

class ScreenCapturer {
  constructor() {
    this.cache = new Map();
    this.windowsCache = null;
    this.cacheTime = 0;
    this.cacheDuration = 5000;
  }

  async getAvailableWindows() {
    const now = Date.now();

    if (this.windowsCache && (now - this.cacheTime) < this.cacheDuration) {
      return this.windowsCache;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 200, height: 200 },
        fetchWindowIcons: true
      });

      const windows = sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        display_id: source.display_id,
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
      }));

      this.windowsCache = windows;
      this.cacheTime = now;

      return windows;
    } catch (error) {
      log.error('Błąd pobierania okien:', error);
      return [];
    }
  }

  async capture(options = {}) {
    const {
      source = 'screen',
      monitorId = 0,
      windowId = null,
      quality = 70,
      scale = 1.0,
      format = 'jpeg'
    } = options;

    const cacheKey = `${source}-${monitorId}-${windowId}-${quality}-${scale}`;
    const now = Date.now();

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (now - cached.timestamp < 100) {
        return cached.data;
      }
    }

    try {
      let imageBuffer;

      if (source === 'file' && options.filePath) {
        imageBuffer = await this.captureFromFile(options.filePath);
      } else {
        const sources = await desktopCapturer.getSources({
          types: [source === 'window' ? 'window' : 'screen'],
          thumbnailSize: screen.getPrimaryDisplay().workAreaSize
        });

        let sourceToCapture;

        if (source === 'window' && windowId) {
          sourceToCapture = sources.find(s => s.id === windowId);
        } else {
          const displays = screen.getAllDisplays();
          const display = displays[monitorId] || displays[0];

          sourceToCapture = sources.find(s => {
            if (s.display_id) {
              return s.display_id === display.id.toString();
            }
            return false;
          }) || sources[0];
        }

        if (!sourceToCapture) {
          throw new Error('Nie znaleziono źródła do przechwycenia');
        }

        imageBuffer = sourceToCapture.thumbnail.toPNG();
      }

      let targetWidth = 1280;

      let sharpImage = sharp(imageBuffer);
      const metadata = await sharpImage.metadata();

      let resizeOptions = {};
      if (metadata.width > targetWidth || scale !== 1.0) {
        const effectiveScale = Math.min(scale, targetWidth / metadata.width);
        const newWidth = Math.round(metadata.width * effectiveScale);
        const newHeight = Math.round(metadata.height * effectiveScale);
        sharpImage = sharpImage.resize(newWidth, newHeight, {
          kernel: sharp.kernel.nearest // fastest scaling
        });
      }

      const processedBuffer = await sharpImage.jpeg({
        quality: 60,
        progressive: false,
        chromaSubsampling: '4:2:0',
        mozjpeg: false
      }).toBuffer();

      this.cache.set(cacheKey, {
        data: processedBuffer,
        timestamp: now
      });

      this.cleanCache();

      return processedBuffer;

    } catch (error) {
      log.error('Błąd przechwytywania ekranu:', error);
      throw error;
    }
  }

  async captureFromFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const os = require('os');
        const uniqueId = Math.random().toString(36).substring(7);
        const tempOutput = path.join(os.tmpdir(), `lg-cast-thumb-${uniqueId}.jpg`);

        const cmd = `"${ffmpeg}" -ss 00:00:01 -i "${filePath}" -vframes 1 -q:v 2 -y "${tempOutput}"`;

        exec(cmd, async (error, stdout, stderr) => {
          if (error) {
            log.error('FFmpeg error:', error);
            // fallback to placeholder on error
            try {
              const placeholder = await this.generatePlaceholder(filePath);
              resolve(placeholder);
            } catch (e) {
              reject(e);
            }
            return;
          }

          try {
            // read the generated file
            const imageBuffer = await fs.readFile(tempOutput);

            // cleanup
            fs.unlink(tempOutput).catch(console.error);

            resolve(imageBuffer);
          } catch (readError) {
            reject(readError);
          }
        });

      } catch (error) {
        log.error('Błąd przechwytywania z pliku:', error);
        reject(error);
      }
    });
  }

  async generatePlaceholder(filePath) {
    return await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 20, g: 20, b: 40 }
      }
    })
      .composite([{
        input: Buffer.from(`
          <svg width="1920" height="1080">
            <rect width="100%" height="100%" fill="#1a1a2e"/>
            <text x="50%" y="45%" text-anchor="middle" fill="#64b5f6" font-size="60" font-family="Arial">
              Plik wideo
            </text>
            <text x="50%" y="55%" text-anchor="middle" fill="#90caf9" font-size="40" font-family="Arial">
              ${path.basename(filePath)}
            </text>
          </svg>
        `),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 1000) { // 1 sekunda
        this.cache.delete(key);
      }
    }
  }

  async getDisplays() {
    const displays = screen.getAllDisplays();
    return displays.map((display, index) => ({
      id: index,
      bounds: display.bounds,
      size: display.size,
      scaleFactor: display.scaleFactor,
      workArea: display.workArea,
      rotation: display.rotation,
      label: `Ekran ${index + 1} (${display.size.width}x${display.size.height})`
    }));
  }
}

module.exports = {
  screenCapture: new ScreenCapturer()
};