import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Vector Master: Logo Mark (Headphone + Play button + 'A')
const logoMarkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff7a1a" />
      <stop offset="100%" stop-color="#f54e00" />
    </linearGradient>
    <filter id="markGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#f54e00" flood-opacity="0.3" />
    </filter>
  </defs>

  <g transform="translate(0, 10)">
    <!-- Left Headband Arc (Navy) -->
    <path d="M 195 240 C 190 140, 290 85, 360 95 C 310 90, 230 135, 235 235 Z" fill="#0f172a" />
    
    <!-- Outer Headband Main Arch -->
    <path d="M 198 230 C 190 120, 310 65, 415 130 C 430 140, 395 120, 350 95 C 270 75, 195 130, 202 230 Z" fill="#0f172a" />

    <!-- Right Headband Arch (Vibrant Orange) -->
    <path d="M 330 90 C 400 100, 440 170, 430 250 C 420 180, 380 125, 315 95 Z" fill="url(#orangeGrad)" />
    <path d="M 285 95 C 375 105, 420 175, 400 245 C 390 175, 345 125, 275 105 Z" fill="#ff6b00" opacity="0.95" />

    <!-- Acoustic soundwaves inside right earcup -->
    <path d="M 390 185 C 410 205, 410 230, 395 250" stroke="#ff5722" stroke-width="11" stroke-linecap="round" fill="none" />
    <path d="M 368 196 C 383 210, 383 225, 373 240" stroke="#ff5722" stroke-width="8.5" stroke-linecap="round" fill="none" />

    <!-- Left Earcup (Dark Navy Oval) -->
    <rect x="168" y="195" width="50" height="85" rx="25" fill="#0f172a" />

    <!-- Right Earcup (Vibrant Orange Oval) -->
    <rect x="394" y="195" width="50" height="85" rx="25" fill="url(#orangeGrad)" />

    <!-- Letter A Right Swoop (Dark Navy with Orange inner highlight) -->
    <path d="M 270 155 C 310 175, 350 250, 405 345 C 380 345, 355 330, 325 270 C 300 220, 270 180, 255 170 Z" fill="#0f172a" />
    <path d="M 275 155 C 315 180, 350 260, 390 340 C 375 340, 345 285, 320 235 C 295 185, 275 165, 265 160 Z" fill="url(#orangeGrad)" />

    <!-- Central Play Button (Orange Triangle with White Cutout) -->
    <path d="M 220 195 C 220 182, 235 174, 246 182 L 340 248 C 352 256, 352 272, 340 280 L 246 346 C 235 354, 220 346, 220 333 Z" fill="url(#orangeGrad)" filter="url(#markGlow)" />
    <path d="M 252 230 C 252 224, 260 220, 265 224 L 305 258 C 311 262, 311 268, 305 272 L 265 306 C 260 310, 252 306, 252 300 Z" fill="#ffffff" />
  </g>
