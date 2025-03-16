import * as vscode from 'vscode';
import { CursorApiClient, UsageData } from './api';

export class UsageWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private cursorApiClient: CursorApiClient;
  private usageData: UsageData | undefined;
  private errorMessage: string | undefined;

  constructor(extensionUri: vscode.Uri, cursorApiClient: CursorApiClient) {
    this.extensionUri = extensionUri;
    this.cursorApiClient = cursorApiClient;
  }

  /**
   * 显示WebView面板
   */
  public show(): void {
    if (this.panel) {
      // 如果面板已经存在，则显示它
      this.panel.reveal();
    } else {
      // 创建新的面板
      this.panel = vscode.window.createWebviewPanel(
        'cursorUsage',
        'Cursor用量详情',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // 当面板关闭时清除引用
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      // 处理来自WebView的消息
      this.panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case 'refresh':
            await this.refreshData();
            break;
          case 'showLogs':
            vscode.commands.executeCommand('cursor-usage-monitor.showLogs');
            break;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'cursor-usage-monitor');
            break;
        }
      });

      // 更新面板内容
      this.updateWebviewContent();
    }
  }

  /**
   * 恢复WebView面板
   */
  public revive(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    
    // 处理来自WebView的消息
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'refresh':
          await this.refreshData();
          break;
        case 'showLogs':
          vscode.commands.executeCommand('cursor-usage-monitor.showLogs');
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'cursor-usage-monitor');
          break;
      }
    });
    
    // 更新面板内容
    this.updateWebviewContent();
  }

  /**
   * 更新用量数据
   */
  public updateUsageData(usageData: UsageData): void {
    this.usageData = usageData;
    this.errorMessage = undefined;
    if (this.panel) {
      this.updateWebviewContent();
    }
  }

  /**
   * 设置错误信息
   */
  public setError(message: string): void {
    this.errorMessage = message;
    if (this.panel) {
      this.updateWebviewContent();
    }
  }

  /**
   * 刷新数据
   */
  private async refreshData(): Promise<void> {
    if (!this.panel) {
      return;
    }

    // 显示加载状态
    this.panel.webview.html = this.getLoadingHtml();
    
    try {
      // 获取用量数据
      const usageData = await this.cursorApiClient.fetchUsageData();
      
      // 更新数据
      this.usageData = usageData;
      this.errorMessage = undefined;
      
      // 更新面板内容
      this.updateWebviewContent();
      
      // 显示成功消息
      vscode.window.showInformationMessage('Cursor用量数据已更新');
    } catch (error) {
      // 设置错误信息
      this.errorMessage = error instanceof Error ? error.message : String(error);
      
      // 更新面板内容
      this.updateWebviewContent();
      
      // 显示错误消息
      vscode.window.showErrorMessage(`获取Cursor用量失败: ${this.errorMessage}`);
    }
  }

  /**
   * 更新WebView内容
   */
  private updateWebviewContent(): void {
    if (!this.panel) {
      return;
    }

    if (this.errorMessage) {
      this.panel.webview.html = this.getErrorHtml(this.errorMessage);
      return;
    }

    if (!this.usageData) {
      this.panel.webview.html = this.getLoadingHtml();
      return;
    }

    this.panel.webview.html = this.getHtml(this.usageData);
  }

  /**
   * 获取加载中的HTML
   */
  private getLoadingHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cursor用量详情</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
          }
          .loading {
            text-align: center;
            margin-top: 50px;
          }
          .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 4px solid var(--vscode-button-background);
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loading">
          <div class="spinner"></div>
          <p>正在加载Cursor用量数据...</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 获取错误HTML
   */
  private getErrorHtml(errorMessage: string): string {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cursor用量详情</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
          }
          .error-card {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 5px;
            padding: 20px;
            margin-bottom: 20px;
            color: var(--vscode-inputValidation-errorForeground);
          }
          .error-title {
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: bold;
          }
          .error-message {
            margin-bottom: 20px;
            word-break: break-word;
          }
          .button-container {
            display: flex;
            gap: 10px;
          }
          .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Cursor用量详情</h1>
          
          <div class="error-card">
            <div class="error-title">获取数据失败</div>
            <div class="error-message">${errorMessage}</div>
            <div class="button-container">
              <button class="button" id="retryButton">重试</button>
              <button class="button secondary-button" id="showLogsButton">查看日志</button>
              <button class="button secondary-button" id="settingsButton">检查设置</button>
            </div>
          </div>
          
          <div>
            <h2>可能的解决方案</h2>
            <ul>
              <li>确认您的Cookie和用户ID是否正确</li>
              <li>Cookie可能已过期，请重新获取</li>
              <li>检查网络连接</li>
              <li>Cursor网站可能发生了变化，请查看日志了解详情</li>
            </ul>
          </div>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          document.getElementById('retryButton').addEventListener('click', () => {
            vscode.postMessage({
              command: 'refresh'
            });
          });
          
          document.getElementById('showLogsButton').addEventListener('click', () => {
            vscode.postMessage({
              command: 'showLogs'
            });
          });
          
          document.getElementById('settingsButton').addEventListener('click', () => {
            vscode.postMessage({
              command: 'openSettings'
            });
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取显示用量数据的HTML
   */
  private getHtml(usageData: UsageData): string {
    const premiumPercentage = Math.round(usageData.premiumUsage.percentage);
    const unlimitedPercentage = Math.round(usageData.unlimitedUsage.percentage);

    // 根据百分比确定颜色
    const getPremiumColor = () => {
      if (premiumPercentage > 90) return '#e74c3c';
      if (premiumPercentage > 75) return '#f39c12';
      return '#2ecc71';
    };

    const getUnlimitedColor = () => {
      if (unlimitedPercentage > 90) return '#e74c3c';
      if (unlimitedPercentage > 75) return '#f39c12';
      return '#2ecc71';
    };

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cursor用量详情</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
          }
          .card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .usage-title {
            font-size: 18px;
            margin-bottom: 15px;
          }
          .progress-container {
            width: 100%;
            background-color: var(--vscode-input-background);
            border-radius: 5px;
            margin-bottom: 10px;
          }
          .progress-bar {
            height: 20px;
            border-radius: 5px;
            text-align: center;
            line-height: 20px;
            color: white;
            font-weight: bold;
          }
          .premium-bar {
            width: ${premiumPercentage}%;
            background-color: ${getPremiumColor()};
          }
          .unlimited-bar {
            width: ${unlimitedPercentage}%;
            background-color: ${getUnlimitedColor()};
          }
          .usage-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
          }
          .button-container {
            display: flex;
            gap: 10px;
          }
          .refresh-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .refresh-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Cursor用量详情</h1>
          
          <div class="card">
            <div class="usage-title">Premium模型使用量</div>
            <div class="progress-container">
              <div class="progress-bar premium-bar">${premiumPercentage}%</div>
            </div>
            <div class="usage-details">
              <span>已使用: ${usageData.premiumUsage.used}</span>
              <span>总量: ${usageData.premiumUsage.total}</span>
            </div>
          </div>
          
          <div class="card">
            <div class="usage-title">无限额请求使用量</div>
            <div class="progress-container">
              <div class="progress-bar unlimited-bar">${unlimitedPercentage}%</div>
            </div>
            <div class="usage-details">
              <span>已使用: ${usageData.unlimitedUsage.used}</span>
              <span>总量: ${usageData.unlimitedUsage.total}</span>
            </div>
          </div>
          
          <div class="card">
            <div class="info-row">
              <span class="info-label">下次重置日期:</span>
              <span>${usageData.resetDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">最后更新时间:</span>
              <span>${new Date(usageData.lastUpdated).toLocaleString()}</span>
            </div>
            
            <div class="button-container">
              <button class="refresh-button" id="refreshButton">刷新数据</button>
              <button class="refresh-button secondary-button" id="showLogsButton">查看日志</button>
            </div>
          </div>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          document.getElementById('refreshButton').addEventListener('click', () => {
            vscode.postMessage({
              command: 'refresh'
            });
          });
          
          document.getElementById('showLogsButton').addEventListener('click', () => {
            vscode.postMessage({
              command: 'showLogs'
            });
          });
        </script>
      </body>
      </html>
    `;
  }
} 