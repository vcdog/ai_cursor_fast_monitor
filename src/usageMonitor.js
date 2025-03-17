const vscode = require('vscode');
const axios = require('axios');

/**
 * 检查配置是否完整
 */
async function checkConfiguration() {
  const config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  const userId = config.get('userId');
  const cookieString = config.get('cookieString');
  
  if (!userId || !cookieString) {
    const setNowAction = '立即设置';
    const response = await vscode.window.showWarningMessage(
      '您需要配置 Cursor 的用户ID和Cookie才能使用此扩展。',
      setNowAction
    );
    
    if (response === setNowAction) {
      vscode.commands.executeCommand('workbench.action.openSettings', 'cursor-usage-monitor');
    }
    
    return false;
  }
  
  return true;
}

/**
 * 激活使用量监控功能
 * @param {vscode.ExtensionContext} context 
 */
function activateUsageMonitor(context) {
  // 注册命令
  const checkUsageCmd = vscode.commands.registerCommand('cursor-usage-monitor.checkUsage', checkUsage);
  const showUsageCmd = vscode.commands.registerCommand('cursor-usage-monitor.showUsage', showUsageDetails);
  const setConfigCmd = vscode.commands.registerCommand('cursor-usage-monitor.setDefaultConfig', setDefaultUserConfig);
  
  context.subscriptions.push(checkUsageCmd, showUsageCmd, setConfigCmd);
  
  // 设置状态栏项
  setupStatusBarItem(context);
  
  // 检查配置或提供默认值
  setDefaultUserConfig().then(configOk => {
    if (configOk) {
      checkUsage();
    }
  });
  
  // 设置定时检查
  setupIntervalCheck();
}

/**
 * 设置状态栏项
 * @param {vscode.ExtensionContext} context 
 */
function setupStatusBarItem(context) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'cursor-usage-monitor.showUsage';
  statusBarItem.text = '$(pulse) Cursor: 加载中...';
  statusBarItem.tooltip = 'Cursor API 使用情况';
  statusBarItem.show();
  
  context.subscriptions.push(statusBarItem);
  
  // 保存到全局，以便更新
  global.cursorStatusBarItem = statusItem;
}

/**
 * 设置定时检查
 */
function setupIntervalCheck() {
  const config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  const intervalInSeconds = config.get('checkInterval') || 3600;
  
  // 清除现有定时器
  if (global.checkIntervalId) {
    clearInterval(global.checkIntervalId);
  }
  
  // 设置新定时器
  global.checkIntervalId = setInterval(checkUsage, intervalInSeconds * 1000);
}

/**
 * 检查使用情况
 */
async function checkUsage() {
  try {
    const usageData = await fetchUsageData();
    updateStatusBar(usageData);
    return usageData;
  } catch (error) {
    console.error('检查Cursor使用情况失败:', error);
    updateStatusBarError();
    return null;
  }
}

/**
 * 获取使用数据
 */
async function fetchUsageData() {
  const config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  const userId = config.get('userId');
  const cookieString = config.get('cookieString');
  
  if (!userId) {
    vscode.window.showWarningMessage('未配置用户ID，请在设置中配置');
    throw new Error('未配置用户ID');
  }
  
  // 添加日志，帮助调试
  console.log(`开始获取用户 ${userId} 的使用情况数据`);
  
  try {
    // 基本 URL
    const url = `https://cursor.com/api/user/${userId}/usage`;
    
    // 构建请求头
    const headers = {};
    
    // 如果有 Cookie 则添加到请求头
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }
    
    console.log(`发送请求到: ${url}`);
    const response = await axios.get(url, { headers });
    
    console.log('成功获取使用情况数据');
    
    // 检查响应格式
    if (!response.data) {
      throw new Error('API 响应数据为空');
    }
    
    return response.data;
  } catch (error) {
    console.error('获取使用情况数据失败:', error.message);
    
    // 尝试备用 API
    try {
      console.log('尝试使用备用 API...');
      const backupUrl = `https://cursor.com/api/usage?user=${userId}`;
      
      const headers = {};
      if (cookieString) {
        headers['Cookie'] = cookieString;
      }
      
      const backupResponse = await axios.get(backupUrl, { headers });
      console.log('成功使用备用 API 获取数据');
      return backupResponse.data;
    } catch (backupError) {
      console.error('备用 API 也失败:', backupError.message);
      throw new Error(`获取数据失败: ${error.message}`);
    }
  }
}

