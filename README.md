# Esther 智能体报销系统

智能体时代的报销系统，支持人工手动提交与 Hermes 语音助手（通过 MCP）自动提交双入口，Esther 管理员审批。

---

## 快速开始（开箱即用）

```bash
# 1. 解压
unzip esther-reimbursement-system.zip
cd esther-reimbursement-system

# 2. 安装依赖
npm install

# 3. 启动（.env 已预配置 Google OAuth，无需额外操作）
npm start

# 4. 打开浏览器访问
open http://localhost:3456
```

---

## 登录方式

系统提供两种登录入口：

| 方式 | 说明 |
|------|------|
| **Google 登录** | 使用真实 Google 账号，邮箱自动作为 submitterId |
| **演示登录** | 无需 Google 账号，点击即进入（开发测试用） |

> 当前 Google OAuth 凭证为预配置共享凭证，开箱即用。如需接入自己的 Google 工作空间，请参阅下方"申请自己的 Google OAuth 凭证"章节。

---

## 系统功能

- 人工提交报销（Web UI，需上传 PDF 发票）
- 智能体自动提交（MCP JSON-RPC）
- 管理员审批（通过 / 拒绝）
- 历史记录查询与筛选
- 仪表盘统计
- 完整审计日志

### 约束条件

| 项目 | 限制 |
|------|------|
| 单次金额 | ≤ 150 CNY |
| 月度额度 | ≤ 3 张凭证 / 人 |
| 发票格式 | PDF（人工提交必填） |

---

## 申请自己的 Google OAuth 凭证（可选）

如果你需要将系统接入自己的 Google Workspace 或担心共享凭证的安全问题，可以按以下步骤申请专属的 OAuth 2.0 凭证：

### 步骤 1：创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击左上角项目选择器 → **新建项目**
3. 输入项目名称（如 `Esther Reimbursement`），点击**创建**

### 步骤 2：启用 Google+ API

1. 进入 **API 和服务 → 库**
2. 搜索并启用 **Google+ API**（用于获取用户邮箱和头像）

### 步骤 3：创建 OAuth 2.0 客户端 ID

1. 进入 **API 和服务 → 凭据**
2. 点击 **创建凭据 → OAuth 客户端 ID**
3. 首次使用需先配置 **同意屏幕**：
   - 用户类型选择 **外部**
   - 填写应用名称（如 `Esther Reimbursement`）
   - 用户支持邮箱填写你的邮箱
   - 添加范围：`.../auth/userinfo.profile`、`.../auth/userinfo.email`
   - 保存并继续
4. 应用类型选择 **Web 应用**
5. 配置以下内容：

   | 字段 | 值（本地开发） |
   |------|---------------|
   | **已获授权的 JavaScript 来源** | `http://localhost:3456` |
   | **已获授权的重定向 URI** | `http://localhost:3456/auth/google/callback` |

6. 点击**创建**，复制生成的 **客户端 ID** 和 **客户端密钥**

### 步骤 4：替换凭证

编辑项目根目录的 `.env` 文件，替换为你的专属凭证：

```bash
GOOGLE_CLIENT_ID=你的客户端ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的客户端密钥
```

保存后重启服务即可生效。

> **注意**：Google OAuth 凭证变更后可能需要等待 2-5 分钟才能生效。

---

## API 端点

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/dashboard` | 仪表盘统计 |
| POST | `/api/reimbursements` | 人工提交报销（multipart，需上传 PDF 发票） |
| POST | `/api/reimbursements/agent` | 智能体提交报销 |
| GET | `/api/reimbursements` | 查询报销列表 |
| GET | `/api/reimbursements/:id` | 查询单条报销 |
| POST | `/api/reimbursements/:id/approve` | 审批通过 |
| POST | `/api/reimbursements/:id/reject` | 审批拒绝 |
| GET | `/api/audit-logs` | 审计日志查询 |

### 认证路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/google` | 跳转到 Google 授权页面 |
| GET | `/auth/google/callback` | Google 授权回调 |
| GET | `/auth/me` | 获取当前登录用户信息 |
| GET | `/auth/logout` | 退出登录 |
| POST | `/auth/mock-login` | Mock 登录（开发测试） |

### MCP 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/mcp` | JSON-RPC 工具调用 |
| GET | `/mcp/sse` | SSE 流式连接 |
| POST | `/mcp/message` | SSE 消息发送 |

---

## MCP 工具（供 Hermes 语音助手调用）

- `submit_reimbursement` — 智能体提交报销
- `query_reimbursements` — 查询报销列表
- `get_reimbursement_status` — 获取单条状态
- `get_dashboard_stats` — 仪表盘统计

**示例调用：**

```bash
curl -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "submit_reimbursement",
      "arguments": {
        "submitterId": "user@company.com",
        "submitterName": "张三",
        "amount": 120,
        "description": "打车去客户现场"
      }
    }
  }'
```

---

## 技术栈

- **Runtime**: Node.js + Express
- **Storage**: 内存 KV（生产环境可替换为 Redis / DynamoDB）
- **Auth**: Passport.js + Google OAuth 2.0
- **File Upload**: Multer（PDF 发票上传）
- **Protocol**: MCP (Model Context Protocol) JSON-RPC
- **Frontend**: 原生 HTML/CSS/JS SPA

---

## 项目结构

```
esther-reimbursement-system/
├── .env                      # Google OAuth 凭证（预配置）
├── .env.example              # 环境变量模板
├── .gitignore
├── package.json
├── server.js                 # Express 主服务器
├── README.md                 # 本文档
├── mcp-client-test.js        # MCP 测试脚本
├── public/
│   └── index.html            # 前端 SPA
├── src/
│   ├── middleware/
│   │   └── audit.js          # 审计日志中间件
│   ├── models/
│   │   └── store.js          # KV 存储层
│   ├── routes/
│   │   ├── api.js            # REST API 路由
│   │   └── auth.js           # Google OAuth 认证路由
│   └── services/
│       ├── reimbursement.js  # 报销业务逻辑
│       └── mcp.js            # MCP JSON-RPC 处理器
└── uploads/                  # PDF 发票上传目录（运行时创建）
```

---

## 安全提醒

- `.env` 文件包含 Google OAuth 凭证，**请勿提交到公共代码仓库**
- 生产环境请使用随机强密码作为 `SESSION_SECRET`
- 建议将 `.env` 加入 `.gitignore`
