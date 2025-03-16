import * as vscode from 'vscode';

export class ConfigManager {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  }

  /**
   * 重新加载配置
   */
  public reloadConfig(): void {
    this.config = vscode.workspace.getConfiguration('cursor-usage-monitor');
  }

  /**
   * 获取Cookie字符串
   */
  public getCookieString(): string {
    return this.config.get<string>('cookieString', '');
  }

  /**
   * 获取用户ID
   */
  public getUserId(): string {
    return this.config.get<string>('userId', '');
  }

  /**
   * 获取检查间隔（秒）
   */
  public getCheckInterval(): number {
    return this.config.get<number>('checkInterval', 3600);
  }

  /**
   * 检查配置是否完整
   */
  public isConfigComplete(): boolean {
    const cookieString = this.getCookieString();
    const userId = this.getUserId();
    return !!cookieString && !!userId;
  }

  /**
   * 更新Cookie字符串
   */
  public async updateCookieString(value: string): Promise<void> {
    await this.config.update('cookieString', value, vscode.ConfigurationTarget.Global);
    this.reloadConfig();
  }

  /**
   * 更新用户ID
   */
  public async updateUserId(value: string): Promise<void> {
    await this.config.update('userId', value, vscode.ConfigurationTarget.Global);
    this.reloadConfig();
  }

  /**
   * 更新检查间隔
   */
  public async updateCheckInterval(value: number): Promise<void> {
    await this.config.update('checkInterval', value, vscode.ConfigurationTarget.Global);
    this.reloadConfig();
  }
} 