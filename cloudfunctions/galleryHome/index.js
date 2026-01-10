// 云函数入口文件 - galleryHome
// 首页参考图列表
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 每页数量
const PAGE_SIZE = 10;

exports.main = async (event, context) => {
    const { cursor } = event;

    try {
        // 构建查询
        let query = db.collection('gallery_items')
            .where({
                enabled: true
            })
            .orderBy('sort', 'asc')
            .orderBy('created_at', 'desc')
            .limit(PAGE_SIZE + 1); // 多取一条判断是否有下一页

        // 分页处理
        if (cursor) {
            const cursorNum = parseInt(cursor, 10);
            query = query.skip(cursorNum);
        }

        const result = await query.get();
        const items = result.data;

        // 判断是否有下一页
        let hasMore = false;
        if (items.length > PAGE_SIZE) {
            hasMore = true;
            items.pop(); // 移除多取的那条
        }

        // 计算下一页游标
        const currentOffset = cursor ? parseInt(cursor, 10) : 0;
        const next_cursor = hasMore ? String(currentOffset + PAGE_SIZE) : null;

        // 格式化返回数据
        const formattedItems = items.map(item => ({
            id: item._id,
            cover_url: item.cover_url,
            sort: item.sort,
            enabled: item.enabled,
            tags: item.tags || []
        }));

        return {
            ok: true,
            data: {
                items: formattedItems,
                next_cursor: next_cursor
            }
        };

    } catch (error) {
        console.error('获取参考图失败:', error);
        return {
            ok: false,
            error: { code: 'LIST_ERROR', message: error.message || '获取参考图失败' }
        };
    }
};
