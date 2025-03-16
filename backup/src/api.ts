import * as https from 'https';
import { ConfigManager } from './config';
import * as vscode from 'vscode';

export interface UsageData {
  premiumUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  unlimitedUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  resetDate: string;
  lastUpdated: string;
}

export class CursorApiClient {
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.outputChannel = vscode.window.createOutputChannel('Cursor用量监控');
  }

  /**
   * 获取Cursor用量数据
   */
  public async fetchUsageData(): Promise<UsageData> {
    this.log('开始获取Cursor用量数据');
    
    try {
      // 首先尝试通过API获取数据
      this.log('尝试通过API获取数据');
      return await this.fetchViaApi();
    } catch (error) {
      this.log(`通过API获取数据失败: ${error instanceof Error ? error.message : String(error)}`);
      this.log('尝试通过网页抓取方式获取数据');
      
      // 如果API失败，尝试通过网页抓取
      try {
        return await this.fetchViaScraping();
      } catch (scrapingError) {
        this.log(`通过网页抓取获取数据失败: ${scrapingError instanceof Error ? scrapingError.message : String(scrapingError)}`);
        throw new Error(`获取Cursor用量数据失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 通过API获取用量数据
   */
  private async fetchViaApi(): Promise<UsageData> {
    const userId = this.configManager.getUserId();
    const cookieString = this.configManager.getCookieString();

    this.log(`用户ID: ${userId}`);
    this.log(`Cookie长度: ${cookieString.length} 字符`);

    if (!userId || !cookieString) {
      throw new Error('缺少用户ID或Cookie');
    }

    // 验证用户ID格式
    if (!userId.startsWith('user_')) {
      this.log('警告: 用户ID格式可能不正确，应以"user_"开头');
    }

    // 更新后的API端点 - 使用正确的URL格式
    const apiUrl = `https://www.cursor.com/api/usage?user=${userId}`;
    this.log(`API请求URL: ${apiUrl}`);

    return new Promise((resolve, reject) => {
      // 设置请求超时
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('API请求超时'));
      }, 10000); // 10秒超时
      
      const req = https.get(
        apiUrl,
        {
          headers: {
            'Cookie': cookieString,
            'User-Agent': 'VSCode-Extension-Cursor-Usage-Monitor',
            'Accept': 'application/json'
          }
        },
        (res) => {
          clearTimeout(timeout);
          
          this.log(`API响应状态码: ${res.statusCode}`);
          
          if (res.statusCode !== 200) {
            reject(new Error(`API请求失败，状态码: ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              // 输出完整的API响应数据
              this.log(`完整的API响应数据: ${data}`);
              
              const jsonData = JSON.parse(data);
              this.log('成功解析API响应JSON数据');
              
              // 输出解析后的JSON对象结构
              this.log(`JSON对象结构: ${JSON.stringify(jsonData, null, 2)}`);
              
              // 获取所有字段名
              const keys = Object.keys(jsonData);
              this.log(`API响应中的所有字段: ${keys.join(', ')}`);
              
              // 新的解析逻辑，适应实际的API响应格式
              // 假设"gpt-4"对应Premium模型，"gpt-3.5-turbo"对应无限额请求
              
              // 提取Premium模型数据 (gpt-4)
              let premiumUsed = 0;
              let premiumTotal = 0;
              if (jsonData['gpt-4']) {
                premiumUsed = jsonData['gpt-4'].numRequests || 0;
                premiumTotal = jsonData['gpt-4'].maxRequestUsage || 0;
                this.log(`从gpt-4提取Premium数据: used=${premiumUsed}, total=${premiumTotal}`);
              }
              
              // 提取无限额请求数据 (gpt-3.5-turbo)
              let unlimitedUsed = 0;
              let unlimitedTotal = 0;
              if (jsonData['gpt-3.5-turbo']) {
                unlimitedUsed = jsonData['gpt-3.5-turbo'].numRequests || 0;
                // 如果maxRequestUsage为null，设置一个默认值或显示为"无限制"
                unlimitedTotal = jsonData['gpt-3.5-turbo'].maxRequestUsage || Infinity;
                if (unlimitedTotal === Infinity) {
                  this.log(`从gpt-3.5-turbo提取无限额数据: used=${unlimitedUsed}, total=无限制`);
                } else {
                  this.log(`从gpt-3.5-turbo提取无限额数据: used=${unlimitedUsed}, total=${unlimitedTotal}`);
                }
              }
              
              // 提取重置日期
              let resetDate = '';
              if (jsonData.startOfMonth) {
                // 从startOfMonth计算下个月的日期
                const startDate = new Date(jsonData.startOfMonth);
                const nextMonth = new Date(startDate);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                resetDate = nextMonth.toISOString().split('T')[0];
                this.log(`从startOfMonth计算重置日期: ${resetDate}`);
              } else {
                resetDate = this.getNextMonthFirstDay();
                this.log(`使用默认重置日期: ${resetDate}`);
              }
              
              // 构建UsageData对象
              const usageData: UsageData = {
                premiumUsage: {
                  used: premiumUsed,
                  total: premiumTotal,
                  percentage: premiumTotal > 0 ? (premiumUsed / premiumTotal * 100) : 0
                },
                unlimitedUsage: {
                  used: unlimitedUsed,
                  // 如果total为Infinity，在显示时处理为"无限制"
                  total: unlimitedTotal === Infinity ? 0 : unlimitedTotal,
                  percentage: unlimitedTotal === Infinity ? (unlimitedUsed > 0 ? 100 : 0) : (unlimitedTotal > 0 ? (unlimitedUsed / unlimitedTotal * 100) : 0)
                },
                resetDate: resetDate,
                lastUpdated: new Date().toISOString()
              };

              this.log(`解析后的用量数据: Premium ${usageData.premiumUsage.used}/${usageData.premiumUsage.total}, Unlimited ${usageData.unlimitedUsage.used}/${usageData.unlimitedUsage.total === 0 ? '无限制' : usageData.unlimitedUsage.total}`);
              
              resolve(usageData);
            } catch (error) {
              this.log(`解析API响应失败: ${error instanceof Error ? error.message : String(error)}`);
              reject(new Error(`解析API响应失败: ${error instanceof Error ? error.message : String(error)}`));
            }
          });
        }
      );

      req.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`API请求错误: ${error.message}`);
        reject(new Error(`API请求错误: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * 通过网页抓取获取用量数据
   * 注意：这是一个备用方法，如果API方法失败时使用
   */
  private async fetchViaScraping(): Promise<UsageData> {
    const cookieString = this.configManager.getCookieString();

    if (!cookieString) {
      throw new Error('缺少Cookie');
    }

    // 网页URL
    const webUrl = 'https://www.cursor.com/settings';
    this.log(`网页抓取URL: ${webUrl}`);

    return new Promise((resolve, reject) => {
      // 设置请求超时
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('网页请求超时'));
      }, 15000); // 15秒超时
      
      const req = https.get(
        webUrl,
        {
          headers: {
            'Cookie': cookieString,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html'
          }
        },
        (res) => {
          clearTimeout(timeout);
          
          this.log(`网页响应状态码: ${res.statusCode}`);
          
          if (res.statusCode !== 200) {
            reject(new Error(`网页请求失败，状态码: ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              this.log(`网页响应数据长度: ${data.length} 字符`);
              
              // 尝试查找包含用量信息的部分
              this.log('开始解析网页内容');
              
              // 提取Premium用量
              const premiumMatch = data.match(/Premium模型使用量：(\d+)\/(\d+)/);
              if (premiumMatch) {
                this.log(`找到Premium用量匹配: ${premiumMatch[0]}`);
              } else {
                this.log('未找到Premium用量匹配');
                // 尝试其他可能的模式
                this.log('尝试其他匹配模式...');
              }
              
              const premiumUsed = premiumMatch ? parseInt(premiumMatch[1], 10) : 0;
              const premiumTotal = premiumMatch ? parseInt(premiumMatch[2], 10) : 0;
              
              // 提取无限额请求用量
              const unlimitedMatch = data.match(/无限额请求：(\d+)\/(\d+)/);
              if (unlimitedMatch) {
                this.log(`找到无限额请求匹配: ${unlimitedMatch[0]}`);
              } else {
                this.log('未找到无限额请求匹配');
              }
              
              const unlimitedUsed = unlimitedMatch ? parseInt(unlimitedMatch[1], 10) : 0;
              const unlimitedTotal = unlimitedMatch ? parseInt(unlimitedMatch[2], 10) : 0;
              
              // 提取重置日期
              const resetDateMatch = data.match(/下次重置：(\d{4}-\d{2}-\d{2})/);
              if (resetDateMatch) {
                this.log(`找到重置日期匹配: ${resetDateMatch[0]}`);
              } else {
                this.log('未找到重置日期匹配');
              }
              
              const resetDate = resetDateMatch ? resetDateMatch[1] : this.getNextMonthFirstDay();

              // 如果所有匹配都失败，尝试查找英文版本的匹配
              if (!premiumMatch && !unlimitedMatch && !resetDateMatch) {
                this.log('尝试查找英文版本的匹配...');
                // 这里可以添加英文版本的正则表达式匹配
              }

              const usageData: UsageData = {
                premiumUsage: {
                  used: premiumUsed,
                  total: premiumTotal,
                  percentage: premiumTotal > 0 ? (premiumUsed / premiumTotal * 100) : 0
                },
                unlimitedUsage: {
                  used: unlimitedUsed,
                  total: unlimitedTotal,
                  percentage: unlimitedTotal > 0 ? (unlimitedUsed / unlimitedTotal * 100) : 0
                },
                resetDate: resetDate,
                lastUpdated: new Date().toISOString()
              };

              this.log(`解析后的用量数据: Premium ${usageData.premiumUsage.used}/${usageData.premiumUsage.total}, Unlimited ${usageData.unlimitedUsage.used}/${usageData.unlimitedUsage.total}`);
              
              // 如果没有找到任何有效数据，抛出错误
              if (premiumUsed === 0 && premiumTotal === 0 && unlimitedUsed === 0 && unlimitedTotal === 0) {
                this.log('未能从网页中提取到任何有效的用量数据');
                reject(new Error('未能从网页中提取到任何有效的用量数据'));
                return;
              }
              
              resolve(usageData);
            } catch (error) {
              this.log(`解析网页响应失败: ${error instanceof Error ? error.message : String(error)}`);
              reject(new Error(`解析网页响应失败: ${error instanceof Error ? error.message : String(error)}`));
            }
          });
        }
      );

      req.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`网页请求错误: ${error.message}`);
        reject(new Error(`网页请求错误: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * 获取下个月第一天的日期字符串
   */
  private getNextMonthFirstDay(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString().split('T')[0];
  }
  
  /**
   * 记录日志
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
} 