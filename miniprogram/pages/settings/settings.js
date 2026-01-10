// pages/settings/settings.js
const app = getApp();

Page({
    data: {
        userInfo: {},
        openid: ''
    },

    onLoad: function (options) {
        this.setData({
            openid: app.globalData.openid || ''
        });
    },

    onShow: function () {
        // 更新openid
        if (!this.data.openid && app.globalData.openid) {
            this.setData({
                openid: app.globalData.openid
            });
        }
    },

    // 打开协议页面
    onOpenAgreement: function (e) {
        const type = e.currentTarget.dataset.type;
        let title = '';

        switch (type) {
            case 'user':
                title = '用户协议';
                break;
            case 'privacy':
                title = '隐私政策';
                break;
            case 'disclaimer':
                title = '免责声明';
                break;
        }

        wx.navigateTo({
            url: `/pages/settings/agreement?type=${type}&title=${title}`
        });
    },

    // 删除所有数据
    onDeleteData: function () {
        wx.showModal({
            title: '确认删除',
            content: '将删除所有上传的图片和生成记录，此操作不可恢复。确定要继续吗？',
            confirmText: '确认删除',
            confirmColor: '#ff5252',
            success: (res) => {
                if (res.confirm) {
                    this.doDeleteData();
                }
            }
        });
    },

    // 执行删除
    doDeleteData: function () {
        app.showLoading('删除中...');

        app.callCloudFunction('userDataDelete', {
            idempotency_key: app.generateIdempotencyKey()
        }).then(() => {
            app.hideLoading();
            app.showToast('删除成功', 'success');
        }).catch(err => {
            app.hideLoading();
            console.error('删除失败', err);
            app.showToast('删除失败，请重试');
        });
    }
});
