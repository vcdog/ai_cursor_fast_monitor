# Cursor用量监控

这是一个VSCode扩展，用于监控Cursor API的使用情况。

## 功能

- 监控Cursor API的使用量
- 在VSCode状态栏显示使用情况
- 详细查看Premium模型和无限额请求的使用情况
- 自动定期检查更新

## 使用方法

1. 安装扩展后，点击VSCode状态栏上的"Cursor用量"图标
2. 首次使用时，需要设置Cursor的Cookie和用户ID
3. 点击"检查Cursor用量"命令获取最新数据
4. 点击状态栏图标查看详细用量信息

## 获取Cookie和用户ID

1. 在浏览器中登录Cursor网站(https://www.cursor.com/settings)
2. 打开开发者工具(F12)，切换到"网络"标签
3. 刷新页面，找到任意请求
4. 在请求头中找到"Cookie"字段，复制完整内容
5. 用户ID可以从Cookie中的WorkosCursorSessionToken部分提取，格式为user_XXXXXXXX

## 配置选项

- `cursor-usage-monitor.cookieString`: Cursor网站的Cookie字符串
- `cursor-usage-monitor.userId`: Cursor用户ID
- `cursor-usage-monitor.checkInterval`: 自动检查间隔（秒）

## 命令

- `cursor-usage-monitor.checkUsage`: 检查Cursor用量
- `cursor-usage-monitor.showUsage`: 显示Cursor用量详情

## 注意事项

- Cookie有效期有限，过期后需要重新设置
- 扩展使用两种方式获取数据：API请求和网页抓取
- 如果API请求失败，会自动尝试网页抓取方式

## 隐私说明

- 所有数据仅存储在本地，不会上传到任何服务器
- Cookie和用户ID仅用于访问您自己的Cursor账户数据

## 开发

1. 克隆仓库
2. 运行 `npm install` 安装依赖
3. 在VSCode中按F5启动调试

## 许可证

MIT