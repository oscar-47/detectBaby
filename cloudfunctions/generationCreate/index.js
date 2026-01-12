// 云函数入口文件 - generationCreate
// 创建生成任务
const fs = require('fs');
const path = require('path');
const https = require('https');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CONFIG = {
    API_KEY: process.env.QN_IMAGE_API_KEY || 'sk-a30f322a422ec953919452f80d392998c0ea8bb28b719a9265c03ee0659469d9',
    API_ENDPOINT: process.env.QN_IMAGE_API_ENDPOINT || 'https://api.qnaigc.com/v1/images/edits',
    MODEL: process.env.QN_IMAGE_MODEL || 'gemini-3.0-pro-image-preview',
    REQUEST_TIMEOUT_MS: 30000,
    OUTPUT_PREFIX: 'generated'
};

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

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { unlock_token, uploadFileID, style_id, idempotency_key } = event;

    try {
        // 参数校验
        if (!unlock_token || !uploadFileID) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少必要参数' }
            };
        }

        const now = Math.floor(Date.now() / 1000);

        // 验证unlock_token
        const sessionResult = await db.collection('unlock_sessions')
            .where({
                unlock_token: unlock_token,
                openid: openid,
                action: 'GEN'
            })
            .limit(1)
            .get();

        if (sessionResult.data.length === 0) {
            return {
                ok: false,
                error: { code: 'INVALID_TOKEN', message: '无效的解锁令牌' }
            };
        }

        const session = sessionResult.data[0];

        // 检查token是否过期
        if (session.token_expires_at < now) {
            return {
                ok: false,
                error: { code: 'TOKEN_EXPIRED', message: '解锁令牌已过期' }
            };
        }

        // 检查是否已消费（幂等处理）
        if (session.status === 'consumed' && session.job_id) {
            // 返回已创建的任务
            const existingJob = await db.collection('generation_jobs')
                .where({
                    job_id: session.job_id
                })
                .limit(1)
                .get();

            if (existingJob.data.length > 0) {
                const job = existingJob.data[0];
                return {
                    ok: true,
                    data: {
                        job_id: job.job_id,
                        status: job.status,
                        original_access: job.original_access
                    }
                };
            }
        }

        // 验证B超图片已通过校验
        const validation = await db.collection('ultrasound_validations')
            .where({
                uploadFileID: uploadFileID,
                openid: openid,
                verdict: 'pass'
            })
            .limit(1)
            .get();

        if (validation.data.length === 0) {
            return {
                ok: false,
                error: { code: 'VALIDATION_REQUIRED', message: 'B超图片需先通过校验' }
            };
        }

        // 确定原图访问权限
        let original_access = 'locked';
        if (session.method === 'pay' && session.sku === 'gen_with_original_1') {
            original_access = 'included';
        }

        // 生成job_id
        const job_id = generateJobId();

        // 创建生成任务
        const job = {
            job_id: job_id,
            openid: openid,
            uploadFileID: uploadFileID,
            style_id: style_id || 'realistic_v1',
            provider_id: 'qiniu_qnaigc',
            status: 'queued',
            progress: 0,
            original_access: original_access,
            unlock_id: session.unlock_id,
            method: session.method,
            cost: {
                amount_fen: session.method === 'pay' ? 990 : 0,
                currency: 'CNY'
            },
            created_at: now
        };

        await db.collection('generation_jobs').add({
            data: job
        });

        // 将session标记为已消费
        await db.collection('unlock_sessions')
            .where({
                unlock_token: unlock_token
            })
            .update({
                data: {
                    status: 'consumed',
                    job_id: job_id,
                    consumed_at: now
                }
            });

        // 异步触发生成任务（实际项目中可使用消息队列）
        triggerGeneration(job_id, uploadFileID, style_id);

        return {
            ok: true,
            data: {
                job_id: job_id,
                status: 'queued',
                original_access: original_access
            }
        };

    } catch (error) {
        console.error('创建生成任务失败:', error);
        return {
            ok: false,
            error: { code: 'CREATE_ERROR', message: error.message || '创建生成任务失败' }
        };
    }
};

// 生成JobID
function generateJobId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `job_${timestamp}_${random}`;
}

