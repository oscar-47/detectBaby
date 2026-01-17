// pages/history/history.js
const app = getApp();

Page({
    data: {
        historyList: [],
        loading: true
    },

    onLoad: function (options) {

    },

    onShow: function () {
        this.loadHistory();
    },

    onPullDownRefresh: function () {
        this.loadHistory().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 加载历史记录
    loadHistory: function () {
        this.setData({ loading: true });

        return app.callCloudFunction('userHistory', {}).then(data => {
            const items = (data.items || []).map(item => {
                return {
                    ...item,
                    created_time: app.formatTime(item.created_at)
                };
            });

            this.setData({
                historyList: items,
                loading: false
            });
        }).catch(err => {
            console.error('加载历史失败', err);
            this.setData({
                historyList: [],
                loading: false
            });
        });
    },

    // 点击历史项
    onItemClick: function (e) {
        const item = e.currentTarget.dataset.item;

        if (item.status === 'succeeded') {
            // 跳转到结果页
            wx.navigateTo({
                url: `/pages/result/result?jobId=${item.job_id}&assetId=${item.view_asset_id || ''}&originalAccess=${item.original_access || 'locked'}&uploadFileID=${encodeURIComponent(item.upload_file_id || '')}`
            });
        } else if (item.status === 'generating' || item.status === 'queued') {
            // 跳转到生成中页面
            wx.navigateTo({
                url: `/pages/job/job?jobId=${item.job_id}&uploadFileID=${encodeURIComponent(item.upload_file_id || '')}`
            });
        } else {
            // 失败，提示重新生成
            wx.showModal({
                title: '生成失败',
                content: '该任务生成失败，是否重新开始？',
                confirmText: '重新生成',
                success: (res) => {
                    if (res.confirm) {
                        this.onGoGenerate();
                    }
                }
            });
        }
    },

    // 前往生成
    onGoGenerate: function () {
        wx.switchTab({
            url: '/pages/home/home'
        });
    }
});
