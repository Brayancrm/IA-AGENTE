/**
 * Gera PNG a partir de public/dadosia-app-icon.svg (fundo escuro).
 * iOS/Android costumam ignorar SVG no ícone instalado — use estes ficheiros.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'public', 'dadosia-app-icon.svg');

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error('Falta:', svgPath);
    process.exit(1);
  }
  const svg = fs.readFileSync(svgPath);
  await sharp(svg).resize(192, 192).png().toFile(path.join(root, 'public', 'icon-192x192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(root, 'public', 'icon-512x512.png'));
  await sharp(svg).resize(180, 180).png().toFile(path.join(root, 'public', 'apple-touch-icon.png'));
  console.log('OK: icon-192x192.png, icon-512x512.png, apple-touch-icon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
