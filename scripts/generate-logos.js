import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// 1. Horizontal Logo SVG (Icon on left, Typography on right)
// Ideal for Navbar (height ~32px-40px), modal headers, footer
const horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 72" width="320" height="72" fill="none">
  <!-- ICON LOCKUP -->
  <g transform="translate(6, 6)">
    <!-- Orange Speech Bubble with Smooth Curves -->
    <path d="M 18,2 C 7,2 0,9 0,20 L 0,32 C 0,43 7,50 18,50 L 19,50 L 12,62 C 11,64 13,66 15,65 L 28,51 C 29,50 31,50 33,50 L 52,50 C 63,50 70,43 70,32 L 70,20 C 70,9 63,2 52,2 Z" 
          fill="#FF6A00" />
    
    <!-- Dark Navy/Obsidian Play Triangle -->
    <polygon points="28,16 28,36 46,26" fill="#0B0F17" />
    
    <!-- Inner Sound Arc (White) -->
    <path d="M 76,17 C 82,22 82,30 76,35" 
          stroke="#FFFFFF" 
          stroke-width="5" 
          stroke-linecap="round" />
    
    <!-- Outer Sound Arc (Vivid Green) -->
    <path d="M 86,10 C 96,19 96,33 86,42" 
          stroke="#22C55E" 
          stroke-width="5" 
          stroke-linecap="round" />
  </g>

  <!-- TYPOGRAPHY LOCKUP -->
  <g transform="translate(116, 0)">
    <!-- ANIDUB Main Wordmark -->
    <text x="0" y="42" font-family="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="38" letter-spacing="-0.5px">
      <tspan fill="#FFFFFF">ANI</tspan><tspan fill="#FF6A00">DUB</tspan>
    </text>

    <!-- INDIA Tracked Subtitle with Accent Rule -->
    <text x="2" y="60" font-family="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="11" fill="#FFFFFF" letter-spacing="5.5px">INDIA</text>
    
    <!-- Horizontal Accent Line -->
    <line x1="68" y1="56.5" x2="194" y2="56.5" stroke="#4B5563" stroke-width="1.8" stroke-linecap="round" />
  </g>
</svg>`;

// 2. Stacked Logo SVG (Icon centered on top, ANIDUB in middle, INDIA with line underneath)
// Exactly matching the user's screenshot!
const stackedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="320" height="280" fill="none">
  <!-- ICON CENTERED ON TOP -->
  <g transform="translate(112, 24)">
    <!-- Orange Speech Bubble with Tail -->
    <path d="M 18,2 C 7,2 0,9 0,20 L 0,34 C 0,45 7,52 18,52 L 19,52 L 11,66 C 10,68 12,71 15,69 L 30,53 C 32,52 34,52 36,52 L 56,52 C 67,52 74,45 74,34 L 74,20 C 74,9 67,2 56,2 Z" 
          fill="#FF6A00" />
    
    <!-- Play Triangle -->
    <polygon points="30,17 30,39 49,28" fill="#0B0F17" />
    
    <!-- Inner Sound Arc (White) -->
    <path d="M 82,18 C 88,24 88,32 82,38" 
          stroke="#FFFFFF" 
          stroke-width="5.5" 
          stroke-linecap="round" />
    
    <!-- Outer Sound Arc (Vivid Green) -->
    <path d="M 93,10 C 104,20 104,36 93,46" 
          stroke="#22C55E" 
          stroke-width="5.5" 
          stroke-linecap="round" />
  </g>

  <!-- TYPOGRAPHY CENTERED BELOW -->
  <!-- ANIDUB Main Header -->
  <g transform="translate(160, 180)">
    <text text-anchor="middle" font-family="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="52" letter-spacing="-1px">
      <tspan fill="#FFFFFF">ANI</tspan><tspan fill="#FF6A00">DUB</tspan>
    </text>

    <!-- INDIA Sub-header with matching right rule -->
    <g transform="translate(-112, 28)">
      <text x="0" y="0" font-family="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="13.5" fill="#FFFFFF" letter-spacing="6.5px">INDIA</text>
      <line x1="78" y1="-4.5" x2="224" y2="-4.5" stroke="#4B5563" stroke-width="2" stroke-linecap="round" />
    </g>
  </g>
</svg>`;

