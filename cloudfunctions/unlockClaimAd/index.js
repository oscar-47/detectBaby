// 云函数入口文件 - unlockClaimAd
// 激励广告播放完成后，将解锁会话置为可消费（授权）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// Token有效期（秒）
const TOKEN_TTL = 300; // 5分钟

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { unlock_id, client_event_id, device_fp, idempotency_key } = event;

    try {
        // 参数校验
        if (!unlock_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少unlock_id参数' }
            };
        }

        const now = Math.floor(Date.now() / 1000);

        // 查找解锁会话
        const sessionResult = await db.collection('unlock_sessions')
            .where({
                unlock_id: unlock_id,
                openid: openid
            })
            .limit(1)
            .get();

        if (sessionResult.data.length === 0) {
            return {
                ok: false,
                error: { code: 'UNLOCK_NOT_FOUND', message: '解锁会话不存在' }
            };
        }

        const session = sessionResult.data[0];

        // 检查是否过期
        if (session.expires_at < now) {
            return {
                ok: false,
                error: { code: 'UNLOCK_EXPIRED', message: '解锁会话已过期' }
            };
        }

        // 检查是否已消费
        if (session.status === 'consumed') {
            return {
                ok: false,
                error: { code: 'UNLOCK_ALREADY_CONSUMED', message: '解锁会话已被使用' }
            };
        }

        // 检查是否已授权（幂等返回）
        if (session.status === 'authorized' && session.unlock_token) {
            return {
                ok: true,
                data: {
                    granted: true,
                    unlock_token: session.unlock_token,
                    expires_at: session.token_expires_at
                }
            };
        }

        // TODO: 这里可以添加广告观看验证逻辑
        // 例如验证client_event_id是否有效

        // 生成unlock_token
        const unlock_token = generateToken();
        const token_expires_at = now + TOKEN_TTL;

        // 更新会话状态
        await db.collection('unlock_sessions')
            .where({
                unlock_id: unlock_id,
                openid: openid
            })
            .update({
                data: {
                    status: 'authorized',
                    method: 'ad',
                    unlock_token: unlock_token,
                    token_expires_at: token_expires_at,
                    authorized_at: now
                }
            });

        return {
            ok: true,
            data: {
                granted: true,
                unlock_token: unlock_token,
                expires_at: token_expires_at
            }
        };

    } catch (error) {
        console.error('广告解锁失败:', error);
        return {
            ok: false,
            error: { code: 'CLAIM_ERROR', message: error.message || '广告解锁失败' }
        };
    }
};

// 生成Token
function generateToken() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 12);
    return `token_${timestamp}_${random}`;
}
