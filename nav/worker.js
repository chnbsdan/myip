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
	  <title>智能导航页</title>
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
  
		  /* 移除容器限制，让内容直接显示在背景上 */
		  .container {
			  padding: 20px;
			  min-height: 100vh;
		  }
  
		  /* 头部样式 - 直接放在背景上，无背景色 */
		  .header {
			  color: white;
			  padding: 2rem 0;
			  margin-bottom: 2rem;
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
			  gap: 1rem;
		  }
  
		  .header-logo {
			  display: flex;
			  align-items: center;
			  gap: 1rem;
			  margin-bottom: 0.5rem;
		  }
  
		  .logo-icon {
			  width: 60px;
			  height: 60px;
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
			  font-size: 3rem;
			  font-weight: 800;
			  margin: 0;
			  color: white;
			  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
			  letter-spacing: 1px;
		  }
  
		  .header p {
			  font-size: 1.3rem;
			  opacity: 0.95;
			  font-weight: 500;
			  color: white;
			  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
			  margin: 0;
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
			  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
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
			  width: 20px;
			  height: 20px;
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
			  .container {
				  padding: 15px;
			  }
			  
			  .header {
				  padding: 1.5rem 0;
			  }
			  
			  .header h1 {
				  font-size: 2.2rem;
			  }
			  
			  .header p {
				  font-size: 1.1rem;
			  }
			  
			  .logo-icon {
				  width: 50px;
				  height: 50px;
			  }
			  
			  .sites-grid {
				  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
				  gap: 1rem;
			  }
			  
			  .category {
				  padding: 1rem;
			  }
			  
			  .admin-floating-btn {
				  bottom: 20px;
				  right: 20px;
			  }
			  
			  .gear-btn {
				  width: 50px;
				  height: 50px;
				  font-size: 1.3rem;
			  }
			  
			  .logout-btn {
				  width: 45px;
				  height: 45px;
				  font-size: 1.1rem;
			  }
		  }
  
		  @media (max-width: 480px) {
			  .header h1 {
				  font-size: 1.8rem;
			  }
			  
			  .header p {
				  font-size: 1rem;
			  }
			  
			  .logo-icon {
				  width: 40px;
				  height: 40px;
			  }
			  
			  .header-logo {
				  gap: 0.7rem;
			  }
			  
			  .sites-grid {
				  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
			  }
			  
			  .site-card {
				  padding: 1rem 0.5rem;
			  }
			  
			  .site-icon {
				  width: 48px;
				  height: 48px;
				  font-size: 1.5rem;
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
	  </style>
  </head>
  <body>
	  <div class="container">
		  <!-- 头部 - 直接放在背景上 -->
		  <header class="header">
			  <div class="header-content">
				  <div class="header-logo">
					  <img src="https://cdn.jsdelivr.net/gh/chnbsdan/cloudflare-workers-blog@master/themes/mya/files/hangdn.ico" 
						   alt="导航图标" 
						   class="logo-icon">
					  <h1>智能导航</h1>
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
			  </div>
		  </div>
  
		  <!-- 分类和网站内容 -->
		  <div id="content"></div>
	  </div>
  
	  <!-- 右下角管理员按钮 - 齿轮样式 -->
	  <div class="admin-floating-btn">
		  <button class="gear-btn" id="adminBtn" onclick="openLoginModal()" title="管理员登录">
			  <span class="iconify" data-icon="mdi:cog"></span>
		  </button>
		  <button class="logout-btn hidden" id="logoutBtn" onclick="logout()" title="退出登录">
			  <span class="iconify" data-icon="mdi:logout"></span>
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
					  <input type="text" class="form-input" name="siteIcon" placeholder="例如: mdi:github" required>
					  <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
						  使用 Iconify 图标代码，访问 <a href="https://icon-sets.iconify.design/" target="_blank">Iconify</a> 查找图标
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
  
	  <script>
		  let authToken = localStorage.getItem('authToken');
		  let navigationData = [];
  
		  // 初始化
		  document.addEventListener('DOMContentLoaded', function() {
			  console.log('DOM loaded, initializing...');
			  checkAuthStatus();
			  loadNavigationData();
			  setupEventListeners();
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
						  html += '<span class="iconify" data-icon="' + escapedIcon + '"></span>';
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
  
		  // 通知功能
		  function showNotification(message, type = 'info') {
			  // 简单的通知实现
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
  
		  console.log('All functions initialized');
	  </script>
  </body>
  </html>`;
  }
