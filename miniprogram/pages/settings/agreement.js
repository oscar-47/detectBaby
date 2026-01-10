// pages/settings/agreement.js
Page({
    data: {
        type: '',
        content: ''
    },

    onLoad: function (options) {
        const type = options.type || 'user';
        const title = decodeURIComponent(options.title || '协议');

        wx.setNavigationBarTitle({
            title: title
        });

        this.setData({
            type: type,
            content: this.getContent(type)
        });
    },

    getContent: function (type) {
        const contents = {
            user: `
        <h2 style="font-size: 36rpx; font-weight: bold; margin-bottom: 24rpx; color: #1a1a2e;">用户协议</h2>
        <p style="margin-bottom: 20rpx;">欢迎使用「宝宝照AI生成」小程序（以下简称"本服务"）。请您在使用前仔细阅读本协议。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">一、服务说明</h3>
        <p style="margin-bottom: 20rpx;">1. 本服务为用户提供基于AI技术的B超图像转新生儿照片的娱乐服务。</p>
        <p style="margin-bottom: 20rpx;">2. 本服务生成的图片仅供娱乐用途，不具有任何医学参考价值。</p>
        <p style="margin-bottom: 20rpx;">3. 用户需对上传的图片内容负责，确保拥有合法使用权。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">二、用户行为规范</h3>
        <p style="margin-bottom: 20rpx;">1. 用户不得上传违法、违规或侵犯他人权益的图片。</p>
        <p style="margin-bottom: 20rpx;">2. 用户不得利用本服务进行任何非法活动。</p>
        <p style="margin-bottom: 20rpx;">3. 用户应妥善保管账户信息，对账户下的所有行为负责。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">三、知识产权</h3>
        <p style="margin-bottom: 20rpx;">1. 本服务的所有技术、界面设计等知识产权归运营方所有。</p>
        <p style="margin-bottom: 20rpx;">2. 用户生成的图片仅供个人使用，不得用于商业用途。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">四、免责声明</h3>
        <p style="margin-bottom: 20rpx;">1. 本服务不保证生成结果的准确性或满意度。</p>
        <p style="margin-bottom: 20rpx;">2. 因不可抗力或第三方原因导致的服务中断，运营方不承担责任。</p>
        
        <p style="margin-top: 32rpx; color: #8e8ea9;">最后更新日期：2026年1月1日</p>
      `,
            privacy: `
        <h2 style="font-size: 36rpx; font-weight: bold; margin-bottom: 24rpx; color: #1a1a2e;">隐私政策</h2>
        <p style="margin-bottom: 20rpx;">我们非常重视您的隐私保护。本隐私政策说明我们如何收集、使用和保护您的个人信息。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">一、信息收集</h3>
        <p style="margin-bottom: 20rpx;">1. 我们收集您的微信OpenID用于识别用户身份。</p>
        <p style="margin-bottom: 20rpx;">2. 我们收集您上传的B超图片用于生成服务。</p>
        <p style="margin-bottom: 20rpx;">3. 我们收集必要的设备信息用于服务优化和安全防护。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">二、信息使用</h3>
        <p style="margin-bottom: 20rpx;">1. 我们仅将收集的信息用于提供和改进服务。</p>
        <p style="margin-bottom: 20rpx;">2. 我们不会将您的个人信息出售给第三方。</p>
        <p style="margin-bottom: 20rpx;">3. 必要时我们可能与合作伙伴共享信息以提供服务。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">三、信息存储与保护</h3>
        <p style="margin-bottom: 20rpx;">1. 您的上传图片和生成结果将保留30天后自动删除。</p>
        <p style="margin-bottom: 20rpx;">2. 您可随时通过设置页面一键删除所有数据。</p>
        <p style="margin-bottom: 20rpx;">3. 我们采用业界标准的安全措施保护您的数据。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">四、您的权利</h3>
        <p style="margin-bottom: 20rpx;">1. 您有权访问、更正或删除您的个人信息。</p>
        <p style="margin-bottom: 20rpx;">2. 您有权撤回对数据收集的同意。</p>
        <p style="margin-bottom: 20rpx;">3. 如有任何疑问，请通过客服联系我们。</p>
        
        <p style="margin-top: 32rpx; color: #8e8ea9;">最后更新日期：2026年1月1日</p>
      `,
            disclaimer: `
        <h2 style="font-size: 36rpx; font-weight: bold; margin-bottom: 24rpx; color: #1a1a2e;">免责声明</h2>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">重要提示</h3>
        <p style="margin-bottom: 20rpx; color: #ff5252; font-weight: bold;">本服务仅供娱乐用途，生成的图片不具有任何医学参考价值。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">一、服务性质</h3>
        <p style="margin-bottom: 20rpx;">1. 本服务基于AI技术，通过B超图像生成假想的新生儿照片。</p>
        <p style="margin-bottom: 20rpx;">2. 生成结果为AI创作，与实际婴儿外貌无任何关联。</p>
        <p style="margin-bottom: 20rpx;">3. 请勿将生成结果用于任何医学诊断或预测目的。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">二、责任限制</h3>
        <p style="margin-bottom: 20rpx;">1. 我们不对生成结果的准确性、完整性作任何保证。</p>
        <p style="margin-bottom: 20rpx;">2. 用户基于生成结果做出的任何决定，由用户自行承担责任。</p>
        <p style="margin-bottom: 20rpx;">3. 对于因使用本服务造成的任何直接或间接损失，我们不承担责任。</p>
        
        <h3 style="font-size: 32rpx; font-weight: bold; margin: 24rpx 0 16rpx; color: #1a1a2e;">三、用户须知</h3>
        <p style="margin-bottom: 20rpx;">1. 请确保上传的B超图片为您本人合法持有。</p>
        <p style="margin-bottom: 20rpx;">2. 建议遮挡或裁剪图片中的个人敏感信息。</p>
        <p style="margin-bottom: 20rpx;">3. 如有医学相关问题，请咨询专业医疗机构。</p>
        
        <p style="margin-top: 32rpx; color: #8e8ea9;">最后更新日期：2026年1月1日</p>
      `
        };

        return contents[type] || contents.user;
    }
});
