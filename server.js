const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const apiRoutes = require('./src/routes/api');
const authModule = require('./src/routes/auth');
const { handleMcpRequest } = require('./src/services/mcp');

const app = express();
const PORT = process.env.PORT || 3456;

// Session 配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'esther-reimbursement-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1天
}));

// Passport 初始化
app.use(passport.initialize());
app.use(passport.session());

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 认证路由
app.use('/auth', authModule.router);

// REST API
app.use('/api', apiRoutes);

// MCP HTTP JSON-RPC endpoint
app.post('/mcp', async (req, res) => {
  try {
    const response = await handleMcpRequest(req.body);
    res.json(response);
  } catch (err) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32000, message: err.message },
    });
  }
});

// MCP SSE endpoint
const mcpClients = new Map();
app.get('/mcp/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const clientId = Date.now().toString();
  res.write(`event: endpoint\ndata: /mcp/message?clientId=${clientId}\n\n`);
  mcpClients.set(clientId, res);
  req.on('close', () => mcpClients.delete(clientId));
});

app.post('/mcp/message', async (req, res) => {
  const clientId = req.query.clientId;
  try {
    const response = await handleMcpRequest(req.body);
    const sse = mcpClients.get(clientId);
    if (sse) sse.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    res.json(response);
  } catch (err) {
    res.status(500).json({ jsonrpc: '2.0', id: req.body?.id || null, error: { code: -32000, message: err.message } });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  if (err.message === '仅支持 PDF 发票文件') {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`Esther Reimbursement System running on http://localhost:${PORT}`);
  console.log(`Auth:`);
  console.log(`  GET  /auth/google          - Google 登录`);
  console.log(`  GET  /auth/google/callback - Google 回调`);
  console.log(`  GET  /auth/me              - 当前用户`);
  console.log(`  GET  /auth/logout          - 退出登录`);
  console.log(`  POST /auth/mock-login      - Mock 登录（开发测试）`);
  console.log(`API docs:`);
  console.log(`  POST /api/reimbursements          - 人工提交（需上传PDF发票）`);
  console.log(`  POST /api/reimbursements/agent    - 智能体提交`);
  console.log(`  GET  /api/reimbursements          - 查询列表`);
  console.log(`  POST /api/reimbursements/:id/approve - 审批通过`);
  console.log(`  POST /api/reimbursements/:id/reject  - 审批拒绝`);
  console.log(`  GET  /api/dashboard               - 仪表盘`);
  console.log(`  POST /mcp                         - MCP JSON-RPC`);
});
