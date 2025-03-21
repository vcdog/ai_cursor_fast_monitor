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
  global.cursorStatusBarItem = statusBarItem;
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
  if (!global.cursorStatusBarItem) {
    return;
  }
  
  // 获取GPT-4数据
  const gpt4 = usageData['gpt-4'] || {};
  const gpt4Used = gpt4.numRequests || 0;
  const gpt4Total = gpt4.maxRequestUsage || 150;
  const gpt4Tokens = gpt4.numTokens || 0;
  const gpt4Percentage = gpt4Total > 0 ? Math.min((gpt4Used / gpt4Total) * 100, 100) : 0;
  
  // 获取GPT-3.5-turbo数据
  const gpt35 = usageData['gpt-3.5-turbo'] || {};
  const gpt35Used = gpt35.numRequests || 0;
  const gpt35Total = gpt35.numRequestsTotal || gpt35Used;
  const gpt35Tokens = gpt35.numTokens || 0;
  const isUnlimited = gpt35.maxRequestUsage === null;
  const gpt35Percentage = isUnlimited ? 1 : (gpt35Total > 0 ? Math.min((gpt35Used / gpt35Total) * 100, 100) : 0);
  
  // 根据GPT-4使用百分比确定状态栏颜色
  let statusColor = '';
  if (gpt4Percentage > 85) {
    statusColor = new vscode.ThemeColor('errorForeground'); // 红色
  } else if (gpt4Percentage > 50) {
    statusColor = new vscode.ThemeColor('editorWarning.foreground'); // 黄色/橙色
  } else {
    statusColor = new vscode.ThemeColor('terminal.ansiGreen'); // 绿色
  }
  
  // 更新状态栏文本
  global.cursorStatusBarItem.text = `$(pulse) Cursor: ${gpt4Used}/${gpt4Total} | ${gpt35Used}`;
  global.cursorStatusBarItem.color = statusColor;
  
  // 对无限模式的GPT-3.5使用精确的百分比
  const gpt35DisplayPercentage = isUnlimited ? '0.01' : gpt35Percentage.toFixed(2);
  global.cursorStatusBarItem.tooltip = `Cursor API 使用情况\nGPT-4: ${gpt4Used}/${gpt4Total} (${gpt4Percentage.toFixed(2)}%)\nGPT-3.5 Turbo: ${gpt35Used}${isUnlimited ? ' ('+gpt35DisplayPercentage+'%)' : ''}\n点击查看详情`;
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
    
    // 添加消息处理
    panel.webview.onDidReceiveMessage(
      async message => {
        if (message.command === 'refresh') {
          try {
            const newUsageData = await checkUsage();
            const newAccountInfo = await fetchAccountType();
            if (newUsageData) {
              panel.webview.html = getWebviewContent(newUsageData, newAccountInfo);
              vscode.window.showInformationMessage('Cursor用量数据已更新');
            } else {
              vscode.window.showErrorMessage('更新数据失败');
            }
          } catch (error) {
            console.error('刷新数据时出错:', error);
            vscode.window.showErrorMessage('刷新数据失败: ' + error.message);
          }
        }
      },
      undefined,
      []
    );

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
  const gpt35Percentage = isUnlimited ? 1 : (gpt35Total > 0 ? Math.min((gpt35Used / gpt35Total) * 100, 100) : 0);
  
  // 获取GPT-4-32k数据
  const gpt432k = usageData['gpt-4-32k'] || {};
  const gpt432kUsed = gpt432k.numRequests || 0;
  const gpt432kTotal = gpt432k.maxRequestUsage || 50;
  const gpt432kTokens = gpt432k.numTokens || 0;
  const gpt432kPercentage = gpt432kTotal > 0 ? Math.min((gpt432kUsed / gpt432kTotal) * 100, 100) : 0;
  
  // 从开始日期计算重置日期
  const startOfMonth = usageData.startOfMonth || '';
  const resetDate = startOfMonth ? new Date(startOfMonth) : new Date();
  // 免费试用期为14天
  resetDate.setDate(resetDate.getDate() + 14);
  // 确保时区正确 (UTC+8)
  const resetDateBJ = new Date(resetDate.getTime() + 8 * 60 * 60 * 1000);
  
  const resetDateStr = resetDateBJ ? 
    resetDateBJ.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    }).replace(/\//g, '-') : '未知';
  
  // 格式化账号类型显示
  let accountTypeDisplay = '';
  let accountTypeClass = '';
  switch(accountInfo.type) {
    case 'free_trial':
      if (accountInfo.daysRemaining > 0) {
        accountTypeDisplay = '免费用户';
        remainingDaysDisplay = `【剩余 ${accountInfo.daysRemaining} 天】`;
      } else {
        accountTypeDisplay = '免费用户';
        remainingDaysDisplay = '【试用到期】';
      }
      accountTypeClass = 'free-user';
      break;
    case 'pro':
      accountTypeDisplay = '会员用户';
      accountTypeClass = 'pro-user';
      break;
    case 'team':
      accountTypeDisplay = '商业用户';
      accountTypeClass = 'team-user';
      break;
    default:
      accountTypeDisplay = '免费用户';
      remainingDaysDisplay = '【试用到期】';
      accountTypeClass = 'free-user';
  }
  
  // 为用量数据添加更精确的百分比显示
  const cards = [
    {
      title: 'Premium用量 (GPT-4)',
      titleClass: 'gpt4-title',
      used: gpt4Used,
      total: gpt4Total,
      tokens: gpt4Tokens,
      percentage: gpt4Percentage,
      colorClass: gpt4ColorClass,
      isUnlimited: false,
      percentageDisplay: gpt4Percentage.toFixed(2) + '%',
      displayAngle: gpt4Percentage
    },
    {
      title: 'Unlimited用量(GPT-3.5-Turbo)',
      titleClass: 'gpt35-title',
      used: gpt35Used,
      total: isUnlimited ? '<span class="infinite-symbol">∞</span>' : gpt35Total,
      tokens: gpt35Tokens,
      percentage: isUnlimited ? 0.01 : gpt35Percentage,
      colorClass: isUnlimited ? 'success' : 'warning',
      isUnlimited: isUnlimited,
      percentageDisplay: isUnlimited ? '0.01%' : gpt35Percentage.toFixed(2) + '%',
      displayAngle: isUnlimited ? 0.01 : gpt35Percentage
    },
    {
      title: 'GPT-4-32K用量',
      titleClass: 'gpt32k-title',
      used: gpt432kUsed,
      total: gpt432kTotal,
      tokens: gpt432kTokens,
      percentage: gpt432kPercentage,
      colorClass: gpt432kPercentage > 50 ? 'warning' : 'success',
      isUnlimited: false,
      percentageDisplay: gpt432kPercentage.toFixed(2) + '%',
      displayAngle: gpt432kUsed === 0 ? 0 : gpt432kPercentage
    }
  ];
  
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
          max-width: 960px;
          margin: 0 auto;
        }
        h1 {
          font-size: 24px;
          margin: 0;
          color: var(--vscode-editor-foreground);
        }
        .cards-container {
          display: flex;
          flex-wrap: nowrap;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 1.5rem;
        }
        .usage-container {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border-radius: 10px;
          padding: 0.8rem;
          margin-bottom: 0;
          width: calc(33.33% - 8px);
          min-width: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          aspect-ratio: 1 / 0.85;
        }
        .usage-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .usage-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 40px;
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
        .circle-progress {
          position: relative;
          width: 150px;
          height: 150px;
          margin: 0 auto;
          margin-top: 20px;
        }
        .circle-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 10px solid var(--vscode-editor-background);
          opacity: 0.2;
          box-sizing: border-box;
        }
        .circle-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 10px solid;
          border-color: transparent;
          transform-origin: center;
          z-index: 2;
          box-sizing: border-box;
        }
        .circle-fill.success {
          border-color: var(--vscode-terminal-ansiGreen);
          clip: rect(0, 75px, 150px, 0);
        }
        .circle-fill.warning {
          background: conic-gradient(#FFC107 0%, #FF9800 100%, transparent 100%);
        }
        .circle-fill.danger {
          background: conic-gradient(#F44336 0%, #E91E63 100%, transparent 100%);
        }
        .circle-fill.unlimited {
          background: conic-gradient(#4CAF50, #8BC34A, #CDDC39, #4CAF50);
          animation: rotate 3s linear infinite;
        }
        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .circle-mask {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          clip: rect(0, 150px, 150px, 75px);
          z-index: 3;
        }
        .circle-inner {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          z-index: 4;
          background: var(--vscode-editor-background);
          border-radius: 50%;
          width: calc(100% - 20px);
          height: calc(100% - 20px);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .usage-number {
          font-size: 20px;
          font-weight: bold;
        }
        .usage-total {
          font-size: 12px;
          opacity: 0.8;
          margin-top: 2px;
        }
        .percentage-display {
          font-size: 11px;
          margin-top: 2px;
          opacity: 0.7;
          color: var(--vscode-descriptionForeground);
        }
        .usage-details {
          margin-top: auto;
          font-size: 14px;
          color: var(--vscode-descriptionForeground);
        }
        .tokens-info {
          margin-top: 8px;
          font-size: 11px;
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
          justify-content: flex-end;
          flex-wrap: wrap;
          position: relative;
        }
        .dates-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        .refresh-button {
          position: relative;
          left: 0;
          margin-right: auto;
          margin-top: 0;
          background-color: #3B83F6;
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s ease;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        .refresh-button:hover {
          background-color: #2970E3;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
        }
        .refresh-button svg {
          margin-right: 6px;
          fill: currentColor;
        }
        .refresh-button-icon {
          display: inline-block;
          width: 16px;
          height: 16px;
          margin-right: 6px;
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
          color: var(--vscode-badge-foreground);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .account-type:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .account-type.free-user {
          background-color: #F5F5F5;
          color: #424242;
        }
        .account-type.pro-user {
          background-color: #E3F2FD;
          color: #1976D2;
        }
        .account-type.team-user {
          background-color: #F3E5F5;
          color: #7B1FA2;
        }
        .account-type .user-type {
          font-weight: bold;
        }
        .account-type .days-remaining {
          margin-left: 6px;
          opacity: 0.9;
        }
        .account-type.warning {
          color: #F44336;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        @media (max-width: 768px) {
          .cards-container {
            flex-wrap: wrap;
            justify-content: space-between;
          }
          .usage-container {
            width: calc(50% - 6px);
            margin-bottom: 12px;
          }
        }
        @media (max-width: 480px) {
          .usage-container {
            width: 100%;
            margin-bottom: 12px;
          }
        }
        .micro-progress {
          clip-path: none !important;
          border-radius: 0 !important;
          width: 2px !important;
          height: 6px !important;
          top: 0 !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          transform-origin: bottom !important;
        }
        .progress-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        .progress-ring__circle {
          width: 150px;
          height: 150px;
          transform: rotate(-90deg);
          transform-origin: center;
          fill: none;
          stroke-width: 10;
        }
        
        .progress-ring__circle.success {
          stroke: var(--vscode-terminal-ansiGreen);
        }
        
        .progress-ring__circle.warning {
          stroke: var(--vscode-editorWarning-foreground);
        }
        
        .progress-ring__circle.danger {
          stroke: var(--vscode-editorError-foreground);
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <h1>Cursor用量详情</h1>
        <span class="account-type ${accountTypeClass} ${isLowDaysRemaining ? 'warning' : ''}">
          <span class="user-type">${accountTypeDisplay}</span>
          ${remainingDaysDisplay ? `<span class="days-remaining">${remainingDaysDisplay}</span>` : ''}
        </span>
      </div>
      
      <div class="cards-container">
        ${cards.map(card => `
          <div class="usage-container">
            <div class="usage-title ${card.titleClass}">${card.title}</div>
            <div class="circle-progress">
              <div class="circle-bg"></div>
              ${
                card.used === 0 ? '' : 
                (card.percentage < 0.5 && card.used > 0) ? 
                `<div class="circle-fill ${card.colorClass} micro-progress"></div>` : 
                `
                <svg class="progress-ring">
                  <circle
                    class="progress-ring__circle ${card.colorClass}"
                    stroke-width="10"
                    fill="transparent"
                    r="70"
                    cx="75"
                    cy="75"
                    style="stroke-dasharray: ${2 * Math.PI * 70}; 
                             stroke-dashoffset: ${2 * Math.PI * 70 * (1 - card.percentage / 100)}"
                  />
                </svg>
                `
              }
              <div class="circle-inner">
                <div class="usage-number">${card.used}</div>
                <div class="usage-total">总量: ${card.total}</div>
                <div class="percentage-display">${card.percentageDisplay}</div>
              </div>
            </div>
            <div class="tokens-info">
              已使用Token数: ${card.tokens.toLocaleString()}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="reset-info">
        <button class="refresh-button" onclick="refreshData()">
          <span class="refresh-button-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.43-6.22L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </span>
          刷新
        </button>
        <div class="dates-info">
          <div>下次重置日期: ${resetDateStr}</div>
          <div>最后更新时间: ${new Date().toLocaleString('zh-CN')}</div>
        </div>
      </div>
      
      <script>
        function refreshData() {
          // 通知 VSCode 扩展刷新数据
          const vscode = acquireVsCodeApi();
          vscode.postMessage({
            command: 'refresh'
          });
        }
      </script>
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