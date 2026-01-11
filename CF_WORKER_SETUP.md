# Cloudflare Worker 代理配置指南

## 问题分析

从您的反馈来看，Cloudflare Worker代理的通义千问API部分工作正常，但Notion API代理部分返回405 Method Not Allowed错误。这可能是由以下原因导致的：

1. **Worker部署问题**：Worker可能没有正确部署
2. **环境变量配置问题**：NOTION_API_KEY可能没有正确设置
3. **测试方法问题**：测试URL可能不完整
4. **网络连接问题**：网络可能阻止了对Cloudflare Workers的访问

## 解决方案

### 1. 确认Worker代码

您的worker.js代码看起来是正确的，支持所有HTTP方法的Notion API请求。让我为您提供一个更清晰的版本：

```javascript
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
```

### 2. 重新部署Worker

1. 登录Cloudflare Dashboard
2. 导航到Workers & Pages
3. 找到您的Worker（agentai-proxy）
4. 点击"Quick edit"
5. 复制上面的代码替换现有代码
6. 点击"Save and deploy"

### 3. 配置环境变量

1. 在Worker编辑页面，点击右上角的"Settings"
2. 选择"Variables"
3. 在"Secret variables"部分，点击"Add variable"
4. 输入：
   - **Name**: NOTION_API_KEY
   - **Value**: 您的Notion API密钥
5. 点击"Save and deploy"

### 4. 正确测试Notion API代理

#### 使用curl测试：

```bash
# 测试数据库查询（替换为您的数据库ID）
curl -X POST -H "Content-Type: application/json" "https://agentai-proxy.timbabys80.workers.dev/notion/databases/[您的数据库ID]/query" -d '{"filter": {"property": "状态", "select": {"equals": "活跃"}}}'

# 测试用户信息（基本API测试）
curl -X GET "https://agentai-proxy.timbabys80.workers.dev/notion/users/me"
```

#### 使用浏览器控制台测试：

```javascript
// 测试数据库查询（替换为您的数据库ID和代理URL）
fetch('https://agentai-proxy.timbabys80.workers.dev/notion/databases/[您的数据库ID]/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filter: {
      property: '状态',
      select: {
        equals: '活跃'
      }
    }
  })
})
.then(response => response.json())
.then(data => console.log('测试结果:', data))
.catch(error => console.error('测试失败:', error));
```

### 5. 检查前端配置

确保您在应用中正确配置了：

1. **Notion代理地址**：`https://agentai-proxy.timbabys80.workers.dev`
2. **课程表数据库ID**：您的Notion数据库ID

## 替代方案：使用公共代理服务

如果您仍然遇到问题，可以考虑使用公共CORS代理服务，如：

```javascript
// 在script.js中临时修改notionApiCall函数
async function notionApiCall(endpoint, method = 'GET', body = null) {
  try {
    // 使用公共CORS代理
    const proxyUrl = `https://cors-anywhere.herokuapp.com/https://api.notion.com/v1${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${config.notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(proxyUrl, options);
    
    if (!response.ok) {
      throw new Error(`Notion API错误: ${response.status} ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Notion API调用失败:', error);
    alert(`Notion API调用失败: ${error.message}`);
    return null;
  }
}
```

## 注意事项

1. **安全性**：公共代理服务不适合生产环境，因为您的API密钥会暴露给第三方
2. **可靠性**：公共代理服务可能不稳定或有使用限制
3. **长期解决方案**：建议继续使用Cloudflare Workers代理，因为它更安全和可靠

如果您需要进一步的帮助，请提供以下信息：

1. Worker部署历史截图
2. 完整的错误信息
3. 您的Notion数据库ID（前几位即可，用于验证格式）

祝您使用愉快！