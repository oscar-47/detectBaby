# 微信小程序「B超生成新生儿照」API（V1，CloudBase 云函数契约）

本文件定义 V1 的云函数接口与数据结构（作为“可扩基座”）。后续如迁移到自建后端，可 1:1 映射为 REST `/v1/*`。

计费：¥9.9/次（生成付费与原图解锁付费同价）  
风格：写实 `style_id=realistic_v1`  

---

## 1. 通用约定

### 1.1 鉴权与身份
- 云函数内使用 `wxContext.OPENID` 作为用户主键（不信任客户端传 openid）。
- 若需要 session/token，可在 V2 引入；V1 可直接使用 CloudBase 登录态。

### 1.2 返回结构
- 成功：`{ ok: true, data: <T> }`
- 失败：`{ ok: false, error: { code: string, message: string, details?: any } }`

### 1.3 幂等
- 所有写入/扣减型接口必须支持 `idempotency_key`。
- 推荐：以 `openid + idempotency_key + function_name` 生成唯一键；重放返回首次结果。

### 1.4 时间与金额
- 时间戳：Unix seconds（`number`）
- 金额：分（`amount_fen`），¥9.9 即 `990`

---

## 2. 核心对象

### 2.1 Upload
```json
{
  "uploadFileID": "string",
  "sha256": "string",
  "purpose": "ultrasound|parent_face",
  "created_at": 1700000000
}
```

### 2.2 UltrasoundValidation
```json
{
  "uploadFileID": "string",
  "verdict": "pass|fail",
  "reason_codes": ["NOT_ULTRASOUND"],
  "scores": { "ultrasound": 0.0, "clarity": 0.0 },
  "pii": { "detected": true, "types": ["HOSPITAL", "NAME", "BARCODE"] },
  "created_at": 1700000000
}
```

reason_codes（V1）：
- `NOT_ULTRASOUND`
- `PII_DETECTED`
- `LOW_CLARITY`
- `FILE_INVALID`

### 2.3 UnlockSession
```json
{
  "unlock_id": "string",
  "openid": "string",
  "action": "GEN|UNLOCK_ORIGINAL",
  "context": { "uploadFileID": "string", "job_id": "string" },
  "method": "ad|pay",
  "sku": "gen_with_original_1|unlock_original_1",
  "status": "prepared|authorized|consumed|expired",
  "authorized_at": 1700000000,
  "expires_at": 1700000000,
  "created_at": 1700000000
}
```

### 2.4 GenerationJob
```json
{
  "job_id": "string",
  "uploadFileID": "string",
  "style_id": "realistic_v1",
  "provider_id": "string",
  "status": "created|validated|unlocked|queued|generating|safety_check|succeeded|failed|canceled",
  "progress": 0,
  "original_access": "locked|unlocked|included",
  "error_code": "string",
  "error_message": "string",
  "cost": { "amount_fen": 0, "currency": "CNY" },
  "created_at": 1700000000,
  "finished_at": 1700000000
}
```

### 2.5 Asset
```json
{
  "asset_id": "string",
  "job_id": "string",
  "kind": "view|original",
  "fileID": "string",
  "mime": "image/jpeg",
  "width": 1024,
  "height": 1024,
  "created_at": 1700000000
}
```

### 2.6 Order / Payment
SKU（同价）：
- `gen_with_original_1`：¥9.9（生成 1 张 + 原图权限 included）
- `unlock_original_1`：¥9.9（解锁某 job 原图下载）

```json
{
  "order_id": "string",
  "sku": "gen_with_original_1",
  "qty": 1,
  "amount_fen": 990,
  "status": "created|paying|paid|closed|refunded",
  "unlock_id": "string",
  "created_at": 1700000000
}
```

```json
{
  "payment_id": "string",
  "order_id": "string",
  "provider": "wechatpay",
  "wx_txn_id": "string",
  "status": "success|failed",
  "paid_at": 1700000000
}
```

---

## 3. 云函数接口

### 3.1 `validateUltrasound`
用途：B 超强门禁校验（fail 必须重传，禁止进入解锁/支付/生成）

req
```json
{ "uploadFileID": "string", "sha256": "string", "idempotency_key": "string" }
```
resp（ok）
```json
{
  "verdict": "pass|fail",
  "reason_codes": ["PII_DETECTED"],
  "scores": { "ultrasound": 0.0, "clarity": 0.0 },
  "pii": { "detected": true, "types": ["HOSPITAL"] }
}
```
error codes（示例）：`FILE_NOT_FOUND`、`FILE_INVALID`

### 3.2 `unlockPrepare`
用途：生成/原图下载的“广告或付费二选一”统一会话（一次性、TTL、强绑定上下文）

req
```json
{
  "action": "GEN|UNLOCK_ORIGINAL",
  "context": { "uploadFileID": "string", "job_id": "string" },
  "idempotency_key": "string"
}
```
resp
```json
{ "unlock_id": "string", "methods": ["ad", "pay"], "expires_at": 1700000000 }
```
约束：
- `action=GEN`：必须提供 `context.uploadFileID`（且该 upload 已校验 `pass`）
- `action=UNLOCK_ORIGINAL`：必须提供 `context.job_id`

error codes：`VALIDATION_REQUIRED`、`JOB_NOT_FOUND`

### 3.3 `unlockClaimAd`
用途：前端激励广告播放完成后，将 unlock 会话置为可消费（授权）

req
```json
{
  "unlock_id": "string",
  "client_event_id": "string",
  "device_fp": "string",
  "idempotency_key": "string"
}
```
resp
```json
{ "granted": true, "unlock_token": "string", "expires_at": 1700000000 }
```
约束：
- `unlock_id` 只能授权成功一次
- 必须未过期且与 openid/context 匹配