// 3. Icon Only SVG (For Favicons, app avatars)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 80" width="110" height="80" fill="none">
  <g transform="translate(6, 4)">
    <path d="M 18,2 C 7,2 0,9 0,20 L 0,34 C 0,45 7,52 18,52 L 19,52 L 11,66 C 10,68 12,71 15,69 L 30,53 C 32,52 34,52 36,52 L 56,52 C 67,52 74,45 74,34 L 74,20 C 74,9 67,2 56,2 Z" 
          fill="#FF6A00" />
    <polygon points="30,17 30,39 49,28" fill="#0B0F17" />
    <path d="M 82,18 C 88,24 88,32 82,38" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round" />
    <path d="M 93,10 C 104,20 104,36 93,46" stroke="#22C55E" stroke-width="5.5" stroke-linecap="round" />
  </g>
</svg>`;

// Write SVG files
fs.writeFileSync('public/logo.svg', horizontalSvg);
fs.writeFileSync('public/logo-stacked.svg', stackedSvg);
fs.writeFileSync('public/logo-icon.svg', iconSvg);
fs.writeFileSync('public/favicon.svg', iconSvg);

console.log('SVG files written successfully.');

// Render crisp, high-resolution transparent PNGs
async function generatePngs() {
  // 1. Horizontal Logo (960 x 216 - 3x retina, perfectly transparent)
  await sharp(Buffer.from(horizontalSvg))
    .resize(960, 216)
    .png()
    .toFile('public/logo.png');

  // 2. Stacked Logo (800 x 700 - transparent PNG)
  await sharp(Buffer.from(stackedSvg))
    .resize(800, 700)
    .png()
    .toFile('public/logo-stacked.png');

  // 3. Favicon (192 x 192 transparent PNG for PWA / browser tab)
  await sharp(Buffer.from(iconSvg))
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/favicon.png');

  // 4. Square App Icon (512 x 512 for PWA)
  const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <rect width="512" height="512" rx="112" fill="#0B0F17" />
    <g transform="translate(196, 110) scale(1.65)">
      <path d="M 18,2 C 7,2 0,9 0,20 L 0,34 C 0,45 7,52 18,52 L 19,52 L 11,66 C 10,68 12,71 15,69 L 30,53 C 32,52 34,52 36,52 L 56,52 C 67,52 74,45 74,34 L 74,20 C 74,9 67,2 56,2 Z" fill="#FF6A00" />
      <polygon points="30,17 30,39 49,28" fill="#0B0F17" />
      <path d="M 82,18 C 88,24 88,32 82,38" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round" />
      <path d="M 93,10 C 104,20 104,36 93,46" stroke="#22C55E" stroke-width="5.5" stroke-linecap="round" />
    </g>
    <text x="256" y="380" text-anchor="middle" font-family="'Space Grotesk', -apple-system, sans-serif" font-weight="900" font-size="76" letter-spacing="-1px">
      <tspan fill="#FFFFFF">ANI</tspan><tspan fill="#FF6A00">DUB</tspan>
    </text>
    <g transform="translate(136, 420)">
      <text x="0" y="0" font-family="'Space Grotesk', -apple-system, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" letter-spacing="9px">INDIA</text>
      <line x1="110" y1="-7" x2="240" y2="-7" stroke="#4B5563" stroke-width="3" stroke-linecap="round" />
    </g>
  </svg>`;
  await sharp(Buffer.from(appIconSvg))
    .resize(512, 512)
    .png()
    .toFile('public/app-icon.png');

  console.log('PNG files rendered with clean alpha transparency!');
}

generatePngs().catch(console.error);
