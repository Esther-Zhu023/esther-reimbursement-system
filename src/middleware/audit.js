const { addAuditLog } = require('../services/reimbursement');

// 记录请求级别的审计日志
function auditMiddleware(action) {
  return async (req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = async function (body) {
      res.send = originalSend;
      const result = originalSend(body);

      try {
        // 对于审批操作，actor 是审批者；对于提交操作，actor 是提交者
        const actorId = req.body?.approverId || req.headers['x-user-id'] || req.body?.submitterId || req.body?.agentId || 'anonymous';
        const actorName = req.body?.approverName || req.headers['x-user-name'] || req.body?.submitterName || req.body?.agentName || actorId;
        const targetId = req.params?.id || req.body?.id || null;
        await addAuditLog({
          action,
          targetId,
          actorId,
          actorName,
          details: {
            method: req.method,
            path: req.path,
            body: { ...req.body, password: undefined },
            responseStatus: res.statusCode,
          },
        });
      } catch (e) {
        console.error('Audit log error:', e.message);
      }
      return result;
    };
    next();
  };
}

module.exports = auditMiddleware;
