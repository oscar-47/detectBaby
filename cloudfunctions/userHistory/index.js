// 云函数入口文件 - userHistory
// 用户历史记录
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 保留天数
const RETENTION_DAYS = 30;

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    try {
        const now = Math.floor(Date.now() / 1000);
        const cutoffTime = now - (RETENTION_DAYS * 24 * 60 * 60);

        // 查询用户的生成任务
        const jobsResult = await db.collection('generation_jobs')
            .where({
                openid: openid,
                created_at: db.command.gte(cutoffTime)
            })
            .orderBy('created_at', 'desc')
            .limit(50)
            .get();

        const jobs = jobsResult.data;

        // 获取每个任务的view资产作为缩略图
        const items = await Promise.all(jobs.map(async (job) => {
            let thumbnail_url = '';
            let view_asset_id = '';

            if (job.status === 'succeeded') {
                // 获取view资产
                const assetResult = await db.collection('assets')
                    .where({
                        job_id: job.job_id,
                        kind: 'view'
                    })
                    .limit(1)
                    .get();

                if (assetResult.data.length > 0) {
                    view_asset_id = assetResult.data[0].asset_id;

                    // 获取临时链接
                    const tempUrlResult = await cloud.getTempFileURL({
                        fileList: [assetResult.data[0].fileID]
                    });

                    if (tempUrlResult.fileList && tempUrlResult.fileList[0] && tempUrlResult.fileList[0].status === 0) {
                        thumbnail_url = tempUrlResult.fileList[0].tempFileURL;
                    }
                }
            }

            return {
                job_id: job.job_id,
                status: job.status,
                upload_file_id: job.uploadFileID,
                original_access: job.original_access,
                style_id: job.style_id,
                thumbnail_url: thumbnail_url,
                view_asset_id: view_asset_id,
                created_at: job.created_at
            };
        }));

        return {
            ok: true,
            data: {
                items: items
            }
        };

    } catch (error) {
        console.error('获取历史记录失败:', error);
        return {
            ok: false,
            error: { code: 'HISTORY_ERROR', message: error.message || '获取历史记录失败' }
        };
    }
};
