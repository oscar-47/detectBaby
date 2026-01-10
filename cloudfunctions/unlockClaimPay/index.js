// 云函数入口文件 - unlockClaimPay
// 支付成功后，将解锁会话置为可消费（授权）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// Token有效期（秒）
const TOKEN_TTL = 300; // 5分钟

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { unlock_id, order_id, idempotency_key } = event;

    try {
        // 参数校验
        if (!unlock_id || !order_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少必要参数' }
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

        // 验证订单状态
        const orderResult = await db.collection('orders')
            .where({
                order_id: order_id,
                openid: openid,
                unlock_id: unlock_id
            })
            .limit(1)
            .get();

        if (orderResult.data.length === 0) {
            return {
                ok: false,
                error: { code: 'ORDER_NOT_FOUND', message: '订单不存在' }
            };
        }

        const order = orderResult.data[0];

        if (order.status !== 'paid') {
            return {
                ok: false,
                error: { code: 'ORDER_NOT_PAID', message: '订单未支付' }
            };
        }

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
                    method: 'pay',
                    sku: order.sku,
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
        console.error('支付解锁失败:', error);
        return {
            ok: false,
            error: { code: 'CLAIM_ERROR', message: error.message || '支付解锁失败' }
        };
    }
};

// 生成Token
function generateToken() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 12);
    return `token_${timestamp}_${random}`;
}
