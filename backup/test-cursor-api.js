const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 配置信息
const CONFIG = {
  // 用户信息
  email: 'king1992@iftballs.com',
  userId: 'user_01JP5AK1CYK1WK6AQVJP75A93R',
  
  // 文件路径
  cookieFilePath: path.join(__dirname, 'cursor-cookies.json'),
  
  // 请求配置
  requestTimeout: 30000,
  maxRetries: 3,
  retryDelay: 2000,
  
  // API端点
  endpoints: {
    health: 'https://www.cursor.com/api/health',
    usage: 'https://www.cursor.com/api/usage',
    me: 'https://www.cursor.com/api/me',
    settings: 'https://www.cursor.com/settings'
  }
};

// 当前cookie字符串
let currentCookieStr = `muxData=mux_viewer_id=ad01817c-2cda-4dc0-98b5-763e854f3a59&msn=0.5086851475952783&sid=418adcc5-2040-49f7-9c3e-f6f5ff81327d&sst=1731505610561&sex=1731507116169; ph_phc_OrLbTmMnw0Ou1C4xuVIWJJaijIcp4J9Cm4JsAVRLtJo_posthog=%7B%22distinct_id%22%3A%2219325c6dcbe1e5f-000d85327d69be-1f525636-384000-19325c6dcbf1a5a%22%2C%22%24device_id%22%3A%2219325c6dcbe1e5f-000d85327d69be-1f525636-384000-19325c6dcbf1a5a%22%2C%22%24user_state%22%3A%22anonymous%22%2C%22%24sesid%22%3A%5B1731569586022%2C%22193299705346da-05aeaad10a62b9-1f525636-384000-193299705351036%22%2C1731569583412%5D%2C%22%24session_recording_enabled_server_side%22%3Afalse%2C%22%24autocapture_disabled_server_side%22%3Afalse%2C%22%24active_feature_flags%22%3A%5B%5D%2C%22%24enabled_feature_flags%22%3A%7B%7D%2C%22%24feature_flag_payloads%22%3A%7B%7D%7D; NEXT_LOCALE=en; WorkosCursorSessionToken=user_01JP5AK1CYK1WK6AQVJP75A93R%3A%3AeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSlA1QUsxQ1lLMVdLNkFRVkpQNzVBOTNSIiwidGltZSI6IjE3NDE3ODgxNTUiLCJyYW5kb21uZXNzIjoiMzY2NGU5OGQtNmI1MS00N2Q1IiwiZXhwIjo0MzMzNzg4MTU1LCJpc3MiOiJodHRwczovL2F1dGhlbnRpY2F0aW9uLmN1cnNvci5zaCIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhdWQiOiJodHRwczovL2N1cnNvci5jb20ifQ.5W_xVHkL9rZVzqfeDAZaMd1DOFxmE-CylZaA39tfOqg; ph_phc_TXdpocbGVeZVm5VJmAsHTMrCofBQu3e0kN8HGMNGTVW_posthog=%7B%22distinct_id%22%3A%2201958fab-2abe-7c2d-a958-12b12a499a75%22%2C%22%24sesid%22%3A%5B1741872114468%2C%2201958fab-2abc-7ec1-bd2a-7f15eaa1af4d%22%2C1741872114364%5D%7D`;

// 创建自定义 axios 实例
const cursorApi = axios.create({
  timeout: CONFIG.requestTimeout,
  httpsAgent: new https.Agent({
    rejectUnauthorized: true,
    keepAlive: true
  })
});

// 保存和加载cookie
function saveCookies(cookies) {
  try {
    fs.writeFileSync(CONFIG.cookieFilePath, JSON.stringify({
      cookies,
      timestamp: Date.now()
    }, null, 2));
    console.log('Cookie已保存到文件');
  } catch (error) {
    console.error('保存Cookie失败:', error.message);
  }
}

function loadCookies() {
  try {
    if (fs.existsSync(CONFIG.cookieFilePath)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.cookieFilePath, 'utf8'));
      const ageInHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);
      
      if (ageInHours < 24) { // 如果Cookie不超过24小时
        console.log(`使用保存的Cookie (${ageInHours.toFixed(2)}小时前保存)`);
        return data.cookies;
      } else {
        console.log(`保存的Cookie已过期 (${ageInHours.toFixed(2)}小时前保存)`);
      }
    }
  } catch (error) {
    console.error('加载Cookie失败:', error.message);
  }
  return null;
}

