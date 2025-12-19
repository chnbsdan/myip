# Hangdn 个人智能导航系统
一个基于 Cloudflare Workers 构建的现代化、功能丰富的个人导航网站，具有毛玻璃设计、音乐播放器、友链申请系统和后台管理功能。

# 🌟 功能特性
## 1. 核心导航功能
分类管理：支持多级分类管理网站

网站收藏：可添加网站名称、链接和图标

分类筛选：侧边栏快速筛选分类

一键访问：点击网站卡片直接跳转

## 2. 音乐播放器
集成网易云音乐歌单

支持播放/暂停、上一首/下一首

独立浮动歌词显示

右键快捷菜单控制

黑胶唱片动画效果

## 3. 友链申请系统
游客可提交友链申请

管理员后台审批功能

支持申请状态管理（待审批/已批准/已拒绝）

申请表单包含网站描述和联系方式

## 4. 管理功能
密码保护的管理员登录

分类管理（添加/删除/编辑）

网站管理（添加/删除/编辑）

友链审批管理

## 5. 用户体验
毛玻璃设计效果

背景图片轮播

响应式设计，支持移动端

实时日期时间显示

快捷搜索功能（点击Logo打开）

侧边分类导航菜单

返回顶部按钮

## 6. 技术特性
基于 Cloudflare Workers

使用 KV 存储数据

RESTful API 设计

前后端分离架构

Token 认证机制

# 🚀 快速部署
准备工作
Cloudflare 账号

开通 Workers 服务

创建 KV 命名空间

部署步骤
克隆代码或复制提供的 Worker 代码

# 配置 KV

在 Cloudflare Dashboard 中创建 KV 命名空间

将命名空间绑定到 Worker，变量名设为 NAVIGATION_DATA

设置环境变量

默认管理员密码：admin123

可在代码中修改或通过环境变量配置

## 部署 Worker

将提供的代码粘贴到 Workers 编辑器中

保存并部署

访问网站

访问你的 Worker 域名即可使用

## 📁 项目结构
text
cloudflare-worker-navigation/
├── worker.js              # Cloudflare Worker 主文件
├── README.md              # 项目说明文档
└── 功能模块：
    ├── 路由处理
    ├── 数据管理
    ├── 认证系统
    ├── 前端界面
    └── 音乐播放器
## 🔧 配置说明
密码配置
javascript
const ADMIN_PASSWORD = 'admin123'; // 建议修改为强密码
音乐播放器配置
javascript
const PLAYLIST_ID = '14148542684'; // 网易云歌单ID
背景图片
默认包含13张背景图

支持自定义替换

每10秒自动轮换

## 🛠️ API 接口
公开接口
GET / - 首页

GET /data - 获取导航数据

POST /login - 管理员登录

POST /apply-link - 提交友链申请

受保护接口（需要认证）
POST /add-category - 添加分类

POST /add-site - 添加网站

POST /delete-category - 删除分类

POST /delete-site - 删除网站

POST /edit-site - 编辑网站

GET /pending-links - 获取待审批友链

POST /approve-link - 批准友链

POST /reject-link - 拒绝友链

## 💡 使用指南
1. 首次使用
访问部署的 Worker 域名

点击右下角齿轮图标登录（默认密码：admin123）

开始添加分类和网站

2. 添加网站
登录后显示控制面板

点击"添加分类"创建分类

点击"添加网站"或分类右上角的"+"按钮

填写网站信息：

名称

URL（完整链接）

图标（Iconify代码或图片链接）

## 3. 申请友链
点击右下角"申请友链"按钮（链接图标）

填写网站信息

等待管理员审核

## 4. 审批友链
管理员登录后点击"审批友链"按钮

查看待审批申请

选择分类并批准或拒绝

## 5. 搜索功能
点击Logo图标打开搜索框

选择搜索引擎

输入关键词搜索

## 6. 音乐控制
点击左下角音乐胶囊展开播放器

右键点击播放器或页面空白处打开控制菜单

歌词会自动显示在左下角

## 🎨 自定义样式
修改主题颜色
在 CSS 部分的 :root 中修改颜色变量：

css
:root {
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  --success-color: #10b981;
  --danger-color: #ef4444;
  --warning-color: #f59e0b;
}
修改背景图片
在 HTML 部分的 .background-container 中替换图片链接：

html
<img src="你的图片链接" class="background-slide active" alt="bg1">
## 🔒 安全说明
密码保护：建议修改默认管理员密码

认证机制：使用 Token 认证，会话有效期为24小时

数据隔离：每个用户的数据通过 KV 隔离

输入验证：所有用户输入都经过验证

CORS 配置：仅允许必要的跨域请求

## 📱 移动端支持
响应式布局，适配各种屏幕尺寸

移动端优化侧边菜单

触摸友好的操作界面

移动端自动调整播放器位置

## 🐛 故障排除
常见问题
无法登录

检查密码是否正确

检查网络连接

查看浏览器控制台错误

数据不保存

检查 KV 绑定是否正确

检查 Worker 部署状态

查看 Worker 日志

图标不显示

检查图标代码格式

确认 Iconify 服务可访问

检查网络连接

播放器无法使用

检查网易云服务可访问性

查看控制台错误信息

刷新页面重试

调试建议
打开浏览器开发者工具

查看 Network 面板请求状态

查看 Console 面板错误信息

检查 Application 面板的 LocalStorage

## 🔄 更新与维护
数据备份
定期导出 KV 数据：

bash
# 使用 Wrangler CLI
wrangler kv:key get --binding=NAVIGATION_DATA "data"
更新代码
修改 Worker 代码

测试本地开发环境

部署到生产环境

## 📄 许可证
本项目仅供个人使用，请遵守相关法律法规。

## 🤝 贡献
欢迎提交 Issue 和 Pull Request 来改进这个项目。

📧 联系方式
如有问题或建议，请通过以下方式联系：

邮箱：sfx@hangdn.com

网站：Hangdn nav

注意事项：

请勿将敏感信息存储在代码中

定期修改管理员密码

遵守版权法，不要使用未授权的资源

建议使用自己的图片和图标资源

## 更新日志：

2024-01-20：初始版本发布

2024-01-21：增加友链申请系统

2024-01-22：优化移动端体验

2024-01-23：增加搜索功能

## 致谢：

Cloudflare Workers 提供运行环境

Iconify 提供图标服务

APlayer 提供音乐播放器

Netease Cloud Music 提供音乐内容
