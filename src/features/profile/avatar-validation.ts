import '@/src/server/server-only';

import sharp from 'sharp';
import type { AvatarContentType } from './profile.repository';

export const AVATAR_IMAGE_LIMITS = {
  maximumDimension: 8_192,
  maximumPixels: 16_777_216,
  maximumMetadataBytes: 256 * 1024,
} as const;

export type AvatarImageInspection = {
  contentType: AvatarContentType;
  width: number;
  height: number;
};

export class AvatarDecodeBusyError extends Error {
  constructor() {
    super('Avatar decoder is busy');
    this.name = 'AvatarDecodeBusyError';
  }
}

const MAX_CONCURRENT_AVATAR_DECODES = 2;
let activeAvatarDecodes = 0;

function startsWith(data: Buffer, bytes: readonly number[]): boolean {
  return bytes.every((byte, index) => data[index] === byte);
}

function validDimensions(width: number, height: number): boolean {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= AVATAR_IMAGE_LIMITS.maximumDimension &&
    height <= AVATAR_IMAGE_LIMITS.maximumDimension &&
    width * height <= AVATAR_IMAGE_LIMITS.maximumPixels
  );
}

const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function pngCrc32(data: Buffer, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = PNG_CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validPngBitDepth(bitDepth: number, colorType: number): boolean {
  const allowed: Record<number, readonly number[]> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  return allowed[colorType]?.includes(bitDepth) ?? false;
}

function inspectPng(data: Buffer): AvatarImageInspection | null {
  if (!startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let metadataBytes = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < data.length) {
    if (offset + 12 > data.length) return null;
    const chunkLength = data.readUInt32BE(offset);
    const typeStart = offset + 4;
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + chunkLength;
    const chunkEnd = payloadEnd + 4;
    if (payloadEnd < payloadStart || chunkEnd > data.length) return null;

    for (let index = typeStart; index < typeStart + 4; index += 1) {
      const byte = data[index];
      if (!((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a))) return null;
    }
    if (pngCrc32(data, typeStart, payloadEnd) !== data.readUInt32BE(payloadEnd)) return null;

    const chunkType = data.toString('ascii', typeStart, typeStart + 4);
    if (!sawHeader && chunkType !== 'IHDR') return null;
    if (chunkType === 'IHDR') {
      if (sawHeader || chunkLength !== 13) return null;
      width = data.readUInt32BE(payloadStart);
      height = data.readUInt32BE(payloadStart + 4);
      if (
        !validDimensions(width, height) ||
        !validPngBitDepth(data[payloadStart + 8], data[payloadStart + 9]) ||
        data[payloadStart + 10] !== 0 ||
        data[payloadStart + 11] !== 0 ||
        data[payloadStart + 12] > 1
      ) {
        return null;
      }
      sawHeader = true;
    } else if (chunkType === 'IDAT') {
      if (!sawHeader || sawEnd || chunkLength === 0) return null;
      sawImageData = true;
    } else if (chunkType === 'IEND') {
      if (!sawImageData || chunkLength !== 0) return null;
      sawEnd = true;
      offset = chunkEnd;
      break;
    } else if (chunkType === 'acTL' || chunkType === 'fcTL' || chunkType === 'fdAT') {
      return null;
    } else if ((data[typeStart] & 0x20) !== 0) {
      metadataBytes += chunkLength;
      if (metadataBytes > AVATAR_IMAGE_LIMITS.maximumMetadataBytes) return null;
    } else if (chunkType !== 'PLTE') {
      return null;
    } else if (sawImageData || chunkLength === 0 || chunkLength > 768 || chunkLength % 3 !== 0) {
      return null;
    }
    offset = chunkEnd;
  }

  return sawHeader && sawImageData && sawEnd && offset === data.length
    ? { contentType: 'image/png', width, height }
    : null;
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const JPEG_ALLOWED_START_OF_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2]);

