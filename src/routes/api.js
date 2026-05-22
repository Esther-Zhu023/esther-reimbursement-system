const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const {
  submitReimbursement,
  approveReimbursement,
  rejectReimbursement,
  listReimbursements,
  getReimbursement,
  getDashboardStats,
  listAuditLogs,
} = require('../services/reimbursement');
const auditMiddleware = require('../middleware/audit');

// Multer 配置：存储上传的 PDF 发票
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PDF 发票文件'));
    }
  },
});

// 健康检查
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'esther-reimbursement', version: '1.0.0' });
});

// 仪表盘统计
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 人工提交报销（multipart/form-data，必须上传PDF发票）
router.post('/reimbursements', upload.array('invoices', 5), auditMiddleware('submit_human'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '必须上传 PDF 发票' });
    }

    const attachments = req.files.map(f => ({
      filename: f.filename,
      originalName: f.originalname,
      path: `/uploads/${f.filename}`,
      size: f.size,
      mimetype: f.mimetype,
    }));

    const result = await submitReimbursement({
      submitterType: 'human',
      submitterId: req.body.submitterId || req.headers['x-user-id'] || 'anonymous',
      submitterName: req.body.submitterName || req.headers['x-user-name'] || '匿名用户',
      amount: parseFloat(req.body.amount),
      currency: req.body.currency || 'CNY',
      category: req.body.category,
      description: req.body.description,
      attachments,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
    });
    if (!result.success) return res.status(400).json(result);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 智能体提交报销
router.post('/reimbursements/agent', auditMiddleware('submit_agent'), async (req, res) => {
  try {
    const result = await submitReimbursement({
      submitterType: 'agent',
      submitterId: req.body.agentId || req.headers['x-agent-id'] || 'hermes-agent',
      submitterName: req.body.agentName || req.headers['x-agent-name'] || 'Hermes',
      amount: req.body.amount,
      currency: req.body.currency || 'CNY',
      category: req.body.category,
      description: req.body.description,
      attachments: req.body.attachments || [],
      metadata: { ...req.body.metadata, source: 'mcp' },
    });
    if (!result.success) return res.status(400).json(result);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 查询报销单列表
router.get('/reimbursements', auditMiddleware('list'), async (req, res) => {
  try {
    const result = await listReimbursements({
      status: req.query.status,
      submitterType: req.query.submitterType,
      submitterId: req.query.submitterId,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取单条报销单
router.get('/reimbursements/:id', auditMiddleware('get'), async (req, res) => {
  try {
    const result = await getReimbursement(req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 管理员审批 - 通过
router.post('/reimbursements/:id/approve', auditMiddleware('approve'), async (req, res) => {
  try {
    const result = await approveReimbursement(
      req.params.id,
      req.body.approverId || req.headers['x-user-id'] || 'esther',
      req.body.approverName || req.headers['x-user-name'] || 'Esther',
      req.body.comment || ''
    );
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 管理员审批 - 拒绝
router.post('/reimbursements/:id/reject', auditMiddleware('reject'), async (req, res) => {
  try {
    const result = await rejectReimbursement(
      req.params.id,
      req.body.approverId || req.headers['x-user-id'] || 'esther',
      req.body.approverName || req.headers['x-user-name'] || 'Esther',
      req.body.reason || '未说明原因'
    );
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 审计日志查询
router.get('/audit-logs', auditMiddleware('audit_list'), async (req, res) => {
  try {
    const result = await listAuditLogs({
      targetId: req.query.targetId,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
