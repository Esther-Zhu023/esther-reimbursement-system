// MCP (Model Context Protocol) 服务器实现
// 为 Hermes 语音助手提供 tools: submit_reimbursement, query_reimbursements, get_reimbursement_status

const {
  submitReimbursement,
  listReimbursements,
  getReimbursement,
  getDashboardStats,
  addAuditLog,
} = require('./reimbursement');

// MCP Tools 定义
const MCP_TOOLS = [
  {
    name: 'submit_reimbursement',
    description: '提交一张新的报销单。支持由智能体自动提交。',
    inputSchema: {
      type: 'object',
      properties: {
        submitterId: { type: 'string', description: '提交者邮箱' },
        submitterName: { type: 'string', description: '提交者名称' },
        amount: { type: 'number', description: '报销金额（人民币）' },
        description: { type: 'string', description: '报销事由描述' },
        category: { type: 'string', enum: ['general', 'transport', 'meal', 'office'], description: '报销类别' },
      },
      required: ['submitterId', 'amount', 'description'],
    },
  },
  {
    name: 'query_reimbursements',
    description: '查询报销单列表，可按状态筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: '筛选状态' },
        submitterType: { type: 'string', enum: ['human', 'agent'], description: '提交者类型筛选' },
        submitterId: { type: 'string', description: '提交者ID筛选' },
        limit: { type: 'number', description: '返回条数上限', default: 20 },
      },
    },
  },
  {
    name: 'get_reimbursement_status',
    description: '获取单张报销单的当前状态和详情。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '报销单ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_dashboard_stats',
    description: '获取报销系统仪表盘统计信息。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// MCP JSON-RPC 处理器
async function handleMcpRequest(request) {
  const { id, method, params } = request;

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: MCP_TOOLS },
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    let result;

    try {
      switch (name) {
        case 'submit_reimbursement': {
          const submitResult = await submitReimbursement({
            submitterType: 'agent',
            submitterId: args.submitterId,
            submitterName: args.submitterName || 'Hermes Agent',
            amount: args.amount,
            currency: 'CNY',
            category: args.category || 'general',
            description: args.description,
            attachments: args.attachments || [],
            metadata: { source: 'mcp', agent: 'hermes' },
          });
          await addAuditLog({
            action: 'mcp_submit',
            targetId: submitResult.data?.id || null,
            actorId: args.submitterId,
            actorName: args.submitterName || 'Hermes',
            details: { args, result: submitResult.success },
          });
          result = submitResult;
          break;
        }

        case 'query_reimbursements': {
          result = await listReimbursements({
            status: args.status,
            submitterType: args.submitterType,
            submitterId: args.submitterId,
            limit: args.limit || 20,
          });
          break;
        }

        case 'get_reimbursement_status': {
          result = await getReimbursement(args.id);
          break;
        }

        case 'get_dashboard_stats': {
          result = { success: true, data: await getDashboardStats() };
          break;
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown tool: ${name}` },
          };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: err.message },
      };
    }
  }

  // 初始化
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'esther-reimbursement-mcp', version: '1.0.0' },
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unknown method: ${method}` },
  };
}

module.exports = { handleMcpRequest, MCP_TOOLS };
