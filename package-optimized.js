#!/usr/bin/env node

/**
 * Cursor用量监控扩展自动打包脚本
 * 功能：自动递增版本号并打包扩展
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// 版本历史记录文件
const VERSION_HISTORY_FILE = path.join(__dirname, 'version-history.json');
// package.json 文件路径
const PACKAGE_JSON_FILE = path.join(__dirname, 'package.json');

/**
 * 读取 package.json 文件
 */
function readPackageJson() {
  try {
    const packageJsonContent = fs.readFileSync(PACKAGE_JSON_FILE, 'utf8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    console.error('读取 package.json 失败:', error.message);
    process.exit(1);
  }
}

/**
 * 更新 package.json 文件
 */
function updatePackageJson(packageJson) {
  try {
    fs.writeFileSync(PACKAGE_JSON_FILE, JSON.stringify(packageJson, null, 2));
    console.log(`package.json 已更新，新版本: ${packageJson.version}`);
  } catch (error) {
    console.error('更新 package.json 失败:', error.message);
    process.exit(1);
  }
}

/**
 * 递增版本号
 * @param {string} version 当前版本号
 * @param {string} type patch|minor|major
 * @returns {string} 新版本号
 */
function incrementVersion(version, type = 'patch') {
  // 如果版本号不存在或无效，从 0.1.0 开始
  if (!version || !version.match(/^\d+\.\d+\.\d+$/)) {
    return '0.1.0';
  }

  const [major, minor, patch] = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * 更新版本历史记录
 */
function updateVersionHistory(version, message) {
  try {
    let versionHistory = [];
    
    // 如果历史记录文件存在，读取它
    if (fs.existsSync(VERSION_HISTORY_FILE)) {
      versionHistory = JSON.parse(fs.readFileSync(VERSION_HISTORY_FILE, 'utf8'));
    }
    
    // 添加新版本记录
    versionHistory.push({
      version,
      date: new Date().toISOString(),
      message: message || `版本 ${version} 发布`
    });
    
    // 保存历史记录
    fs.writeFileSync(VERSION_HISTORY_FILE, JSON.stringify(versionHistory, null, 2));
    console.log('版本历史记录已更新');
  } catch (error) {
    console.error('更新版本历史记录失败:', error.message);
  }
}

/**
 * 执行打包命令
 */
function runPackageCommand() {
  try {
    console.log('开始打包扩展...');
    execSync('npm run package', { stdio: 'inherit' });
    console.log('打包完成');
  } catch (error) {
    console.error('打包失败:', error.message);
    process.exit(1);
  }
}

/**
 * 创建交互式命令行接口
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * 在生成 VSIX 之前，验证发布者信息
 */
function verifyPublisherInfo(packageJson) {
  if (packageJson.publisher === 'your-publisher-name') {
    console.warn('警告: package.json 中的发布者名称仍为默认值');
    const useDefaultAction = readline.question('是否更新为 "vcdog"? (y/n): ');
    
    if (useDefaultAction.toLowerCase() === 'y') {
      packageJson.publisher = 'vcdog';
      updatePackageJson(packageJson);
    }
  }
  
  return packageJson;
}

/**
 * 执行发布命令
 * @param {string} version 版本号
 * @param {string} token 访问令牌
 */
async function publishExtension(version, token) {
  if (!token) {
    console.error('未提供有效的发布令牌，无法发布');
    return false;
  }
  
  try {
    console.log('正在发布扩展到 VS Code 市场...');
    execSync(`vsce publish -p ${token}`, { stdio: 'inherit' });
    console.log(`\n✅ 已成功发布 cursor-usage-monitor v${version}`);
    console.log(`\n📦 扩展链接: https://marketplace.visualstudio.com/items?itemName=vcdog.cursor-usage-monitor`);
    console.log(`\n📊 管理页面: https://marketplace.visualstudio.com/manage/publishers/vcdog/extensions/cursor-usage-monitor/hub`);
    return true;
  } catch (error) {
    console.error('发布失败:', error.message);
    return false;
  }
}

/**
 * 从配置文件加载令牌
 */
function loadToken() {
  const tokenFilePath = path.join(__dirname, '.vscode-token');
  if (fs.existsSync(tokenFilePath)) {
    try {
      return fs.readFileSync(tokenFilePath, 'utf8').trim();
    } catch (error) {
      return null;
    }
  }
  return null;
}

/**
 * 保存令牌到配置文件
 */
function saveToken(token) {
  if (!token) return;
  
  const tokenFilePath = path.join(__dirname, '.vscode-token');
  try {
    fs.writeFileSync(tokenFilePath, token);
    console.log('令牌已保存，下次发布将自动使用');
    
    // 确保令牌文件不被纳入版本控制
    const gitignorePath = path.join(__dirname, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.vscode-token')) {
        fs.appendFileSync(gitignorePath, '\n.vscode-token\n');
      }
    } else {
      fs.writeFileSync(gitignorePath, '.vscode-token\n');
    }
  } catch (error) {
    console.error('保存令牌失败:', error.message);
  }
}

/**
 * 在打包前检查 README.md 文件
 */
function checkReadmeFile() {
  if (!fs.existsSync(path.join(__dirname, 'README.md'))) {
    if (fs.existsSync(path.join(__dirname, 'readme.md'))) {
      console.warn('警告: 检测到小写的 readme.md 文件。VSCode 扩展市场要求使用大写的 README.md');
      console.log('正在将 readme.md 重命名为 README.md...');
      try {
        fs.renameSync(
          path.join(__dirname, 'readme.md'), 
          path.join(__dirname, 'README.md')
        );
        console.log('文件重命名成功!');
      } catch (error) {
        console.error('无法重命名文件:', error.message);
      }
    } else {
      console.warn('警告: 未找到 README.md 文件，扩展发布后可能显示"无可用自述文件"');
    }
  }
}

/**
 * 主函数
 */
async function main() {
  // 检查 README.md 文件
  checkReadmeFile();
  
  // 读取当前 package.json
  let packageJson = readPackageJson();
  const currentVersion = packageJson.version || '0.0.0';
  
  console.log(`当前版本: ${currentVersion}`);
  
  // 验证发布者信息
  packageJson = verifyPublisherInfo(packageJson);
  
  // 创建命令行接口
  const rl = createReadlineInterface();
  
  // 询问版本类型
  rl.question('选择要递增的版本类型 [patch/minor/major] (默认: patch): ', (versionType) => {
    versionType = versionType.trim().toLowerCase();
    if (!['patch', 'minor', 'major'].includes(versionType)) {
      versionType = 'patch';
    }
    
    // 递增版本号
    const newVersion = incrementVersion(currentVersion, versionType);
    
    // 询问版本更新消息
    rl.question(`请输入版本 ${newVersion} 的更新内容: `, (message) => {
      // 更新 package.json
      packageJson.version = newVersion;
      updatePackageJson(packageJson);
      
      // 更新版本历史记录
      updateVersionHistory(newVersion, message);
      
      // 运行打包命令
      runPackageCommand();
      
      // 生成 VSIX 文件
      try {
        const vsixFileName = `cursor-usage-monitor-${newVersion}.vsix`;
        console.log(`生成 VSIX 文件: ${vsixFileName}`);
        execSync('vsce package', { stdio: 'inherit' });
        
        // 重命名生成的 VSIX 文件
        const defaultVsixName = `cursor-usage-monitor-${newVersion}.vsix`;
        if (fs.existsSync(defaultVsixName)) {
          fs.renameSync(defaultVsixName, vsixFileName);
          console.log(`VSIX 文件已生成: ${vsixFileName}`);
        }
        
        // 询问是否要发布
        rl.question('是否发布到 VSCode 扩展市场? (y/n): ', (shouldPublish) => {
          if (shouldPublish.toLowerCase() === 'y') {
            // 尝试加载已保存的令牌
            const savedToken = loadToken();
            
            if (savedToken) {
              rl.question(`检测到已保存的令牌，是否使用? (y/n): `, (useToken) => {
                if (useToken.toLowerCase() === 'y') {
                  publishExtension(newVersion, savedToken).then(() => rl.close());
                } else {
                  rl.question('请输入 Personal Access Token: ', (token) => {
                    if (token) {
                      publishExtension(newVersion, token).then(() => {
                        rl.question('是否保存此令牌以便未来使用? (y/n): ', (saveTokenChoice) => {
                          if (saveTokenChoice.toLowerCase() === 'y') {
                            saveToken(token);
                          }
                          rl.close();
                        });
                      });
                    } else {
                      console.log('未提供令牌，跳过发布');
                      rl.close();
                    }
                  });
                }
              });
            } else {
              rl.question('请输入 Personal Access Token: ', (token) => {
                if (token) {
                  publishExtension(newVersion, token).then(() => {
                    rl.question('是否保存此令牌以便未来使用? (y/n): ', (saveTokenChoice) => {
                      if (saveTokenChoice.toLowerCase() === 'y') {
                        saveToken(token);
                      }
                      rl.close();
                    });
                  });
                } else {
                  console.log('未提供令牌，跳过发布');
                  rl.close();
                }
              });
            }
          } else {
            console.log('跳过发布，仅完成本地打包');
            rl.close();
          }
        });
      } catch (error) {
        console.error('生成 VSIX 文件失败:', error.message);
        rl.close();
      }
    });
  });
}

// 运行主函数
main().catch(error => {
  console.error('执行过程中出错:', error);
  process.exit(1);
}); 