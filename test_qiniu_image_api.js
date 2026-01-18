#!/usr/bin/env node

/**
 * 七牛云图生图API测试脚本
 * 用于测试从四维彩超/胎儿检测图片生成出生后婴儿照片
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const CONFIG = {
  API_KEY: 'sk-7581d97b6f995e103eba62bb08da05762eb62c32cfed294e88cc3e082e371ac8',
  API_ENDPOINT: 'https://api.qnaigc.com/v1/images/edits',
  MODEL: 'gemini-3.0-pro-image-preview',
  INPUT_DIR: './input',
  OUTPUT_DIR: './output'
};

// Prompt工程：让AI根据四维彩超预测出生后的婴儿长相
const GENERATION_PROMPT = `Based on this ultrasound/prenatal scan image, generate a highly realistic photograph of what the baby will look like after birth.

CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY:

1. POSE AND POSITION MATCHING (MOST IMPORTANT):
   - The baby's head angle and orientation MUST exactly match the ultrasound image
   - If the baby's head is tilted left in the scan, tilt left in the photo
   - If the baby's head is tilted right in the scan, tilt right in the photo
   - If the baby is facing forward/sideways/profile in the scan, maintain the SAME viewing angle
   - The body position and posture MUST match the scan as closely as possible
   - Preserve the exact head-to-body positioning shown in the ultrasound

2. FACIAL FEATURES MATCHING (IDENTICAL):
   - Facial features MUST be IDENTICAL to the ultrasound image
   - Preserve the exact facial structure, nose shape, nose bridge height, nostrils
   - Keep mouth position, lip shape, chin shape EXACTLY as shown
   - Match forehead shape, cheekbone structure, jawline
   - Preserve overall facial proportions precisely
   - Match eye spacing, eye shape, eyebrow position

3. NEWBORN CHARACTERISTICS:
   - Generate a newborn baby (0-7 days old) with natural newborn characteristics
   - Realistic newborn skin tone and texture (slightly wrinkled, natural baby skin)
   - Eyes that may be closed or slightly open (typical newborn)
   - Natural newborn facial expression (peaceful, neutral)
   - Soft baby hair texture (if visible in ultrasound, match the hair amount and position)

4. ETHNICITY CONSISTENCY:
   - The baby should appear ethnically Chinese / East Asian
   - Avoid Western/European facial traits; keep features aligned with the scan

5. PHOTO STYLE:
   - Create a professional hospital newborn photo style with soft, natural lighting
   - Output should look like a real hospital newborn photograph
   - Background should be soft, neutral (white or light colors), typical hospital setting
   - The baby can be lying on a hospital bed or wrapped in a white blanket

6. ACCURACY:
   - This should look like an actual photograph of the newborn, not an illustration or artistic rendering
   - Focus on maximum accuracy and realism
   - The pose, angle, and facial features are non-negotiable - they MUST match the ultrasound

根据这张四维彩超/产前检测图像，生成一张高度逼真的婴儿出生后的照片。

关键要求 - 必须严格遵守：

1. 姿势和位置匹配（最重要）：
   - 婴儿的头部角度和方向必须与彩超图像完全一致
   - 如果彩超中婴儿头部向左倾斜，照片中也要向左倾斜
   - 如果彩超中婴儿头部向右倾斜，照片中也要向右倾斜
   - 如果彩超中婴儿是正面/侧面/侧脸，保持相同的观看角度
   - 身体位置和姿态必须尽可能匹配扫描图像
   - 保留彩超中显示的头部与身体的精确位置关系

2. 面部特征匹配（完全一致）：
   - 面部特征必须与彩超图像完全一致
   - 精确保留面部结构、鼻子形状、鼻梁高度、鼻孔
   - 保持嘴巴位置、嘴唇形状、下巴形状与扫描完全一致
   - 匹配额头形状、颧骨结构、下颌线
   - 精确保留整体面部比例
   - 匹配眼睛间距、眼睛形状、眉毛位置

3. 新生儿特征：
   - 生成新生儿（0-7天大）具有自然的新生儿特征
   - 真实的新生儿肤色和质感（略微褶皱，自然的婴儿皮肤）
   - 可能闭合或微微睁开的眼睛（典型新生儿）
   - 自然的新生儿面部表情（平和、中性）
   - 柔软的婴儿毛发质感（如果彩超中可见，匹配毛发的数量和位置）

4. 人种一致性：
   - 婴儿应呈现中国/东亚新生儿特征
   - 避免明显西方/欧洲面部特征，仍以彩超特征为准

5. 照片风格：
   - 创建专业的医院新生儿照片风格，柔和自然的光线
   - 输出应该看起来像真实的医院新生儿照片
   - 背景应该柔和、中性（白色或浅色），典型的医院环境
   - 婴儿可以躺在医院床上或包裹在白色毯子中

6. 准确性：
   - 这应该看起来像新生儿的真实照片，而不是插图或艺术渲染
   - 注重最大程度的准确性和真实感
   - 姿势、角度和面部特征是不可妥协的 - 必须与彩超匹配`;

/**
 * 将图片文件转换为Base64 Data URI
 */
