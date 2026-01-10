// pages/validate/validate.js
const app = getApp();

Page({
    data: {
        uploadFileID: '',
        sha256: '',
        previewImage: '',
        status: 'validating', // validating, pass, fail
        currentStep: 1,
        scores: {
            ultrasound: 0,
            clarity: 0
        },
        reasonCodes: [],
        failMessage: '',
        failTips: [],
        reasonTexts: {
            'NOT_ULTRASOUND': {
                title: '非B超图片',
                desc: '系统检测到上传的图片不是B超图，请上传正确的B超检查图片'
            },
            'PII_DETECTED': {
                title: '检测到敏感信息',
                desc: '图片中包含姓名、医院名称或条形码等个人信息，请遮挡后重新上传'
            },
            'LOW_CLARITY': {
                title: '图片清晰度不足',
                desc: '图片过于模糊，可能影响生成效果，请上传更清晰的图片'
            },
            'FILE_INVALID': {
                title: '文件格式无效',
                desc: '文件损坏或格式不支持，请重新选择图片'
            }
        }
    },

    onLoad: function (options) {
        const uploadFileID = decodeURIComponent(options.uploadFileID || '');
        const sha256 = options.sha256 || '';

        this.setData({
            uploadFileID: uploadFileID,
            sha256: sha256
        });

        // 获取临时预览链接
        this.getPreviewImage(uploadFileID);

        // 开始校验
        this.startValidation();
    },

    // 获取预览图片
    getPreviewImage: function (fileID) {
        wx.cloud.getTempFileURL({
            fileList: [fileID],
            success: res => {
                if (res.fileList && res.fileList[0]) {
                    this.setData({
                        previewImage: res.fileList[0].tempFileURL
                    });
                }
            }
        });
    },

    // 开始校验流程
    startValidation: function () {
        const that = this;

        // 模拟步骤进度
        this.stepTimer = setInterval(() => {
            if (that.data.currentStep < 4) {
                that.setData({
                    currentStep: that.data.currentStep + 1
                });
            }
        }, 800);

        // 调用云函数校验
        app.callCloudFunction('validateUltrasound', {
            uploadFileID: this.data.uploadFileID,
            sha256: this.data.sha256,
            idempotency_key: app.generateIdempotencyKey()
        }).then(data => {
            clearInterval(that.stepTimer);
            that.setData({ currentStep: 4 });

            setTimeout(() => {
                if (data.verdict === 'pass') {
                    that.setData({
                        status: 'pass',
                        scores: data.scores || { ultrasound: 0.95, clarity: 0.88 }
                    });
                } else {
                    that.handleValidationFail(data);
                }
            }, 500);
        }).catch(err => {
            clearInterval(that.stepTimer);
            console.error('校验失败', err);

            that.handleValidationFail({
                verdict: 'fail',
                reason_codes: [err.code || 'FILE_INVALID']
            });
        });
    },

    // 处理校验失败
    handleValidationFail: function (data) {
        const reasonCodes = data.reason_codes || ['FILE_INVALID'];
        const tips = this.generateFailTips(reasonCodes);

        this.setData({
            status: 'fail',
            reasonCodes: reasonCodes,
            failMessage: '请根据以下原因修改后重新上传',
            failTips: tips
        });
    },

    // 生成失败提示
    generateFailTips: function (reasonCodes) {
        const tips = [];

        if (reasonCodes.includes('NOT_ULTRASOUND')) {
            tips.push('确保上传的是产前B超检查图片');
        }
        if (reasonCodes.includes('PII_DETECTED')) {
            tips.push('使用图片编辑工具遮挡或裁剪掉个人信息');
            tips.push('姓名、医院名称、日期、条形码等都需要遮挡');
        }
        if (reasonCodes.includes('LOW_CLARITY')) {
            tips.push('重新拍摄B超单，确保光线充足');
            tips.push('避免反光和阴影');
        }
        if (reasonCodes.includes('FILE_INVALID')) {
            tips.push('确保图片格式为JPG或PNG');
            tips.push('文件大小不超过10MB');
        }

        return tips;
    },

    // 继续到解锁页
    onContinue: function () {
        wx.navigateTo({
            url: `/pages/unlock/unlock?action=GEN&uploadFileID=${encodeURIComponent(this.data.uploadFileID)}`
        });
    },

    // 重新上传
    onReupload: function () {
        wx.navigateBack();
    },

    onUnload: function () {
        if (this.stepTimer) {
            clearInterval(this.stepTimer);
        }
    }
});
