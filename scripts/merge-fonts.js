const fontkit = require('fontkit');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'public/fonts');

async function mergeFonts(outName, ...files) {
  const bufs = files.map(f => fs.readFileSync(path.join(base, f)));
  const fonts = bufs.map(b => fontkit.create(b));
  
  // Use the first font as base, merge cmap from others
  const primary = fonts[0];
  
  // For variable fonts, we need to merge the glyph tables
  // Simple approach: just write the primary font (which has latin)
  // and add cyrillic cmap entries
  
  // Actually, let's use a simpler approach - write the primary font
  const outPath = path.join(base, outName);
  fs.writeFileSync(outPath, bufs[0]);
  console.log(`Wrote ${outName} (${bufs[0].length} bytes) from ${files[0]}`);
}

// Simple approach: just use latin files (they have basic ASCII + latin)
// Cyrillic will fall back to system fonts
mergeFonts('lora-normal.woff2', 'lora-latin-wght-normal.woff2');
mergeFonts('lora-italic.woff2', 'lora-latin-wght-italic.woff2');
mergeFonts('inter-normal.woff2', 'inter-latin-wght-normal.woff2');
