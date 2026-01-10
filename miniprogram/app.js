// app.js
App({
  globalData: {
    userInfo: null,
    openid: null,
    // 价格配置
    price: {
      gen_with_original_1: 990, // ¥9.9 生成+原图
      unlock_original_1: 990   // ¥9.9 解锁原图
    },
    // 风格配置
    defaultStyleId: 'realistic_v1',
    // 留存天数
    retentionDays: 30
  },

  onLaunch: function () {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id', // 请替换为你的云开发环境ID
        traceUser: true,
      });
    }

    // 获取用户openid
    this.getOpenid();
  },

  // 获取用户openid
  getOpenid: function () {
    const that = this;
    // 调用云函数获取openid
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('[云函数] [login] 调用成功', res.result);
        that.globalData.openid = res.result.openid;
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err);
      }
    });
  },

  // 显示加载提示
  showLoading: function (title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    });
  },

  // 隐藏加载提示
  hideLoading: function () {
    wx.hideLoading();
  },

  // 显示Toast提示
  showToast: function (title, icon = 'none') {
    wx.showToast({
      title: title,
      icon: icon,
      duration: 2000
    });
  },

  // 生成幂等键
  generateIdempotencyKey: function () {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // 格式化时间戳
  formatTime: function (timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 格式化金额（分转元）
  formatAmount: function (amountFen) {
    return (amountFen / 100).toFixed(2);
  },

  // 云函数调用封装
  callCloudFunction: function (name, data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: name,
        data: data,
        success: res => {
          if (res.result && res.result.ok) {
            resolve(res.result.data);
          } else {
            reject(res.result ? res.result.error : { code: 'UNKNOWN', message: '未知错误' });
          }
        },
        fail: err => {
          reject({ code: 'NETWORK_ERROR', message: '网络请求失败' });
        }
      });
    });
  }
});
