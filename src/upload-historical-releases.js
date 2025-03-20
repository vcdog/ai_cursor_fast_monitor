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

/**
 * 上传历史版本
 */
async function uploadHistoricalReleases() {
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
      throw new Error('仓库验证失败，上传终止');
    }

    // 2. 查找所有.vsix文件
    const vsixFiles = glob.sync('./*.vsix');
    console.log(`📦 找到 ${vsixFiles.length} 个.vsix文件`);

    if (vsixFiles.length === 0) {
      throw new Error('未找到.vsix文件');
    }

    // 3. 获取现有的releases和tags
    console.log('🔍 获取现有releases...');
    const { data: existingReleases } = await octokit.repos.listReleases({
      owner: OWNER,
      repo: REPO
    });

    console.log('🔍 获取现有tags...');
    const { data: existingTags } = await octokit.repos.listTags({
      owner: OWNER,
      repo: REPO
    });

    // 4. 处理每个文件
    for (const vsixFile of vsixFiles) {
      // 从文件名提取版本号
      const versionMatch = path.basename(vsixFile).match(/cursor-usage-monitor-(\d+\.\d+\.\d+)\.vsix/);
      if (!versionMatch) {
        console.warn(`⚠️ 无法从文件名提取版本号: ${vsixFile}，跳过`);
        continue;
      }

      const versionNumber = versionMatch[1];
      const tagName = `v${versionNumber}`;
      
      // 检查这个版本的release是否已存在
      const existingRelease = existingReleases.find(release => release.tag_name === tagName);
      if (existingRelease) {
        console.log(`⚠️ Release ${tagName} 已存在，跳过`);
        continue;
      }

      // 检查tag是否存在
      const tagExists = existingTags.some(tag => tag.name === tagName);
      
      // 5. 创建Release
      console.log(`🚀 开始创建 ${tagName} Release...`);
      
      // 生成Release说明
      const releaseNotes = generateGenericReleaseNotes(tagName);
      
      try {
        const release = await octokit.repos.createRelease({
          owner: OWNER,
          repo: REPO,
          tag_name: tagName,
          name: tagName,
          body: releaseNotes,
          draft: false,
          prerelease: false,
          // 如果tag不存在，则从当前HEAD创建
          target_commitish: tagExists ? undefined : 'main' 
        });
        
        console.log(`✅ Release ${tagName} 创建成功: ${release.data.html_url}`);
        
        // 6. 上传.vsix文件
        console.log(`📤 开始上传 ${vsixFile}...`);
        const vsixContent = fs.readFileSync(vsixFile);
        await octokit.repos.uploadReleaseAsset({
          owner: OWNER,
          repo: REPO,
          release_id: release.data.id,
          name: path.basename(vsixFile),
          data: vsixContent
        });
        
        console.log(`✅ ${vsixFile} 上传成功`);
      } catch (error) {
        console.error(`❌ 为 ${tagName} 创建Release失败:`, error.message);
        continue; // 继续处理下一个文件
      }
    }
    
    console.log('🎉 历史版本上传完成');
  } catch (error) {
    console.error('❌ 上传历史版本失败:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * 生成通用版本更新说明
 */
function generateGenericReleaseNotes(version) {
  return `# ${version}

## 历史版本
这是 Cursor用量监控 扩展的历史版本。

## 安装方法
1. 下载此 .vsix 文件
2. 在 VS Code 中通过 "Install from VSIX..." 安装
3. 重启 VS Code

## 反馈问题
如有问题请在 GitHub Issues 中反馈
`;
}

// 开始上传
if (require.main === module) {
  uploadHistoricalReleases().catch(console.error);
}

module.exports = {
  uploadHistoricalReleases
}; 