// 检查JWT令牌是否有效
function isTokenValid(cookieStr) {
  try {
    // 从cookie中提取JWT令牌
    const tokenRegex = /WorkosCursorSessionToken=([^;]+)/;
    const match = cookieStr.match(tokenRegex);
    if (!match || !match[1]) {
      console.error('无法从Cookie中提取WorkosCursorSessionToken');
      return false;
    }
    
    // 解码URL编码的令牌
    const decodedToken = decodeURIComponent(match[1]);
    console.log('已提取令牌:', decodedToken.substring(0, 20) + '...');
    
    // 按::分割提取JWT部分
    const parts = decodedToken.split('::');
    if (parts.length < 2) {
      console.error('令牌格式不正确，无法找到::分隔符');
      return false;
    }
    
    const userId = parts[0];
    const jwtToken = parts[1];
    
    console.log('用户ID:', userId);
    console.log('JWT令牌前20字符:', jwtToken.substring(0, 20) + '...');
    
    // 验证用户ID是否与配置匹配
    if (userId !== CONFIG.userId) {
      console.warn(`警告: 令牌中的用户ID(${userId})与配置的用户ID(${CONFIG.userId})不匹配`);
      // 不返回false，因为用户ID可能已更新
    }
    
    // 解码JWT的payload部分(不验证签名)
    const jwtParts = jwtToken.split('.');
    if (jwtParts.length < 2) {
      console.error('JWT格式不正确');
      return false;
    }
    
    const base64Payload = jwtParts[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
    
    console.log('JWT payload:', JSON.stringify(payload, null, 2));
    
    // 检查过期时间
    if (payload.exp && payload.exp * 1000 > Date.now()) {
      console.log(`令牌有效，过期时间: ${new Date(payload.exp * 1000).toLocaleString()}`);
      return true;
    } else {
      console.log('令牌已过期或无效');
      if (payload.exp) {
        console.log(`过期时间: ${new Date(payload.exp * 1000).toLocaleString()}`);
        console.log(`当前时间: ${new Date().toLocaleString()}`);
      }
      return false;
    }
  } catch (error) {
    console.error('令牌验证失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    return false;
  }
}

// 带重试功能的API请求
async function apiRequestWithRetry(url, options, retries = CONFIG.maxRetries) {
  try {
    return await cursorApi(url, options);
  } catch (error) {
    if (retries > 0) {
      console.log(`请求失败，${CONFIG.retryDelay/1000}秒后重试 (剩余重试次数: ${retries-1})...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
      return apiRequestWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// 测试基本连接
async function testHealthEndpoint() {
  try {
    console.log('测试基本连接...');
    const response = await apiRequestWithRetry(CONFIG.endpoints.health, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    console.log('基本连接成功，状态码:', response.status);
    return true;
  } catch(error) {
    console.error('基本连接测试失败:', error.message);
    return false;
  }
}

// 验证用户信息
async function verifyUserInfo() {
  try {
    console.log('验证用户信息...');
    const response = await apiRequestWithRetry(CONFIG.endpoints.me, {
      method: 'GET',
      headers: {
        'Cookie': currentCookieStr,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.cursor.com/settings'
      }
    });
    
    if (response.data && response.data.email === CONFIG.email) {
      console.log('用户验证成功:', response.data.email);
      return true;
    } else {
      console.log('用户信息不匹配:', response.data?.email || '未知');
      return false;
    }
  } catch (error) {
    console.error('用户验证失败:', error.message);
    return false;
  }
}

// 获取使用量数据
async function fetchUsageData() {
  try {
    console.log('获取使用量数据...');
    const response = await apiRequestWithRetry(`${CONFIG.endpoints.usage}?user=${CONFIG.userId}`, {
      method: 'GET',
      headers: {
        'Cookie': currentCookieStr,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.cursor.com/settings',
        'Origin': 'https://www.cursor.com'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('获取使用量数据失败:', error.message);
    
    if (error.response) {
      console.error('错误状态码:', error.response.status);
      console.error('错误响应:', error.response.data);
    }
    
    return null;
  }
}

// 分析使用量数据
function analyzeUsageData(data) {
  if (!data) {
    console.log('没有可用的使用量数据');
    return;
  }
  
  console.log('\n========== Cursor 使用量报告 ==========');
  
  // 账户信息
  if (data.accountType) {
    console.log(`\n账户类型: ${data.accountType}`);
  }
  
  if (data.daysRemaining !== undefined) {
    console.log(`试用剩余天数: ${data.daysRemaining}`);
    
    // 添加到期日期计算
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + data.daysRemaining);
    console.log(`预计到期日期: ${expiryDate.toLocaleDateString()}`);
  }
  
  // 模型使用情况
  if (data.models) {
    console.log('\n模型使用情况:');
    console.log('----------------------------------------');
    
    Object.keys(data.models).forEach(modelKey => {
      const model = data.models[modelKey];
      const used = model.used || 0;
      const limit = model.limit || '无限制';
      const percentage = model.used && model.limit ? ((model.used / model.limit) * 100).toFixed(2) + '%' : 'N/A';
      
      console.log(`\n模型: ${modelKey}`);
      console.log(`  已使用: ${used}`);
      console.log(`  限额: ${limit}`);
      console.log(`  使用率: ${percentage}`);
      
      // 模型类型判断
      if (model.limit) {
        console.log('  类型: Premium models (快速请求)');
        
        // 添加剩余请求数和使用建议
        const remaining = model.limit - model.used;
        console.log(`  剩余请求数: ${remaining}`);
        
        if (percentage && parseFloat(percentage) > 80) {
          console.log('  ⚠️ 警告: 快速请求配额即将用完，请谨慎使用');
        }
      } else {
        console.log('  类型: gpt-4o-mini/cursor-small (无限额请求)');
      }
    });
  }
  
  // 使用趋势分析 (如果有历史数据)
  if (data.history && data.history.length > 0) {
    console.log('\n使用趋势:');
    console.log('----------------------------------------');
    
    // 这里可以添加历史数据分析逻辑
    const latestUsage = data.history[data.history.length - 1];
    console.log(`最近记录: ${new Date(latestUsage.timestamp).toLocaleString()}`);
    console.log(`请求数量: ${latestUsage.count || 0}`);
  }
  
  console.log('\n========================================');
}

// 主测试函数
async function testCursorApi() {
  console.log('开始测试Cursor API...');
  console.log('----------------------------------------');
  
  // 尝试加载保存的cookie
  const savedCookies = loadCookies();
  if (savedCookies) {
    currentCookieStr = savedCookies;
  }
  
  // 验证令牌有效性
  if (!isTokenValid(currentCookieStr)) {
    console.log('⚠️ 警告: 当前Cookie中的令牌无效或已过期');
    console.log('请更新Cookie字符串后重试');
    return;
  }
  
  // 测试基本连接
  const healthCheck = await testHealthEndpoint();
  if (!healthCheck) {
    console.log('基本连接测试失败，请检查网络连接');
    return;
  }
  
  // 验证用户信息
  const userVerified = await verifyUserInfo();
  if (!userVerified) {
    console.log('用户验证失败，请检查Cookie和用户ID是否匹配');
    return;
  }
  
  // 获取使用量数据
  const usageData = await fetchUsageData();
  if (usageData) {
    // 保存有效的cookie
    saveCookies(currentCookieStr);
    
    // 分析使用量数据
    analyzeUsageData(usageData);
  } else {
    console.log('无法获取使用量数据，请检查Cookie和用户ID');
    
    // 尝试备用方法
    try {
      console.log('\n尝试备用方法获取数据...');
      const settingsResponse = await apiRequestWithRetry(CONFIG.endpoints.settings, {
        method: 'GET',
        headers: {
          'Cookie': currentCookieStr,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*'
        }
      });
      
      console.log('成功访问settings页面，状态码:', settingsResponse.status);
      
      // 检查页面内容是否包含使用量信息
      const hasUsageInfo = settingsResponse.data.includes('Premium models');
      console.log('页面是否包含使用量信息:', hasUsageInfo ? '是' : '否');
      
      if (hasUsageInfo) {
        console.log('建议: 可以手动从页面提取使用量信息');
      }
    } catch (error) {
      console.error('备用方法也失败:', error.message);
    }
  }
}

// 运行测试
testCursorApi(); 