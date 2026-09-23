// Rasterises public/icon.svg into the PWA icon set with sharp. Run via
// `scripts/npm.sh run icons`. See spec §5 SP1 / plan Decision #11: the PWA
// icon is the golden apple of Discord on terracotta, authored as SVG.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const svgPath = path.join(root, 'public', 'icon.svg');
const outDir = path.join(root, 'public', 'icons');

const TERRACOTTA = '#C0623B';

async function main() {
  await mkdir(outDir, { recursive: true });
  const svg = await import('node:fs/promises').then((fs) => fs.readFile(svgPath));

  await sharp(svg, { density: 384 })
    .resize(192, 192)
    .png()
    .toFile(path.join(outDir, 'icon-192.png'));

  await sharp(svg, { density: 384 })
    .resize(512, 512)
    .png()
    .toFile(path.join(outDir, 'icon-512.png'));

  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .png()
    .toFile(path.join(outDir, 'apple-touch-icon.png'));

  // Maskable icon: the artwork scaled to 80% and centred on a solid
  // terracotta 512x512 background, so platform masks never crop the apple.
  const inset = Math.round(512 * 0.1);
  const scaledSize = 512 - inset * 2;
  const scaled = await sharp(svg, { density: 384 }).resize(scaledSize, scaledSize).png().toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: TERRACOTTA,
    },
  })
    .composite([{ input: scaled, left: inset, top: inset }])
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512.png'));

  console.log('Icons written to', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
