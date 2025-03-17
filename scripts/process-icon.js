const sharp = require('sharp');
const path = require('path');

async function processIcon() {
  const inputPath = path.join(__dirname, '../original-icon.png');
  const outputPath = path.join(__dirname, '../images/icon.png');
  
  try {
    // 首先分析原始图片
    const metadata = await sharp(inputPath).metadata();
    const originalStats = await sharp(inputPath).stats();
    console.log('原始图片信息:', {
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      stats: originalStats
    });

    // 创建一个纯白色的背景
    const whiteBackground = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .png()
    .toBuffer();

    // 然后处理原始图标
    await sharp(inputPath)
      // 调整尺寸，保持透明度
      .resize(230, 230, {  // 稍微小一点以留出边距
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      // 提取非透明部分
      .ensureAlpha()
      // 将图标合成到白色背景上
      .composite([
        {
          input: whiteBackground,
          top: 0,
          left: 0,
          blend: 'destination-over'  // 将白色背景放在下层
        }
      ])
      // 强制设置背景为白色
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      // 确保输出为 PNG
      .png()
      .toFile(outputPath);
    
    console.log('图标处理完成！');
    
    // 验证输出图片的背景
    const stats = await sharp(outputPath).stats();
    console.log('处理后的图片信息:', stats);
    
  } catch (error) {
    console.error('处理图标时出错:', error);
  }
}

async function analyzeOriginalImage() {
  const inputPath = path.join(__dirname, '../original-icon.png');
  try {
    const metadata = await sharp(inputPath).metadata();
    const stats = await sharp(inputPath).stats();
    console.log('原始图片信息:', {
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      stats: stats
    });
  } catch (error) {
    console.error('分析原始图片时出错:', error);
  }
}

// 在处理前先分析原始图片
await analyzeOriginalImage();

processIcon().catch(error => {
  console.error('执行过程中出错:', error);
  process.exit(1);
}); 