/**
 * 更新状态栏
 */
function updateStatusBar(usageData) {
  if (!global.cursorStatusBarItem) return;
  
  try {
    // 获取GPT-4使用情况
    const gpt4Data = usageData['gpt-4'] || {};
    const used = gpt4Data.numRequests || 0;
    const total = gpt4Data.maxRequestUsage || 150;
    
    // 计算使用百分比
    const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    
    // 确定状态图标和颜色标识
    let statusIcon = '🟢';
    let statusText = '良好';
    if (percentage > 85) {
      statusIcon = '🔴';
      statusText = '危险';
    } else if (percentage > 50) {
      statusIcon = '🟡';
      statusText = '警告';
    }
    
    // 获取GPT-3.5-turbo使用情况
    const gpt35Data = usageData['gpt-3.5-turbo'] || {};
    const turboUsed = gpt35Data.numRequests || 0;
    
    // 更新状态栏
    global.cursorStatusBarItem.text = `$(pulse) Cursor: ${used}/${total} | Turbo: ${turboUsed}`;
    global.cursorStatusBarItem.tooltip = `Cursor API 使用情况\nGPT-4: ${used}/${total} | ${percentage.toFixed(1)}% ${statusIcon} ${statusText}\nGPT-3.5-Turbo: ${turboUsed}`;
  } catch (error) {
    console.error('更新状态栏失败:', error);
    updateStatusBarError();
  }
}

/**
 * 更新状态栏错误状态
 */
function updateStatusBarError() {
  if (!global.cursorStatusBarItem) return;
  
  global.cursorStatusBarItem.text = '$(error) Cursor: 错误';
  global.cursorStatusBarItem.tooltip = '获取Cursor使用情况失败';
}

/**
 * 获取用户账号类型信息
 */
async function fetchAccountType() {
  const config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  const cookieString = config.get('cookieString');
  
  try {
    const response = await axios.get('https://www.cursor.com/api/auth/stripe', {
      headers: {
        'Cookie': cookieString
      }
    });
    
    return {
      type: response.data.membershipType || 'unknown',
      daysRemaining: response.data.daysRemainingOnTrial || 0
    };
  } catch (error) {
    console.error('获取账号类型失败:', error);
    return { type: 'unknown', daysRemaining: 0 };
  }
}

/**
 * 显示使用详情
 */
