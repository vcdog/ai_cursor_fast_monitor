const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// GitHub 配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// 从package.json中读取仓库信息
let OWNER, REPO;
try {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  if (packageJson.repository && packageJson.repository.url) {
    const repoUrl = packageJson.repository.url;
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/i);
    if (match) {
      OWNER = match[1];
      REPO = match[2];
      console.log(`📦 从package.json中解析到仓库: ${OWNER}/${REPO}`);
    }
  }
} catch (error) {
  console.error('⚠️ 从package.json读取仓库信息失败，将使用默认值');
}

// 如果无法从package.json获取，使用默认值或从环境变量获取
OWNER = OWNER || process.env.GITHUB_OWNER || 'vcdog';
REPO = REPO || process.env.GITHUB_REPO || 'cursor-usage-monitor';

console.log(`🔗 使用仓库: ${OWNER}/${REPO}`);

async function createGitHubRelease() {
  try {
    // 1. 初始化 GitHub API 客户端
    const octokit = new Octokit({
      auth: GITHUB_TOKEN
    });

    // 验证Token和仓库是否有效
    try {
      console.log('🔍 验证仓库是否存在...');
      await octokit.repos.get({
        owner: OWNER,
        repo: REPO
      });
      console.log('✅ 仓库验证成功!');
    } catch (repoError) {
      console.error(`❌ 仓库验证失败: ${repoError.message}`);
      console.error('请确认以下信息:');
      console.error(`1. 仓库 ${OWNER}/${REPO} 是否存在`);
      console.error('2. GitHub Token是否有权限访问该仓库');
      console.error('3. 仓库URL是否正确 (检查package.json中的repository字段)');
      
      console.log('\n您可以通过设置环境变量来覆盖仓库信息:');
      console.log('GITHUB_OWNER=您的用户名 GITHUB_REPO=您的仓库名 npm run release');
      throw new Error('仓库验证失败，发布终止');
    }

    // 2. 读取 package.json 获取版本号
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const version = `v${packageJson.version}`;
    console.log(`📋 准备发布版本: ${version}`);

    // 3. 查找最新的 .vsix 文件
    const vsixFiles = glob.sync('./*.vsix');
    const latestVsix = vsixFiles.sort().pop();
    
    if (!latestVsix) {
      throw new Error('未找到 .vsix 文件');
    }
    console.log(`📦 找到.vsix文件: ${latestVsix}`);

    // 4. 生成更新说明
    const releaseNotes = generateReleaseNotes(version);
    console.log('📝 生成发布说明完成');

    // 5. 创建 Release
    console.log('🚀 开始创建GitHub Release...');
    const release = await octokit.repos.createRelease({
      owner: OWNER,
      repo: REPO,
      tag_name: version,
      name: version,
      body: releaseNotes,
      draft: false,
      prerelease: false
    });
    console.log(`✅ Release创建成功: ${release.data.html_url}`);

    // 6. 上传 .vsix 文件
    console.log(`📤 开始上传.vsix文件...`);
    const vsixContent = fs.readFileSync(latestVsix);
    await octokit.repos.uploadReleaseAsset({
      owner: OWNER,
      repo: REPO,
      release_id: release.data.id,
      name: path.basename(latestVsix),
      data: vsixContent
    });

    console.log(`✅ 成功创建 Release ${version} 并上传 .vsix 文件`);
    console.log(`🌐 发布地址: ${release.data.html_url}`);
  } catch (error) {
    console.error('❌ 创建 Release 失败:');
    if (error.status) {
      console.error(`HTTP状态码: ${error.status}`);
      console.error(`响应消息: ${error.response?.data?.message || '未知错误'}`);
      console.error(`文档URL: ${error.response?.data?.documentation_url || '无'}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * 生成版本更新说明
 */
function generateReleaseNotes(version) {
  // 读取最近的 git commit 信息来生成更新说明
  const commitMessage = require('child_process')
    .execSync('git log -1 --pretty=%B')
    .toString()
    .trim();

  return `# ${version}

## 更新内容
${commitMessage}

## 安装方法
1. 下载此 .vsix 文件
2. 在 VS Code 中通过 "Install from VSIX..." 安装
3. 重启 VS Code

## 反馈问题
如有问题请在 GitHub Issues 中反馈
`;
}

// 添加到 package.json 的 scripts 中
if (require.main === module) {
  createGitHubRelease().catch(console.error);
}

module.exports = {
  createGitHubRelease
}; 