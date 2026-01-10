// 云函数入口文件 - validateUltrasound
// B超强门禁校验
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 校验结果原因码
const REASON_CODES = {
    NOT_ULTRASOUND: 'NOT_ULTRASOUND',
    PII_DETECTED: 'PII_DETECTED',
    LOW_CLARITY: 'LOW_CLARITY',
    FILE_INVALID: 'FILE_INVALID'
};

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { uploadFileID, sha256, idempotency_key } = event;

    try {
        // 参数校验
        if (!uploadFileID) {
            return {
                ok: false,
                error: { code: 'INVALID_PARAMS', message: '缺少uploadFileID参数' }
            };
        }

        // 幂等性检查
        const existingValidation = await db.collection('ultrasound_validations')
            .where({
                uploadFileID: uploadFileID,
                openid: openid
            })
            .limit(1)
            .get();

        if (existingValidation.data.length > 0) {
            const existing = existingValidation.data[0];
            return {
                ok: true,
                data: {
                    verdict: existing.verdict,
                    reason_codes: existing.reason_codes || [],
                    scores: existing.scores || { ultrasound: 0, clarity: 0 },
                    pii: existing.pii || { detected: false, types: [] }
                }
            };
        }

        // 获取文件临时链接进行分析
        const fileResult = await cloud.getTempFileURL({
            fileList: [uploadFileID]
        });

        if (!fileResult.fileList || fileResult.fileList.length === 0 || fileResult.fileList[0].status !== 0) {
            return {
                ok: false,
                error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
            };
        }

        // TODO: 实际项目中应调用AI服务进行B超识别
        // 这里使用模拟的校验逻辑
        const validationResult = await performValidation(uploadFileID);

        // 保存校验结果
        const validationRecord = {
            uploadFileID: uploadFileID,
            openid: openid,
            sha256: sha256,
            verdict: validationResult.verdict,
            reason_codes: validationResult.reason_codes,
            scores: validationResult.scores,
            pii: validationResult.pii,
            created_at: Math.floor(Date.now() / 1000)
        };

        await db.collection('ultrasound_validations').add({
            data: validationRecord
        });

        return {
            ok: true,
            data: {
                verdict: validationResult.verdict,
                reason_codes: validationResult.reason_codes,
                scores: validationResult.scores,
                pii: validationResult.pii
            }
        };

    } catch (error) {
        console.error('校验失败:', error);
        return {
            ok: false,
            error: { code: 'VALIDATION_ERROR', message: error.message || '校验失败' }
        };
    }
};

// 模拟B超校验逻辑
// 实际项目中应替换为真正的AI服务调用
async function performValidation(uploadFileID) {
    // 模拟分析延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 模拟校验结果 - 90%通过率用于演示
    const random = Math.random();

    if (random > 0.9) {
        // 10% 失败率
        const failReasons = [
            { reason: REASON_CODES.NOT_ULTRASOUND },
            { reason: REASON_CODES.PII_DETECTED },
            { reason: REASON_CODES.LOW_CLARITY }
        ];
        const failCase = failReasons[Math.floor(Math.random() * failReasons.length)];

        return {
            verdict: 'fail',
            reason_codes: [failCase.reason],
            scores: {
                ultrasound: failCase.reason === REASON_CODES.NOT_ULTRASOUND ? 0.3 : 0.85,
                clarity: failCase.reason === REASON_CODES.LOW_CLARITY ? 0.4 : 0.8
            },
            pii: {
                detected: failCase.reason === REASON_CODES.PII_DETECTED,
                types: failCase.reason === REASON_CODES.PII_DETECTED ? ['HOSPITAL', 'NAME'] : []
            }
        };
    }

    // 通过
    return {
        verdict: 'pass',
        reason_codes: [],
        scores: {
            ultrasound: 0.92 + Math.random() * 0.08,
            clarity: 0.85 + Math.random() * 0.15
        },
        pii: {
            detected: false,
            types: []
        }
    };
}
