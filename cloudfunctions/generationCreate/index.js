// 云函数入口文件 - generationCreate
// 创建生成任务
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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
            provider_id: 'default_provider',
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
        // 这里使用setTimeout模拟异步处理
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

// 触发生成（模拟）
async function triggerGeneration(job_id, uploadFileID, style_id) {
    // 实际项目中应调用AI Provider进行生成
    // 这里只是更新状态模拟生成过程

    try {
        const db = cloud.database();

        // 模拟生成延迟
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 更新为生成中
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: { status: 'generating', progress: 30 }
            });

        await new Promise(resolve => setTimeout(resolve, 3000));

        // 更新进度
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: { progress: 70 }
            });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // 安全审核
        await db.collection('generation_jobs')
            .where({ job_id: job_id })
            .update({
                data: { status: 'safety_check', progress: 90 }
            });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // 生成资产（模拟）
        const now = Math.floor(Date.now() / 1000);
        const view_asset_id = `asset_view_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const original_asset_id = `asset_orig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // 创建view资产
        await db.collection('assets').add({
            data: {
                asset_id: view_asset_id,
                job_id: job_id,
                kind: 'view',
                fileID: uploadFileID, // 实际应为生成的图片fileID
                mime: 'image/jpeg',
                width: 1024,
                height: 1024,
                created_at: now
            }
        });

        // 创建original资产
        await db.collection('assets').add({
            data: {
                asset_id: original_asset_id,
                job_id: job_id,
                kind: 'original',
                fileID: uploadFileID, // 实际应为生成的原图fileID
                mime: 'image/jpeg',
                width: 2048,
                height: 2048,
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
