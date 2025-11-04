addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request));
  });
  
  // 密码配置（建议存储在环境变量中）
  const ADMIN_PASSWORD = 'admin123'; // 默认密码，可以修改
  
  // 路由处理
  const routes = {
	'GET /': handleHomePage,
	'GET /data': handleGetData,
	'POST /login': handleLogin,
	'POST /add-category': withAuth(handleAddCategory),
	'POST /add-site': withAuth(handleAddSite),
	'POST /delete-category': withAuth(handleDeleteCategory),
	'POST /delete-site': withAuth(handleDeleteSite),
	'POST /edit-site': withAuth(handleEditSite),
	// 新增友链申请相关路由
	'POST /apply-link': handleApplyLink,
	'GET /pending-links': withAuth(handleGetPendingLinks),
	'POST /approve-link': withAuth(handleApproveLink),
	'POST /reject-link': withAuth(handleRejectLink),
  };
  
  async function handleRequest(request) {
	const { pathname } = new URL(request.url);
	const method = request.method;
	const routeKey = `${method} ${pathname}`;
	
	const handler = routes[routeKey] || handleNotFound;
	return handler(request);
  }
  
  // 认证中间件
  function withAuth(handler) {
	return async (request) => {
	  const authHeader = request.headers.get('Authorization');
	  if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	  }
	  
	  const token = authHeader.substring(7);
	  const session = await getSession(token);
	  if (!session) {
		return jsonResponse({ error: 'Invalid token' }, 401);
	  }
	  
	  return handler(request);
	};
  }
  
  // 会话管理
  async function getSession(token) {
	const session = await NAVIGATION_DATA.get(`session:${token}`);
	return session ? JSON.parse(session) : null;
  }
  
  async function createSession(userId) {
	const token = generateToken();
	const session = { userId, createdAt: Date.now() };
	await NAVIGATION_DATA.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 86400 });
	return token;
  }
  
  function generateToken() {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  // 登录处理
  async function handleLogin(request) {
	try {
	  const { password } = await request.json();
	  if (password === ADMIN_PASSWORD) {
		const token = await createSession('admin');
		return jsonResponse({ token, message: 'Login successful' });
	  }
	  return jsonResponse({ error: 'Invalid password' }, 401);
	} catch (error) {
	  return jsonResponse({ error: 'Invalid request' }, 400);
	}
  }
  
  // 其他路由处理函数
  async function handleHomePage(request) {
	return new Response(await renderNavigationPage(), {
	  headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
  }
  
  async function handleGetData(request) {
	const navigationData = await getNavigationData();
	return jsonResponse(navigationData);
  }
  
  async function handleAddCategory(request) {
	try {
	  const requestBody = await request.json();
	  const navigationData = await getNavigationData();
	  
	  const categoryExists = navigationData.categories.some(
		category => category.name === requestBody.name
	  );
	  
	  if (categoryExists) {
		return jsonResponse({ error: 'Category already exists' }, 400);
	  }
	  
	  const newCategory = { 
		name: requestBody.name, 
		sites: [],
		color: requestBody.color || '#6366f1'
	  };
	  navigationData.categories.push(newCategory);
	  await setNavigationData(navigationData);
	  
	  return jsonResponse({ message: 'Category added successfully' });
	} catch (error) {
	  return jsonResponse({ error: 'Invalid request' }, 400);
	}
  }
  
  async function handleAddSite(request) {
	try {
	  const requestBody = await request.json();
	  const navigationData = await getNavigationData();
	  const { categoryIndex, siteName, siteUrl, siteIcon } = requestBody;
	  
	  if (!siteName || !siteUrl || !siteIcon) {
		return jsonResponse({ error: 'Missing required fields' }, 400);
	  }
	  
	  try {
		new URL(siteUrl);
	  } catch {
		return jsonResponse({ error: 'Invalid URL format' }, 400);
	  }
	  
	  navigationData.categories[categoryIndex].sites.push({ 
		name: siteName, 
		url: siteUrl, 
		icon: siteIcon 
	  });
	  await setNavigationData(navigationData);
	  
	  return jsonResponse({ message: 'Site added successfully' });
	} catch (error) {
	  return jsonResponse({ error: 'Invalid request' }, 400);
	}
  }
  
  async function handleDeleteCategory(request) {
	try {
	  const requestBody = await request.json();
	  const navigationData = await getNavigationData();
	  const { categoryIndex } = requestBody;
	  
	  navigationData.categories.splice(categoryIndex, 1);
	  await setNavigationData(navigationData);
	  
	  return jsonResponse({ message: 'Category deleted successfully' });
	} catch (error) {
	  return jsonResponse({ error: 'Invalid request' }, 400);
	}
  }
  
  async function handleDeleteSite(request) {
	try {
	  const requestBody = await request.json();
	  const navigationData = await getNavigationData();
	  const { categoryIndex, siteIndex } = requestBody;
	  
	  navigationData.categories[categoryIndex].sites.splice(siteIndex, 1);
	  await setNavigationData(navigationData);
	  
	  return jsonResponse({ message: 'Site deleted successfully' });
	} catch (error) {
	  return jsonResponse({ error: 'Invalid request' }, 400);
	}
  }
  
  async function handleEditSite(request) {
	try {
	  const requestBody = await request.json();
	  const navigationData = await getNavigationData();
	  const { categoryIndex, siteIndex, siteName, siteUrl, siteIcon } = requestBody;
	  
	  console.log('Editing site:', { categoryIndex, siteIndex, siteName, siteUrl, siteIcon });
	  
	  if (!siteName || !siteUrl || !siteIcon) {
		return jsonResponse({ error: 'Missing required fields' }, 400);
	  }
	  
	  try {
		new URL(siteUrl);
	  } catch {
		return jsonResponse({ error: 'Invalid URL format' }, 400);
	  }
	  
	  // 修复：确保索引存在
	  if (!navigationData.categories[categoryIndex] || !navigationData.categories[categoryIndex].sites[siteIndex]) {
		return jsonResponse({ error: 'Site not found' }, 404);
	  }
	  
	  // 更新网站信息
	  navigationData.categories[categoryIndex].sites[siteIndex] = { 
		name: siteName, 
		url: siteUrl, 
		icon: siteIcon 
	  };
	  
	  await setNavigationData(navigationData);
	  
	  return jsonResponse({ message: 'Site updated successfully' });
	} catch (error) {
	  console.error('Edit site error:', error);
	  return jsonResponse({ error: 'Invalid request' }, 400);
	}
  }
  
  // 游客申请友链
  async function handleApplyLink(request) {
	try {
	  const requestBody = await request.json();
	  const { siteName, siteUrl, siteIcon, description, contact } = requestBody;
	  
	  // 验证必填字段
	  if (!siteName || !siteUrl || !siteIcon) {
		return jsonResponse({ error: '网站名称、链接和图标为必填项' }, 400);
	  }
	  
	  // 验证URL格式
	  try {
		new URL(siteUrl);
	  } catch {
		return jsonResponse({ error: '无效的URL格式' }, 400);
	  }
	  
	  // 生成申请ID和时间戳
	  const applyId = generateToken();
	  const applyData = {
		id: applyId,
		siteName,
		siteUrl,
		siteIcon,
		description: description || '',
		contact: contact || '',
		status: 'pending', // pending, approved, rejected
		appliedAt: Date.now(),
		approvedAt: null,
		approvedBy: null
	  };
	  
	  // 存储到KV
	  await NAVIGATION_DATA.put(`link_apply:${applyId}`, JSON.stringify(applyData));
	  
	  return jsonResponse({ 
		message: '友链申请提交成功，等待管理员审核',
		applyId 
	  });
	} catch (error) {
	  return jsonResponse({ error: '无效的请求' }, 400);
	}
  }
  
  // 获取待审核的友链申请
  async function handleGetPendingLinks(request) {
	try {
	  const list = await NAVIGATION_DATA.list({ prefix: 'link_apply:' });
	  const pendingLinks = [];
	  
	  for (const key of list.keys) {
		const applyData = await NAVIGATION_DATA.get(key.name);
		if (applyData) {
		  const data = JSON.parse(applyData);
		  if (data.status === 'pending') {
			pendingLinks.push(data);
		  }
		}
	  }
	  
	  // 按申请时间排序
	  pendingLinks.sort((a, b) => b.appliedAt - a.appliedAt);
	  
	  return jsonResponse({ pendingLinks });
	} catch (error) {
	  return jsonResponse({ error: '获取申请列表失败' }, 500);
	}
  }
  
  // 批准友链申请
  async function handleApproveLink(request) {
	try {
	  const { applyId, categoryIndex } = await request.json();
	  
	  if (!applyId || categoryIndex === undefined) {
		return jsonResponse({ error: '申请ID和分类索引为必填项' }, 400);
	  }
	  
	  // 获取申请数据
	  const applyData = await NAVIGATION_DATA.get(`link_apply:${applyId}`);
	  if (!applyData) {
		return jsonResponse({ error: '申请不存在' }, 404);
	  }
	  
	  const apply = JSON.parse(applyData);
	  
	  if (apply.status !== 'pending') {
		return jsonResponse({ error: '申请已被处理' }, 400);
	  }
	  
	  // 获取导航数据
	  const navigationData = await getNavigationData();
	  
	  // 验证分类索引
	  if (!navigationData.categories[categoryIndex]) {
		return jsonResponse({ error: '分类不存在' }, 400);
	  }
	  
	  // 添加到指定分类
	  navigationData.categories[categoryIndex].sites.push({
		name: apply.siteName,
		url: apply.siteUrl,
		icon: apply.siteIcon
	  });
	  
	  // 更新申请状态
	  apply.status = 'approved';
	  apply.approvedAt = Date.now();
	  // 这里可以添加获取管理员信息的逻辑
	  apply.approvedBy = 'admin';
	  
	  // 保存数据
	  await setNavigationData(navigationData);
	  await NAVIGATION_DATA.put(`link_apply:${applyId}`, JSON.stringify(apply));
	  
	  return jsonResponse({ message: '友链申请已批准' });
	} catch (error) {
	  console.error('Approve link error:', error);
	  return jsonResponse({ error: '批准申请失败' }, 500);
	}
  }
  
  // 拒绝友链申请
  async function handleRejectLink(request) {
	try {
	  const { applyId } = await request.json();
	  
	  if (!applyId) {
		return jsonResponse({ error: '申请ID为必填项' }, 400);
	  }
	  
	  // 获取申请数据
	  const applyData = await NAVIGATION_DATA.get(`link_apply:${applyId}`);
	  if (!applyData) {
		return jsonResponse({ error: '申请不存在' }, 404);
	  }
	  
	  const apply = JSON.parse(applyData);
	  
	  if (apply.status !== 'pending') {
		return jsonResponse({ error: '申请已被处理' }, 400);
	  }
	  
	  // 更新申请状态
	  apply.status = 'rejected';
	  apply.approvedAt = Date.now();
	  apply.approvedBy = 'admin';
	  
	  // 保存数据
	  await NAVIGATION_DATA.put(`link_apply:${applyId}`, JSON.stringify(apply));
	  
	  return jsonResponse({ message: '友链申请已拒绝' });
	} catch (error) {
	  return jsonResponse({ error: '拒绝申请失败' }, 500);
	}
  }
  
  async function handleNotFound() {
	return new Response('Not Found', { status: 404 });
  }
  
  // 数据存储函数
  async function getNavigationData() {
	const data = await NAVIGATION_DATA.get('data');
	return data ? JSON.parse(data) : { categories: [] };
  }
  
  async function setNavigationData(data) {
	await NAVIGATION_DATA.put('data', JSON.stringify(data));
  }
  
  // 工具函数
  function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
	  status,
	  headers: { 
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	  }
	});
  }
  
  // 渲染导航页面
  async function renderNavigationPage() {
	const navigationData = await getNavigationData();
	
	return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Hangdn个人智能导航</title>
	  <link rel="icon" href="https://cdn.jsdelivr.net/gh/chnbsdan/cloudflare-workers-blog@master/themes/mya/files/hangdn.ico" type="image/x-icon">
	  <script src="https://code.iconify.design/2/2.0.3/iconify.min.js"></script>
	  <style>
		  :root {
			  --primary-color: #6366f1;
			  --secondary-color: #8b5cf6;
			  --success-color: #10b981;
			  --danger-color: #ef4444;
			  --warning-color: #f59e0b;
			  --background-color: #f8fafc;
			  --card-background: rgba(255, 255, 255, 0.85);
			  --glass-background: rgba(255, 255, 255, 0.25);
			  --glass-border: rgba(255, 255, 255, 0.18);
			  --text-primary: #1e293b;
			  --text-secondary: #64748b;
			  --border-color: rgba(255, 255, 255, 0.3);
			  --shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		  }
  
		  * {
			  margin: 0;
			  padding: 0;
			  box-sizing: border-box;
		  }
  
		  body {
			  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			  background: var(--background-color);
			  color: var(--text-primary);
			  line-height: 1.6;
			  transition: all 0.3s ease;
			  min-height: 100vh;
			  background-image: url('https://webp.hangdn.com/fg/fg1.jpg');
			  background-size: cover;
			  background-position: center;
			  background-attachment: fixed;
		  }
  
		  /* 背景容器样式 */
		  .background-container {
			  position: fixed;
			  inset: 0;
			  z-index: -2;
			  overflow: hidden;
		  }
  
		  .background-slide {
			  position: absolute;
			  inset: 0;
			  width: 100%;
			  height: 100%;
			  object-fit: cover;
			  opacity: 0;
			  transition: opacity 1.6s ease;
		  }
  
		  .background-slide.active {
			  opacity: 1;
		  }
  
		  /* 黑色遮罩层 */
		  .bg-overlay {
			  position: fixed;
			  inset: 0;
			  background: rgba(0,0,0,0.30);
			  z-index: -1;
			  pointer-events: none;
		  }
  
		  /* 移除容器限制，让内容直接显示在背景上 */
		  .container {
			  padding: 20px;
			  min-height: 100vh;
		  }
  
		  /* 头部样式 - 直接放在背景上，无背景色 */
		  .header {
			  color: white;
			  padding: 1rem 0;
			  margin-bottom: 1rem;
			  text-align: center;
			  position: relative;
			  width: 100%;
		  }
  
		  .header-content {
			  position: relative;
			  z-index: 2;
			  display: flex;
			  flex-direction: column;
			  align-items: center;
			  gap: 0.8rem;
		  }
  
		  .header-logo {
			  display: flex;
			  align-items: center;
			  gap: 0.8rem;
			  margin-bottom: 0.3rem;
			  cursor: pointer;
			  transition: all 0.3s ease;
		  }
  
		  .header-logo:hover {
			  transform: scale(1.05);
		  }
  
		  .logo-icon {
			  width: 40px;
			  height: 40px;
			  border-radius: 12px;
			  object-fit: cover;
			  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
			  transition: all 0.3s ease;
		  }
  
		  .logo-icon:hover {
			  transform: scale(1.05);
			  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
		  }
  
		  .header h1 {
			  font-size: 2rem;
			  font-weight: 800;
			  margin: 0;
			  color: white;
			  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
			  letter-spacing: 1px;
		  }
  
		  .header p {
			  font-size: 1rem;
			  opacity: 0.95;
			  font-weight: 500;
			  color: white;
			  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
			  margin: 0;
		  }
  
		  /* 返回顶部按钮 */
		  .back-to-top {
			  position: fixed;
			  bottom: 110px;
			  right: 30px;
			  width: 30px;
			  height: 30px;
			  background: #ffa500;
			  border: none;
			  border-radius: 50%;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  display: flex;
			  align-items: center;
			  justify-content: center;
			  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);
			  color: white;
			  font-size: 1.2rem;
			  z-index: 1000;
		  }
  
		  .back-to-top:hover {
			  transform: translateY(-3px);
			  box-shadow: 0 12px 35px rgba(99, 102, 241, 0.4);
		  }
  
		  /* 右下角管理员按钮 - 齿轮样式 */
		  .admin-floating-btn {
			  position: fixed;
			  bottom: 30px;
			  right: 30px;
			  z-index: 1000;
		  }
  
		  .gear-btn {
			  width: 30px;
			  height: 30px;
			  background: #87ceeb;
			  border: none;
			  border-radius: 50%;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  display: flex;
			  align-items: center;
			  justify-content: center;
			  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);
			  color: white;
			  font-size: 1.5rem;
		  }
  
		  .gear-btn:hover {
			  transform: rotate(90deg) scale(1.1);
			  box-shadow: 0 12px 35px rgba(99, 102, 241, 0.4);
		  }
  
		  .logout-btn {
			  width: 30px;
			  height: 30px;
			  background: linear-gradient(135deg, var(--danger-color), #f97316);
			  border: none;
			  border-radius: 50%;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  display: flex;
			  align-items: center;
			  justify-content: center;
			  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);
			  color: white;
			  font-size: 1.3rem;
		  }
  
		  .logout-btn:hover {
			  transform: scale(1.1);
			  box-shadow: 0 12px 35px rgba(239, 68, 68, 0.4);
		  }
  
		  /* 控制面板 - 透明背景 */
		  .control-panel {
			  background: rgba(255, 255, 255, 0.1);
			  backdrop-filter: blur(16px) saturate(180%);
			  -webkit-backdrop-filter: blur(16px) saturate(180%);
			  border: 1px solid rgba(255, 255, 255, 0.2);
			  padding: 1.2rem;
			  border-radius: 16px;
			  box-shadow: var(--shadow);
			  margin-bottom: 2rem;
			  display: none;
			  justify-content: space-between;
			  align-items: center;
			  flex-wrap: wrap;
			  gap: 1rem;
			  width: 100%;
			  max-width: 1200px;
			  margin-left: auto;
			  margin-right: auto;
		  }
  
		  .control-panel.active {
			  display: flex;
		  }
  
		  .auth-section {
			  display: flex;
			  gap: 0.8rem;
			  align-items: center;
		  }
  
		  .btn {
			  padding: 0.6rem 1.2rem;
			  border: none;
			  border-radius: 12px;
			  font-weight: 600;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  display: inline-flex;
			  align-items: center;
			  gap: 0.5rem;
			  text-decoration: none;
			  font-size: 0.9rem;
		  }
  
		  .btn-primary {
			  background: var(--primary-color);
			  color: white;
		  }
  
		  .btn-primary:hover {
			  transform: translateY(-2px);
			  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
		  }
  
		  .btn-danger {
			  background: var(--danger-color);
			  color: white;
		  }
  
		  .btn-success {
			  background: var(--success-color);
			  color: white;
		  }
  
		  .btn-warning {
			  background: var(--warning-color);
			  color: white;
		  }
  
		  /* 分类样式 - 半透明毛玻璃 */
		  .category {
			  background: rgba(255, 255, 255, 0.15);
			  backdrop-filter: blur(16px) saturate(180%);
			  -webkit-backdrop-filter: blur(16px) saturate(180%);
			  border: 1px solid rgba(255, 255, 255, 0.2);
			  border-radius: 20px;
			  padding: 1.5rem;
			  margin-bottom: 1.5rem;
			  box-shadow: var(--shadow);
			  transition: all 0.3s ease;
			  width: 100%;
			  max-width: 1200px;
			  margin-left: auto;
			  margin-right: auto;
		  }
  
		  .category:hover {
			  transform: translateY(-5px);
			  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
			  border-color: rgba(255, 255, 255, 0.4);
			  background: rgba(255, 255, 255, 0.2);
		  }
  
		  .category-header {
			  display: flex;
			  justify-content: space-between;
			  align-items: center;
			  margin-bottom: 1.2rem;
			  padding-bottom: 0.8rem;
			  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
		  }
  
		  .category-title {
			  font-size: 1.5rem;
			  font-weight: 700;
			  color: white;
			  display: flex;
			  align-items: center;
			  gap: 0.5rem;
			  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
		  }
  
		  .category-actions {
			  display: flex;
			  gap: 0.5rem;
		  }
  
		  .icon-btn {
			  background: rgba(255, 255, 255, 0.2);
			  border: 1px solid rgba(255, 255, 255, 0.3);
			  padding: 0.5rem;
			  border-radius: 10px;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  color: white;
			  backdrop-filter: blur(10px);
			  -webkit-backdrop-filter: blur(10px);
		  }
  
		  .icon-btn:hover {
			  background: rgba(255, 255, 255, 0.3);
			  transform: scale(1.1);
		  }
  
		  /* 站点网格 */
		  .sites-grid {
			  display: grid;
			  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			  gap: 1.2rem;
		  }
  
		  .site-card {
			  background: rgba(255, 255, 255, 0.2);
			  backdrop-filter: blur(16px) saturate(180%);
			  -webkit-backdrop-filter: blur(16px) saturate(180%);
			  border: 1px solid rgba(255, 255, 255, 0.3);
			  border-radius: 16px;
			  padding: 1.2rem 0.8rem;
			  text-align: center;
			  transition: all 0.3s ease;
			  position: relative;
			  cursor: pointer;
		  }
  
		  .site-card:hover {
			  transform: translateY(-8px);
			  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
			  border-color: var(--primary-color);
			  background: rgba(255, 255, 255, 0.3);
		  }
  
		  .site-icon {
			  width: 56px;
			  height: 56px;
			  margin: 0 auto 0.8rem;
			  display: flex;
			  align-items: center;
			  justify-content: center;
			  color: white;
			  font-size: 2rem;
			  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));
		  }
  
		  .site-icon img {
			  width: 32px;
			  height: 32px;
			  object-fit: contain;
			  border-radius: 8px;
		  }
  
		  .site-name {
			  font-weight: 600;
			  color: white;
			  margin-bottom: 0.3rem;
			  font-size: 0.9rem;
			  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
		  }
  
		  .site-url {
			  font-size: 0.75rem;
			  color: rgba(255, 255, 255, 0.8);
			  word-break: break-all;
			  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
		  }
  
		  .site-actions {
			  position: absolute;
			  top: 0.5rem;
			  right: 0.5rem;
			  display: flex;
			  gap: 0.25rem;
			  opacity: 0;
			  transition: opacity 0.3s ease;
		  }
  
		  .site-card:hover .site-actions {
			  opacity: 1;
		  }
  
		  /* 模态框 - 毛玻璃 */
		  .modal {
			  display: none;
			  position: fixed;
			  top: 0;
			  left: 0;
			  width: 100%;
			  height: 100%;
			  background: rgba(0, 0, 0, 0.5);
			  backdrop-filter: blur(8px);
			  -webkit-backdrop-filter: blur(8px);
			  z-index: 2000;
			  align-items: center;
			  justify-content: center;
		  }
  
		  .modal-content {
			  background: var(--card-background);
			  backdrop-filter: blur(16px) saturate(180%);
			  -webkit-backdrop-filter: blur(16px) saturate(180%);
			  border: 1px solid var(--glass-border);
			  border-radius: 24px;
			  padding: 2rem;
			  max-width: 450px;
			  width: 90%;
			  max-height: 90vh;
			  overflow-y: auto;
			  box-shadow: var(--shadow);
			  animation: modalSlideIn 0.3s ease;
		  }
  
		  @keyframes modalSlideIn {
			  from {
				  opacity: 0;
				  transform: translateY(-50px) scale(0.9);
			  }
			  to {
				  opacity: 1;
				  transform: translateY(0) scale(1);
			  }
		  }
  
		  .modal-header {
			  display: flex;
			  justify-content: space-between;
			  align-items: center;
			  margin-bottom: 1.5rem;
		  }
  
		  .modal-title {
			  font-size: 1.3rem;
			  font-weight: 700;
			  color: var(--text-primary);
		  }
  
		  .close-btn {
			  background: none;
			  border: none;
			  font-size: 1.5rem;
			  cursor: pointer;
			  color: var(--text-secondary);
			  padding: 0.25rem;
			  border-radius: 6px;
			  transition: all 0.3s ease;
		  }
  
		  .close-btn:hover {
			  background: rgba(255, 255, 255, 0.2);
			  color: var(--text-primary);
		  }
  
		  /* 表单样式 */
		  .form-group {
			  margin-bottom: 1.2rem;
		  }
  
		  .form-label {
			  display: block;
			  margin-bottom: 0.5rem;
			  font-weight: 600;
			  color: var(--text-primary);
			  font-size: 0.9rem;
		  }
  
		  .form-input {
			  width: 100%;
			  padding: 0.7rem 1rem;
			  border: 1px solid var(--glass-border);
			  border-radius: 12px;
			  font-size: 0.9rem;
			  transition: all 0.3s ease;
			  background: rgba(255, 255, 255, 0.1);
			  color: var(--text-primary);
			  backdrop-filter: blur(10px);
			  -webkit-backdrop-filter: blur(10px);
		  }
  
		  .form-input:focus {
			  outline: none;
			  border-color: var(--primary-color);
			  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
			  background: rgba(255, 255, 255, 0.15);
		  }
  
		  .form-select {
			  appearance: none;
			  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
			  background-repeat: no-repeat;
			  background-position: right 1rem center;
			  background-size: 1rem;
		  }
  
		  /* 响应式设计 */
		  @media (max-width: 768px) {
			  .header {
				  padding: 0.8rem 0;
			  }
			  
			  .header h1 {
				  font-size: 1.6rem;
			  }
			  
			  .header p {
				  font-size: 0.9rem;
			  }
			  
			  .logo-icon {
				  width: 35px;
				  height: 35px;
			  }
			  
			  .header-logo {
				  gap: 0.6rem;
			  }
		  }
  
		  @media (max-width: 480px) {
			  .header h1 {
				  font-size: 1.4rem;
			  }
			  
			  .header p {
				  font-size: 0.8rem;
			  }
			  
			  .logo-icon {
				  width: 30px;
				  height: 30px;
			  }
			  
			  .header-logo {
				  gap: 0.5rem;
			  }
		  }
  
		  /* 工具类 */
		  .hidden {
			  display: none !important;
		  }
  
		  .text-center {
			  text-align: center;
		  }
  
		  .mb-4 {
			  margin-bottom: 2rem;
		  }
  
		  /* 空状态样式 */
		  .empty-state {
			  text-align: center;
			  padding: 3rem 2rem;
			  color: rgba(255, 255, 255, 0.8);
		  }
  
		  .empty-state .iconify {
			  font-size: 4rem;
			  margin-bottom: 1rem;
			  opacity: 0.5;
			  color: white;
		  }
  
		  /* ===== 播放器面板（点击胶囊展开） ===== */
		  #player-wrap {
			  position: fixed;
			  left: 18px;
			  bottom: 92px;
			  width: 360px;
			  max-width: calc(100% - 36px);
			  z-index: 15000;
			  display: none;
			  transform-origin: left bottom;
		  }
		  #player-wrap.show {
			  display: block;
			  animation: popIn .18s ease;
		  }
		  @keyframes popIn {
			  from { opacity: 0; transform: scale(.96) }
			  to { opacity: 1; transform: scale(1) }
		  }
  
		  /* APlayer 微调样式 */
		  .aplayer { 
			  border-radius: 12px !important; 
			  overflow: hidden !important; 
		  }
		  .aplayer .aplayer-lrc p { 
			  color: orange !important; 
			  font-weight: 700; 
		  }
  
		  /* ===== 音乐播放器样式修改 ===== */
		  /* 顶部歌曲名改为黑色 */
		  .aplayer .aplayer-info .aplayer-music .aplayer-title {
			  color: #000 !important;
			  font-weight: bold;
		  }
  
		  /* 播放列表歌名改为黑色 */
		  .aplayer .aplayer-list ol li {
			  color: #000 !important;
		  }
  
		  .aplayer .aplayer-list ol li .aplayer-list-title {
			  color: #000 !important;
		  }
  
		  /* 歌词改为橙色 */
		  .aplayer .aplayer-lrc p {
			  color: #ff8c00 !important;
		  }
  
		  .aplayer .aplayer-lrc p.aplayer-lrc-current {
			  color: #ff4500 !important;
			  font-weight: bold;
			  font-size: 16px;
		  }
  
		  /* 播放器整体样式调整 */
		  .aplayer {
			  background: rgba(255, 255, 255, 0.9) !important;
			  border-radius: 12px;
			  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		  }
  
		  .aplayer .aplayer-info {
			  border-top: none;
			  padding: 12px 15px 8px;
		  }
  
		  .aplayer .aplayer-list ol li {
			  border-top: 1px solid rgba(0, 0, 0, 0.1);
		  }
  
		  .aplayer .aplayer-list ol li:hover {
			  background: rgba(0, 0, 0, 0.05);
		  }
  
		  .aplayer .aplayer-list ol li.aplayer-list-light {
			  background: rgba(255, 140, 0, 0.1);
		  }
  
		  /* ===== 独立歌词显示 - 新增逐步推进效果 ===== */
		  #floating-lyrics {
			  position: fixed;
			  left: 100px;
			  bottom: 50px;
			  text-align: left;
			  z-index: 99999;
			  color: #ff8c00;
			  font-size: 18px;
			  font-weight: bold;
			  text-shadow: 2px 2px 12px rgba(0, 0, 0, 0.9);
			  background: rgba(255, 255, 255, 0.10);
			  padding: 15px 20px;
			  border-radius: 12px;
			  backdrop-filter: blur(20px) saturate(180%);
			  -webkit-backdrop-filter: blur(20px) saturate(180%);
			  max-width: 400px;
			  opacity: 0;
			  transition: opacity 0.3s ease;
			  border: 1px solid rgba(255, 255, 255, 0.1);
			  box-shadow: 
				  0 8px 32px rgba(0, 0, 0, 0.1),
				  inset 0 1px 0 rgba(255, 255, 255, 0.2);
			  pointer-events: none;
		  }
  
		  #floating-lyrics.show {
			  opacity: 1;
		  }
  
		  #floating-lyrics .current-line {
			  color: #ff4500;
			  font-size: 30px;
			  margin-bottom: 8px;
			  font-weight: bold;
			  min-height: 24px;
			  overflow: hidden;
			  position: relative;
		  }
  
		  #floating-lyrics .next-line {
			  color: #ff8c00;
			  font-size: 14px;
			  opacity: 0.8;
			  min-height: 18px;
		  }
  
		  /* 新增：逐字推进效果 */
		  #floating-lyrics .current-line .typing-text {
			  display: inline-block;
			  overflow: hidden;
			  white-space: nowrap;
			  animation: typing 2s steps(40, end), blink-caret 0.75s step-end infinite;
			  border-right: 2px solid #ff4500;
			  animation-fill-mode: both;
		  }
  
		  #floating-lyrics .current-line .fade-in-text {
			  opacity: 0;
			  animation: fadeIn 0.5s ease-in forwards;
		  }
  
		  /* 打字机效果动画 */
		  @keyframes typing {
			  from { width: 0 }
			  to { width: 100% }
		  }
  
		  @keyframes blink-caret {
			  from, to { border-color: transparent }
			  50% { border-color: #ff4500 }
		  }
  
		  @keyframes fadeIn {
			  from { opacity: 0; transform: translateX(20px); }
			  to { opacity: 1; transform: translateX(0); }
		  }
  
		  /* ===== 音乐胶囊（固定左下） ===== */
		  #music-capsule{position:fixed;left:22px;bottom:96px;width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:30000;background:radial-gradient(circle at 30% 30%, #00c3ff,#0061ff);box-shadow:0 8px 28px rgba(0,180,255,0.12)}
		  #music-capsule img{width:64%;height:64%;border-radius:50%;object-fit:cover;transition:transform .3s}
		  #music-capsule.playing{background:radial-gradient(circle at 30% 30%, #ff9500,#ff5e00);box-shadow:0 8px 28px rgba(255,140,0,0.28)}
		  #music-capsule.playing img{animation:spin 6s linear infinite}
		  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  
		  /* ===== 右键菜单（毛玻璃半透明） ===== */
		  #right-menu{position:fixed;display:none;z-index:40000;min-width:220px;background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.35);padding:6px 0;opacity:0;transform:scale(.98);transition:opacity .12s,transform .12s}
		  #right-menu.show{display:flex;opacity:1;transform:scale(1);flex-direction:column}
		  #right-menu li{list-style:none;padding:10px 16px;cursor:pointer;white-space:nowrap;font-weight:700;transition:background .12s}
		  #right-menu li:hover{background:rgba(255,255,255,0.14);color:#000;border-radius:6px}
		  #right-menu::after{content:"";position:absolute;top:-8px;left:var(--arrow-left,24px);transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:8px solid rgba(255,255,255,0.12)}
  
		  /* ===== 响应式（竖屏/移动端） ===== */
		  @media (max-width:900px){
			  #music-capsule{left:18px;bottom:22px}
			  #player-wrap{left:12px;bottom:84px;width:calc(100% - 24px)}
			  #floating-lyrics {
				  left: 90px;
				  bottom: 30px;
				  max-width: 250px;
				  font-size: 16px;
			  }
			  #floating-lyrics .current-line {
				  font-size: 18px;
			  }
			  #floating-lyrics .next-line {
				  font-size: 12px;
			  }
		  }
  
		  /* 方案二：拟物黑胶风 */
		  .vinyl-arm {
			  position: absolute;
			  top: -30px;
			  left: 50%;
			  transform: translateX(-50%);
			  width: 90px;
			  height: 70px;
			  z-index: 10;
			  pointer-events: none;
			  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
		  }
  
		  .arm-base {
			  position: absolute;
			  top: 0;
			  left: 50%;
			  transform: translateX(-50%);
			  width: 16px;
			  height: 25px;
			  background: linear-gradient(135deg, #8b8b8b, #4a4a4a, #8b8b8b);
			  border-radius: 4px 4px 2px 2px;
			  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
			  border: 1px solid #5a5a5a;
		  }
  
		  .arm-rod {
			  position: absolute;
			  top: 25px;
			  left: 50%;
			  width: 3px;
			  height: 45px;
			  background: linear-gradient(to bottom, #c0c0c0, #808080, #505050);
			  transform-origin: top center;
			  transform: translateX(-50%) rotate(-25deg);
			  transition: transform 0.8s cubic-bezier(0.34, 1.2, 0.64, 1);
			  border-radius: 1px;
		  }
  
		  .arm-head {
			  position: absolute;
			  bottom: 0;
			  left: 50%;
			  width: 12px;
			  height: 12px;
			  background: linear-gradient(135deg, #333, #000);
			  border-radius: 50%;
			  transform: translateX(-50%);
			  box-shadow: 0 1px 6px rgba(0,0,0,0.6), 
						  inset 0 1px 1px rgba(255,255,255,0.2);
			  border: 1px solid #000;
		  }
  
		  /* 播放状态 */
		  #music-capsule.playing .vinyl-arm .arm-rod {
			  transform: translateX(-50%) rotate(25deg);
		  }
  
		  /* 金属光泽细节 */
		  .arm-rod::before {
			  content: '';
			  position: absolute;
			  top: 0;
			  left: 0;
			  width: 100%;
			  height: 100%;
			  background: linear-gradient(90deg, 
						  transparent, 
						  rgba(255,255,255,0.3), 
						  transparent);
			  border-radius: 1px;
		  }
  
		  /* 待审批友链列表样式 */
		  .pending-link-item {
			  background: rgba(255, 255, 255, 0.1);
			  border-radius: 12px;
			  padding: 1rem;
			  margin-bottom: 1rem;
			  border: 1px solid rgba(255, 255, 255, 0.2);
		  }
  
		  .pending-link-item h4 {
			  color: white;
			  margin: 0;
		  }
  
		  .pending-link-item p {
			  color: rgba(255, 255, 255, 0.8);
			  margin: 0.5rem 0;
		  }
  
		  /* 申请友链按钮样式 */
		  .apply-link-btn {
			  width: 30px;
			  height: 30px;
			  background: linear-gradient(135deg, var(--success-color), #22c55e);
			  border: none;
			  border-radius: 50%;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  display: flex;
			  align-items: center;
			  justify-content: center;
			  box-shadow: 0 8px 25px rgba(34, 197, 94, 0.3);
			  color: white;
			  font-size: 1.5rem;
		  }
  
		  .apply-link-btn:hover {
			  transform: scale(1.1);
			  box-shadow: 0 12px 35px rgba(34, 197, 94, 0.4);
		  }
  
		  /* 页脚样式 */
		  .footer {
			  position: fixed;
			  bottom: 0;
			  left: 0;
			  width: 100%;
			  text-align: center;
			  padding: 1rem 0;
			  z-index: 100;
		  }
  
		  .footer-content {
			  color: rgba(255, 255, 255, 0.8);
			  font-size: 0.9rem;
			  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
		  }
  
		  /* 右上角日期时间显示 */
		  .datetime-display {
			  position: fixed;
			  top: 20px;
			  right: 20px;
			  text-align: right;
			  z-index: 100;
			  color: white;
			  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
			  background: rgba(255, 255, 255, 0.1);
			  backdrop-filter: blur(10px);
			  -webkit-backdrop-filter: blur(10px);
			  padding: 12px 16px;
			  border-radius: 12px;
			  border: 1px solid rgba(255, 255, 255, 0.2);
			  min-width: 140px;
		  }
  
		  .date-text {
			  font-size: 0.9rem;
			  font-weight: 600;
			  margin-bottom: 4px;
			  color: rgba(255, 255, 255, 0.9);
		  }
  
		  .time-text {
			  font-size: 1.4rem;
			  font-weight: 700;
			  color: white;
			  font-family: 'Courier New', monospace;
		  }
  
		  /* 响应式设计 */
		  @media (max-width: 768px) {
			  .datetime-display {
				  top: 15px;
				  right: 15px;
				  padding: 10px 12px;
				  min-width: 120px;
			  }
			  
			  .date-text {
				  font-size: 0.8rem;
			  }
			  
			  .time-text {
				  font-size: 1.2rem;
			  }
			  
			  .footer {
				  padding: 0.8rem 0;
			  }
			  
			  .footer-content {
				  font-size: 0.8rem;
			  }
		  }
  
		  @media (max-width: 480px) {
			  .datetime-display {
				  top: 10px;
				  right: 10px;
				  padding: 8px 10px;
				  min-width: 100px;
			  }
			  
			  .date-text {
				  font-size: 0.7rem;
			  }
			  
			  .time-text {
				  font-size: 1rem;
			  }
		  }
  
		  /* 页脚链接样式 */
		  .footer-link {
			  color: rgba(255, 255, 255, 0.9);
			  text-decoration: none;
			  transition: all 0.3s ease;
			  padding-bottom: 1px;
			  cursor: pointer;
		  }
  
		  .footer-link:hover {
			  color: white;
			  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
		  }
  
		  .footer a:hover {
			  color: rgba(255, 255, 255, 1);
		  }
  
		  /* 关于本站模态框样式 */
		  .footer-link-section {
			  background: #0066cc;
			  backdrop-filter: blur(10px);
			  border-radius: 12px;
			  padding: 1.2rem;
			  border: 1px solid rgba(255, 255, 255, 0.2);
			  margin-bottom: 1.5rem;
		  }
  
		  .footer-link-section h4 {
			  color: #4CAF50;
			  margin-bottom: 0.8rem;
			  font-size: 1rem;
			  display: flex;
			  align-items: center;
			  gap: 0.5rem;
		  }
  
		  .footer-link-list {
			  list-style: none;
			  padding: 0;
			  margin: 0;
		  }
  
		  .footer-link-list li {
			  margin-bottom: 0.5rem;
		  }
  
		  .footer-link-list a {
			  color: rgba(255, 255, 255, 0.8);
			  text-decoration: none;
			  font-size: 0.85rem;
			  transition: all 0.3s ease;
			  display: flex;
			  align-items: center;
			  gap: 0.4rem;
		  }
  
		  .footer-link-list a:hover {
			  color: white;
			  transform: translateX(5px);
		  }
  
		  /* 搜索按钮样式 */
		  .search-engine-btn {
			  background: #4CAF50;
			  border: 1px solid rgba(255, 255, 255, 0.3);
			  border-radius: 12px;
			  padding: 1rem 0.5rem;
			  color: white;
			  cursor: pointer;
			  transition: all 0.3s ease;
			  display: flex;
			  flex-direction: column;
			  align-items: center;
			  gap: 0.5rem;
			  backdrop-filter: blur(10px);
		  }
  
		  .search-engine-btn:hover {
			  background: rgba(76, 175, 80, 0.5);
			  transform: translateY(-2px);
			  border-color: var(--primary-color);
		  }
  
		  .search-engine-btn span:last-child {
			  font-size: 0.85rem;
			  font-weight: 600;
		  }
	  </style>
  </head>
  <body>
	  <!-- 背景容器 -->
	  <div class="background-container">
		  <img src="https://webp.hangdn.com/fg/fg1.jpg" class="background-slide active" alt="bg1">
		  <img src="https://webp.hangdn.com/fg/fg2.jpg" class="background-slide" alt="bg2">
		  <img src="https://webp.hangdn.com/fg/yk5.jpg" class="background-slide" alt="bg3">
		  <img src="https://pan.hangdn.com/raw/img/352347587.jpg" class="background-slide" alt="bg4">
		  <img src="https://pan.hangdn.com/raw/img/377786273.jpg" class="background-slide" alt="bg5">
		  <img src="https://webp.hangdn.com/fg/fj22.jpg" class="background-slide" alt="bg6">
		  <img src="https://webp.hangdn.com/fg/yk1.jpg" class="background-slide" alt="bg7">
		  <img src="https://webp.hangdn.com/fg/yk2.jpg" class="background-slide" alt="bg8">
		  <img src="https://webp.hangdn.com/fg/yk3.jpg" class="background-slide" alt="bg9">
		  <img src="https://webp.hangdn.com/fg/sh3.jpg" class="background-slide" alt="bg10">
		  <img src="https://webp.hangdn.com/fg/sh2.jpg" class="background-slide" alt="bg11">
		  <img src="https://webp.hangdn.com/fg/sh1.jpg" class="background-slide" alt="bg12">
		  <img src="https://webp.hangdn.com/fg/bj1.jpg" class="background-slide" alt="bg13"> 
	  </div>
  
	  <!-- 黑色遮罩层 -->
	  <div class="bg-overlay"></div>
  
	  <!-- 右上角日期时间显示 -->
	  <div class="datetime-display">
		  <div id="currentDate" class="date-text"></div>
		  <div id="currentTime" class="time-text"></div>
	  </div>
  
	  <!-- 独立歌词显示 -->
	  <div id="floating-lyrics">
		  <div class="current-line"></div>
		  <div class="next-line"></div>
	  </div>
  
	  <!-- 音乐胶囊 -->
	  <div id="music-capsule" title="点击展开音乐播放器">
		  <img id="capsule-cover" src="https://p2.music.126.net/4HGEnXVexEfF2M4WdDdfrQ==/109951166354363385.jpg" alt="capsule cover">
		  <!-- 新增的黑胶唱片滑动杆 -->
		  <div class="vinyl-arm">
			  <div class="arm-base"></div>
			  <div class="arm-rod"></div>
			  <div class="arm-head"></div>
		  </div>
	  </div>
  
	  <!-- 播放器容器（Meting 会在这里渲染 APlayer） -->
	  <div id="player-wrap" aria-hidden="true">
		  <div id="aplayer-container"></div>
	  </div>
  
	  <!-- 右键菜单（毛玻璃） -->
	  <ul id="right-menu" role="menu" aria-hidden="true">
		  <li id="menu-play">▶ 播放 / 暂停</li>
		  <li id="menu-prev">⏮ 上一首</li>
		  <li id="menu-next">⏭ 下一首</li>
		  <li id="menu-volup">🔊 音量 +</li>
		  <li id="menu-voldown">🔉 音量 -</li>
		  <li id="menu-lyrics">📜 显示/隐藏歌词</li>
		  <li id="menu-support">💡 技术支持</li>
		  <li id="menu-fullscreen">🖥️ 全屏模式</li>
		  <li id="menu-close">❌ 关闭播放器</li>
	  </ul>    
  
	  <!-- 引入 APlayer 和 Meting.js -->
	  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css">
	  <script src="https://unpkg.com/meting@2.0.1/dist/Meting.min.js"></script>
	  <script src="https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js"></script>
  
	  <div class="container">
		  <!-- 头部 - 直接放在背景上 -->
		  <header class="header">
			  <div class="header-content">
				  <div class="header-logo" onclick="openSearchModal()" title="点击搜索">
					  <img src="https://cdn.jsdelivr.net/gh/chnbsdan/cloudflare-workers-blog@master/themes/mya/files/hangdn.ico" 
						   alt="导航图标" 
						   class="logo-icon">
					  <h1>Hangdn nav</h1>
				  </div>
				  <p>高效组织你的网络世界</p>
			  </div>
		  </header>
  
		  <!-- 控制面板 - 登录后显示 -->
		  <div class="control-panel" id="controlPanel">
			  <div class="auth-section">
				  <button class="btn btn-success" onclick="openAddCategoryModal()">
					  <span class="iconify" data-icon="mdi:plus"></span>
					  添加分类
				  </button>
				  <button class="btn btn-primary" onclick="openAddSiteModal()">
					  <span class="iconify" data-icon="mdi:web-plus"></span>
					  添加网站
				  </button>
				  <!-- 新增审批按钮 -->
				  <button class="btn btn-warning" onclick="openApproveLinksModal()" id="approveLinksBtn">
					  <span class="iconify" data-icon="mdi:account-check"></span>
					  审批友链
				  </button>
			  </div>
		  </div>
  
		  <!-- 分类和网站内容 -->
		  <div id="content"></div>
	  </div>
  
	  <!-- 返回顶部按钮 -->
	  <button class="back-to-top" onclick="scrollToTop()" title="返回顶部">
		  <span class="iconify" data-icon="mdi:chevron-up"></span>
	  </button>
  
	  <!-- 右下角管理员按钮 - 齿轮样式 -->
	  <div class="admin-floating-btn">
		  <button class="gear-btn" id="adminBtn" onclick="openLoginModal()" title="管理员登录">
			  <span class="iconify" data-icon="mdi:cog"></span>
		  </button>
		  <button class="logout-btn hidden" id="logoutBtn" onclick="logout()" title="退出登录">
			  <span class="iconify" data-icon="mdi:logout"></span>
		  </button>
  
		  <!-- 新增申请友链按钮 -->
		  <button class="apply-link-btn" onclick="openApplyLinkModal()" title="申请友链" style="margin-top: 10px;">
			  <span class="iconify" data-icon="mdi:link-plus"></span>
		  </button>
	  </div>
  
	  <!-- 登录模态框 -->
	  <div id="loginModal" class="modal">
		  <div class="modal-content">
			  <div class="modal-header">
				  <h3 class="modal-title">管理员登录</h3>
				  <button class="close-btn" onclick="closeLoginModal()">&times;</button>
			  </div>
			  <form id="loginForm">
				  <div class="form-group">
					  <label class="form-label">密码</label>
					  <input type="password" class="form-input" id="password" placeholder="请输入管理员密码" required>
				  </div>
				  <button type="submit" class="btn btn-primary" style="width: 100%;">
					  <span class="iconify" data-icon="mdi:login"></span>
					  登录
				  </button>
			  </form>
		  </div>
	  </div>
  
	  <!-- 添加分类模态框 -->
	  <div id="addCategoryModal" class="modal">
		  <div class="modal-content">
			  <div class="modal-header">
				  <h3 class="modal-title">添加分类</h3>
				  <button class="close-btn" onclick="closeAddCategoryModal()">&times;</button>
			  </div>
			  <form id="addCategoryForm">
				  <div class="form-group">
					  <label class="form-label">分类名称</label>
					  <input type="text" class="form-input" name="name" placeholder="请输入分类名称" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">主题颜色</label>
					  <input type="color" class="form-input" name="color" value="#6366f1" style="height: 50px;">
				  </div>
				  <button type="submit" class="btn btn-success" style="width: 100%;">
					  <span class="iconify" data-icon="mdi:check"></span>
					  添加分类
				  </button>
			  </form>
		  </div>
	  </div>
  
	  <!-- 添加网站模态框 -->
	  <div id="addSiteModal" class="modal">
		  <div class="modal-content">
			  <div class="modal-header">
				  <h3 class="modal-title">添加网站</h3>
				  <button class="close-btn" onclick="closeAddSiteModal()">&times;</button>
			  </div>
			  <form id="addSiteForm">
				  <div class="form-group">
					  <label class="form-label">选择分类</label>
					  <select class="form-input form-select" name="categoryIndex" required>
						  <!-- 动态填充 -->
					  </select>
				  </div>
				  <div class="form-group">
					  <label class="form-label">网站名称</label>
					  <input type="text" class="form-input" name="siteName" placeholder="请输入网站名称" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">网站链接</label>
					  <input type="url" class="form-input" name="siteUrl" placeholder="https://example.com" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">图标代码</label>
					  <input type="text" class="form-input" name="siteIcon" placeholder="例如: mdi:github 或 https://example.com/icon.ico" required>
					  <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
						  支持 Iconify 图标代码或外部图标链接
					  </small>
				  </div>
				  <button type="submit" class="btn btn-success" style="width: 100%;">
					  <span class="iconify" data-icon="mdi:check"></span>
					  添加网站
				  </button>
			  </form>
		  </div>
	  </div>
  
	  <!-- 编辑网站模态框 -->
	  <div id="editSiteModal" class="modal">
		  <div class="modal-content">
			  <div class="modal-header">
				  <h3 class="modal-title">编辑网站</h3>
				  <button class="close-btn" onclick="closeEditSiteModal()">&times;</button>
			  </div>
			  <form id="editSiteForm">
				  <input type="hidden" name="currentCategoryIndex" id="currentCategoryIndex">
				  <input type="hidden" name="siteIndex" id="siteIndex">
				  <div class="form-group">
					  <label class="form-label">选择分类</label>
					  <select class="form-input form-select" name="categoryIndex" id="editCategoryIndex" required>
						  <!-- 动态填充 -->
					  </select>
				  </div>
				  <div class="form-group">
					  <label class="form-label">网站名称</label>
					  <input type="text" class="form-input" name="siteName" id="editSiteName" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">网站链接</label>
					  <input type="url" class="form-input" name="siteUrl" id="editSiteUrl" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">图标代码</label>
					  <input type="text" class="form-input" name="siteIcon" id="editSiteIcon" required>
				  </div>
				  <button type="submit" class="btn btn-primary" style="width: 100%;">
					  <span class="iconify" data-icon="mdi:content-save"></span>
					  保存修改
				  </button>
			  </form>
		  </div>
	  </div>
  
	  <!-- 友链申请模态框 -->
	  <div id="applyLinkModal" class="modal">
		  <div class="modal-content">
			  <div class="modal-header">
				  <h3 class="modal-title">申请友链</h3>
				  <button class="close-btn" onclick="closeApplyLinkModal()">&times;</button>
			  </div>
			  <form id="applyLinkForm">
				  <div class="form-group">
					  <label class="form-label">网站名称</label>
					  <input type="text" class="form-input" name="siteName" placeholder="请输入网站名称" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">网站链接</label>
					  <input type="url" class="form-input" name="siteUrl" placeholder="https://example.com" required>
				  </div>
				  <div class="form-group">
					  <label class="form-label">图标代码</label>
					  <input type="text" class="form-input" name="siteIcon" placeholder="例如: mdi:github 或 https://example.com/icon.ico" required>
					  <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
						  支持 Iconify 图标代码或外部图标链接
					  </small>
				  </div>
				  <div class="form-group">
					  <label class="form-label">网站描述</label>
					  <textarea class="form-input" name="description" placeholder="请输入网站描述（可选）" rows="3"></textarea>
				  </div>
				  <div class="form-group">
					  <label class="form-label">联系方式</label>
					  <input type="text" class="form-input" name="contact" placeholder="邮箱或QQ等（可选）">
				  </div>
				  <button type="submit" class="btn btn-success" style="width: 100%;">
					  <span class="iconify" data-icon="mdi:send"></span>
					  提交申请
				  </button>
			  </form>
		  </div>
	  </div>
  
	  <!-- 友链审批模态框 -->
	  <div id="approveLinksModal" class="modal">
		  <div class="modal-content" style="max-width: 800px;">
			  <div class="modal-header">
				  <h3 class="modal-title">待审批友链</h3>
				  <button class="close-btn" onclick="closeApproveLinksModal()">&times;</button>
			  </div>
			  <div id="pendingLinksList" style="max-height: 400px; overflow-y: auto;">
				  <!-- 动态填充待审批列表 -->
			  </div>
		  </div>
	  </div>
  
	  <!-- 搜索模态框 -->
	  <div id="searchModal" class="modal">
		  <div class="modal-content" style="max-width: 600px;">
			  <div class="modal-header">
				  <h3 class="modal-title">快速搜索</h3>
				  <button class="close-btn" onclick="closeSearchModal()">&times;</button>
			  </div>
			  <div style="padding: 1rem 0;">
				  <div class="form-group">
					  <input type="text" class="form-input" id="searchInput" placeholder="请输入搜索内容" style="font-size: 1.1rem; padding: 1rem;">
				  </div>
				  <div class="search-engines-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
					  <button class="search-engine-btn" onclick="performSearch('https://www.baidu.com/s?word=')">
						  <span class="iconify" data-icon="simple-icons:baidu" style="font-size: 2rem;"></span>
						  <span>百度</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://www.sogou.com/web?query=')">
						  <span class="iconify" data-icon="simple-icons:sogou" style="font-size: 2rem;"></span>
						  <span>搜狗</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://cn.bing.com/search?q=')">
						  <span class="iconify" data-icon="simple-icons:microsoftbing" style="font-size: 2rem;"></span>
						  <span>必应</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://www.zhihu.com/search?q=')">
						  <span class="iconify" data-icon="simple-icons:zhihu" style="font-size: 2rem;"></span>
						  <span>知乎</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://search.bilibili.com/all?keyword=')">
						  <span class="iconify" data-icon="simple-icons:bilibili" style="font-size: 2rem;"></span>
						  <span>哔哩哔哩</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://s.weibo.com/weibo/')">
						  <span class="iconify" data-icon="simple-icons:sinaweibo" style="font-size: 2rem;"></span>
						  <span>微博</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://www.google.com/search?q=')">
						  <span class="iconify" data-icon="simple-icons:google" style="font-size: 2rem;"></span>
						  <span>谷歌</span>
					  </button>
					  <button class="search-engine-btn" onclick="performSearch('https://fanyi.baidu.com/#auto/zh/')">
						  <span class="iconify" data-icon="mdi:translate" style="font-size: 2rem;"></span>
						  <span>翻译</span>
					  </button>
				  </div>
			  </div>
		  </div>
	  </div>
  
	  <!-- 页脚版权信息 -->
	  <footer class="footer">
		  <div class="footer-content">
			  <p>Copyright ©2024-2025 <span class="footer-link" onclick="openAboutModal()">Hangdn nav</span>. All Rights Reserved.</p>
		  </div>
	  </footer>
  
	  <!-- 关于本站模态框 -->
	  <div id="aboutModal" class="modal">
		  <div class="modal-content" style="max-width: 700px;">
			  <div class="modal-header">
				  <h3 class="modal-title">关于本站</h3>
				  <button class="close-btn" onclick="closeAboutModal()">&times;</button>
			  </div>
			  <div style="max-height: 70vh; overflow-y: auto; padding: 1rem 0;">
				  <!-- 关于本站 -->
				  <div class="footer-link-section" style="margin-bottom: 2rem;">
					  <h4>
						  <span class="iconify" data-icon="mdi:information"></span>
						  关于本站
					  </h4>
					  <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.6; font-size: 0.95rem;">
						  <p>感谢来访，本站致力于简洁高效的上网导航和搜索入口，安全快捷。</p>
                                                                                                  <p>搜索入口正常网页中看不到，为隐藏设计，需要用鼠标点击本站LOGO图标就会弹出搜索框。</p>
						  <p>如果您喜欢我们的网站，请将本站添加到收藏夹（快捷键Ctrl+D），并设为浏览器主页，方便您的下次访问，感谢支持。</p>
					  </div>
				  </div>
  
				  <!-- 本站承诺 -->
				  <div class="footer-link-section" style="margin-bottom: 2rem;">
					  <h4>
						  <span class="iconify" data-icon="mdi:shield-check"></span>
						  本站承诺
					  </h4>
					  <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.6; font-size: 0.95rem;">
						  <p style="color: #4ade80; font-weight: 600; margin-bottom: 1rem;">绝对不会收集用户的隐私信息</p>
						  <p>区别于部分导航网站，本站链接直接跳转目标，不会对链接处理再后跳转，不会收集用户的隐藏信息，包括但不限于点击记录，访问记录和搜索记录，请放心使用。</p>
						  <p style="margin-top: 1rem;">
							  <strong>申请收录：</strong>本站可以直接申请友链，填写表单后提交，管理员后台审核批准后就可以显示在导航上；请点击右下角的
							  <span style="color: #4ade80; font-weight: 600;">申请友链按钮</span>
							  进行申请。
						  </p>
					  </div>
				  </div>
  
				  <!-- 联系我们 -->
				  <div class="footer-link-section" style="margin-bottom: 2rem;">
					  <h4>
						  <span class="iconify" data-icon="mdi:email"></span>
						  联系我们
					  </h4>
					  <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.6; font-size: 0.95rem;">
						  <p>若您在使用本站时遇到了包括但不限于以下问题：</p>
						  <ul style="margin: 0.5rem 0 1rem 1.5rem; color: rgba(255, 255, 255, 0.9);">
							  <li>图标缺失</li>
							  <li>目标网站无法打开</li>
							  <li>描述错误</li>
							  <li>网站违规</li>
							  <li>收录加急处理</li>
							  <li>链接删除</li>
						  </ul>
						  <p>请发邮件与我们联系</p>
					  </div>
				  </div>
  
				  <!-- 联系邮箱 -->
				  <div class="footer-link-section" style="margin-bottom: 2rem;">
					  <h4>
						  <span class="iconify" data-icon="mdi:email-fast"></span>
						  联系邮箱
					  </h4>
					  <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.6; font-size: 0.95rem;">
						  <p style="background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #6366f1;">
							  <strong>sfx@hangdn.com</strong>
						  </p>
					  </div>
				  </div>
  
				  <!-- 联系说明 -->
				  <div class="footer-link-section">
					  <h4>
						  <span class="iconify" data-icon="mdi:help-circle"></span>
						  联系说明
					  </h4>
					  <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.6; font-size: 0.95rem;">
						  <p>为了您的问题能快速被处理，建议在邮件主题添加：</p>
						  <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0;">
							  <span style="background: rgba(99, 102, 241, 0.3); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem;">
								  【反馈】
							  </span>
							  <span style="background: rgba(239, 68, 68, 0.3); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem;">
								  【投诉】
							  </span>
							  <span style="background: rgba(34, 197, 94, 0.3); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem;">
								  【推荐】
							  </span>
							  <span style="background: rgba(245, 158, 11, 0.3); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem;">
								  【友链】
							  </span>
						  </div>
					  </div>
				  </div>
			  </div>
		  </div>
	  </div>
  
	  <script>
		  let authToken = localStorage.getItem('authToken');
		  let navigationData = [];
  
		  // 初始化
		  document.addEventListener('DOMContentLoaded', function() {
			  console.log('DOM loaded, initializing...');
			  checkAuthStatus();
			  loadNavigationData();
			  setupEventListeners();
			  initDateTime();
			  initBackToTop();
		  });
  
		  function setupEventListeners() {
			  // 登录表单
			  const loginForm = document.getElementById('loginForm');
			  if (loginForm) {
				  loginForm.addEventListener('submit', handleLoginSubmit);
			  }
  
			  // 添加分类表单
			  const addCategoryForm = document.getElementById('addCategoryForm');
			  if (addCategoryForm) {
				  addCategoryForm.addEventListener('submit', handleAddCategorySubmit);
			  }
  
			  // 添加网站表单
			  const addSiteForm = document.getElementById('addSiteForm');
			  if (addSiteForm) {
				  addSiteForm.addEventListener('submit', handleAddSiteSubmit);
			  }
  
			  // 编辑网站表单
			  const editSiteForm = document.getElementById('editSiteForm');
			  if (editSiteForm) {
				  editSiteForm.addEventListener('submit', handleEditSiteSubmit);
			  }
  
			  // 友链申请表单
			  const applyLinkForm = document.getElementById('applyLinkForm');
			  if (applyLinkForm) {
				  applyLinkForm.addEventListener('submit', handleApplyLinkSubmit);
			  }
  
			  // 搜索输入框回车事件
			  const searchInput = document.getElementById('searchInput');
			  if (searchInput) {
				  searchInput.addEventListener('keypress', function(e) {
					  if (e.key === 'Enter') {
						  performSearch('https://www.baidu.com/s?word=');
					  }
				  });
			  }
  
			  // 模态框外部点击关闭
			  window.addEventListener('click', function(e) {
				  if (e.target.classList.contains('modal')) {
					  e.target.style.display = 'none';
				  }
			  });
  
			  console.log('Event listeners registered successfully');
		  }
  
		  // 认证相关函数
		  async function checkAuthStatus() {
			  console.log('Checking auth status...');
			  // 总是显示管理员按钮
			  const adminBtn = document.getElementById('adminBtn');
			  if (adminBtn) adminBtn.classList.remove('hidden');
			  
			  if (authToken) {
				  try {
					  const response = await fetch('/data', {
						  headers: { 'Authorization': 'Bearer ' + authToken }
					  });
					  
					  if (response.ok) {
						  showAdminFeatures();
					  } else {
						  logout();
					  }
				  } catch (error) {
					  console.error('Auth check failed:', error);
					  logout();
				  }
			  }
		  }
  
		  function showAdminFeatures() {
			  console.log('Showing admin features');
			  const adminBtn = document.getElementById('adminBtn');
			  const logoutBtn = document.getElementById('logoutBtn');
			  const controlPanel = document.getElementById('controlPanel');
			  
			  if (adminBtn) adminBtn.classList.add('hidden');
			  if (logoutBtn) logoutBtn.classList.remove('hidden');
			  if (controlPanel) controlPanel.classList.add('active');
		  }
  
		  function hideAdminFeatures() {
			  console.log('Hiding admin features');
			  const adminBtn = document.getElementById('adminBtn');
			  const logoutBtn = document.getElementById('logoutBtn');
			  const controlPanel = document.getElementById('controlPanel');
			  
			  if (adminBtn) adminBtn.classList.remove('hidden');
			  if (logoutBtn) logoutBtn.classList.add('hidden');
			  if (controlPanel) controlPanel.classList.remove('active');
		  }
  
		  // 表单处理函数
		  async function handleLoginSubmit(e) {
			  e.preventDefault();
			  const password = document.getElementById('password').value;
			  await login(password);
		  }
  
		  async function handleAddCategorySubmit(e) {
			  e.preventDefault();
			  const formData = new FormData(e.target);
			  const data = Object.fromEntries(formData);
			  
			  try {
				  const response = await fetch('/add-category', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify(data)
				  });
  
				  if (response.ok) {
					  showNotification('分类添加成功', 'success');
					  closeAddCategoryModal();
					  loadNavigationData();
					  e.target.reset();
				  } else {
					  showNotification('添加失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  async function handleAddSiteSubmit(e) {
			  e.preventDefault();
			  const formData = new FormData(e.target);
			  const data = {
				  categoryIndex: parseInt(formData.get('categoryIndex')),
				  siteName: formData.get('siteName'),
				  siteUrl: formData.get('siteUrl'),
				  siteIcon: formData.get('siteIcon')
			  };
			  
			  try {
				  const response = await fetch('/add-site', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify(data)
				  });
  
				  if (response.ok) {
					  showNotification('网站添加成功', 'success');
					  closeAddSiteModal();
					  loadNavigationData();
					  e.target.reset();
				  } else {
					  showNotification('添加失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  async function handleEditSiteSubmit(e) {
			  e.preventDefault();
			  console.log('Edit form submitted');
			  
			  const currentCategoryIndex = parseInt(document.getElementById('currentCategoryIndex').value);
			  const siteIndex = parseInt(document.getElementById('siteIndex').value);
			  const categoryIndex = parseInt(document.getElementById('editCategoryIndex').value);
			  const siteName = document.getElementById('editSiteName').value;
			  const siteUrl = document.getElementById('editSiteUrl').value;
			  const siteIcon = document.getElementById('editSiteIcon').value;
  
			  const data = {
				  categoryIndex: categoryIndex,
				  siteIndex: siteIndex,
				  siteName: siteName,
				  siteUrl: siteUrl,
				  siteIcon: siteIcon
			  };
  
			  console.log('Sending edit data:', data);
			  
			  try {
				  const response = await fetch('/edit-site', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify(data)
				  });
  
				  if (response.ok) {
					  showNotification('网站修改成功', 'success');
					  closeEditSiteModal();
					  loadNavigationData();
				  } else {
					  const errorData = await response.json();
					  showNotification('修改失败: ' + (errorData.error || '未知错误'), 'error');
					  console.error('Edit failed:', errorData);
				  }
			  } catch (error) {
				  showNotification('网络错误: ' + error.message, 'error');
				  console.error('Network error:', error);
			  }
		  }
  
		  // 处理友链申请提交
		  async function handleApplyLinkSubmit(e) {
			  e.preventDefault();
			  const formData = new FormData(e.target);
			  const data = {
				  siteName: formData.get('siteName'),
				  siteUrl: formData.get('siteUrl'),
				  siteIcon: formData.get('siteIcon'),
				  description: formData.get('description'),
				  contact: formData.get('contact')
			  };
			  
			  try {
				  const response = await fetch('/apply-link', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json'
					  },
					  body: JSON.stringify(data)
				  });
  
				  const result = await response.json();
				  
				  if (response.ok) {
					  showNotification('申请提交成功！等待管理员审核', 'success');
					  closeApplyLinkModal();
					  e.target.reset();
				  } else {
					  showNotification(result.error || '提交失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误，请重试', 'error');
			  }
		  }
  
		  // 登录功能
		  async function login(password) {
			  try {
				  const response = await fetch('/login', {
					  method: 'POST',
					  headers: { 'Content-Type': 'application/json' },
					  body: JSON.stringify({ password })
				  });
  
				  const data = await response.json();
				  
				  if (response.ok) {
					  authToken = data.token;
					  localStorage.setItem('authToken', authToken);
					  showAdminFeatures();
					  closeLoginModal();
					  showNotification('登录成功！', 'success');
				  } else {
					  showNotification(data.error || '登录失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误，请重试', 'error');
			  }
		  }
  
		  function logout() {
			  authToken = null;
			  localStorage.removeItem('authToken');
			  hideAdminFeatures();
			  showNotification('已退出登录', 'info');
		  }
  
		  // 数据加载和渲染
		  async function loadNavigationData() {
			  try {
				  const response = await fetch('/data');
				  navigationData = await response.json();
				  console.log('Loaded navigation data:', navigationData);
				  renderContent();
			  } catch (error) {
				  console.error('加载数据失败:', error);
			  }
		  }
  
		  function renderContent() {
			  const contentEl = document.getElementById('content');
			  if (!contentEl) return;
			  
			  if (!navigationData.categories || navigationData.categories.length === 0) {
				  contentEl.innerHTML = \`
					  <div class="empty-state">
						  <span class="iconify" data-icon="mdi:folder-open-outline"></span>
						  <h3>暂无分类</h3>
						  <p>登录后可以添加分类和网站</p>
					  </div>
				  \`;
				  return;
			  }
  
			  let html = '';
			  
			  // 原有的其他分类
			  navigationData.categories.forEach((category, categoryIndex) => {
				  html += '<div class="category">';
				  html += '<div class="category-header">';
				  html += '<h2 class="category-title">';
				  html += '<span class="iconify" data-icon="mdi:folder"></span>';
				  html += category.name;
				  html += '</h2>';
				  
				  if (authToken) {
					  html += '<div class="category-actions">';
					  html += '<button class="icon-btn" onclick="openAddSiteModal(' + categoryIndex + ')" title="添加网站">';
					  html += '<span class="iconify" data-icon="mdi:plus"></span>';
					  html += '</button>';
					  html += '<button class="icon-btn" onclick="deleteCategory(' + categoryIndex + ')" title="删除分类">';
					  html += '<span class="iconify" data-icon="mdi:delete"></span>';
					  html += '</button>';
					  html += '</div>';
				  }
				  
				  html += '</div>';
				  html += '<div class="sites-grid">';
				  
				  if (category.sites && category.sites.length > 0) {
					  category.sites.forEach((site, siteIndex) => {
						  // 转义特殊字符
						  const escapedName = site.name.replace(/'/g, "\\\\'");
						  const escapedUrl = site.url.replace(/'/g, "\\\\'");
						  const escapedIcon = site.icon.replace(/'/g, "\\\\'");
						  
						  html += '<div class="site-card" onclick="openSite(\\'' + escapedUrl + '\\')">';
						  html += '<div class="site-icon">';
						  
						  // 判断图标类型并相应渲染
						  if (site.icon.startsWith('http://') || site.icon.startsWith('https://') || 
							  site.icon.endsWith('.ico') || site.icon.endsWith('.png') || 
							  site.icon.endsWith('.jpg') || site.icon.endsWith('.svg') ||
							  site.icon.endsWith('.jpeg') || site.icon.endsWith('.gif')) {
							  // 外部图标链接
							  html += '<img src="' + site.icon + '" alt="' + escapedName + '">';
						  } else {
							  // Iconify 图标代码
							  html += '<span class="iconify" data-icon="' + escapedIcon + '"></span>';
						  }
						  
						  html += '</div>';
						  html += '<div class="site-name">' + site.name + '</div>';
						  html += '<div class="site-url">' + new URL(site.url).hostname + '</div>';
						  
						  if (authToken) {
							  html += '<div class="site-actions">';
							  html += '<button class="icon-btn" onclick="event.stopPropagation(); openEditSiteModal(' + categoryIndex + ', ' + siteIndex + ')" title="编辑">';
							  html += '<span class="iconify" data-icon="mdi:pencil"></span>';
							  html += '</button>';
							  html += '<button class="icon-btn" onclick="event.stopPropagation(); deleteSite(' + categoryIndex + ', ' + siteIndex + ')" title="删除">';
							  html += '<span class="iconify" data-icon="mdi:delete"></span>';
							  html += '</button>';
							  html += '</div>';
						  }
						  
						  html += '</div>';
					  });
				  } else {
					  html += '<div class="empty-state" style="padding: 2rem; grid-column: 1 / -1;">';
					  html += '<span class="iconify" data-icon="mdi:web"></span>';
					  html += '<p>暂无网站，点击上方 + 按钮添加</p>';
					  html += '</div>';
				  }
				  
				  html += '</div>';
				  html += '</div>';
			  });
			  
			  contentEl.innerHTML = html;
		  }
  
		  // 网站操作函数
		  function openSite(url) {
			  window.open(url, '_blank');
		  }
  
		  async function deleteCategory(categoryIndex) {
			  if (!confirm('确定要删除这个分类吗？分类下的所有网站也会被删除。')) return;
			  
			  try {
				  const response = await fetch('/delete-category', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify({ categoryIndex })
				  });
  
				  if (response.ok) {
					  showNotification('分类删除成功', 'success');
					  loadNavigationData();
				  } else {
					  showNotification('删除失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  async function deleteSite(categoryIndex, siteIndex) {
			  if (!confirm('确定要删除这个网站吗？')) return;
			  
			  try {
				  const response = await fetch('/delete-site', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify({ categoryIndex, siteIndex })
				  });
  
				  if (response.ok) {
					  showNotification('网站删除成功', 'success');
					  loadNavigationData();
				  } else {
					  showNotification('删除失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  // 模态框控制函数
		  function openLoginModal() {
			  const modal = document.getElementById('loginModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeLoginModal() {
			  const modal = document.getElementById('loginModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  function openAddCategoryModal() {
			  const modal = document.getElementById('addCategoryModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeAddCategoryModal() {
			  const modal = document.getElementById('addCategoryModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  function openAddSiteModal(categoryIndex = null) {
			  const select = document.querySelector('#addSiteForm select[name="categoryIndex"]');
			  if (select) {
				  select.innerHTML = '';
				  
				  navigationData.categories.forEach((category, index) => {
					  const option = document.createElement('option');
					  option.value = index;
					  option.textContent = category.name;
					  if (index === categoryIndex) {
						  option.selected = true;
					  }
					  select.appendChild(option);
				  });
			  }
			  
			  const modal = document.getElementById('addSiteModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeAddSiteModal() {
			  const modal = document.getElementById('addSiteModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  function openEditSiteModal(categoryIndex, siteIndex) {
			  console.log('Opening edit modal for category:', categoryIndex, 'site:', siteIndex);
			  
			  // 检查数据是否存在
			  if (!navigationData.categories[categoryIndex] || !navigationData.categories[categoryIndex].sites[siteIndex]) {
				  showNotification('网站数据不存在', 'error');
				  return;
			  }
			  
			  const site = navigationData.categories[categoryIndex].sites[siteIndex];
			  console.log('Editing site:', site);
			  
			  // 直接设置表单值
			  document.getElementById('currentCategoryIndex').value = categoryIndex;
			  document.getElementById('siteIndex').value = siteIndex;
			  document.getElementById('editSiteName').value = site.name;
			  document.getElementById('editSiteUrl').value = site.url;
			  document.getElementById('editSiteIcon').value = site.icon;
			  
			  // 填充分类选择
			  const categorySelect = document.getElementById('editCategoryIndex');
			  if (categorySelect) {
				  categorySelect.innerHTML = '';
				  
				  navigationData.categories.forEach((category, index) => {
					  const option = document.createElement('option');
					  option.value = index;
					  option.textContent = category.name;
					  if (index === categoryIndex) {
						  option.selected = true;
					  }
					  categorySelect.appendChild(option);
				  });
			  }
			  
			  const modal = document.getElementById('editSiteModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeEditSiteModal() {
			  const modal = document.getElementById('editSiteModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  // 友链申请相关函数
		  function openApplyLinkModal() {
			  const modal = document.getElementById('applyLinkModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeApplyLinkModal() {
			  const modal = document.getElementById('applyLinkModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  function openApproveLinksModal() {
			  loadPendingLinks();
			  const modal = document.getElementById('approveLinksModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeApproveLinksModal() {
			  const modal = document.getElementById('approveLinksModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  // 关于本站模态框函数
		  function openAboutModal() {
			  const modal = document.getElementById('aboutModal');
			  if (modal) modal.style.display = 'flex';
		  }
  
		  function closeAboutModal() {
			  const modal = document.getElementById('aboutModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  // 搜索模态框函数
		  function openSearchModal() {
			  const modal = document.getElementById('searchModal');
			  if (modal) {
				  modal.style.display = 'flex';
				  document.getElementById('searchInput').focus();
			  }
		  }
  
		  function closeSearchModal() {
			  const modal = document.getElementById('searchModal');
			  if (modal) modal.style.display = 'none';
		  }
  
		  function performSearch(searchUrl) {
			  const searchText = document.getElementById('searchInput').value.trim();
			  if (searchText) {
				  const encodedText = encodeURIComponent(searchText);
				  window.open(searchUrl + encodedText, '_blank');
				  closeSearchModal();
			  } else {
				  alert('请输入搜索内容');
				  document.getElementById('searchInput').focus();
			  }
		  }
  
		  // 加载待审批友链
		  async function loadPendingLinks() {
			  try {
				  const response = await fetch('/pending-links', {
					  headers: {
						  'Authorization': 'Bearer ' + authToken
					  }
				  });
				  
				  const data = await response.json();
				  
				  if (response.ok) {
					  renderPendingLinks(data.pendingLinks);
				  } else {
					  showNotification('加载申请列表失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  // 渲染待审批友链列表
		  function renderPendingLinks(links) {
			  const container = document.getElementById('pendingLinksList');
			  
			  if (!links || links.length === 0) {
				  container.innerHTML = '<div class="empty-state" style="padding: 2rem;"><p>暂无待审批的友链申请</p></div>';
				  return;
			  }
			  
			  let html = '';
			  links.forEach((apply, index) => {
				  html += \`
					  <div class="pending-link-item">
						  <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
							  \`;
				  
				  // 判断图标类型并相应渲染
				  if (apply.siteIcon.startsWith('http://') || apply.siteIcon.startsWith('https://') || 
					  apply.siteIcon.endsWith('.ico') || apply.siteIcon.endsWith('.png') || 
					  apply.siteIcon.endsWith('.jpg') || apply.siteIcon.endsWith('.svg') ||
					  apply.siteIcon.endsWith('.jpeg') || apply.siteIcon.endsWith('.gif')) {
					  // 外部图标链接
					  html += \`<img src="\${apply.siteIcon}" alt="\${apply.siteName}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 6px;">\`;
				  } else {
					  // Iconify 图标代码
					  html += \`<span class="iconify" data-icon="\${apply.siteIcon}" style="font-size: 2rem; color: white;"></span>\`;
				  }
				  
				  html += \`
							  <div style="flex: 1;">
								  <h4 style="color: white; margin: 0;">\${apply.siteName}</h4>
								  <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 0.9rem;">\${apply.siteUrl}</p>
							  </div>
						  </div>
						  \${apply.description ? \`<p style="color: rgba(255,255,255,0.9); margin: 0.5rem 0;">\${apply.description}</p>\` : ''}
						  \${apply.contact ? \`<p style="color: rgba(255,255,255,0.8); margin: 0.5rem 0; font-size: 0.9rem;">联系方式: \${apply.contact}</p>\` : ''}
						  <p style="color: rgba(255,255,255,0.7); margin: 0.5rem 0; font-size: 0.8rem;">
							  申请时间: \${new Date(apply.appliedAt).toLocaleString()}
						  </p>
						  <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
							  <select class="form-input" style="flex: 1;" id="categorySelect_\${apply.id}">
								  \${navigationData.categories.map((cat, idx) => 
									  \`<option value="\${idx}">\${cat.name}</option>\`
								  ).join('')}
							  </select>
							  <button class="btn btn-success" onclick="approveLink('\${apply.id}', \${index})" style="padding: 0.5rem 1rem;">
								  <span class="iconify" data-icon="mdi:check"></span>
								  批准
							  </button>
							  <button class="btn btn-danger" onclick="rejectLink('\${apply.id}', \${index})" style="padding: 0.5rem 1rem;">
								  <span class="iconify" data-icon="mdi:close"></span>
								  拒绝
							  </button>
						  </div>
					  </div>
				  \`;
			  });
			  
			  container.innerHTML = html;
		  }
  
		  // 批准友链
		  async function approveLink(applyId, index) {
			  const categoryIndex = parseInt(document.getElementById(\`categorySelect_\${applyId}\`).value);
			  
			  try {
				  const response = await fetch('/approve-link', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify({ applyId, categoryIndex })
				  });
				  
				  if (response.ok) {
					  showNotification('友链已批准', 'success');
					  loadPendingLinks();
					  loadNavigationData();
				  } else {
					  showNotification('批准失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  // 拒绝友链
		  async function rejectLink(applyId, index) {
			  if (!confirm('确定要拒绝这个友链申请吗？')) return;
			  
			  try {
				  const response = await fetch('/reject-link', {
					  method: 'POST',
					  headers: {
						  'Content-Type': 'application/json',
						  'Authorization': 'Bearer ' + authToken
					  },
					  body: JSON.stringify({ applyId })
				  });
				  
				  if (response.ok) {
					  showNotification('友链已拒绝', 'success');
					  loadPendingLinks();
				  } else {
					  showNotification('拒绝失败', 'error');
				  }
			  } catch (error) {
				  showNotification('网络错误', 'error');
			  }
		  }
  
		  // 时间更新函数
		  function updateDateTime() {
			  const now = new Date();
			  const year = now.getFullYear();
			  const month = (now.getMonth() + 1).toString().padStart(2, '0');
			  const date = now.getDate().toString().padStart(2, '0');
			  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
			  const weekday = weekdays[now.getDay()];
			  const dateString = \`\${year}年\${month}月\${date}日 \${weekday}\`;
			  
			  const hours = now.getHours().toString().padStart(2, '0');
			  const minutes = now.getMinutes().toString().padStart(2, '0');
			  const seconds = now.getSeconds().toString().padStart(2, '0');
			  const timeString = \`\${hours}:\${minutes}:\${seconds}\`;
			  
			  const dateElement = document.getElementById('currentDate');
			  const timeElement = document.getElementById('currentTime');
			  
			  if (dateElement) dateElement.textContent = dateString;
			  if (timeElement) timeElement.textContent = timeString;
		  }
  
		  function initDateTime() {
			  updateDateTime();
			  setInterval(updateDateTime, 1000);
		  }
  
		  // 返回顶部功能
		  function initBackToTop() {
			  const backToTopBtn = document.querySelector('.back-to-top');
			  window.addEventListener('scroll', function() {
				  if (window.pageYOffset > 300) {
					  backToTopBtn.style.display = 'flex';
				  } else {
					  backToTopBtn.style.display = 'none';
				  }
			  });
		  }
  
		  function scrollToTop() {
			  window.scrollTo({
				  top: 0,
				  behavior: 'smooth'
			  });
		  }
  
		  // 通知功能
		  function showNotification(message, type = 'info') {
			  alert(message);
		  }
  
		  // 全局函数 - 确保可以被 onclick 调用
		  window.openLoginModal = openLoginModal;
		  window.closeLoginModal = closeLoginModal;
		  window.openAddCategoryModal = openAddCategoryModal;
		  window.closeAddCategoryModal = closeAddCategoryModal;
		  window.openAddSiteModal = openAddSiteModal;
		  window.closeAddSiteModal = closeAddSiteModal;
		  window.openEditSiteModal = openEditSiteModal;
		  window.closeEditSiteModal = closeEditSiteModal;
		  window.openSite = openSite;
		  window.deleteCategory = deleteCategory;
		  window.deleteSite = deleteSite;
		  window.logout = logout;
		  window.openApplyLinkModal = openApplyLinkModal;
		  window.closeApplyLinkModal = closeApplyLinkModal;
		  window.openApproveLinksModal = openApproveLinksModal;
		  window.closeApproveLinksModal = closeApproveLinksModal;
		  window.approveLink = approveLink;
		  window.rejectLink = rejectLink;
		  window.openAboutModal = openAboutModal;
		  window.closeAboutModal = closeAboutModal;
		  window.openSearchModal = openSearchModal;
		  window.closeSearchModal = closeSearchModal;
		  window.performSearch = performSearch;
		  window.scrollToTop = scrollToTop;
  
		  console.log('All functions initialized');
	  </script>
  
	  <script>
		  /* ====================== 配置区域（可按需改） ====================== */
		  // 网易云歌单 ID
		  const PLAYLIST_ID = '14148542684';
  
		  /* ======= DOM 引用 ======= */
		  const capsule = document.getElementById('music-capsule');
		  const capsuleCover = document.getElementById('capsule-cover');
		  const playerWrap = document.getElementById('player-wrap');
		  const aplayerContainer = document.getElementById('aplayer-container');
		  const rightMenu = document.getElementById('right-menu');
  
		  let metingEl = null;
		  let aplayer = null;
		  let lyricsInterval = null;
		  let currentLyric = '';
		  let lyricsVisible = true;
  
		  /* ===== 独立歌词显示功能 ===== */
		  const floatingLyrics = document.getElementById('floating-lyrics');
		  const currentLineEl = floatingLyrics.querySelector('.current-line');
		  const nextLineEl = floatingLyrics.querySelector('.next-line');
  
		  // 新的歌词显示方法 - 带逐步推进效果
		  function showLyricsWithEffect(currentText, nextText) {
			  // 如果歌词不可见，直接返回
			  if (!lyricsVisible) return;
			  
			  // 如果歌词没有变化，不重复触发动画
			  if (currentText === currentLyric) return;
			  
			  currentLyric = currentText;
			  
			  // 清除当前行的内容
			  currentLineEl.innerHTML = '';
			  
			  if (currentText && currentText.trim()) {
				  // 创建打字机效果的文本容器
				  const typingSpan = document.createElement('span');
				  typingSpan.className = 'typing-text';
				  typingSpan.textContent = currentText;
				  
				  // 创建淡入效果的文本容器（备用）
				  const fadeSpan = document.createElement('span');
				  fadeSpan.className = 'fade-in-text';
				  fadeSpan.textContent = currentText;
				  
				  // 根据歌词长度决定使用哪种效果
				  if (currentText.length > 15) {
					  // 长歌词使用淡入效果
					  currentLineEl.appendChild(fadeSpan);
				  } else {
					  // 短歌词使用打字机效果
					  currentLineEl.appendChild(typingSpan);
				  }
				  
				  // 设置下一句歌词
				  nextLineEl.textContent = nextText || '';
				  
				  // 显示歌词容器
				  floatingLyrics.classList.add('show');
			  } else {
				  // 没有歌词时隐藏
				  floatingLyrics.classList.remove('show');
			  }
		  }
  
		  // 新的歌词更新方法 - 通过定时器检查DOM元素
		  function startLyricsUpdate(ap) {
			  console.log('开始歌词更新监听');
			  
			  // 清除之前的定时器
			  if (lyricsInterval) {
				  clearInterval(lyricsInterval);
			  }
			  
			  // 设置定时器检查歌词
			  lyricsInterval = setInterval(() => {
				  updateLyricsFromDOM();
			  }, 100);
		  }
  
		  function updateLyricsFromDOM() {
			  try {
				  // 如果歌词不可见，不更新歌词
				  if (!lyricsVisible) {
					  return;
				  }
				  
				  // 查找APlayer的歌词元素
				  const lrcContainer = document.querySelector('.aplayer-lrc');
				  if (!lrcContainer) {
					  console.log('未找到歌词容器');
					  floatingLyrics.classList.remove('show');
					  return;
				  }
				  
				  // 获取当前歌词和下一句歌词
				  const currentLrc = lrcContainer.querySelector('p.aplayer-lrc-current');
				  const allLrcLines = lrcContainer.querySelectorAll('p');
				  
				  if (currentLrc && currentLrc.textContent.trim()) {
					  const currentText = currentLrc.textContent.trim();
					  let nextText = '';
					  
					  // 找到下一句歌词
					  for (let i = 0; i < allLrcLines.length; i++) {
						  if (allLrcLines[i] === currentLrc && i < allLrcLines.length - 1) {
							  nextText = allLrcLines[i + 1].textContent.trim();
							  break;
						  }
					  }
					  
					  console.log('当前歌词:', currentText, '下一句:', nextText);
					  
					  // 使用新的歌词显示方法
					  showLyricsWithEffect(currentText, nextText);
				  } else {
					  console.log('没有找到当前歌词');
					  floatingLyrics.classList.remove('show');
					  currentLyric = '';
				  }
			  } catch (error) {
				  console.log('歌词更新错误:', error);
				  floatingLyrics.classList.remove('show');
				  currentLyric = '';
			  }
		  }
  
		  /* ================= 初始化 Meting + APlayer（音乐） ================= */
		  function initMeting(){
			  if (aplayer) return Promise.resolve(aplayer);
			  return new Promise((resolve, reject) => {
				  // 如果已经渲染好则直接返回
				  if (metingEl && metingEl.aplayer) {
					  aplayer = metingEl.aplayer;
					  bindAPlayerEvents(aplayer);
					  return resolve(aplayer);
				  }
  
				  // 创建 meting-js 并加入 DOM
				  aplayerContainer.innerHTML = '';
				  metingEl = document.createElement('meting-js');
				  metingEl.setAttribute('server', 'netease');
				  metingEl.setAttribute('type', 'playlist');
				  metingEl.setAttribute('id', PLAYLIST_ID);
				  metingEl.setAttribute('autoplay', 'false');
				  metingEl.setAttribute('theme', '#49b1f5');
				  metingEl.setAttribute('loop', 'all');
				  metingEl.setAttribute('preload', 'auto');
				  metingEl.setAttribute('lrctype', '1');
				  aplayerContainer.appendChild(metingEl);
  
				  // 轮询或等待 rendered 事件
				  let handled = false;
				  function tryResolve(){
					  if (handled) return;
					  if (metingEl && metingEl.aplayer) {
						  aplayer = metingEl.aplayer;
						  handled = true;
						  bindAPlayerEvents(aplayer);
						  resolve(aplayer);
					  }
				  }
				  metingEl.addEventListener('rendered', tryResolve);
				  const poll = setInterval(()=>{ tryResolve(); if(handled) clearInterval(poll); }, 300);
				  setTimeout(()=>{ if(!handled){ clearInterval(poll); reject(new Error('APlayer 初始化超时')); }}, 9000);
			  });
		  }
  
		  /* 绑定 APlayer 事件（更新封面、旋转状态、歌词滚动等） */
		  function bindAPlayerEvents(ap){
			  if (!ap) return;
			  
			  // 更新胶囊封面
			  function updateCover(){
				  try {
					  const info = ap.list.audios[ap.list.index];
					  if (info && info.cover) capsuleCover.src = info.cover;
				  } catch(e){}
			  }
			  
			  ap.on('loadeddata', updateCover);
			  ap.on('listswitch', updateCover);
			  ap.on('play', ()=> {
				  capsule.classList.add('playing');
				  // 开始监听歌词
				  startLyricsUpdate(ap);
			  });
			  ap.on('pause', ()=> {
				  capsule.classList.remove('playing');
				  // 暂停时隐藏歌词
				  floatingLyrics.classList.remove('show');
				  currentLyric = '';
			  });
			  ap.on('ended', ()=> {
				  floatingLyrics.classList.remove('show');
				  currentLyric = '';
			  });
		  }
  
		  /* helper：确保播放器就绪后执行操作 */
		  async function ensurePlayerAndRun(fn){
			  try {
				  const ap = await initMeting();
				  if (typeof fn === 'function') fn(ap);
			  } catch(err){
				  console.warn('播放器未就绪：', err);
			  }
		  }
  
		  /* 点击胶囊：隐藏胶囊、显示播放器（异步初始化播放器） */
		  capsule.addEventListener('click', ()=>{
			  capsule.style.display = 'none';
			  playerWrap.classList.add('show');
			  initMeting().catch(()=>{ /* ignore */ });
		  });
  
		  /* ================== 右键菜单：显示、隐藏、绑定功能 ================== */
		  /* showRightMenuAt：固定定位（clientX/Y），并防止被底部任务栏遮挡 */
		  function showRightMenuAt(clientX, clientY){
			  rightMenu.style.display = 'block';
			  rightMenu.classList.remove('show');
			  requestAnimationFrame(()=>{
				  const mw = rightMenu.offsetWidth || 220;
				  const mh = rightMenu.offsetHeight || 280;
				  let left = Math.round(clientX - mw/2);
				  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
				  let top = clientY - mh - 12;
				  if (top < 8) top = clientY + 12;
				  if (top + mh > window.innerHeight - 8) top = Math.max(8, window.innerHeight - mh - 8);
				  rightMenu.style.left = left + 'px';
				  rightMenu.style.top = top + 'px';
				  // 箭头位置
				  const arrowLeft = Math.max(12, Math.min(clientX - left, mw - 12));
				  rightMenu.style.setProperty('--arrow-left', arrowLeft + 'px');
				  rightMenu.classList.add('show');
			  });
		  }
  
		  /* 绑定右键事件：显示菜单并阻止默认菜单 */
		  document.addEventListener('contextmenu', (e) => {
			  e.preventDefault();
			  showRightMenuAt(e.clientX, e.clientY);
		  });
  
		  /* 点击空白处或触摸空白处立即隐藏菜单 */
		  function hideRightMenuImmediate(){
			  rightMenu.classList.remove('show');
			  rightMenu.style.display = 'none';
		  }
		  document.addEventListener('click', (e) => {
			  if (!rightMenu.contains(e.target)) hideRightMenuImmediate();
		  });
		  document.addEventListener('touchstart', (e) => {
			  if (!rightMenu.contains(e.target)) hideRightMenuImmediate();
		  });
  
		  // ================== 歌词显示/隐藏控制 ==================
		  // 歌词显示/隐藏控制函数
		  function toggleLyricsVisibility() {
			  lyricsVisible = !lyricsVisible;
			  
			  if (lyricsVisible) {
				  floatingLyrics.classList.add('show');
				  // 如果正在播放，重新开始歌词更新
				  if (aplayer && !aplayer.audio.paused) {
					  startLyricsUpdate(aplayer);
				  }
			  } else {
				  floatingLyrics.classList.remove('show');
				  // 清除歌词内容
				  currentLineEl.textContent = '';
				  nextLineEl.textContent = '';
				  currentLyric = '';
			  }
			  
			  // 更新菜单文本
			  const lyricsMenuItem = document.getElementById('menu-lyrics');
			  lyricsMenuItem.textContent = lyricsVisible ? '📜 隐藏歌词' : '📜 显示歌词';
			  
			  // 保存状态到本地存储
			  localStorage.setItem('lyricsVisible', lyricsVisible.toString());
		  }
  
		  /* 菜单功能：点击后立即执行并隐藏菜单 */
		  document.getElementById('menu-play').addEventListener('click', ()=>{ ensurePlayerAndRun(ap=>ap.toggle()); hideRightMenuImmediate(); });
		  document.getElementById('menu-prev').addEventListener('click', ()=>{ ensurePlayerAndRun(ap=>ap.skipBack()); hideRightMenuImmediate(); });
		  document.getElementById('menu-next').addEventListener('click', ()=>{ ensurePlayerAndRun(ap=>ap.skipForward()); hideRightMenuImmediate(); });
		  document.getElementById('menu-volup').addEventListener('click', ()=>{ ensurePlayerAndRun(ap=>ap.volume(Math.min((ap.audio.volume||0.8)+0.1,1), true)); hideRightMenuImmediate(); });
		  document.getElementById('menu-voldown').addEventListener('click', ()=>{ ensurePlayerAndRun(ap=>ap.volume(Math.max((ap.audio.volume||0.2)-0.1,0), true)); hideRightMenuImmediate(); });
  
		  // 新增的歌词控制菜单项
		  document.getElementById('menu-lyrics').addEventListener('click', ()=>{
			  toggleLyricsVisibility();
			  hideRightMenuImmediate();
		  });
  
		  document.getElementById('menu-support').addEventListener('click', ()=>{ window.open('https://1356666.xyz','_blank'); hideRightMenuImmediate(); });
  
		  document.getElementById('menu-fullscreen').addEventListener('click', ()=>{
			  hideRightMenuImmediate();
			  // 整个页面进入全屏
			  if (!document.fullscreenElement) {
				  document.documentElement.requestFullscreen().catch(()=>{});
			  } else {
				  document.exitFullscreen().catch(()=>{});
			  }
		  });
  
		  document.getElementById('menu-close').addEventListener('click', ()=>{
			  ensurePlayerAndRun(ap=>ap.pause());
			  playerWrap.classList.remove('show');
			  capsule.style.display = 'flex';
			  hideRightMenuImmediate();
		  });
  
		  /* 预初始化 APlayer（使菜单能立即使用） */
		  initMeting().then(ap=>{
			  console.log('APlayer初始化完成');
		  }).catch(()=>{
			  console.log('APlayer初始化失败');
		  });
  
		  // 页面加载完成后初始化歌词显示状态
		  document.addEventListener('DOMContentLoaded', function() {
			  // 从本地存储读取歌词显示状态
			  const savedLyricsVisible = localStorage.getItem('lyricsVisible');
			  if (savedLyricsVisible !== null) {
				  lyricsVisible = savedLyricsVisible === 'true';
			  }
			  
			  // 根据状态更新菜单文本
			  const lyricsMenuItem = document.getElementById('menu-lyrics');
			  lyricsMenuItem.textContent = lyricsVisible ? '📜 隐藏歌词' : '📜 显示歌词';
			  
			  // 如果歌词应该隐藏，立即隐藏
			  if (!lyricsVisible) {
				  floatingLyrics.classList.remove('show');
			  }
		  });
	  </script>
  
	  <script>
		  // 背景轮播功能
		  function initBackgroundRotation() {
			  const bgImgs = document.querySelectorAll('.background-slide');
			  let bgIndex = 0;
			  
			  // 每10秒切换一次背景
			  setInterval(() => {
				  bgImgs.forEach((img, i) => img.classList.toggle('active', i === bgIndex));
				  bgIndex = (bgIndex + 1) % bgImgs.length;
			  }, 10000);
		  }
  
		  // 页面加载完成后初始化背景轮播
		  document.addEventListener('DOMContentLoaded', function() {
			  // 初始化背景轮播
			  initBackgroundRotation();
		  });
	  </script>
  </body>
  </html>`;
  }
