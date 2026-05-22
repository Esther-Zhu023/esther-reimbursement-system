// MCP 客户端测试脚本 — 模拟 Hermes 语音助手调用报销系统

async function mcpCall(method, params = {}, id = 1) {
  const res = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return res.json();
}

async function main() {
  console.log('=== Hermes MCP Client Test ===\n');

  // 1. Initialize
  console.log('1. Initialize MCP connection...');
  const init = await mcpCall('initialize', { protocolVersion: '2024-11-05' }, 1);
  console.log('   Server:', init.result?.serverInfo?.name, init.result?.serverInfo?.version);

  // 2. List tools
  console.log('\n2. List available tools...');
  const tools = await mcpCall('tools/list', {}, 2);
  tools.result?.tools?.forEach(t => console.log(`   - ${t.name}: ${t.description}`));

  // 3. Submit reimbursement via agent
  console.log('\n3. Agent submits reimbursement...');
  const submit = await mcpCall('tools/call', {
    name: 'submit_reimbursement',
    arguments: {
      submitterId: 'user@company.com',
      submitterName: '张三',
      amount: 120,
      description: '打车去客户现场',
      category: 'transport',
    },
  }, 3);
  console.log('   Result:', JSON.parse(submit.result?.content?.[0]?.text || '{}'));

  // 4. Submit another via agent
  console.log('\n4. Agent submits another...');
  const submit2 = await mcpCall('tools/call', {
    name: 'submit_reimbursement',
    arguments: {
      submitterId: 'user@company.com',
      submitterName: '张三',
      amount: 150,
      description: '团队晚餐',
      category: 'meal',
    },
  }, 4);
  console.log('   Result:', JSON.parse(submit2.result?.content?.[0]?.text || '{}'));

  // 5. Query all
  console.log('\n5. Query all reimbursements...');
  const query = await mcpCall('tools/call', {
    name: 'query_reimbursements',
    arguments: { limit: 10 },
  }, 5);
  console.log('   Result:', JSON.parse(query.result?.content?.[0]?.text || '{}'));

  // 6. Dashboard stats
  console.log('\n6. Get dashboard stats...');
  const dash = await mcpCall('tools/call', {
    name: 'get_dashboard_stats',
    arguments: {},
  }, 6);
  console.log('   Result:', JSON.parse(dash.result?.content?.[0]?.text || '{}'));

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