function getMimeTypeFromFileId(fileID) {
    const ext = path.extname(fileID || '').toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
}

async function downloadImageAsDataUri(fileID) {
    const downloadResult = await cloud.downloadFile({
        fileID: fileID
    });

    if (!downloadResult || !downloadResult.fileContent) {
        throw new Error('下载原图失败');
    }

    const mimeType = getMimeTypeFromFileId(fileID);
    const base64Image = downloadResult.fileContent.toString('base64');
    return `data:${mimeType};base64,${base64Image}`;
}

function callQiniuImageAPI(imageBase64) {
    if (!CONFIG.API_KEY) {
        return Promise.reject(new Error('图生图API未配置API_KEY'));
    }

    const requestBody = JSON.stringify({
        model: CONFIG.MODEL,
        image: imageBase64,
        prompt: GENERATION_PROMPT,
        n: 1
    });

    const url = new URL(CONFIG.API_ENDPOINT);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            },
            timeout: CONFIG.REQUEST_TIMEOUT_MS
        }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
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

        req.on('timeout', () => {
            req.destroy(new Error('API请求超时'));
        });

        req.write(requestBody);
        req.end();
    });
}

function extractGeneratedImage(response) {
    const data = response && response.data;
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('API响应中没有生成图片');
    }

    const item = data.find(entry => entry && entry.b64_json);
    if (!item || !item.b64_json) {
        throw new Error('API响应中没有生成图片数据');
    }

    let base64Data = item.b64_json;
    if (base64Data.includes('base64,')) {
        base64Data = base64Data.split('base64,')[1];
    }

    return base64Data;
}

async function uploadGeneratedImage(base64Data, job_id) {
    const buffer = Buffer.from(base64Data, 'base64');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `generated_${timestamp}.jpg`;
    const tempPath = path.join('/tmp', fileName);
    fs.writeFileSync(tempPath, buffer);

    const cloudPath = `${CONFIG.OUTPUT_PREFIX}/${job_id}/${fileName}`;
    const uploadResult = await cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempPath
    });

    try {
        fs.unlinkSync(tempPath);
    } catch (err) {
        console.warn('清理临时文件失败:', err);
    }

    return {
        fileID: uploadResult.fileID,
        mime: 'image/jpeg',
        width: 1024,
        height: 1024
    };
}

// 触发生成（调用图生图API）
async function triggerGeneration(job_id, uploadFileID, style_id) {
    try {
        const db = cloud.database();

        // 更新为生成中
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: { status: 'generating', progress: 30 }
            });

        const inputDataUri = await downloadImageAsDataUri(uploadFileID);
        const response = await callQiniuImageAPI(inputDataUri);
        const generatedItem = extractGeneratedImage(response);

        // 更新进度
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: { progress: 70 }
            });

        const uploadResult = await uploadGeneratedImage(generatedItem, job_id);

        // 安全审核（占位）
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: { status: 'safety_check', progress: 90 }
            });

        // 生成资产
        const now = Math.floor(Date.now() / 1000);
        const view_asset_id = `asset_view_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const original_asset_id = `asset_orig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // view/original 使用同一张生成图，避免重复占用存储
        await db.collection('assets').add({
            data: {
                asset_id: view_asset_id,
                job_id: job_id,
                kind: 'view',
                fileID: uploadResult.fileID,
                mime: uploadResult.mime,
                width: uploadResult.width,
                height: uploadResult.height,
                created_at: now
            }
        });

        await db.collection('assets').add({
            data: {
                asset_id: original_asset_id,
                job_id: job_id,
                kind: 'original',
                fileID: uploadResult.fileID,
                mime: uploadResult.mime,
                width: uploadResult.width,
                height: uploadResult.height,
                created_at: now
            }
        });

        // 完成
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: {
                    status: 'succeeded',
                    progress: 100,
                    finished_at: now
                }
            });

    } catch (error) {
        console.error('生成失败:', error);

        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: {
                    status: 'failed',
                    error_code: 'GENERATION_ERROR',
                    error_message: error.message || '生成失败',
                    finished_at: Math.floor(Date.now() / 1000)
                }
            });
    }
}