</svg>
`;

// 2. Full Horizontal/Stacked Logo for Dark Theme (Navbar / Footer / Social)
const fullLogoDarkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" width="1000" height="580">
  <defs>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff7a1a" />
      <stop offset="100%" stop-color="#f54e00" />
    </linearGradient>
    <filter id="markGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#f54e00" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- HEADPHONE & A EMBLEM (Centered at x=500, y=180) -->
  <g transform="translate(245, 0) scale(1.0)">
    <path d="M 195 240 C 190 140, 290 85, 360 95 C 310 90, 230 135, 235 235 Z" fill="#0f172a" />
    <path d="M 198 230 C 190 120, 310 65, 415 130 C 430 140, 395 120, 350 95 C 270 75, 195 130, 202 230 Z" fill="#0f172a" />
    <path d="M 330 90 C 400 100, 440 170, 430 250 C 420 180, 380 125, 315 95 Z" fill="url(#orangeGrad)" />
    <path d="M 285 95 C 375 105, 420 175, 400 245 C 390 175, 345 125, 275 105 Z" fill="#ff6b00" opacity="0.95" />

    <path d="M 390 185 C 410 205, 410 230, 395 250" stroke="#ff5722" stroke-width="11" stroke-linecap="round" fill="none" />
    <path d="M 368 196 C 383 210, 383 225, 373 240" stroke="#ff5722" stroke-width="8.5" stroke-linecap="round" fill="none" />

    <rect x="168" y="195" width="50" height="85" rx="25" fill="#0f172a" />
    <rect x="394" y="195" width="50" height="85" rx="25" fill="url(#orangeGrad)" />

    <path d="M 270 155 C 310 175, 350 250, 405 345 C 380 345, 355 330, 325 270 C 300 220, 270 180, 255 170 Z" fill="#0f172a" />
    <path d="M 275 155 C 315 180, 350 260, 390 340 C 375 340, 345 285, 320 235 C 295 185, 275 165, 265 160 Z" fill="url(#orangeGrad)" />

    <path d="M 220 195 C 220 182, 235 174, 246 182 L 340 248 C 352 256, 352 272, 340 280 L 246 346 C 235 354, 220 346, 220 333 Z" fill="url(#orangeGrad)" filter="url(#markGlow)" />
    <path d="M 252 230 C 252 224, 260 220, 265 224 L 305 258 C 311 262, 311 268, 305 272 L 265 306 C 260 310, 252 306, 252 300 Z" fill="#ffffff" />
  </g>

  <!-- TYPOGRAPHY: anidub -->
  <text x="500" y="440" text-anchor="middle" font-family="system-ui, -apple-system, 'Montserrat', 'Nunito', 'Arial Black', sans-serif" font-weight="900" font-size="118" letter-spacing="-2" fill="#ff5722">anidub</text>

  <!-- TYPOGRAPHY: INDIA (Crisp white for dark backgrounds) -->
  <text x="500" y="515" text-anchor="middle" font-family="system-ui, -apple-system, 'Montserrat', 'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="44" letter-spacing="14" fill="#f8fafc">INDIA</text>

  <!-- TRICOLOR BAR UNDER INDIA -->
  <g transform="translate(458, 535)">
    <rect x="0" y="0" width="26" height="7" rx="3.5" fill="#ff9933" />
    <rect x="30" y="0" width="26" height="7" rx="3.5" fill="#ffffff" />
    <rect x="60" y="0" width="26" height="7" rx="3.5" fill="#138808" />
  </g>
</svg>
`;

// 3. Full Horizontal Logo (for light backgrounds / print)
const fullLogoLightSvg = fullLogoDarkSvg.replace('fill="#f8fafc">INDIA', 'fill="#0f172a">INDIA');

// 4. Square App Icon SVG (with dark luxury container background)
const squareAppIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121827" />
      <stop offset="100%" stop-color="#070a10" />
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff7a1a" />
      <stop offset="100%" stop-color="#f54e00" />
    </linearGradient>
    <filter id="markGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#f54e00" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Squircle rounded background -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <rect x="16" y="16" width="480" height="480" rx="96" fill="none" stroke="#ff5722" stroke-width="4" stroke-opacity="0.25" />

  <!-- Mark Centered -->
  <g transform="translate(0, 15)">
    <path d="M 195 240 C 190 140, 290 85, 360 95 C 310 90, 230 135, 235 235 Z" fill="#334155" />
    <path d="M 198 230 C 190 120, 310 65, 415 130 C 430 140, 395 120, 350 95 C 270 75, 195 130, 202 230 Z" fill="#1e293b" />
    <path d="M 330 90 C 400 100, 440 170, 430 250 C 420 180, 380 125, 315 95 Z" fill="url(#orangeGrad)" />
    <path d="M 285 95 C 375 105, 420 175, 400 245 C 390 175, 345 125, 275 105 Z" fill="#ff6b00" opacity="0.95" />

    <path d="M 390 185 C 410 205, 410 230, 395 250" stroke="#ff5722" stroke-width="11" stroke-linecap="round" fill="none" />
    <path d="M 368 196 C 383 210, 383 225, 373 240" stroke="#ff5722" stroke-width="8.5" stroke-linecap="round" fill="none" />

    <rect x="168" y="195" width="50" height="85" rx="25" fill="#334155" />
    <rect x="394" y="195" width="50" height="85" rx="25" fill="url(#orangeGrad)" />

    <path d="M 270 155 C 310 175, 350 250, 405 345 C 380 345, 355 330, 325 270 C 300 220, 270 180, 255 170 Z" fill="#1e293b" />
    <path d="M 275 155 C 315 180, 350 260, 390 340 C 375 340, 345 285, 320 235 C 295 185, 275 165, 265 160 Z" fill="url(#orangeGrad)" />

    <path d="M 220 195 C 220 182, 235 174, 246 182 L 340 248 C 352 256, 352 272, 340 280 L 246 346 C 235 354, 220 346, 220 333 Z" fill="url(#orangeGrad)" filter="url(#markGlow)" />
    <path d="M 252 230 C 252 224, 260 220, 265 224 L 305 258 C 311 262, 311 268, 305 272 L 265 306 C 260 310, 252 306, 252 300 Z" fill="#ffffff" />
  </g>
