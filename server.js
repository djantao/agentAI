// 学习平台服务器，支持静态文件服务和API代理
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

// 服务器配置
const PORT = 3001;
const PUBLIC_DIR = __dirname;

// 创建Express应用
const app = express();

// 启用CORS
app.use(cors());

// 解析JSON请求体
app.use(express.json());

// 静态文件服务
app.use(express.static(PUBLIC_DIR));

// 默认路由返回index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Notion API代理路由
app.all('/api/notion/*', async (req, res) => {
  try {
    // 获取Notion API密钥
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return res.status(500).json({ error: 'Notion API密钥未配置，请检查.env文件' });
    }

    // 构建Notion API请求URL
    const notionEndpoint = req.originalUrl.replace('/api/notion', '');
    const notionUrl = `https://api.notion.com/v1${notionEndpoint}`;
    console.log(`转发请求到Notion API: ${notionUrl}`);

    // 构建请求头
    const headers = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };

    // 发送请求到Notion API
    const response = await fetch(notionUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'DELETE' ? JSON.stringify(req.body) : undefined
    });

    // 获取响应内容
    const data = await response.json();

    // 返回响应给前端
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Notion API代理错误:', error);
    res.status(500).json({ error: 'Notion API代理错误: ' + error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}/`);
  console.log(`您可以通过上述URL访问学习平台。`);
  console.log(`Notion API代理已配置，使用 /api/notion 前缀访问。`);
});
