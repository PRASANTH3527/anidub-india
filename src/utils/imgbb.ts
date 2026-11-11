import { cloudflareApi } from '../services/cloudflareApi';

const MAX_IMGBB_SIZE_BYTES = 32 * 1024 * 1024; // 32MB
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
];

export function validateImageUpload(
  sizeBytes: number,
  mimeType: string
): { valid: boolean; error?: string } {
  if (sizeBytes <= 0) {
    return { valid: false, error: 'Image file is empty' };
  }
  if (sizeBytes > MAX_IMGBB_SIZE_BYTES) {
    return { valid: false, error: 'Image size exceeds ImgBB maximum limit of 32MB' };
  }
  const normalizedMime = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!SUPPORTED_MIME_TYPES.includes(normalizedMime)) {
    return { valid: false, error: `Unsupported image format: ${mimeType}` };
  }
  return { valid: true };
}

export function isImgbbUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname === 'i.ibb.co' || parsed.hostname === 'ibb.co';
  } catch {
    return false;
  }
}

export function sanitizeImgbbUrl(url: string | null | undefined, fallback: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return fallback;
  return trimmed;
}

export function proxyUrl(url?: string | null): string {
  return (url || '').trim();
}

export function parseImgbbApiResponse(response: any): {
  success: boolean;
  url?: string;
  displayUrl?: string;
  thumbUrl?: string;
  error?: string;
} {
  if (response && response.success && response.data) {
    return {
      success: true,
      url: response.data.url || response.data.display_url,
      displayUrl: response.data.display_url || response.data.url,
      thumbUrl: response.data.thumb?.url || response.data.url,
    };
  }
  return {
    success: false,
    error: response?.error?.message || response?.status_txt || 'ImgBB upload failed',
  };
}

/**
 * Uploads an image file to ImgBB strictly via the secure server-side API route (/api/upload).
 * Never exposes or accepts an API key on the client side; the server uses process.env.IMGBB_API_KEY.
 * @param file The image File object from an input element
 * @returns The direct image URL (e.g., https://i.ibb.co/...)
 */
export const uploadToImgBB = async (file: File): Promise<string> => {
  const check = validateImageUpload(file.size, file.type || 'image/png');
  if (!check.valid) {
    throw new Error(check.error);
  }

  const base64Image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode image file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const data = await cloudflareApi.uploadImage(base64Image, file.name);
  const directUrl = data.display_url || data.url;
  if (!directUrl) {
    throw new Error('Server upload did not return a valid image URL');
  }

  return directUrl;
};
