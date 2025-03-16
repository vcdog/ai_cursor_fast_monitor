const fs = require('fs');
const svg2img = require('svg2img');

const sizes = [16, 32, 64, 128, 256];
const svgPath = './resources/icon.svg';
const svgContent = fs.readFileSync(svgPath, 'utf8');

sizes.forEach(size => {
  svg2img(svgContent, { width: size, height: size }, (error, buffer) => {
    if (error) {
      console.error(`Error converting to ${size}x${size}:`, error);
      return;
    }
    
    fs.writeFileSync(`./resources/icon-${size}.png`, buffer);
    console.log(`Created icon-${size}.png`);
  });
});
