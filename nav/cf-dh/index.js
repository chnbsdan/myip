//  src/templates/index.js    这是该项目中输出文件的原码未压缩

import { getNavigationData } from '../services/kv.js';
import { getHead } from './head.js';
import { getStyles } from './styles.js';
import { getBody } from './body.js';
import { getMainScript } from './scripts/main.js';
import { getPlayerScript } from './scripts/player.js';

export async function renderNavigationPage() {
  const navigationData = await getNavigationData();
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
${getHead()}
${getStyles()}
<body>
${getBody()}
${getMainScript()}
${getPlayerScript()}
</body>
</html>`;
}
