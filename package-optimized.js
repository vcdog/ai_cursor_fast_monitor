#!/usr/bin/env node

/**
 * Cursor用量监控扩展自动打包脚本
 * 功能：自动递增版本号并打包扩展
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const axios = require('axios');  // 确保已经安装了 axios

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
 * 运行打包命令
 */
function runPackageCommand() {
  try {
    // 确保 images 目录存在
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir);
    }

    // 检查并处理图标
    if (!fs.existsSync(path.join(imagesDir, 'icon.png')) && 
        fs.existsSync(path.join(__dirname, 'original-icon.png'))) {
      console.log('处理扩展图标...');
      execSync('npm run process-icon', { stdio: 'inherit' });
    }

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
    // 确保图标存在
    const iconPath = path.join(__dirname, 'images', 'icon.png');
    if (!fs.existsSync(iconPath)) {
      console.error('错误: 未找到扩展图标，请确保 images/icon.png 文件存在');
      return false;
    }

    console.log('正在发布扩展到 VS Code 市场...');
    execSync(`vsce publish -p ${token}`, { stdio: 'inherit' });
    console.log('\n发布成功！');
    console.log('----------------------------------------');
    console.log(`✅ 版本: Cursor用量监控 v${version}`);
    console.log(`📦 市场链接: https://marketplace.visualstudio.com/items?itemName=vcdog.cursor-usage-monitor`);
    console.log(`📊 管理页面: https://marketplace.visualstudio.com/manage`);
    console.log('----------------------------------------\n');
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
 * 从配置文件加载 GitHub 令牌
 */
function loadGitHubToken() {
  const tokenFilePath = path.join(__dirname, '.github-token');
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
 * 保存 GitHub 令牌到配置文件
 */
function saveGitHubToken(token) {
  if (!token) return;
  
  const tokenFilePath = path.join(__dirname, '.github-token');
  try {
    fs.writeFileSync(tokenFilePath, token);
    console.log('GitHub 令牌已保存，下次发布将自动使用');
    
    // 添加到 .gitignore
    const gitignorePath = path.join(__dirname, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.github-token')) {
        fs.appendFileSync(gitignorePath, '\n.github-token\n');
      }
    }
  } catch (error) {
    console.error('保存 GitHub 令牌失败:', error.message);
  }
}

/**
 * 创建 GitHub Release 并上传 VSIX 文件
 */
async function createGitHubRelease(version, message, vsixPath, token) {
  const owner = 'vcdog';  // 替换为您的 GitHub 用户名
  const repo = 'cursor-usage-monitor';  // 替换为您的仓库名
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  
  try {
    console.log('正在创建 GitHub Release...');
    
    // 创建 Release
    const releaseResponse = await axios({
      method: 'POST',
      url: `${baseUrl}/releases`,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      data: {
        tag_name: `v${version}`,
        target_commitish: 'main',
        name: `Release v${version}`,
        body: message,
        draft: false,
        prerelease: false
      }
    });
    
    // 上传 VSIX 文件
    const uploadUrl = releaseResponse.data.upload_url.replace('{?name,label}', '');
    const vsixContent = fs.readFileSync(vsixPath);
    const vsixName = path.basename(vsixPath);
    
    await axios({
      method: 'POST',
      url: `${uploadUrl}?name=${vsixName}`,
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/vnd.github.v3+json'
      },
      data: vsixContent,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    // 复制图标到发布文件中
    const iconPath = path.join(__dirname, 'images', 'icon.png');
    if (fs.existsSync(iconPath)) {
      const releaseIconPath = path.join(path.dirname(vsixPath), 'icon.png');
      fs.copyFileSync(iconPath, releaseIconPath);
      
      // 添加图标到 release 资产
      const iconContent = fs.readFileSync(releaseIconPath);
      await axios({
        method: 'POST',
        url: `${uploadUrl}?name=icon.png`,
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'image/png',
          'Accept': 'application/vnd.github.v3+json'
        },
        data: iconContent
      });
    }
    
    console.log(`\n✨ GitHub Release v${version} 创建成功！`);
    console.log(`\n Release URL: https://github.com/${owner}/${repo}/releases/tag/v${version}`);
    
    // 添加下载链接到版本历史记录
    try {
      const versionHistory = JSON.parse(fs.readFileSync(VERSION_HISTORY_FILE, 'utf8'));
      const currentVersion = versionHistory.find(v => v.version === version);
      if (currentVersion) {
        currentVersion.githubReleaseUrl = `https://github.com/${owner}/${repo}/releases/tag/v${version}`;
        currentVersion.vsixDownloadUrl = `https://github.com/${owner}/${repo}/releases/download/v${version}/${vsixName}`;
        fs.writeFileSync(VERSION_HISTORY_FILE, JSON.stringify(versionHistory, null, 2));
      }
    } catch (error) {
      console.warn('更新版本历史记录的 GitHub 链接失败:', error.message);
    }
    
    return true;
  } catch (error) {
    if (error.response) {
      console.error('创建 GitHub Release 失败:', error.response.data.message);
      if (error.response.status === 404) {
        console.error('提示: 请确保仓库存在且 GitHub Token 有足够的权限');
      } else if (error.response.status === 422) {
        console.error('提示: 该版本标签可能已经存在，请先删除已存在的 Release');
      }
    } else {
      console.error('创建 GitHub Release 失败:', error.message);
    }
    return false;
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