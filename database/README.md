# 数据库初始化脚本说明

在云开发控制台执行以下操作来初始化数据库。

## 创建集合

需要创建以下8个集合：

1. **uploads** - 上传记录
2. **ultrasound_validations** - B超校验记录
3. **unlock_sessions** - 解锁会话
4. **generation_jobs** - 生成任务
5. **assets** - 资产（生成的图片）
6. **orders** - 订单
7. **payments** - 支付记录
8. **gallery_items** - 首页参考图库

## 索引配置

### uploads
```
{ openid: 1, created_at: -1 }
{ sha256: 1 }
```

### ultrasound_validations
```
{ openid: 1, created_at: -1 }
{ uploadFileID: 1, openid: 1 }
```

### unlock_sessions
```
{ openid: 1, created_at: -1 }
{ unlock_id: 1, openid: 1 }
{ unlock_token: 1, openid: 1 }
{ expires_at: 1 }
```

### generation_jobs
```
{ openid: 1, created_at: -1 }
{ job_id: 1 }
{ status: 1 }
```

### assets
```
{ job_id: 1 }
{ asset_id: 1 }
```

### orders
```
{ openid: 1, created_at: -1 }
{ order_id: 1 }
{ unlock_id: 1, openid: 1 }
```

### payments
```
{ order_id: 1 }
{ wx_txn_id: 1 } (唯一索引)
```

### gallery_items
```
{ enabled: 1, sort: 1 }
```

## 添加示例参考图

在 gallery_items 集合中添加示例数据：

```json
{
  "cover_url": "https://example.com/sample1.jpg",
  "sort": 1,
  "enabled": true,
  "tags": ["写实", "可爱"],
  "created_at": 1704067200
}
```

## 数据权限设置

所有集合的安全规则建议设置为：

```json
{
  "read": "auth.openid == doc.openid || doc.enabled == true",
  "write": "auth.openid == doc.openid"
}
```

gallery_items 特殊设置（只读）：
```json
{
  "read": true,
  "write": false
}
```
