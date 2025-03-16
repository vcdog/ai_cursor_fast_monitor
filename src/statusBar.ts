import * as vscode from 'vscode';
import { UsageData } from './api';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private context: vscode.ExtensionContext;
  private isLoading: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * 初始化状态栏
   */
  public initialize(): void {
    this.statusBarItem.text = 'Cursor用量: 加载中...';
    this.statusBarItem.tooltip = '点击查看Cursor用量详情';
    this.statusBarItem.command = 'cursor-usage-monitor.showUsage';
    this.statusBarItem.show();
  }

  /**
   * 设置加载状态
   */
  public setLoading(isLoading: boolean): void {
    this.isLoading = isLoading;
    
    if (isLoading) {
      this.statusBarItem.text = '$(sync~spin) Cursor用量: 加载中...';
      this.statusBarItem.tooltip = '正在获取Cursor用量数据...';
    } else if (this.statusBarItem.text.includes('加载中')) {
      // 如果当前是加载状态，但isLoading为false，则恢复到默认状态
      this.statusBarItem.text = 'Cursor用量: 点击查看';
      this.statusBarItem.tooltip = '点击查看Cursor用量详情';
    }
  }

  /**
   * 设置错误状态
   */
  public setError(): void {
    this.isLoading = false;
    this.statusBarItem.text = '$(error) Cursor用量: 获取失败';
    this.statusBarItem.tooltip = '点击重试或查看详情';
  }

  /**
   * 更新用量信息
   */
  public updateUsage(usageData: UsageData): void {
    this.isLoading = false;
    
    // 显示Premium模型的使用百分比
    const premiumPercentage = Math.round(usageData.premiumUsage.percentage);
    
    // 根据使用百分比选择不同的图标
    let icon = '$(check)';
    if (premiumPercentage > 90) {
      icon = '$(warning)';
    } else if (premiumPercentage > 75) {
      icon = '$(info)';
    }
    
    // 更新状态栏文本
    this.statusBarItem.text = `${icon} Cursor: ${premiumPercentage}%`;
    
    // 更新提示信息
    this.statusBarItem.tooltip = `
      Premium模型: ${usageData.premiumUsage.used}/${usageData.premiumUsage.total} (${premiumPercentage}%)
      无限额请求: ${usageData.unlimitedUsage.used}/${usageData.unlimitedUsage.total} (${Math.round(usageData.unlimitedUsage.percentage)}%)
      下次重置: ${usageData.resetDate}
      最后更新: ${new Date(usageData.lastUpdated).toLocaleString()}
      
      点击查看详情
    `;
  }
} 