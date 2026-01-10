// 云函数入口文件 - wxPayNotify
// 微信支付回调
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
    try {
        const { outTradeNo, resultCode, transactionId } = event;

        if (resultCode !== 'SUCCESS') {
            console.log('支付未成功:', event);
            return { errcode: 0 };
        }

        const order_id = outTradeNo;
        const now = Math.floor(Date.now() / 1000);

        // 查询订单
        const orderResult = await db.collection('orders')
            .where({
                order_id: order_id
            })
            .limit(1)
            .get();

        if (orderResult.data.length === 0) {
            console.error('订单不存在:', order_id);
            return { errcode: 0 };
        }

        const order = orderResult.data[0];

        // 幂等检查
        if (order.status === 'paid') {
            console.log('订单已支付，幂等返回:', order_id);
            return { errcode: 0 };
        }

        // 更新订单状态
        await db.collection('orders')
            .where({
                order_id: order_id
            })
            .update({
                data: {
                    status: 'paid',
                    paid_at: now,
                    wx_txn_id: transactionId
                }
            });

        // 创建支付记录
        await db.collection('payments').add({
            data: {
                payment_id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                order_id: order_id,
                provider: 'wechatpay',
                wx_txn_id: transactionId,
                amount_fen: order.amount_fen,
                status: 'success',
                paid_at: now
            }
        });

        console.log('支付成功:', order_id);
        return { errcode: 0 };

    } catch (error) {
        console.error('支付回调处理失败:', error);
        return { errcode: 0 };
    }
};