function inspectJpeg(data: Buffer): AvatarImageInspection | null {
  if (data.length < 12 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  if (data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) return null;

  let offset = 2;
  let width = 0;
  let height = 0;
  let metadataBytes = 0;
  let sawFrame = false;
  while (offset < data.length - 2) {
    if (data[offset] !== 0xff) return null;
    while (offset < data.length && data[offset] === 0xff) offset += 1;
    if (offset >= data.length) return null;
    const marker = data[offset];
    offset += 1;

    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9) return null;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > data.length - 2) return null;
    const segmentLength = data.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > data.length - 2) return null;
    const payloadStart = offset + 2;
    const payloadLength = segmentLength - 2;

    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
      metadataBytes += payloadLength;
      if (metadataBytes > AVATAR_IMAGE_LIMITS.maximumMetadataBytes) return null;
      if (
        marker === 0xe2 &&
        payloadLength >= 4 &&
        data.toString('ascii', payloadStart, payloadStart + 4) === 'MPF\0'
      ) {
        return null;
      }
    }

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (sawFrame || !JPEG_ALLOWED_START_OF_FRAME_MARKERS.has(marker) || payloadLength < 9) {
        return null;
      }
      const precision = data[payloadStart];
      height = data.readUInt16BE(payloadStart + 1);
      width = data.readUInt16BE(payloadStart + 3);
      const components = data[payloadStart + 5];
      if (
        precision !== 8 ||
        components < 1 ||
        components > 4 ||
        payloadLength !== 6 + components * 3 ||
        !validDimensions(width, height)
      ) {
        return null;
      }
      sawFrame = true;
    }

    if (marker === 0xda) {
      return sawFrame && offset + segmentLength < data.length - 2
        ? { contentType: 'image/jpeg', width, height }
        : null;
    }
    offset += segmentLength;
  }
  return null;
}

function readGifSubBlocks(
  data: Buffer,
  start: number
): { nextOffset: number; payloadBytes: number; firstPayload: Buffer } | null {
  let offset = start;
  let payloadBytes = 0;
  let firstPayload = Buffer.alloc(0);
  while (offset < data.length) {
    const length = data[offset];
    offset += 1;
    if (length === 0) return { nextOffset: offset, payloadBytes, firstPayload };
    if (offset + length > data.length) return null;
    if (payloadBytes === 0) firstPayload = Buffer.from(data.subarray(offset, offset + length));
    payloadBytes += length;
    offset += length;
  }
  return null;
}

function inspectGif(data: Buffer): AvatarImageInspection | null {
  const header = data.toString('ascii', 0, 6);
  if (data.length < 14 || (header !== 'GIF87a' && header !== 'GIF89a')) return null;
  const width = data.readUInt16LE(6);
  const height = data.readUInt16LE(8);
  if (!validDimensions(width, height)) return null;

  const packed = data[10];
  let offset = 13;
  if ((packed & 0x80) !== 0) {
    offset += 3 * 2 ** ((packed & 0x07) + 1);
    if (offset > data.length) return null;
  }

  let frames = 0;
  let metadataBytes = 0;
  while (offset < data.length) {
    const marker = data[offset];
    offset += 1;
    if (marker === 0x3b) {
      return frames === 1 && offset === data.length
        ? { contentType: 'image/gif', width, height }
        : null;
    }
    if (marker === 0x2c) {
      if (offset + 9 > data.length) return null;
      const frameWidth = data.readUInt16LE(offset + 4);
      const frameHeight = data.readUInt16LE(offset + 6);
      if (!validDimensions(frameWidth, frameHeight)) return null;
      const imagePacked = data[offset + 8];
      offset += 9;
      if ((imagePacked & 0x80) !== 0) {
        offset += 3 * 2 ** ((imagePacked & 0x07) + 1);
        if (offset > data.length) return null;
      }
      if (offset >= data.length || data[offset] < 2 || data[offset] > 8) return null;
      offset += 1;
      const imageData = readGifSubBlocks(data, offset);
      if (!imageData || imageData.payloadBytes === 0) return null;
      offset = imageData.nextOffset;
      frames += 1;
      if (frames > 1) return null;
      continue;
    }
    if (marker !== 0x21 || offset >= data.length) return null;

    const extensionLabel = data[offset];
    offset += 1;
    const extension = readGifSubBlocks(data, offset);
    if (!extension) return null;
    offset = extension.nextOffset;
    metadataBytes += extension.payloadBytes;
    if (metadataBytes > AVATAR_IMAGE_LIMITS.maximumMetadataBytes) return null;
    if (
      extensionLabel === 0xff &&
      (extension.firstPayload.toString('ascii') === 'NETSCAPE2.0' ||
        extension.firstPayload.toString('ascii') === 'ANIMEXTS1.0')
    ) {
      return null;
    }
  }
  return null;
}