async function showUsageDetails() {
  try {
    // 获取最新数据
    const usageData = await checkUsage();
    // 获取账号类型信息
    const accountInfo = await fetchAccountType();
    
    if (!usageData) {
      vscode.window.showErrorMessage('无法获取Cursor使用数据');
      return;
    }
    
    // 创建并显示Webview
    const panel = vscode.window.createWebviewPanel(
      'cursorUsage',
      'Cursor用量详情',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    
    // 设置HTML内容
    panel.webview.html = getWebviewContent(usageData, accountInfo);
  } catch (error) {
    console.error('显示使用详情失败:', error);
    vscode.window.showErrorMessage('显示Cursor使用详情失败: ' + error.message);
  }
}

/**
 * 生成Webview内容
 */
function getWebviewContent(usageData, accountInfo) {
  // 获取GPT-4数据
  const gpt4 = usageData['gpt-4'] || {};
  const gpt4Used = gpt4.numRequests || 0;
  const gpt4Total = gpt4.maxRequestUsage || 150;
  const gpt4Tokens = gpt4.numTokens || 0;
  const gpt4Percentage = gpt4Total > 0 ? Math.min((gpt4Used / gpt4Total) * 100, 100) : 0;
  
  // 确定GPT-4进度条颜色类
  let gpt4ColorClass = '';
  if (gpt4Percentage > 85) {
    gpt4ColorClass = 'danger';
  } else if (gpt4Percentage > 50) {
    gpt4ColorClass = 'warning';
  } else {
    gpt4ColorClass = 'success';
  }
  
  // 确定账户状态样式
  const isLowDaysRemaining = accountInfo.type === 'free_trial' && accountInfo.daysRemaining <= 3;
  
  // 获取GPT-3.5-turbo数据
  const gpt35 = usageData['gpt-3.5-turbo'] || {};
  const gpt35Used = gpt35.numRequests || 0;
  const gpt35Total = gpt35.numRequestsTotal || gpt35Used;
  const gpt35Tokens = gpt35.numTokens || 0;
  const isUnlimited = gpt35.maxRequestUsage === null;
  const gpt35Percentage = isUnlimited ? 0.1 : (gpt35Total > 0 ? Math.min((gpt35Used / gpt35Total) * 100, 100) : 0);
  
  // 获取GPT-4-32k数据
  const gpt432k = usageData['gpt-4-32k'] || {};
  const gpt432kUsed = gpt432k.numRequests || 0;
  const gpt432kTotal = gpt432k.maxRequestUsage || 50;
  const gpt432kTokens = gpt432k.numTokens || 0;
  const gpt432kPercentage = gpt432kTotal > 0 ? Math.min((gpt432kUsed / gpt432kTotal) * 100, 100) : 0;
  
  // 获取重置日期
  const startOfMonth = usageData.startOfMonth || '';
  const resetDate = startOfMonth ? new Date(startOfMonth) : new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  const resetDateStr = resetDate.toISOString().split('T')[0];
  
  // 格式化账号类型显示
  let accountTypeDisplay = '';
  let remainingDaysDisplay = '';
  switch(accountInfo.type) {
    case 'free_trial':
      accountTypeDisplay = '免费用户';
      remainingDaysDisplay = `【剩余 ${accountInfo.daysRemaining} 天】`;
      break;
    case 'pro':
      accountTypeDisplay = '会员用户';
      break;
    case 'team':
      accountTypeDisplay = '商业用户';
      break;
    default:
      accountTypeDisplay = '未知';
  }
  
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cursor用量详情</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          padding: 2rem;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          font-size: 24px;
          margin: 0;
          color: var(--vscode-editor-foreground);
        }
        .usage-container {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .usage-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .usage-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
        }
        .usage-title::before {
          content: "";
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }
        .gpt4-title::before {
          background-color: #4e8eda;
        }
        .gpt35-title::before {
          background-color: #4caf50;
        }
        .gpt32k-title::before {
          background-color: #9c27b0;
        }
        .progress-bar {
          height: 10px;
          background-color: var(--vscode-input-background);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 12px;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--vscode-progressBar-background) 0%, var(--vscode-statusBarItem-prominentBackground, #0078d4) 100%);
          border-radius: 10px;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .progress-fill.success {
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
        }
        .progress-fill.warning {
          background: linear-gradient(90deg, #FFC107, #FF9800);
        }
        .progress-fill.danger {
          background: linear-gradient(90deg, #F44336, #E91E63);
        }
        .progress-fill.unlimited {
          background: linear-gradient(90deg, #4CAF50, #8BC34A, #CDDC39);
          background-size: 200% 100%;
          animation: gradient-shift 3s ease infinite;
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .usage-details {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 14px;
          color: var(--vscode-descriptionForeground);
        }
        .tokens-info {
          margin-top: 8px;
          font-size: 12px;
          opacity: 0.8;
          font-style: italic;
        }
        .reset-info {
          margin-top: 2rem;
          padding-top: 1rem;
          color: var(--vscode-descriptionForeground);
          border-top: 1px solid var(--vscode-panel-border);
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .infinite-symbol {
          font-size: 1.2em;
          font-weight: bold;
          color: var(--vscode-symbolIcon-classForeground, #4caf50);
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .account-type {
          font-size: 18px;
          padding: 8px 12px;
          border-radius: 10px;
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          color: var(--vscode-badge-foreground);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .account-type:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .account-type .user-type {
          font-weight: bold;
          color: #000000;
        }
        .account-type .days-remaining {
          margin-left: 6px;
        }
        .account-type.warning {
          color: #F44336;
          animation: pulse 1.5s infinite;
        }
        .account-type.warning .user-type {
          color: #000000;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <h1>Cursor用量详情</h1>
        <span class="account-type ${isLowDaysRemaining ? 'warning' : ''}">
          <span class="user-type">${accountTypeDisplay}</span>
          ${remainingDaysDisplay ? `<span class="days-remaining">${remainingDaysDisplay}</span>` : ''}
        </span>
      </div>
      
      <div class="usage-container">
        <div class="usage-title gpt4-title">Premium模型使用量 (GPT-4)</div>
        <div class="progress-bar">
          <div class="progress-fill ${gpt4ColorClass}" style="width: ${gpt4Percentage}%"></div>
        </div>
        <div class="usage-details">
          <span>已使用: ${gpt4Used}</span>
          <span>总量: ${gpt4Total}</span>
        </div>
        <div class="tokens-info">
          已使用Token数: ${gpt4Tokens.toLocaleString()}
        </div>
      </div>
      
      <div class="usage-container">
        <div class="usage-title gpt35-title">无限额请求使用量 (GPT-3.5-Turbo)</div>
        <div class="progress-bar">
          <div class="progress-fill ${isUnlimited ? 'unlimited' : ''}" style="width: ${gpt35Percentage}%"></div>
        </div>
        <div class="usage-details">
          <span>已使用: ${gpt35Used}</span>
          <span>总量: ${isUnlimited ? '<span class="infinite-symbol">∞</span>' : gpt35Total}</span>
        </div>
        <div class="tokens-info">
          已使用Token数: ${gpt35Tokens.toLocaleString()}
        </div>
      </div>
      
      <div class="usage-container">
        <div class="usage-title gpt32k-title">GPT-4-32K使用量</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${gpt432kPercentage}%"></div>
        </div>
        <div class="usage-details">
          <span>已使用: ${gpt432kUsed}</span>
          <span>总量: ${gpt432kTotal}</span>
        </div>
        <div class="tokens-info">
          已使用Token数: ${gpt432kTokens.toLocaleString()}
        </div>
      </div>
      
      <div class="reset-info">
        <div>下次重置日期: ${resetDateStr}</div>
        <div>最后更新时间: ${new Date().toLocaleString('zh-CN')}</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * 设置默认用户配置（仅用于开发测试）
 */
async function setDefaultUserConfig() {
  const config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  const userId = config.get('userId');
  const cookieString = config.get('cookieString');
  
  // 如果用户尚未配置，提供使用默认值的选项
  if (!userId || !cookieString) {
    const useDefaultAction = '使用默认值';
    const configManuallyAction = '手动配置';
    
    const response = await vscode.window.showInformationMessage(
      '您尚未配置Cursor的用户ID和Cookie。要使用默认测试值吗？',
      useDefaultAction,
      configManuallyAction
    );
    
    if (response === useDefaultAction) {
      // 使用提供的默认值
      await config.update('userId', 'user_01JP4J5TVVNHKYT0M99SPC2G6J', vscode.ConfigurationTarget.Global);
      await config.update('cookieString', 'WorkosCursorSessionToken=user_01JP4J5TVVNHKYT0M99SPC2G6J%3A%3AeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSlA0SjVUVlZOSEtZVDBNOTlTUEMyRzZKIiwidGltZSI6IjE3NDE3NjI1NjAiLCJyYW5kb21uZXNzIjoiNmMwZTNjZGEtY2UwZC00Y2JlIiwiZXhwIjo0MzMzNzYyNTYwLCJpc3MiOiJodHRwczovL2F1dGhlbnRpY2F0aW9uLmN1cnNvci5zaCIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhdWQiOiJodHRwczovL2N1cnNvci5jb20ifQ.fjgdg1dR2_XgHhamkNZJf8xqnrx1Z8VAe6q2X7lM_gw', vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('已设置默认测试值，现在可以检查用量');
      return true;
    } else if (response === configManuallyAction) {
      vscode.commands.executeCommand('workbench.action.openSettings', 'cursor-usage-monitor');
    }
    
    return false;
  }
  
  return true;
}

module.exports = {
  activateUsageMonitor
}; 