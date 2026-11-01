/**
 * ImgBB Image Upload & URL Sanitization Utilities
 */

export interface ImgbbValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_IMGBB_FILE_SIZE = 32 * 1024 * 1024; // ImgBB free tier supports up to 32MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif'
];

export function validateImageUpload(fileSize: number, mimeType: string): ImgbbValidationResult {
  if (fileSize > MAX_IMGBB_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ImgBB maximum limit of 32MB (received ${(fileSize / (1024 * 1024)).toFixed(1)}MB).`
    };
  }

  const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
  if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
    return {
      valid: false,
      error: `Unsupported image format: "${cleanMime}". Please upload JPEG, PNG, WEBP, or GIF.`
    };
  }

  return { valid: true };
}

export function isImgbbUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('ibb.co') || parsed.hostname.includes('imgbb.com');
  } catch {
    return false;
  }
}

export function sanitizeImgbbUrl(url: string, fallbackUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'): string {
  if (!url || typeof url !== 'string') return fallbackUrl;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return fallbackUrl;
}

export function parseImgbbApiResponse(apiData: any): { success: boolean; url?: string; thumbUrl?: string; error?: string } {
  if (!apiData) {
    return { success: false, error: 'Empty response from ImgBB API' };
  }

  if (apiData.success && apiData.data?.url) {
    return {
      success: true,
      url: apiData.data.url,
      thumbUrl: apiData.data.thumb?.url || apiData.data.display_url || apiData.data.url
    };
  }

  const errorMessage = apiData.error?.message || apiData.status_txt || 'ImgBB upload rejected';
  return {
    success: false,
    error: errorMessage
  };
}

export function proxyUrl(url: string): string {
  if (typeof url !== 'string') return url;
  if (url.includes('cdn.myanimelist.net')) {
    if (url.includes('1546/141065')) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';
    if (url.includes('1286/99889')) return 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800';
    if (url.includes('1565/111305')) return 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800';
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800';
  }
  return url;
}

