// pages/job/job.js
const app = getApp();

Page({
    data: {
        unlockToken: '',
        uploadFileID: '',
        method: 'ad', // ad | pay
        jobId: '',
        status: 'generating', // generating, succeeded, failed
        progress: 0,
        currentStep: 1,
        errorMessage: '',
        originalAccess: 'locked'
    },

    pollTimer: null,
    progressTimer: null,

    onLoad: function (options) {
        const unlockToken = options.unlockToken || '';
        const uploadFileID = decodeURIComponent(options.uploadFileID || '');
        const method = options.method || 'ad';
        const jobId = options.jobId || '';

        this.setData({
            unlockToken: unlockToken,
            uploadFileID: uploadFileID,
            method: method,
            jobId: jobId
        });

        if (jobId) {
            // 场景 2：已有任务 ID，直接开始轮询
            this.startProgressSimulation();
            this.pollJobStatus(jobId);
        } else if (uploadFileID) {
            // 场景 1 & 3：有图片 ID，创建新任务
            this.createGeneration(uploadFileID, unlockToken);
        } else {
            // 场景 4：容错处理（如开发环境刷新）
            this.setData({
                status: 'failed',
                errorMessage: '参数丢失，请返回重新上传'
            });
        }
    },

    // 创建生成任务
    createGeneration: function (uploadFileID, unlockToken) {
        const that = this;

        // 调试日志
        console.log('createGeneration 调用参数:', {
            传入uploadFileID: uploadFileID,
            传入unlockToken: unlockToken,
            data中uploadFileID: this.data.uploadFileID,
            data中unlockToken: this.data.unlockToken,
            最终uploadFileID: uploadFileID || this.data.uploadFileID,
            最终unlockToken: unlockToken || this.data.unlockToken
        });

        // 启动进度模拟
        this.startProgressSimulation();

        const finalUploadFileID = uploadFileID || this.data.uploadFileID;
        const finalUnlockToken = unlockToken || this.data.unlockToken;

        if (!finalUploadFileID) {
            console.error('错误：uploadFileID 为空！');
            that.stopProgressSimulation();
            that.setData({
                status: 'failed',
                errorMessage: '图片ID丢失，请返回重新上传'
            });
            return;
        }

        app.callCloudFunction('generationCreate', {
            unlock_token: finalUnlockToken,
            uploadFileID: finalUploadFileID,
            style_id: app.globalData.defaultStyleId,
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            that.setData({
                jobId: data.job_id,
                originalAccess: data.original_access
            });

            // 开始轮询任务状态
            that.pollJobStatus(data.job_id);
        }).catch(err => {
            console.error('创建生成任务失败', err);
            that.stopProgressSimulation();
            that.setData({
                status: 'failed',
                errorMessage: err.message || '创建任务失败'
            });
        });
    },

    // 轮询任务状态
    pollJobStatus: function (jobId) {
        const that = this;
        const currentJobId = jobId || this.data.jobId;

        if (!currentJobId) {
            console.error('轮询失败：缺失 jobId');
            return;
        }

        // 使用长轮询（缩短等待时间以彻底解决 NETWORK_ERROR）
        app.callCloudFunction('generationGet', {
            job_id: currentJobId,
            wait_ms: 5000
        }).then(data => {
            that.updateStepByStatus(data.status);

            if (data.status === 'succeeded') {
                that.stopProgressSimulation();
                that.setData({
                    status: 'succeeded',
                    progress: 100,
                    currentStep: 5
                });

                // 延迟跳转到结果页
                setTimeout(() => {
                    that.goToResult(data);
                }, 1500);
            } else if (data.status === 'failed') {
                that.stopProgressSimulation();
                that.setData({
                    status: 'failed',
                    errorMessage: data.error_message || '生成失败'
                });
            } else {
                // 继续轮询
                that.pollTimer = setTimeout(() => {
                    that.pollJobStatus(currentJobId);
                }, 2000);
            }
        }).catch(err => {
            console.error('查询任务状态失败', err);
            // 继续轮询
            that.pollTimer = setTimeout(() => {
                that.pollJobStatus(currentJobId);
            }, 3000);
        });
    },

    // 根据状态更新步骤
    updateStepByStatus: function (status) {
        let step = 1;
        switch (status) {
            case 'created':
            case 'validated':
            case 'unlocked':
                step = 1;
                break;
            case 'queued':
                step = 2;
                break;
            case 'generating':
                step = 3;
                break;
            case 'safety_check':
                step = 4;
                break;
            case 'succeeded':
                step = 5;
                break;
            default:
                step = 1;
        }
        this.setData({ currentStep: step });
    },

    // 模拟进度
    startProgressSimulation: function () {
        const that = this;
        let progress = 0;

        this.progressTimer = setInterval(() => {
            if (progress < 90) {
                // 前10秒快速
                if (progress < 50) {
                    progress += Math.random() * 8 + 2;
                } else {
                    // 后面变慢
                    progress += Math.random() * 3 + 1;
                }
                progress = Math.min(progress, 90);
                that.setData({ progress: Math.floor(progress) });
            }
        }, 500);
    },

    // 停止进度模拟
    stopProgressSimulation: function () {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    },

    // 跳转到结果页
    goToResult: function (data) {
        const assets = data.assets || [];
        const viewAsset = assets.find(a => a.kind === 'view');

        wx.redirectTo({
            url: `/pages/result/result?jobId=${this.data.jobId}&assetId=${viewAsset ? viewAsset.asset_id : ''}&originalAccess=${data.original_access || this.data.originalAccess}&uploadFileID=${encodeURIComponent(this.data.uploadFileID)}`
        });
    },

    // 重试
    onRetry: function () {
        wx.navigateBack({
            delta: 2 // 返回到上传页
        });
    },

    // 返回首页
    onBackHome: function () {
        wx.switchTab({
            url: '/pages/home/home'
        });
    },

    onUnload: function () {
        this.stopProgressSimulation();
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
        }
    }
});