function readUint24LittleEndian(data: Buffer, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function inspectWebp(data: Buffer): AvatarImageInspection | null {
  if (
    data.length < 20 ||
    data.toString('ascii', 0, 4) !== 'RIFF' ||
    data.toString('ascii', 8, 12) !== 'WEBP' ||
    data.readUInt32LE(4) + 8 !== data.length
  ) {
    return null;
  }

  let offset = 12;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let imageWidth = 0;
  let imageHeight = 0;
  let imageChunks = 0;
  let metadataBytes = 0;
  while (offset < data.length) {
    if (offset + 8 > data.length) return null;
    const chunkType = data.toString('ascii', offset, offset + 4);
    const chunkLength = data.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + chunkLength;
    const chunkEnd = payloadEnd + (chunkLength & 1);
    if (payloadEnd < payloadStart || chunkEnd > data.length) return null;

    if (chunkType === 'VP8X') {
      if (canvasWidth || chunkLength !== 10) return null;
      const flags = data[payloadStart];
      if (
        (flags & 0xc3) !== 0 ||
        data[payloadStart + 1] ||
        data[payloadStart + 2] ||
        data[payloadStart + 3]
      ) {
        return null;
      }
      canvasWidth = readUint24LittleEndian(data, payloadStart + 4) + 1;
      canvasHeight = readUint24LittleEndian(data, payloadStart + 7) + 1;
      if (!validDimensions(canvasWidth, canvasHeight)) return null;
    } else if (chunkType === 'VP8 ') {
      if (
        imageChunks > 0 ||
        chunkLength < 10 ||
        (data[payloadStart] & 1) !== 0 ||
        !startsWith(data.subarray(payloadStart + 3), [0x9d, 0x01, 0x2a])
      ) {
        return null;
      }
      imageWidth = data.readUInt16LE(payloadStart + 6) & 0x3fff;
      imageHeight = data.readUInt16LE(payloadStart + 8) & 0x3fff;
      if (!validDimensions(imageWidth, imageHeight)) return null;
      imageChunks += 1;
    } else if (chunkType === 'VP8L') {
      if (imageChunks > 0 || chunkLength < 5 || data[payloadStart] !== 0x2f) return null;
      const packed = data.readUInt32LE(payloadStart + 1);
      // Bit 28 is the valid alpha-used hint; only bits 29..31 encode version.
      if (packed >>> 29 !== 0) return null;
      imageWidth = (packed & 0x3fff) + 1;
      imageHeight = ((packed >>> 14) & 0x3fff) + 1;
      if (!validDimensions(imageWidth, imageHeight)) return null;
      imageChunks += 1;
    } else if (chunkType === 'ANIM' || chunkType === 'ANMF') {
      return null;
    } else if (chunkType === 'EXIF' || chunkType === 'XMP ' || chunkType === 'ICCP') {
      metadataBytes += chunkLength;
      if (metadataBytes > AVATAR_IMAGE_LIMITS.maximumMetadataBytes) return null;
    }
    offset = chunkEnd;
  }

  const width = canvasWidth || imageWidth;
  const height = canvasHeight || imageHeight;
  if (
    offset !== data.length ||
    imageChunks !== 1 ||
    !validDimensions(width, height) ||
    (canvasWidth > 0 && (canvasWidth !== imageWidth || canvasHeight !== imageHeight))
  ) {
    return null;
  }
  return { contentType: 'image/webp', width, height };
}

/**
 * Validate enough of the binary container to bound decoder work. Animated
 * images, excessive metadata, malformed chunk graphs and oversized rasters are
 * rejected before the original bytes are persisted or sent to a browser.
 */
export function inspectAvatarImage(data: Buffer): AvatarImageInspection | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) return inspectJpeg(data);
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47])) return inspectPng(data);
  if (data.toString('ascii', 0, 4) === 'RIFF') return inspectWebp(data);
  if (data.toString('ascii', 0, 3) === 'GIF') return inspectGif(data);
  return null;
}

/**
 * Combine the strict container parser above with a bounded full pixel decode.
 * This prevents a valid-looking header/CRC graph from persisting corrupt or
 * decompression-heavy bytes. Concurrency is deliberately small per process so
 * simultaneous authenticated uploads cannot multiply the 16 MP memory budget.
 */
export async function inspectDecodableAvatarImage(
  data: Buffer
): Promise<AvatarImageInspection | null> {
  const inspection = inspectAvatarImage(data);
  if (!inspection) return null;
  if (activeAvatarDecodes >= MAX_CONCURRENT_AVATAR_DECODES) {
    throw new AvatarDecodeBusyError();
  }

  activeAvatarDecodes += 1;
  try {
    const expectedFormat: Record<AvatarContentType, string> = {
      'image/jpeg': 'jpeg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const image = sharp(data, {
      animated: true,
      failOn: 'error',
      limitInputPixels: AVATAR_IMAGE_LIMITS.maximumPixels,
      sequentialRead: true,
      unlimited: false,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== expectedFormat[inspection.contentType] ||
      metadata.width !== inspection.width ||
      metadata.height !== inspection.height ||
      (metadata.pages ?? 1) !== 1
    ) {
      return null;
    }
    await image.clone().raw().toBuffer();
    return inspection;
  } catch {
    return null;
  } finally {
    activeAvatarDecodes -= 1;
  }
}

/** Compatibility helper for callers that only need the validated MIME type. */
export function detectAvatarContentType(data: Buffer): AvatarContentType | null {
  return inspectAvatarImage(data)?.contentType ?? null;
}
