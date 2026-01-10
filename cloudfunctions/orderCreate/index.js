// 云函数入口文件 - orderCreate
// 创建支付订单
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// SKU配置
const SKU_CONFIG = {
    'gen_with_original_1': {
        name: '生成宝宝照（含原图）',
        amount_fen: 990,
        currency: 'CNY'
    },
    'unlock_original_1': {
        name: '解锁原图下载',
        amount_fen: 990,
        currency: 'CNY'
    }
};

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { sku, qty, unlock_id, idempotency_key } = event;

    try {
        // 参数校验
        if (!sku || !SKU_CONFIG[sku]) {
            return {
                ok: false,
                error: { code: 'SKU_INVALID', message: '无效的SKU' }
            };
        }

        if (!unlock_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少unlock_id参数' }
            };
        }

        const now = Math.floor(Date.now() / 1000);

        // 检查解锁会话
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

        // 幂等检查 - 检查是否已有相同unlock_id的订单
        const existingOrder = await db.collection('orders')
            .where({
                unlock_id: unlock_id,
                openid: openid
            })
            .limit(1)
            .get();

        if (existingOrder.data.length > 0) {
            const order = existingOrder.data[0];
            return {
                ok: true,
                data: {
                    order_id: order.order_id,
                    amount_fen: order.amount_fen,
                    status: order.status
                }
            };
        }

        // 创建订单
        const order_id = generateOrderId();
        const skuConfig = SKU_CONFIG[sku];
        const quantity = qty || 1;
        const amount_fen = skuConfig.amount_fen * quantity;

        const order = {
            order_id: order_id,
            openid: openid,
            sku: sku,
            qty: quantity,
            amount_fen: amount_fen,
            currency: skuConfig.currency,
            status: 'created',
            unlock_id: unlock_id,
            created_at: now
        };

        await db.collection('orders').add({
            data: order
        });

        return {
            ok: true,
            data: {
                order_id: order_id,
                amount_fen: amount_fen,
                status: 'created'
            }
        };

    } catch (error) {
        console.error('创建订单失败:', error);
        return {
            ok: false,
            error: { code: 'ORDER_CREATE_ERROR', message: error.message || '创建订单失败' }
        };
    }
};

// 生成订单ID
function generateOrderId() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `ORD${dateStr}${timestamp}${random}`;
}
