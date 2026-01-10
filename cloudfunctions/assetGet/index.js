// 云函数入口文件 - assetGet
// 获取资产临时链接
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 临时链接有效期（秒）
const TEMP_URL_TTL = 7200; // 2小时

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { asset_id } = event;

    try {
        // 参数校验
        if (!asset_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少asset_id参数' }
            };
        }

        // 查询资产
        const assetResult = await db.collection('assets')
            .where({
                asset_id: asset_id
            })
            .limit(1)
            .get();

        if (assetResult.data.length === 0) {
            return {
                ok: false,
                error: { code: 'ASSET_NOT_FOUND', message: '资产不存在' }
            };
        }

        const asset = assetResult.data[0];

        // 验证资产所有权
        const jobResult = await db.collection('generation_jobs')
            .where({
                job_id: asset.job_id,
                openid: openid
            })
            .limit(1)
            .get();

        if (jobResult.data.length === 0) {
            return {
                ok: false,
                error: { code: 'ACCESS_DENIED', message: '无权访问该资产' }
            };
        }

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

    } catch (error) {
        console.error('获取资产链接失败:', error);
        return {
            ok: false,
            error: { code: 'GET_ERROR', message: error.message || '获取资产链接失败' }
        };
    }
};
