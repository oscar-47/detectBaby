// pages/home/home.js
const app = getApp();

Page({
    data: {
        galleryItems: [],
        leftColumn: [],
        rightColumn: [],
        loading: true,
        hasMore: true,
        cursor: null
    },

    onLoad: function (options) {
        this.loadGallery();
    },

    onShow: function () {
        // 页面显示时刷新
    },

    onPullDownRefresh: function () {
        this.data.cursor = null;
        this.data.galleryItems = [];
        this.loadGallery().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 加载参考图库
    loadGallery: function () {
        this.setData({ loading: true });

        return app.callCloudFunction('galleryHome', {
            cursor: this.data.cursor
        }).then(data => {
            const items = data.items || [];
            const allItems = this.data.cursor ? [...this.data.galleryItems, ...items] : items;

            // 分配到两列（瀑布流）
            const leftColumn = [];
            const rightColumn = [];
            allItems.forEach((item, index) => {
                if (index % 2 === 0) {
                    leftColumn.push(item);
                } else {
                    rightColumn.push(item);
                }
            });

            this.setData({
                galleryItems: allItems,
                leftColumn: leftColumn,
                rightColumn: rightColumn,
                cursor: data.next_cursor,
                hasMore: !!data.next_cursor,
                loading: false
            });
        }).catch(err => {
            console.error('加载参考图失败', err);
            this.setData({ loading: false });
            app.showToast('加载失败，请稍后重试');
        });
    },

    // 加载更多
    loadMoreGallery: function () {
        if (this.data.loading || !this.data.hasMore) return;
        this.loadGallery();
    },

    // 开始生成
    onStartGenerate: function () {
        wx.navigateTo({
            url: '/pages/upload/upload'
        });
    },

    // 预览图片
    onPreviewImage: function (e) {
        const url = e.currentTarget.dataset.url;
        const urls = this.data.galleryItems.map(item => item.cover_url);

        wx.previewImage({
            current: url,
            urls: urls
        });
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

    // 分享
    onShareAppMessage: function () {
        return {
            title: '宝宝照AI生成 - 看看你的宝宝长什么样',
            path: '/pages/home/home',
            imageUrl: '/images/share-cover.png'
        };
    }
});
