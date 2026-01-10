// pages/unlock/unlock.js
const app = getApp();

Page({
    data: {
        action: 'GEN', // GEN | UNLOCK_ORIGINAL
        uploadFileID: '',
        jobId: '',
        selectedMethod: null, // ad | pay
        processing: false,
        unlockId: '',
        unlockToken: ''
    },

    onLoad: function (options) {
        const action = options.action || 'GEN';
        const uploadFileID = decodeURIComponent(options.uploadFileID || '');
        const jobId = options.jobId || '';

        this.setData({
            action: action,
            uploadFileID: uploadFileID,
            jobId: jobId
        });

        // 准备解锁会话
        this.prepareUnlock();
    },

    // 准备解锁会话
    prepareUnlock: function () {
        const context = this.data.action === 'GEN'
            ? { uploadFileID: this.data.uploadFileID }
            : { job_id: this.data.jobId };

        app.callCloudFunction('unlockPrepare', {
            action: this.data.action,
            context: context,
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            this.setData({
                unlockId: data.unlock_id
            });
            console.log('解锁会话已准备', data);
        }).catch(err => {
            console.error('准备解锁会话失败', err);
            app.showToast('初始化失败，请重试');
        });
    },

    // 选择解锁方式
    onSelectMethod: function (e) {
        const method = e.currentTarget.dataset.method;
        this.setData({
            selectedMethod: method
        });
    },

    // 确认解锁
    onConfirm: function () {
        if (!this.data.selectedMethod || this.data.processing) return;

        if (this.data.selectedMethod === 'ad') {
            this.unlockByAd();
        } else {
            this.unlockByPay();
        }
    },

    // 广告解锁
    unlockByAd: function () {
        const that = this;
        this.setData({ processing: true });

        // 创建激励视频广告
        const rewardedVideoAd = wx.createRewardedVideoAd({
            adUnitId: 'your-ad-unit-id' // 请替换为你的广告单元ID
        });

        rewardedVideoAd.onLoad(() => {
            console.log('激励视频广告加载成功');
        });

        rewardedVideoAd.onError((err) => {
            console.error('激励视频广告错误', err);
            that.setData({ processing: false });
            app.showToast('广告加载失败，请稍后重试');
        });

        rewardedVideoAd.onClose((res) => {
            if (res && res.isEnded) {
                // 广告完整播放完成
                that.claimAdUnlock();
            } else {
                // 广告未完整播放
                that.setData({ processing: false });
                app.showToast('请完整观看广告');
            }
        });

        // 显示广告
        rewardedVideoAd.show().catch(() => {
            rewardedVideoAd.load().then(() => rewardedVideoAd.show()).catch(err => {
                console.error('广告展示失败', err);
                that.setData({ processing: false });
                app.showToast('广告加载失败');
            });
        });
    },

    // 广告完成后领取解锁
    claimAdUnlock: function () {
        const that = this;

        app.callCloudFunction('unlockClaimAd', {
            unlock_id: this.data.unlockId,
            client_event_id: Date.now().toString(),
            device_fp: '',
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            if (data.granted) {
                that.setData({
                    unlockToken: data.unlock_token
                });
                that.proceedAfterUnlock();
            } else {
                that.setData({ processing: false });
                app.showToast('解锁失败，请重试');
            }
        }).catch(err => {
            console.error('广告解锁失败', err);
            that.setData({ processing: false });
            app.showToast(err.message || '解锁失败');
        });
    },

    // 付费解锁
    unlockByPay: function () {
        const that = this;
        this.setData({ processing: true });

        const sku = this.data.action === 'GEN' ? 'gen_with_original_1' : 'unlock_original_1';

        // 1. 创建订单
        app.callCloudFunction('orderCreate', {
            sku: sku,
            qty: 1,
            unlock_id: this.data.unlockId,
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            const orderId = data.order_id;

            // 2. 获取支付参数
            return app.callCloudFunction('wxPrepay', {
                order_id: orderId,
                idempotency_key: app.generateIdempotencyKey()
            }).then(prepayData => {
                return { orderId, payParams: prepayData.pay_params };
            });
        }).then(({ orderId, payParams }) => {
            // 3. 调用微信支付
            wx.requestPayment({
                ...payParams,
                success: () => {
                    // 支付成功，领取解锁
                    that.claimPayUnlock(orderId);
                },
                fail: (err) => {
                    console.log('支付取消或失败', err);
                    that.setData({ processing: false });
                    if (err.errMsg.includes('cancel')) {
                        app.showToast('支付已取消');
                    } else {
                        app.showToast('支付失败');
                    }
                }
            });
        }).catch(err => {
            console.error('创建订单失败', err);
            that.setData({ processing: false });
            app.showToast(err.message || '订单创建失败');
        });
    },

    // 支付成功后领取解锁
    claimPayUnlock: function (orderId) {
        const that = this;

        app.callCloudFunction('unlockClaimPay', {
            unlock_id: this.data.unlockId,
            order_id: orderId,
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            if (data.granted) {
                that.setData({
                    unlockToken: data.unlock_token
                });
                that.proceedAfterUnlock();
            } else {
                that.setData({ processing: false });
                app.showToast('解锁失败，请联系客服');
            }
        }).catch(err => {
            console.error('支付解锁失败', err);
            that.setData({ processing: false });
            app.showToast(err.message || '解锁失败');
        });
    },

    // 解锁后继续
    proceedAfterUnlock: function () {
        if (this.data.action === 'GEN') {
            // 跳转到生成页面
            wx.redirectTo({
                url: `/pages/job/job?unlockToken=${this.data.unlockToken}&uploadFileID=${encodeURIComponent(this.data.uploadFileID)}&method=${this.data.selectedMethod}`
            });
        } else {
            // 返回结果页并传递解锁token
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage) {
                prevPage.setData({
                    originalUnlockToken: this.data.unlockToken
                });
            }
            wx.navigateBack();
        }
    }
});