</svg>
`;

// 5. OpenGraph & Twitter Social Card (1200x630)
const ogCardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f17" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#070a10" />
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff7a1a" />
      <stop offset="100%" stop-color="#f54e00" />
    </linearGradient>
    <radialGradient id="glowBackdrop" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#f54e00" stop-opacity="0.25" />
      <stop offset="60%" stop-color="#9333ea" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
    <filter id="markGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#f54e00" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#glowBackdrop)" />
  <rect x="24" y="24" width="1152" height="582" rx="32" fill="none" stroke="#1f293d" stroke-width="2" />

  <!-- Main Center Logo (Headphones + Play Symbol) -->
  <g transform="translate(440, 20) scale(0.62)">
    <path d="M 195 240 C 190 140, 290 85, 360 95 C 310 90, 230 135, 235 235 Z" fill="#334155" />
    <path d="M 198 230 C 190 120, 310 65, 415 130 C 430 140, 395 120, 350 95 C 270 75, 195 130, 202 230 Z" fill="#1e293b" />
    <path d="M 330 90 C 400 100, 440 170, 430 250 C 420 180, 380 125, 315 95 Z" fill="url(#orangeGrad)" />
    <path d="M 285 95 C 375 105, 420 175, 400 245 C 390 175, 345 125, 275 105 Z" fill="#ff6b00" opacity="0.95" />

    <path d="M 390 185 C 410 205, 410 230, 395 250" stroke="#ff5722" stroke-width="11" stroke-linecap="round" fill="none" />
    <path d="M 368 196 C 383 210, 383 225, 373 240" stroke="#ff5722" stroke-width="8.5" stroke-linecap="round" fill="none" />

    <rect x="168" y="195" width="50" height="85" rx="25" fill="#334155" />
    <rect x="394" y="195" width="50" height="85" rx="25" fill="url(#orangeGrad)" />

    <path d="M 270 155 C 310 175, 350 250, 405 345 C 380 345, 355 330, 325 270 C 300 220, 270 180, 255 170 Z" fill="#1e293b" />
    <path d="M 275 155 C 315 180, 350 260, 390 340 C 375 340, 345 285, 320 235 C 295 185, 275 165, 265 160 Z" fill="url(#orangeGrad)" />

    <path d="M 220 195 C 220 182, 235 174, 246 182 L 340 248 C 352 256, 352 272, 340 280 L 246 346 C 235 354, 220 346, 220 333 Z" fill="url(#orangeGrad)" filter="url(#markGlow)" />
    <path d="M 252 230 C 252 224, 260 220, 265 224 L 305 258 C 311 262, 311 268, 305 272 L 265 306 C 260 310, 252 306, 252 300 Z" fill="#ffffff" />
  </g>

  <!-- Brand Typography -->
  <text x="600" y="315" text-anchor="middle" font-family="system-ui, -apple-system, 'Montserrat', 'Nunito', 'Arial Black', sans-serif" font-weight="900" font-size="92" letter-spacing="-2" fill="#ff5722">anidub</text>
  <text x="600" y="375" text-anchor="middle" font-family="system-ui, -apple-system, 'Montserrat', 'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="36" letter-spacing="16" fill="#f8fafc">INDIA</text>

  <!-- Tricolor Bar -->
  <g transform="translate(565, 395)">
    <rect x="0" y="0" width="20" height="6" rx="3" fill="#ff9933" />
    <rect x="25" y="0" width="20" height="6" rx="3" fill="#ffffff" />
    <rect x="50" y="0" width="20" height="6" rx="3" fill="#138808" />
  </g>

  <!-- Subtitle / Tagline -->
  <text x="600" y="455" text-anchor="middle" font-family="system-ui, -apple-system, 'Inter', sans-serif" font-weight="700" font-size="24" fill="#94a3b8">
    Official Indian Regional Dubbed Anime Directory
  </text>

  <!-- Language Badges Row -->
  <g transform="translate(230, 495)">
    <!-- Tamil -->
    <rect x="0" y="0" width="110" height="38" rx="19" fill="#451a03" stroke="#b45309" stroke-width="1.5" />
    <text x="55" y="24" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#fde68a">Tamil Dub</text>

    <!-- Telugu -->
    <rect x="125" y="0" width="115" height="38" rx="19" fill="#082f49" stroke="#0284c7" stroke-width="1.5" />
    <text x="182" y="24" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#bae6fd">Telugu Dub</text>

    <!-- Hindi -->
    <rect x="255" y="0" width="110" height="38" rx="19" fill="#064e3b" stroke="#059669" stroke-width="1.5" />
    <text x="310" y="24" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#a7f3d0">Hindi Dub</text>

    <!-- Malayalam -->
    <rect x="380" y="0" width="145" height="38" rx="19" fill="#3b0764" stroke="#9333ea" stroke-width="1.5" />
    <text x="452" y="24" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#e9d5ff">Malayalam Dub</text>

    <!-- Kannada -->
    <rect x="540" y="0" width="130" height="38" rx="19" fill="#1e1b4b" stroke="#6366f1" stroke-width="1.5" />
    <text x="605" y="24" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#c7d2fe">Kannada Dub</text>

    <!-- Verified Badge -->
    <rect x="685" y="0" width="55" height="38" rx="19" fill="#16a34a" />
    <text x="712" y="24" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff">✓</text>
  </g>

  <!-- Platforms Footer -->
  <text x="600" y="580" text-anchor="middle" font-family="system-ui, -apple-system, 'Inter', sans-serif" font-weight="600" font-size="15" fill="#64748b">
    Streaming legally on Crunchyroll • Netflix • JioHotstar • JioCinema • Prime Video
  </text>
</svg>
`;

function makeIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

async function run() {
  console.log('[Assets] Generating brand SVGs...');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo-mark.svg'), logoMarkSvg.trim());
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.svg'), fullLogoDarkSvg.trim());
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo-dark.svg'), fullLogoDarkSvg.trim());
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo-light.svg'), fullLogoLightSvg.trim());
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), squareAppIconSvg.trim());

  console.log('[Assets] Rendering PNG brand assets via sharp...');

  // 1. High-Res Logo PNG
  await sharp(Buffer.from(fullLogoDarkSvg))
    .resize(1000, 580)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'logo.png'));

  // 2. Square App Icon
  const square512 = await sharp(Buffer.from(squareAppIconSvg))
    .resize(512, 512)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'android-chrome-512x512.png'), square512);

  const square192 = await sharp(Buffer.from(squareAppIconSvg))
    .resize(192, 192)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'android-chrome-192x192.png'), square192);

  // 3. Apple Touch Icon (180x180)
  const appleTouch = await sharp(Buffer.from(squareAppIconSvg))
    .resize(180, 180)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleTouch);

  // 4. Favicon 32x32 & 16x16
  const fav32 = await sharp(Buffer.from(squareAppIconSvg))
    .resize(32, 32)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), fav32);

  const fav16 = await sharp(Buffer.from(squareAppIconSvg))
    .resize(16, 16)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16x16.png'), fav16);

  // 5. Favicon.ico
  const icoBuffer = makeIco(fav32);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);

  // 6. Default OpenGraph / Twitter Social Card (1200x630)
  const ogBuffer = await sharp(Buffer.from(ogCardSvg))
    .resize(1200, 630)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'og-default.png'), ogBuffer);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'og-image.png'), ogBuffer);

  console.log('[Assets] All brand icons, favicons, logos & OG cards generated successfully!');
}

run().catch((err) => {
  console.error('[Assets] Error generating brand assets:', err);
  process.exit(1);
});
