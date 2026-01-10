// pages/upload/upload.js
const app = getApp();

Page({
    data: {
        selectedImage: null,
        selectedImagePath: null,
        uploading: false,
        uploadProgress: 0
    },

    onLoad: function (options) {
        // 初始化
    },

    // 选择图片
    onChooseImage: function () {
        if (this.data.selectedImage) return;
        this.chooseImage();
    },

    // 更换图片
    onChangeImage: function () {
        this.chooseImage();
    },

    // 选择图片逻辑
    chooseImage: function () {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            camera: 'back',
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                this.setData({
                    selectedImage: tempFilePath,
                    selectedImagePath: tempFilePath
                });
            }
        });
    },

    // 裁剪图片
    onCropImage: function () {
        if (!this.data.selectedImagePath) return;

        wx.editImage({
            src: this.data.selectedImagePath,
            success: (res) => {
                this.setData({
                    selectedImage: res.tempFilePath,
                    selectedImagePath: res.tempFilePath
                });
            },
            fail: (err) => {
                console.log('裁剪取消或失败', err);
            }
        });
    },

    // 开始上传并校验
    onStartUpload: function () {
        if (!this.data.selectedImage || this.data.uploading) return;

        this.setData({ uploading: true, uploadProgress: 0 });

        const that = this;
        const filePath = this.data.selectedImagePath;

        // 1. 计算文件SHA256（简化处理，实际需要计算）
        const sha256 = this.generateSimpleHash(filePath);

        // 2. 上传到云存储
        const cloudPath = `uploads/${app.globalData.openid || 'anonymous'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

        wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            success: res => {
                console.log('上传成功', res);
                const uploadFileID = res.fileID;

                // 更新进度到100%
                that.setData({ uploadProgress: 100 });

                // 跳转到校验页面
                setTimeout(() => {
                    wx.navigateTo({
                        url: `/pages/validate/validate?uploadFileID=${encodeURIComponent(uploadFileID)}&sha256=${sha256}`
                    });
                    that.setData({ uploading: false, uploadProgress: 0 });
                }, 500);
            },
            fail: err => {
                console.error('上传失败', err);
                app.showToast('上传失败，请重试');
                that.setData({ uploading: false, uploadProgress: 0 });
            },
            // 上传进度
            progress: res => {
                that.setData({
                    uploadProgress: res.progress
                });
            }
        });
    },

    // 生成简单哈希（实际应使用真实的SHA256）
    generateSimpleHash: function (str) {
        let hash = 0;
        const timestamp = Date.now().toString();
        const combined = str + timestamp;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    },

    onUnload: function () {
        // 清理
    }
});
