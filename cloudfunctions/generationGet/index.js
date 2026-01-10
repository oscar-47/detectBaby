// 云函数入口文件 - generationGet
// 查询生成任务状态（支持长轮询）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 最大等待时间（毫秒）
const MAX_WAIT_MS = 18000;
// 轮询间隔（毫秒）
const POLL_INTERVAL_MS = 1000;

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { job_id, wait_ms } = event;

    try {
        // 参数校验
        if (!job_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少job_id参数' }
            };
        }

        const waitTime = Math.min(wait_ms || 0, MAX_WAIT_MS);
        const startTime = Date.now();

        // 长轮询逻辑
        while (true) {
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

            // 如果任务已完成（成功或失败），立即返回
            if (['succeeded', 'failed', 'canceled'].includes(job.status)) {
                // 获取资产
                let assets = [];
                if (job.status === 'succeeded') {
                    const assetsResult = await db.collection('assets')
                        .where({
                            job_id: job_id
                        })
                        .get();
                    assets = assetsResult.data.map(a => ({
                        asset_id: a.asset_id,
                        kind: a.kind
                    }));
                }

                return {
                    ok: true,
                    data: {
                        status: job.status,
                        progress: job.progress,
                        assets: assets,
                        original_access: job.original_access,
                        error_code: job.error_code,
                        error_message: job.error_message
                    }
                };
            }

            // 检查是否超时
            const elapsed = Date.now() - startTime;
            if (elapsed >= waitTime) {
                // 返回当前状态
                return {
                    ok: true,
                    data: {
                        status: job.status,
                        progress: job.progress,
                        assets: [],
                        original_access: job.original_access
                    }
                };
            }

            // 等待后继续轮询
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }

    } catch (error) {
        console.error('查询任务状态失败:', error);
        return {
            ok: false,
            error: { code: 'GET_ERROR', message: error.message || '查询任务状态失败' }
        };
    }
};
