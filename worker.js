// Cloudflare Workers 代理代码
// 用于解决API的CORS问题并保护API密钥

// 声明全局变量，解决TypeScript类型检查错误
// @ts-ignore - 忽略TypeScript对全局变量的检查
const NOTION_API_KEY = globalThis.NOTION_API_KEY || '';

// 兼容Cloudflare Workers的事件监听方式
addEventListener('fetch', (event) => {
  return event.respondWith(handleRequest(event.request));
});

/**
 * 处理所有请求
 * @param {Request} request - 请求对象
 * @returns {Promise<Response>} - 响应对象
 */
async function handleRequest(request) {
  // 处理OPTIONS请求（CORS预检）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理Notion API请求
    if (path.startsWith('/notion')) {
      return handleNotionApiRequest(request);
    }
    
    // 处理通义千问API请求
    if (path.startsWith('/qwen')) {
      return handleQwenApiRequest(request);
    }
    
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    // 错误处理
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * 处理Notion API请求
 * @param {Request} request - 请求对象
 * @returns {Promise<Response>} - 响应对象
 */
async function handleNotionApiRequest(request) {
  try {
    // 从请求中获取Notion API端点
    const url = new URL(request.url);
    const notionEndpoint = url.pathname.replace('/notion', '');
    
    // 从环境变量获取Notion API密钥
    // 使用在文件顶部声明的NOTION_API_KEY变量
    const notionApiKey = NOTION_API_KEY;
    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion API密钥未配置' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 构建Notion API请求
    const notionUrl = `https://api.notion.com/v1${notionEndpoint}`;
    const method = request.method;
    const headers = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };
    
    // 获取请求体
    let body = null;
    if (method !== 'GET' && method !== 'DELETE') {
      body = await request.text();
    }
    
    // 发送请求到Notion API
    const response = await fetch(notionUrl, {
      method,
      headers,
      body
    });
    
    // 获取响应体
    const responseBody = await response.text();
    
    // 返回响应给前端
    return new Response(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * 处理通义千问API请求
 * @param {Request} request - 请求对象
 * @returns {Promise<Response>} - 响应对象
 */
async function handleQwenApiRequest(request) {
  // 只处理POST请求
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 获取请求体
  const body = await request.json();
  
  // 验证参数
  if (!body.messages || !body.apiKey) {
    return new Response(JSON.stringify({ error: '缺少必要参数' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // 将OpenAI格式的messages转换为通义千问的prompt格式
    const prompt = body.messages.map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`).join('\n');
    
    // 构建通义千问API请求
    const apiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: { prompt: prompt },
        parameters: { result_format: 'text' }
      })
    });

    const data = await apiResponse.json();
    
    // 返回响应给前端
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    // 错误处理
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
