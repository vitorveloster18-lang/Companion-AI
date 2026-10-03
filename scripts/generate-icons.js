import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(size, primaryColor = [124, 58, 237, 255]) {
  // size x size RGBA
  const width = size;
  const height = size;

  // Uncompressed raw scanlines: each line starts with filter byte 0
  const lineLength = 1 + width * 4;
  const rawData = Buffer.alloc(lineLength * height);

  const radius = size * 0.44;
  const center = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * lineLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background rounded squircle / circle
      if (dist <= radius) {
        // Gradient from violet #7c3aed to cyan #06b6d4
        const t = (x + y) / (width + height);
        const r = Math.round(primaryColor[0] * (1 - t * 0.4) + 6 * (t * 0.4));
        const g = Math.round(primaryColor[1] * (1 - t * 0.4) + 182 * (t * 0.4));
        const b = Math.round(primaryColor[2] * (1 - t * 0.4) + 212 * (t * 0.4));
        
        // Edge antialiasing
        let alpha = 255;
        if (dist > radius - 2) {
          alpha = Math.max(0, Math.min(255, Math.round((radius - dist) * 127.5)));
        }

        // Inner decorative circle / core
        if (dist < radius * 0.25) {
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
          rawData[pixelOffset + 3] = alpha;
        } else {
          rawData[pixelOffset] = r;
          rawData[pixelOffset + 1] = g;
          rawData[pixelOffset + 2] = b;
          rawData[pixelOffset + 3] = alpha;
        }
      } else {
        // Transparent outside
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // CRC32 over type + data
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc >>> 0, 8 + len);
    return buf;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Table-based CRC32
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPNG(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPNG(512));
console.log('✅ Icons generated in public/icon-192.png and public/icon-512.png');
