// 云函数入口文件 - userDataDelete
// 一键删除用户所有数据
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { idempotency_key } = event;

    try {
        const now = Math.floor(Date.now() / 1000);

        // 1. 获取用户所有资产的fileID用于删除
        const assetsToDelete = [];

        // 获取用户的所有任务
        const jobsResult = await db.collection('generation_jobs')
            .where({
                openid: openid
            })
            .get();

        const jobs = jobsResult.data;
        const jobIds = jobs.map(j => j.job_id);

        // 获取这些任务的所有资产
        if (jobIds.length > 0) {
            for (const jobId of jobIds) {
                const assetsResult = await db.collection('assets')
                    .where({
                        job_id: jobId
                    })
                    .get();

                assetsResult.data.forEach(asset => {
                    if (asset.fileID) {
                        assetsToDelete.push(asset.fileID);
                    }
                });
            }
        }

        // 获取用户上传的文件
        const uploadsResult = await db.collection('uploads')
            .where({
                openid: openid
            })
            .get();

        uploadsResult.data.forEach(upload => {
            if (upload.uploadFileID) {
                assetsToDelete.push(upload.uploadFileID);
            }
        });

        // 2. 删除云存储文件
        if (assetsToDelete.length > 0) {
            // 分批删除（每批最多50个）
            const batchSize = 50;
            for (let i = 0; i < assetsToDelete.length; i += batchSize) {
                const batch = assetsToDelete.slice(i, i + batchSize);
                try {
                    await cloud.deleteFile({
                        fileList: batch
                    });
                } catch (err) {
                    console.error('删除文件失败:', err);
                }
            }
        }

        // 3. 删除数据库记录
        // 删除资产
        if (jobIds.length > 0) {
            for (const jobId of jobIds) {
                await db.collection('assets')
                    .where({
                        job_id: jobId
                    })
                    .remove();
            }
        }

        // 删除生成任务
        await db.collection('generation_jobs')
            .where({
                openid: openid
            })
            .remove();

        // 删除上传记录
        await db.collection('uploads')
            .where({
                openid: openid
            })
            .remove();

        // 删除校验记录
        await db.collection('ultrasound_validations')
            .where({
                openid: openid
            })
            .remove();

        // 删除解锁会话
        await db.collection('unlock_sessions')
            .where({
                openid: openid
            })
            .remove();

        // 删除订单记录
        await db.collection('orders')
            .where({
                openid: openid
            })
            .remove();

        // 删除支付记录（通过订单关联）
        // 注意：支付记录可能需要保留用于财务审计，实际项目中需要谨慎处理

        console.log(`用户数据已删除: ${openid}, 删除文件数: ${assetsToDelete.length}`);

        return {
            ok: true,
            data: {
                deleted: true,
                files_deleted: assetsToDelete.length
            }
        };

    } catch (error) {
        console.error('删除用户数据失败:', error);
        return {
            ok: false,
            error: { code: 'DELETE_ERROR', message: error.message || '删除用户数据失败' }
        };
    }
};