error codes：`UNLOCK_EXPIRED`、`UNLOCK_ALREADY_CONSUMED`、`RISK_REJECTED`

### 3.4 `orderCreate`
用途：创建支付订单（¥9.9）

req
```json
{
  "sku": "gen_with_original_1|unlock_original_1",
  "qty": 1,
  "unlock_id": "string",
  "idempotency_key": "string"
}
```
resp
```json
{ "order_id": "string", "amount_fen": 990, "status": "created" }
```
error codes：`UNLOCK_EXPIRED`、`SKU_INVALID`

### 3.5 `wxPrepay`
用途：生成小程序 `wx.requestPayment` 所需参数

req
```json
{ "order_id": "string", "idempotency_key": "string" }
```
resp
```json
{
  "pay_params": {
    "timeStamp": "string",
    "nonceStr": "string",
    "package": "string",
    "signType": "RSA",
    "paySign": "string"
  }
}
```
error codes：`ORDER_NOT_FOUND`、`ORDER_STATUS_INVALID`

### 3.6 `wxPayNotify`
用途：微信支付回调（验签、幂等入账）
- 幂等键：`wx_txn_id`（平台交易号）或 `order_id`
- 入账后将订单置 `paid`，写入 payment 记录

### 3.7 `unlockClaimPay`
用途：支付成功后，将 unlock 会话置为可消费（授权，与 `orderCreate` 绑定）

req
```json
{ "unlock_id": "string", "order_id": "string", "idempotency_key": "string" }
```
resp
```json
{ "granted": true, "unlock_token": "string", "expires_at": 1700000000 }
```
error codes：`ORDER_NOT_PAID`、`UNLOCK_EXPIRED`、`UNLOCK_ALREADY_CONSUMED`

### 3.8 `generationCreate`
用途：消费一个已授权的 `GEN` unlock_token，创建生成任务并将会话置为 consumed

req
```json
{
  "unlock_token": "string",
  "uploadFileID": "string",
  "style_id": "realistic_v1",
  "idempotency_key": "string"
}
```
resp
```json
{ "job_id": "string", "status": "queued|generating", "original_access": "locked|included" }
```
规则：
- 仅允许校验 `pass` 的上传进入生成
- unlock 会话的 `method=ad`：`original_access=locked`
- unlock 会话的 `method=pay` 且 `sku=gen_with_original_1`：`original_access=included`

error codes：`VALIDATION_REQUIRED`、`UNLOCK_EXPIRED`、`RISK_REJECTED`

### 3.9 `generationGet`
用途：查询任务状态（支持长轮询）

req
```json
{ "job_id": "string", "wait_ms": 18000 }
```
resp
```json
{
  "status": "queued|generating|succeeded|failed",
  "progress": 0,
  "assets": [{ "asset_id": "string", "kind": "view" }],
  "original_access": "locked|unlocked|included",
  "error_code": "string",
  "error_message": "string"
}
```
error codes：`JOB_NOT_FOUND`

### 3.10 `assetGet`
用途：获取 `view` 图临时链接（用于展示与保存相册）

req
```json
{ "asset_id": "string" }
```
resp
```json
{ "temp_url": "string", "expires_at": 1700000000 }
```

### 3.11 `originalDownload`
用途：获取 `original` 原图临时链接（需权限）。若原图锁定，需消费 `UNLOCK_ORIGINAL` 的 unlock_token 解锁一次。

req
```json
{ "job_id": "string", "unlock_token": "string", "idempotency_key": "string" }
```
resp
```json
{ "temp_url": "string", "expires_at": 1700000000 }
```
规则：
- `original_access=included`：直接返回
- `original_access=unlocked`：直接返回
- `original_access=locked`：必须提供并消费 `UNLOCK_ORIGINAL` 的 unlock_token（广告或付费），消费后将其置为 `unlocked`

error codes：`ORIGINAL_LOCKED`、`UNLOCK_EXPIRED`、`UNLOCK_ALREADY_CONSUMED`

### 3.12 `galleryHome`
用途：首页参考图（自营维护）

req
```json
{ "cursor": "string" }
```
resp
```json
{ "items": [{ "id": "string", "cover_url": "string", "sort": 1, "enabled": true, "tags": ["string"] }], "next_cursor": "string" }
```

### 3.13 `userHistory` / `userDataDelete`
`userHistory`：返回 30 天内任务与 `view` 缩略信息  
`userDataDelete`：标记删除并触发异步清理（包含存储文件）

---

## 4. Collections（云数据库）与索引建议

集合：
- `uploads`（索引：`openid+created_at`，`sha256`）
- `ultrasound_validations`（索引：`openid+created_at`，主键可用 `uploadFileID`）
- `unlock_sessions`（索引：`openid+created_at`，`expires_at`）
- `generation_jobs`（索引：`openid+created_at`，`status`，`provider_id`）
- `assets`（索引：`job_id`）
- `orders`（索引：`openid+created_at`，`status`）
- `payments`（索引：`order_id`，`wx_txn_id` 唯一）
- `gallery_items`（索引：`enabled+sort`）

30 天清理：
- 定时触发器每日扫描：`created_at < now-30d` 且未删除的 uploads/jobs/assets，先标记后删除存储文件与记录。

---

## 5. Provider 插件（后端内部契约）

接口（示意）：
- `createJob(input): { jobRef }`
- `poll(jobRef): { status, progress }`
- `fetchResult(jobRef): { original_image_bytes|url, metadata }`

建议统一输入：
```json
{
  "ultrasound_url": "string",
  "style_id": "realistic_v1",
  "output": { "width": 1024, "height": 1024, "format": "jpg" },
  "template_version": "realistic_v1@2026-01-01"
}
```
