// 云函数入口文件 - wxPrepay
// 生成微信支付参数
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { order_id, idempotency_key } = event;

    try {
        // 参数校验
        if (!order_id) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少order_id参数' }
            };
        }

        // 查询订单
        const orderResult = await db.collection('orders')
            .where({
                order_id: order_id,
                openid: openid
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

        // 检查订单状态
        if (order.status !== 'created') {
            return {
                ok: false,
                error: { code: 'ORDER_STATUS_INVALID', message: '订单状态无效' }
            };
        }

        // 调用微信支付统一下单
        // 注意：需要在云开发控制台配置微信支付
        const payResult = await cloud.cloudPay.unifiedOrder({
            body: getOrderBody(order.sku),
            outTradeNo: order.order_id,
            spbillCreateIp: '127.0.0.1',
            subMchId: '', // 子商户号，如果有的话
            totalFee: order.amount_fen,
            envId: cloud.DYNAMIC_CURRENT_ENV,
            functionName: 'wxPayNotify', // 支付回调云函数
            nonceStr: generateNonceStr(),
            tradeType: 'JSAPI'
        });

        if (payResult.returnCode === 'SUCCESS' && payResult.resultCode === 'SUCCESS') {
            // 更新订单状态为支付中
            await db.collection('orders')
                .where({
                    order_id: order_id
                })
                .update({
                    data: {
                        status: 'paying',
                        prepay_id: payResult.prepayId
                    }
                });

            return {
                ok: true,
                data: {
                    pay_params: {
                        timeStamp: payResult.payment.timeStamp,
                        nonceStr: payResult.payment.nonceStr,
                        package: payResult.payment.package,
                        signType: payResult.payment.signType,
                        paySign: payResult.payment.paySign
                    }
                }
            };
        } else {
            return {
                ok: false,
                error: {
                    code: 'PREPAY_FAILED',
                    message: payResult.returnMsg || payResult.errCodeDes || '预支付失败'
                }
            };
        }

    } catch (error) {
        console.error('生成支付参数失败:', error);
        return {
            ok: false,
            error: { code: 'PREPAY_ERROR', message: error.message || '生成支付参数失败' }
        };
    }
};

// 获取订单描述
function getOrderBody(sku) {
    const descriptions = {
        'gen_with_original_1': '宝宝照AI生成',
        'unlock_original_1': '解锁原图下载'
    };
    return descriptions[sku] || '宝宝照AI服务';
}

// 生成随机字符串
function generateNonceStr() {
    return Math.random().toString(36).substr(2, 15);
}
