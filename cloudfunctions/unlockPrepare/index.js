// 云函数入口文件 - unlockPrepare
// 生成/原图下载的"广告或付费二选一"统一会话
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 会话有效期（秒）
const SESSION_TTL = 600; // 10分钟

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { action, context: unlockContext, idempotency_key } = event;

    try {
        // 参数校验
        if (!action || !['GEN', 'UNLOCK_ORIGINAL'].includes(action)) {
            return {
                ok: false,
                error: { code: 'INVALID_ACTION', message: '无效的action参数' }
            };
        }

        // 根据action校验context
        if (action === 'GEN') {
            if (!unlockContext || !unlockContext.uploadFileID) {
                return {
                    ok: false,
                    error: { code: 'INVALID_CONTEXT', message: '生成操作需要提供uploadFileID' }
                };
            }

            // 检查是否已通过校验
            const validation = await db.collection('ultrasound_validations')
                .where({
                    uploadFileID: unlockContext.uploadFileID,
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
        } else if (action === 'UNLOCK_ORIGINAL') {
            if (!unlockContext || !unlockContext.job_id) {
                return {
                    ok: false,
                    error: { code: 'INVALID_CONTEXT', message: '解锁原图需要提供job_id' }
                };
            }

            // 检查job是否存在
            const job = await db.collection('generation_jobs')
                .where({
                    job_id: unlockContext.job_id,
                    openid: openid
                })
                .limit(1)
                .get();

            if (job.data.length === 0) {
                return {
                    ok: false,
                    error: { code: 'JOB_NOT_FOUND', message: '任务不存在' }
                };
            }
        }

        // 生成unlock_id
        const unlock_id = generateUnlockId();
        const now = Math.floor(Date.now() / 1000);
        const expires_at = now + SESSION_TTL;

        // 创建解锁会话
        const unlockSession = {
            unlock_id: unlock_id,
            openid: openid,
            action: action,
            context: unlockContext,
            method: null, // 待用户选择
            sku: null,
            status: 'prepared',
            authorized_at: null,
            expires_at: expires_at,
            created_at: now
        };

        await db.collection('unlock_sessions').add({
            data: unlockSession
        });

        return {
            ok: true,
            data: {
                unlock_id: unlock_id,
                methods: ['ad', 'pay'],
                expires_at: expires_at
            }
        };

    } catch (error) {
        console.error('准备解锁会话失败:', error);
        return {
            ok: false,
            error: { code: 'PREPARE_ERROR', message: error.message || '准备解锁会话失败' }
        };
    }
};

// 生成解锁ID
function generateUnlockId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `unlock_${timestamp}_${random}`;
}
