// Script para gerar ícones PWA
// Este script cria ícones básicos para PWA
// Para ícones personalizados, use uma ferramenta online como:
// https://www.pwabuilder.com/imageGenerator

const fs = require('fs');
const path = require('path');

// Criar um SVG simples como placeholder
const createIconSVG = (size) => {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#25D366"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" 
        font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">WPP</text>
</svg>`;
};

// Nota: Este script cria placeholders SVG
// Para produção, você deve criar ícones PNG reais
// Use o logo.png existente e redimensione para 192x192 e 512x512

console.log('📱 Gerando ícones PWA...');
console.log('');
console.log('⚠️  ATENÇÃO: Este script cria placeholders.');
console.log('Para ícones reais, você precisa:');
console.log('1. Usar o logo.png existente');
console.log('2. Redimensionar para 192x192 e 512x512 pixels');
console.log('3. Salvar como icon-192x192.png e icon-512x512.png na pasta public/');
console.log('');
console.log('💡 Ferramentas recomendadas:');
console.log('   - https://www.pwabuilder.com/imageGenerator');
console.log('   - https://realfavicongenerator.net/');
console.log('   - Qualquer editor de imagem (Photoshop, GIMP, etc.)');
console.log('');

// Criar instruções no README
const readmeContent = `# Ícones PWA

Para que o PWA funcione completamente, você precisa criar os seguintes ícones:

- \`public/icon-192x192.png\` - Ícone 192x192 pixels
- \`public/icon-512x512.png\` - Ícone 512x512 pixels

## Como criar os ícones:

1. Use o \`public/logo.png\` como base
2. Redimensione para os tamanhos acima
3. Salve na pasta \`public/\`

## Ferramentas online:

- https://www.pwabuilder.com/imageGenerator
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/

## Nota:

O PWA funcionará mesmo sem os ícones, mas eles melhoram a experiência do usuário.
`;

fs.writeFileSync(path.join(__dirname, '../public/PWA_ICONS_README.md'), readmeContent);

console.log('✅ Instruções salvas em public/PWA_ICONS_README.md');
console.log('');
console.log('📝 Próximos passos:');
console.log('   1. Crie os ícones usando o logo.png');
console.log('   2. Salve como icon-192x192.png e icon-512x512.png');
console.log('   3. Coloque na pasta public/');
console.log('');

