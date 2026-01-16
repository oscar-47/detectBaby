// 云函数入口文件 - originalDownload
// 获取原图临时链接（需权限）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 临时链接有效期（秒）
const TEMP_URL_TTL = 7200; // 2小时

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { job_id, unlock_token, idempotency_key } = event;

    try {
        // 参数校验
        if (!job_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少job_id参数' }
            };
        }

        const now = Math.floor(Date.now() / 1000);

        // 查询任务
        const jobResult = await db.collection('generation_jobs')
            .where({
                job_id: job_id,
                openid: openid
            })
            .limit(1)
            .get();

        if (jobResult.data.length === 0) {
            return {
                ok: false,
                error: { code: 'JOB_NOT_FOUND', message: '任务不存在' }
            };
        }

        const job = jobResult.data[0];

        // === 推广期免费：直接返回原图 ===
        return await getOriginalUrl(job_id);
        // === 推广期结束后恢复以下权限检查逻辑 ===
        /*
        // 检查原图访问权限
        if (job.original_access === 'included' || job.original_access === 'unlocked') {
            // 有权限，直接返回
            return await getOriginalUrl(job_id);
        }

        // 需要解锁
        if (!unlock_token) {
            return {
                ok: false,
                error: { code: 'ORIGINAL_LOCKED', message: '原图需要解锁' }
            };
        }
        */

        // 验证解锁token
        const sessionResult = await db.collection('unlock_sessions')
            .where({
                unlock_token: unlock_token,
                openid: openid,
                action: 'UNLOCK_ORIGINAL'
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

        // 检查context是否匹配
        if (session.context.job_id !== job_id) {
            return {
                ok: false,
                error: { code: 'CONTEXT_MISMATCH', message: '解锁令牌与任务不匹配' }
            };
        }

        // 消费token并解锁原图
        await db.collection('unlock_sessions')
            .where({
                unlock_token: unlock_token
            })
            .update({
                data: {
                    status: 'consumed',
                    consumed_at: now
                }
            });

        // 更新任务的原图访问权限
        await db.collection('generation_jobs')
            .where({
                job_id: job_id
            })
            .update({
                data: {
                    original_access: 'unlocked'
                }
            });

        // 返回原图链接
        return await getOriginalUrl(job_id);

    } catch (error) {
        console.error('获取原图失败:', error);
        return {
            ok: false,
            error: { code: 'DOWNLOAD_ERROR', message: error.message || '获取原图失败' }
        };
    }
};

// 获取原图临时链接
async function getOriginalUrl(job_id) {
    // 查询原图资产
    const assetResult = await db.collection('assets')
        .where({
            job_id: job_id,
            kind: 'original'
        })
        .limit(1)
        .get();

    if (assetResult.data.length === 0) {
        return {
            ok: false,
            error: { code: 'ASSET_NOT_FOUND', message: '原图不存在' }
        };
    }

    const asset = assetResult.data[0];

    // 获取临时链接
    const tempUrlResult = await cloud.getTempFileURL({
        fileList: [asset.fileID]
    });

    if (!tempUrlResult.fileList || tempUrlResult.fileList.length === 0 || tempUrlResult.fileList[0].status !== 0) {
        return {
            ok: false,
            error: { code: 'FILE_ERROR', message: '获取文件链接失败' }
        };
    }

    const now = Math.floor(Date.now() / 1000);

    return {
        ok: true,
        data: {
            temp_url: tempUrlResult.fileList[0].tempFileURL,
            expires_at: now + TEMP_URL_TTL
        }
    };
}
