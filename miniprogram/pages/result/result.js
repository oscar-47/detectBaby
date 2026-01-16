// pages/result/result.js
const app = getApp();

Page({
    data: {
        jobId: '',
        assetId: '',
        originalAccess: 'locked', // locked | unlocked | included
        viewImageUrl: '',
        originalUnlockToken: '' // 从解锁页返回时设置
    },

    onLoad: function (options) {
        const jobId = options.jobId || '';
        const assetId = options.assetId || '';
        // === 推广期免费：原图始终已解锁 ===
        const originalAccess = 'included'; // options.originalAccess || 'locked';
        // 保存uploadFileID用于再生成
        const uploadFileID = decodeURIComponent(options.uploadFileID || '');

        this.setData({
            jobId: jobId,
            assetId: assetId,
            originalAccess: originalAccess,
            uploadFileID: uploadFileID
        });

        // 获取展示图临时链接
        if (assetId) {
            this.loadViewImage();
        }
    },

    // 加载展示图
    loadViewImage: function () {
        app.callCloudFunction('assetGet', {
            asset_id: this.data.assetId
        }).then(data => {
            this.setData({
                viewImageUrl: data.temp_url
            });
        }).catch(err => {
            console.error('获取图片失败', err);
            app.showToast('图片加载失败');
        });
    },

    // 预览图片
    onPreviewImage: function () {
        if (!this.data.viewImageUrl) return;

        wx.previewImage({
            current: this.data.viewImageUrl,
            urls: [this.data.viewImageUrl]
        });
    },

    // 保存到相册
    onSaveToAlbum: function () {
        const that = this;

        if (!this.data.viewImageUrl) {
            app.showToast('图片加载中，请稍后');
            return;
        }

        // 检查相册权限
        wx.getSetting({
            success: (res) => {
                if (res.authSetting['scope.writePhotosAlbum']) {
                    that.doSaveToAlbum();
                } else if (res.authSetting['scope.writePhotosAlbum'] === false) {
                    // 用户曾拒绝，引导打开设置
                    wx.showModal({
                        title: '需要相册权限',
                        content: '请在设置中开启相册权限，以便保存图片',
                        confirmText: '去设置',
                        success: (modalRes) => {
                            if (modalRes.confirm) {
                                wx.openSetting();
                            }
                        }
                    });
                } else {
                    // 首次请求权限
                    that.doSaveToAlbum();
                }
            }
        });
    },

    // 执行保存
    doSaveToAlbum: function () {
        const that = this;
        app.showLoading('保存中...');

        // 先下载图片
        wx.downloadFile({
            url: this.data.viewImageUrl,
            success: (res) => {
                if (res.statusCode === 200) {
                    wx.saveImageToPhotosAlbum({
                        filePath: res.tempFilePath,
                        success: () => {
                            app.hideLoading();
                            app.showToast('保存成功', 'success');
                        },
                        fail: (err) => {
                            app.hideLoading();
                            if (err.errMsg.includes('auth deny')) {
                                wx.showModal({
                                    title: '需要相册权限',
                                    content: '请在设置中开启相册权限',
                                    confirmText: '去设置',
                                    success: (modalRes) => {
                                        if (modalRes.confirm) {
                                            wx.openSetting();
                                        }
                                    }
                                });
                            } else {
                                app.showToast('保存失败');
                            }
                        }
                    });
                } else {
                    app.hideLoading();
                    app.showToast('图片下载失败');
                }
            },
            fail: () => {
                app.hideLoading();
                app.showToast('图片下载失败');
            }
        });
    },

    // 下载原图
    onDownloadOriginal: function () {
        // === 推广期免费：直接下载原图 ===
        this.downloadOriginal();
        // === 推广期结束后恢复以下逻辑 ===
        /*
        if (this.data.originalAccess === 'locked') {
            // 需要解锁
            wx.navigateTo({
                url: `/pages/unlock/unlock?action=UNLOCK_ORIGINAL&jobId=${this.data.jobId}`
            });
        } else {
            // 已解锁，直接下载
            this.downloadOriginal();
        }
        */
    },

    // 执行原图下载
    downloadOriginal: function (unlockToken) {
        const that = this;
        app.showLoading('获取原图...');

        app.callCloudFunction('originalDownload', {
            job_id: this.data.jobId,
            unlock_token: unlockToken || '',
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            // 更新状态
            that.setData({
                originalAccess: 'unlocked'
            });

            // 下载并保存
            wx.downloadFile({
                url: data.temp_url,
                success: (res) => {
                    if (res.statusCode === 200) {
                        wx.saveImageToPhotosAlbum({
                            filePath: res.tempFilePath,
                            success: () => {
                                app.hideLoading();
                                app.showToast('原图已保存', 'success');
                            },
                            fail: () => {
                                app.hideLoading();
                                app.showToast('保存失败');
                            }
                        });
                    } else {
                        app.hideLoading();
                        app.showToast('下载失败');
                    }
                },
                fail: () => {
                    app.hideLoading();
                    app.showToast('下载失败');
                }
            });
        }).catch(err => {
            app.hideLoading();
            console.error('获取原图失败', err);
            app.showToast(err.message || '获取原图失败');
        });
    },

    // 再生成一张
    onRegenerate: function () {
        // === 推广期免费：直接跳转生成页 ===
        wx.navigateTo({
            url: `/pages/job/job?uploadFileID=${encodeURIComponent(this.data.uploadFileID || '')}&method=free`
        });
        // === 推广期结束后恢复以下逻辑 ===
        /*
        wx.navigateTo({
            url: `/pages/unlock/unlock?action=GEN&uploadFileID=${encodeURIComponent(this.data.uploadFileID || '')}`
        });
        */
    },

    // 查看历史
    onGoHistory: function () {
        wx.switchTab({
            url: '/pages/history/history'
        });
    },

    // 从解锁页返回时检查
    onShow: function () {
        // 如果有原图解锁token，执行下载
        if (this.data.originalUnlockToken) {
            this.downloadOriginal(this.data.originalUnlockToken);
            this.setData({ originalUnlockToken: '' });
        }
    },

    // 分享
    onShareAppMessage: function () {
        return {
            title: '看看AI生成的宝宝照！',
            path: '/pages/home/home',
            imageUrl: this.data.viewImageUrl || '/images/share-cover.png'
        };
    }
});
