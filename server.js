// 简单的HTTP服务器，用于提供静态文件服务
const http = require('http');
const fs = require('fs');
const path = require('path');

// 服务器配置
const PORT = 3001;
const PUBLIC_DIR = __dirname;

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // 解析请求URL
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // 如果路径为空或为根目录，默认返回index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // 构建文件路径
  const filePath = path.join(PUBLIC_DIR, pathname);

  // 获取文件扩展名
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // 读取并返回文件
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，返回404
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        // 服务器错误
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      // 文件存在，返回文件内容
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`You can now access the learning platform at the above URL.`);
});
