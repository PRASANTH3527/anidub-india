import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageUpload, isImgbbUrl, sanitizeImgbbUrl, parseImgbbApiResponse } from './imgbb.ts';

test('validateImageUpload accepts supported image formats under 32MB', () => {
  const result = validateImageUpload(5 * 1024 * 1024, 'image/png');
  assert.equal(result.valid, true);
  assert.equal(result.error, undefined);

  const jpegResult = validateImageUpload(1024 * 500, 'image/jpeg');
  assert.equal(jpegResult.valid, true);

  const webpResult = validateImageUpload(2 * 1024 * 1024, 'image/webp; charset=binary');
  assert.equal(webpResult.valid, true);
});

test('validateImageUpload rejects oversized images exceeding 32MB', () => {
  const result = validateImageUpload(35 * 1024 * 1024, 'image/png');
  assert.equal(result.valid, false);
  assert.match(result.error || '', /exceeds ImgBB maximum limit/);
});

test('validateImageUpload rejects non-image formats', () => {
  const result = validateImageUpload(1000, 'application/pdf');
  assert.equal(result.valid, false);
  assert.match(result.error || '', /Unsupported image format/);
});

test('isImgbbUrl detects valid ImgBB domains', () => {
  assert.equal(isImgbbUrl('https://i.ibb.co/vzS8G90/default-avatar.png'), true);
  assert.equal(isImgbbUrl('https://ibb.co/2ndCYJK'), true);
  assert.equal(isImgbbUrl('https://example.com/image.png'), false);
  assert.equal(isImgbbUrl('invalid-url'), false);
});

test('sanitizeImgbbUrl falls back gracefully on empty string', () => {
  const fallback = 'https://i.ibb.co/fallback.png';
  assert.equal(sanitizeImgbbUrl('', fallback), fallback);
  assert.equal(sanitizeImgbbUrl('https://i.ibb.co/test.png', fallback), 'https://i.ibb.co/test.png');
});

test('parseImgbbApiResponse parses success response correctly', () => {
  const mockApiSuccess = {
    data: {
      id: '2ndCYJK',
      url: 'https://i.ibb.co/w04Pq6b/poster.jpg',
      display_url: 'https://i.ibb.co/98W13PY/poster.jpg',
      thumb: { url: 'https://i.ibb.co/2ndCYJK/thumb.jpg' }
    },
    success: true,
    status: 200
  };
  const parsed = parseImgbbApiResponse(mockApiSuccess);
  assert.equal(parsed.success, true);
  assert.equal(parsed.url, 'https://i.ibb.co/w04Pq6b/poster.jpg');
  assert.equal(parsed.thumbUrl, 'https://i.ibb.co/2ndCYJK/thumb.jpg');
});

test('parseImgbbApiResponse parses error response correctly', () => {
  const mockApiError = {
    status_code: 400,
    error: {
      message: 'Invalid API key',
      code: 100
    },
    status_txt: 'Bad Request'
  };
  const parsed = parseImgbbApiResponse(mockApiError);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, 'Invalid API key');
});