function imageToBase64DataUri(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();

  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.webp') mimeType = 'image/webp';

  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * 调用七牛云图生图API
 */
async function callQiniuImageAPI(imageBase64) {
  const requestBody = JSON.stringify({
    model: CONFIG.MODEL,
    image: imageBase64,
    prompt: GENERATION_PROMPT,
    n: 1
  });

  const url = new URL(CONFIG.API_ENDPOINT);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (err) {
            reject(new Error(`解析响应失败: ${err.message}`));
          }
        } else {
          reject(new Error(`API请求失败 (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`网络请求失败: ${err.message}`));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * 保存生成的图片
 */
function saveGeneratedImage(b64JsonData, originalFileName, index = 0) {
  // 从 data:image/xxx;base64,xxxx 中提取base64部分
  let base64Data = b64JsonData;
  if (b64JsonData.includes('base64,')) {
    base64Data = b64JsonData.split('base64,')[1];
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const baseName = path.basename(originalFileName, path.extname(originalFileName));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputFileName = `${baseName}_generated_${timestamp}_${index}.jpg`;
  const outputPath = path.join(CONFIG.OUTPUT_DIR, outputFileName);

  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ 保存生成图片: ${outputPath}`);
  return outputPath;
}

/**
 * 处理单张图片
 */
async function processImage(imagePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📸 处理图片: ${imagePath}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 1. 读取并转换图片为Base64
    console.log('📂 读取图片并转换为Base64...');
    const imageBase64 = imageToBase64DataUri(imagePath);
    const sizeKB = (imageBase64.length / 1024).toFixed(2);
    console.log(`✅ 图片大小: ${sizeKB} KB (Base64编码后)\n`);

    // 2. 调用API
    console.log('🚀 调用七牛云API...');
    console.log(`   模型: ${CONFIG.MODEL}`);
    console.log(`   Prompt长度: ${GENERATION_PROMPT.length} 字符\n`);

    const startTime = Date.now();
    const response = await callQiniuImageAPI(imageBase64);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ API调用成功 (耗时: ${duration}秒)`);
    console.log(`   Token使用: ${JSON.stringify(response.usage || {})}\n`);

    // 3. 保存生成的图片
    if (response.data && response.data.length > 0) {
      console.log(`💾 保存生成的图片 (共${response.data.length}张)...`);
      response.data.forEach((item, index) => {
        if (item.b64_json) {
          saveGeneratedImage(item.b64_json, path.basename(imagePath), index);
        }
      });
      console.log('\n✨ 处理完成!\n');
      return true;
    } else {
      console.error('❌ API响应中没有生成的图片数据');
      return false;
    }

  } catch (error) {
    console.error(`\n❌ 处理失败: ${error.message}\n`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n🎨 七牛云图生图API测试工具');
  console.log('📋 功能: 从四维彩超生成新生儿照片\n');

  // 检查input文件夹
  if (!fs.existsSync(CONFIG.INPUT_DIR)) {
    console.error(`❌ 错误: ${CONFIG.INPUT_DIR} 文件夹不存在`);
    console.log(`请创建文件夹: mkdir ${CONFIG.INPUT_DIR}`);
    process.exit(1);
  }

  // 确保output文件夹存在
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`✅ 创建输出文件夹: ${CONFIG.OUTPUT_DIR}\n`);
  }

  // 读取input文件夹中的所有图片
  const files = fs.readdirSync(CONFIG.INPUT_DIR);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  });

  if (imageFiles.length === 0) {
    console.log(`⚠️  ${CONFIG.INPUT_DIR} 文件夹中没有找到图片`);
    console.log(`请将彩超图片放入 ${CONFIG.INPUT_DIR} 文件夹中\n`);
    process.exit(0);
  }

  console.log(`📁 找到 ${imageFiles.length} 张图片:\n`);
  imageFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  console.log('');

  // 处理所有图片
  let successCount = 0;
  let failCount = 0;

  for (const imageFile of imageFiles) {
    const imagePath = path.join(CONFIG.INPUT_DIR, imageFile);
    const success = await processImage(imagePath);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // 如果还有更多图片要处理,稍微延迟一下避免API限流
    if (imageFiles.indexOf(imageFile) < imageFiles.length - 1) {
      console.log('⏳ 等待2秒后处理下一张...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理总结');
  console.log('='.repeat(60));
  console.log(`✅ 成功: ${successCount} 张`);
  console.log(`❌ 失败: ${failCount} 张`);
  console.log(`📂 输出目录: ${CONFIG.OUTPUT_DIR}`);
  console.log('='.repeat(60) + '\n');
}

// 运行主函数
main().catch(error => {
  console.error('程序执行出错:', error);
  process.exit(1);
});
