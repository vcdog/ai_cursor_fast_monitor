// 主扩展入口文件
const vscode = require('vscode');
const { activateUsageMonitor } = require('./usageMonitor');

/**
 * 扩展激活时调用
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Cursor Usage Monitor 扩展已激活');
  
  // 激活使用量监控功能
  activateUsageMonitor(context);
}

/**
 * 扩展停用时调用
 */
function deactivate() {
  console.log('Cursor Usage Monitor 扩展已停用');
}

module.exports = {
  activate,
  deactivate
}; 