import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { CursorApiClient } from './api';
import { UsageWebviewProvider } from './webview';
import { ConfigManager } from './config';

let statusBarManager: StatusBarManager;
let cursorApiClient: CursorApiClient;
let usageWebviewProvider: UsageWebviewProvider;
let configManager: ConfigManager;
let checkUsageInterval: NodeJS.Timer | undefined;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Cursor用量监控扩展已激活');
  
  // 创建输出通道
  outputChannel = vscode.window.createOutputChannel('Cursor用量监控');
  context.subscriptions.push(outputChannel);
  
  log('扩展激活');

  // 初始化各个模块
  configManager = new ConfigManager();
  cursorApiClient = new CursorApiClient(configManager);
  statusBarManager = new StatusBarManager(context);
  usageWebviewProvider = new UsageWebviewProvider(context.extensionUri, cursorApiClient);

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('cursor-usage-monitor.checkUsage', async () => {
      log('执行命令: cursor-usage-monitor.checkUsage');
      await checkUsage();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursor-usage-monitor.showUsage', () => {
      log('执行命令: cursor-usage-monitor.showUsage');
      usageWebviewProvider.show();
    })
  );

  // 注册命令：显示日志
  context.subscriptions.push(
    vscode.commands.registerCommand('cursor-usage-monitor.showLogs', () => {
      log('执行命令: cursor-usage-monitor.showLogs');
      outputChannel.show();
    })
  );

  // 初始化状态栏
  statusBarManager.initialize();
  log('状态栏已初始化');

  // 首次检查用量
  log('开始首次检查用量');
  await checkUsage();

  // 设置定期检查
  setupIntervalCheck(context);
  log(`已设置定期检查，间隔: ${configManager.getCheckInterval()}秒`);

  // 监听配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('cursor-usage-monitor')) {
        log('配置已更改，重新加载配置');
        configManager.reloadConfig();
        setupIntervalCheck(context);
      }
    })
  );
  
  // 注册WebView消息处理
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer('cursorUsage', {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: any) {
        log('恢复WebView面板');
        usageWebviewProvider.revive(webviewPanel);
      }
    })
  );
}

async function checkUsage() {
  log('开始检查Cursor用量');
  
  try {
    // 检查配置是否完整
    if (!configManager.isConfigComplete()) {
      log('配置不完整，提示用户设置Cookie和用户ID');
      const action = await vscode.window.showInformationMessage(
        '请先设置Cursor的Cookie和用户ID',
        '设置',
        '查看帮助'
      );
      
      if (action === '设置') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'cursor-usage-monitor');
      } else if (action === '查看帮助') {
        // 显示帮助信息
        vscode.window.showInformationMessage(
          '如何获取Cookie和用户ID：\n' +
          '1. 在浏览器中登录Cursor网站(https://www.cursor.com/settings)\n' +
          '2. 打开开发者工具(F12)，切换到"网络"标签\n' +
          '3. 刷新页面，找到任意请求\n' +
          '4. 在请求头中找到"Cookie"字段，复制完整内容\n' +
          '5. 用户ID可以从Cookie中的WorkosCursorSessionToken部分提取，格式为user_XXXXXXXX'
        );
      }
      return;
    }

    // 显示加载状态
    log('显示加载状态');
    statusBarManager.setLoading(true);
    
    // 获取用量数据
    log('开始获取用量数据');
    const usageData = await cursorApiClient.fetchUsageData();
    
    log(`获取用量数据成功: Premium ${usageData.premiumUsage.used}/${usageData.premiumUsage.total}, Unlimited ${usageData.unlimitedUsage.used}/${usageData.unlimitedUsage.total}`);
    
    // 更新状态栏
    log('更新状态栏');
    statusBarManager.updateUsage(usageData);
    
    // 更新详情视图
    log('更新详情视图');
    usageWebviewProvider.updateUsageData(usageData);
    
    vscode.window.showInformationMessage('Cursor用量数据已更新');
    log('Cursor用量数据已更新');
  } catch (error) {
    const errorMessage = `获取Cursor用量失败: ${error instanceof Error ? error.message : String(error)}`;
    log(`错误: ${errorMessage}`);
    
    vscode.window.showErrorMessage(errorMessage, '查看日志', '重试').then(selection => {
      if (selection === '查看日志') {
        outputChannel.show();
      } else if (selection === '重试') {
        checkUsage();
      }
    });
    
    statusBarManager.setError();
  } finally {
    statusBarManager.setLoading(false);
    log('检查Cursor用量完成');
  }
}

function setupIntervalCheck(context: vscode.ExtensionContext) {
  // 清除现有的定时器
  if (checkUsageInterval) {
    log('清除现有的定时器');
    clearInterval(checkUsageInterval);
  }

  // 获取检查间隔（秒）
  const intervalInSeconds = configManager.getCheckInterval();
  log(`设置新的定时器，间隔: ${intervalInSeconds}秒`);
  
  // 设置新的定时器
  checkUsageInterval = setInterval(async () => {
    log('定时器触发，开始检查用量');
    await checkUsage();
  }, intervalInSeconds * 1000);

  // 确保扩展停用时清除定时器
  context.subscriptions.push({
    dispose: () => {
      if (checkUsageInterval) {
        log('扩展停用，清除定时器');
        clearInterval(checkUsageInterval);
      }
    }
  });
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
}

export function deactivate() {
  if (checkUsageInterval) {
    clearInterval(checkUsageInterval);
  }
  log('Cursor用量监控扩展已停用');
  console.log('Cursor用量监控扩展已停用');
} 