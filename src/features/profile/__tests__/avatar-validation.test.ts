// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_IMAGE_LIMITS,
  inspectAvatarImage,
  inspectDecodableAvatarImage,
} from '../avatar-validation';

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, payload: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + payload.length);
  result.writeUInt32BE(payload.length, 0);
  typeBytes.copy(result, 4);
  payload.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])), 8 + payload.length);
  return result;
}

function insertAfterPngHeaderChunk(png: Buffer, chunk: Buffer): Buffer {
  const firstChunkEnd = 8 + 12 + png.readUInt32BE(8);
  return Buffer.concat([png.subarray(0, firstChunkEnd), chunk, png.subarray(firstChunkEnd)]);
}

function corruptPngPayloadButRepairChunkCrc(pngInput: Buffer): Buffer {
  const png = Buffer.from(pngInput);
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const typeStart = offset + 4;
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + length;
    if (png.toString('ascii', typeStart, typeStart + 4) === 'IDAT' && length >= 4) {
      png[payloadEnd - 1] ^= 0xff;
      png.writeUInt32BE(crc32(png.subarray(typeStart, payloadEnd)), payloadEnd);
      return png;
    }
    offset = payloadEnd + 4;
  }
  throw new Error('PNG fixture has no IDAT chunk');
}

function losslessWebp(width: number, height: number, alpha: boolean): Buffer {
  const packed = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | (alpha ? 1 << 28 : 0);
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  payload.writeUInt32LE(packed >>> 0, 1);
  const chunk = Buffer.alloc(8 + payload.length + 1);
  chunk.write('VP8L', 0, 'ascii');
  chunk.writeUInt32LE(payload.length, 4);
  payload.copy(chunk, 8);
  const webp = Buffer.concat([Buffer.from('RIFF0000WEBP', 'ascii'), chunk]);
  webp.writeUInt32LE(webp.length - 8, 4);
  return webp;
}

describe('avatar binary validation', () => {
  it.each([
    ['public/brand/axe-prime-emblem.png', 'image/png'],
    ['public/brand/og-image.jpg', 'image/jpeg'],
    ['public/media/axe-reward-iphone.webp', 'image/webp'],
  ] as const)('accepts the real static asset %s', (relativePath, contentType) => {
    const image = readFileSync(resolve(process.cwd(), relativePath));

    expect(inspectAvatarImage(image)).toMatchObject({ contentType });
  });

  it('accepts a structurally valid single-frame GIF', () => {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

    expect(inspectAvatarImage(gif)).toEqual({ contentType: 'image/gif', width: 1, height: 1 });
  });

  it('accepts the VP8L alpha hint while requiring version zero', () => {
    expect(inspectAvatarImage(losslessWebp(32, 24, true))).toEqual({
      contentType: 'image/webp',
      width: 32,
      height: 24,
    });

    const unsupportedVersion = losslessWebp(32, 24, false);
    unsupportedVersion[24] |= 0x20;
    expect(inspectAvatarImage(unsupportedVersion)).toBeNull();
  });

  it('rejects a PNG whose declared raster exceeds the pixel budget', () => {
    const png = Buffer.from(
      readFileSync(resolve(process.cwd(), 'public/brand/axe-prime-emblem.png'))
    );
    png.writeUInt32BE(8_192, 16);
    png.writeUInt32BE(8_192, 20);
    png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);

    expect(inspectAvatarImage(png)).toBeNull();
  });

  it('rejects APNG animation control chunks', () => {
    const png = readFileSync(resolve(process.cwd(), 'public/brand/axe-prime-emblem.png'));
    const animationControl = Buffer.alloc(8);
    animationControl.writeUInt32BE(1, 0);
    const apng = insertAfterPngHeaderChunk(png, pngChunk('acTL', animationControl));

    expect(inspectAvatarImage(apng)).toBeNull();
  });

  it('rejects metadata beyond the bounded allowance', () => {
    const png = readFileSync(resolve(process.cwd(), 'public/brand/axe-prime-emblem.png'));
    const oversizedText = Buffer.alloc(AVATAR_IMAGE_LIMITS.maximumMetadataBytes + 1, 0x61);
    const image = insertAfterPngHeaderChunk(png, pngChunk('tEXt', oversizedText));

    expect(inspectAvatarImage(image)).toBeNull();
  });

  it('rejects GIF animation extensions even before a second frame', () => {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    const applicationExtension = Buffer.concat([
      Buffer.from([0x21, 0xff, 0x0b]),
      Buffer.from('NETSCAPE2.0', 'ascii'),
      Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
    ]);
    const globalColorTableEnd = 19;
    const animated = Buffer.concat([
      gif.subarray(0, globalColorTableEnd),
      applicationExtension,
      gif.subarray(globalColorTableEnd),
    ]);

    expect(inspectAvatarImage(animated)).toBeNull();
  });

  it('rejects a container whose repaired CRC hides corrupt compressed pixels', async () => {
    const png = readFileSync(resolve(process.cwd(), 'public/brand/axe-prime-emblem.png'));
    const corrupt = corruptPngPayloadButRepairChunkCrc(png);

    expect(inspectAvatarImage(corrupt)).toMatchObject({ contentType: 'image/png' });
    await expect(inspectDecodableAvatarImage(corrupt)).resolves.toBeNull();
    await expect(inspectDecodableAvatarImage(png)).resolves.toMatchObject({
      contentType: 'image/png',
    });
  });
});
