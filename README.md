# GitHub学习平台

一个基于GitHub的交互式学习和复习平台，支持跨设备访问，能够存储学习提示词、保存每日对话记录，并生成智能复习计划和习题。

## 功能特性

### 1. 提示词管理
- 存储学习方法和复习方法的提示词
- 支持自定义和扩展提示词
- 通过GitHub API安全存储

### 2. 每日对话记录
- 自动将每日学习和复习对话保存在GitHub仓库中
- 按日期命名的文件夹结构，便于查找和管理
- JSON格式存储，支持随时查看历史记录

### 3. 智能复习计划生成
- 基于学习方法和复习方法提示词生成个性化复习计划
- 支持指定科目和学习目标
- 详细的每日复习内容和方法建议

### 4. 智能习题生成
- 根据指定科目、主题、难度和数量生成习题
- 包含题目、答案和解析
- 支持多种难度级别选择

### 5. 跨设备访问
- 基于Web应用开发，支持在任何有网络的设备上使用
- 通过GitHub Pages部署，无需本地安装
- 配置信息保存在浏览器本地存储中

## 技术栈

- **前端**：HTML5、CSS3、JavaScript
- **后端API**：GitHub API、通义千问API
- **部署**：GitHub Pages
- **数据存储**：GitHub仓库（JSON格式）
- **本地存储**：浏览器LocalStorage

## 部署步骤

### 1. 创建GitHub仓库

1. 在GitHub上创建一个新的仓库（公开或私有均可）
2. 将本项目代码克隆到本地或直接上传

### 2. 配置GitHub Pages

项目已包含GitHub Pages的自动部署配置（.github/workflows/gh-pages.yml），无需额外配置。当代码推送到main分支时，会自动部署到GitHub Pages。

或者，您可以手动配置GitHub Pages：

1. 进入仓库设置
2. 选择"Pages"选项卡
3. 在"Source"部分，选择"Deploy from a branch"
4. 选择"main"分支和根目录
5. 点击"Save"按钮

### 3. 生成API密钥

#### GitHub Token

1. 进入GitHub设置 → Developer settings → Personal access tokens
2. 点击"Generate new token"
3. 选择以下权限：
   - repo (所有repo权限)
4. 生成并保存您的GitHub Token

#### 通义千问API Key

1. 访问阿里云官网 (https://www.aliyun.com/)
2. 登录并进入通义千问API管理页面
3. 生成并保存您的API密钥

#### 5. 配置代理服务器（重要）

由于浏览器安全限制（CORS），无法直接调用通义千问API。您需要配置一个代理服务器：

##### 方案一：使用Cloudflare Workers（推荐，免费）

1. 访问Cloudflare Workers官网 (https://workers.cloudflare.com/)
2. 注册并登录Cloudflare账号（提供免费套餐）
3. 创建一个新的Worker
4. 将项目中的`worker.js`文件内容复制到Worker编辑器中
5. 点击"Deploy"部署Worker
6. 复制生成的Worker URL（如：`https://your-worker-name.your-username.workers.dev`）

**费用说明**：Cloudflare Workers提供免费套餐，包含每天10万次请求，完全满足个人使用需求。

##### 方案二：本地Node.js代理（免费）

1. 安装Node.js（如果尚未安装）
2. 创建一个名为`proxy-server.js`的文件，内容如下：
```javascript
const http = require('http');
const https = require('https');
const url = require('url');

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const prompt = data.messages.map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`).join('\n');

        const options = {
          hostname: 'dashscope.aliyuncs.com',
          path: '/api/v1/services/aigc/text-generation/generation',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${data.apiKey}`,
            'Content-Type': 'application/json'
          }
        };

        const apiReq = https.request(options, apiRes => {
          let apiBody = '';
          apiRes.on('data', chunk => {
            apiBody += chunk.toString();
          });

          apiRes.on('end', () => {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            });
            res.end(apiBody);
          });
        });

        apiReq.on('error', error => {
          res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ error: error.message }));
        });

        apiReq.write(JSON.stringify({
          model: 'qwen-turbo',
          input: { prompt: prompt },
          parameters: { result_format: 'text' }
        }));
        apiReq.end();
      } catch (error) {
        res.writeHead(400, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
  }
});

server.listen(3000, () => {
  console.log('代理服务器运行在 http://localhost:3000');
});
```
3. 在终端中运行：`node proxy-server.js`
4. 使用`http://localhost:3000`作为代理服务器地址

##### 方案三：本地Python代理（免费）

1. 安装Python（如果尚未安装）
2. 创建一个名为`proxy.py`的文件，内容如下：
```python
from flask import Flask, request, jsonify
import requests
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['POST', 'OPTIONS'])
def proxy():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.json
    
    if not data or 'messages' not in data or 'apiKey' not in data:
        return jsonify({'error': '缺少必要参数'}), 400
    
    try:
        # 转换messages格式
        prompt = ''
        for msg in data['messages']:
            role = '用户' if msg['role'] == 'user' else '助手'
            prompt += f"{role}: {msg['content']}\n"
        
        # 调用通义千问API
        api_url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        headers = {
            'Authorization': f'Bearer {data["apiKey"]}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': 'qwen-turbo',
            'input': {'prompt': prompt},
            'parameters': {'result_format': 'text'}
        }
        
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        
        return jsonify(response.json())
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
```
3. 安装依赖：`pip install flask flask-cors requests`
4. 在终端中运行：`python proxy.py`
5. 使用`http://localhost:3000`作为代理服务器地址

## 使用说明

### 1. 访问应用

部署完成后，您可以通过以下方式访问应用：

- GitHub Pages URL：`https://<your-username>.github.io/<repository-name>/`
- 本地开发：运行`python -m http.server 8000`并访问`http://localhost:8000`

### 2. 配置API密钥

首次使用时，需要配置API密钥：

1. 在应用页面顶部的输入框中，输入您的：
   - GitHub Token
   - 通义千问API Key
   - 仓库所有者（GitHub用户名）
   - 仓库名称
   - 代理服务器地址（Cloudflare Workers URL）
2. 点击"保存配置"按钮

配置信息将保存在浏览器的本地存储中，下次访问时会自动加载。

### 3. 使用核心功能

#### 与AI对话

1. 选择"与AI对话"菜单
2. 在输入框中输入您的问题或学习内容
3. 点击"发送"按钮
4. AI将生成回复，对话内容会自动保存到GitHub仓库

#### 生成复习计划

1. 选择"生成复习计划"菜单
2. 输入科目名称
3. 点击"生成复习计划"按钮
4. AI将基于学习方法和复习方法提示词生成详细的复习计划

#### 生成习题

1. 选择"生成习题"菜单
2. 输入科目、主题、选择难度和数量
3. 点击"生成习题"按钮
4. AI将生成指定数量和难度的习题

#### 提示词管理

1. 选择"提示词管理"菜单
2. 输入提示词名称和内容
3. 点击"保存提示词"按钮
4. 提示词将保存到GitHub仓库的prompts文件夹中

### 4. 查看历史记录

在左侧面板的"历史记录"部分，可以查看所有已保存的对话记录。点击任意日期，即可在对话面板中查看该日期的完整对话内容。

## 文件结构

```
.
├── .github/
│   └── workflows/
│       └── gh-pages.yml     # GitHub Pages自动部署配置
├── prompts/                 # 提示词文件夹
│   ├── learning_method.md   # 学习方法提示词
│   └── review_method.md     # 复习方法提示词
├── conversations/           # 对话记录文件夹
│   ├── 2023-05-01.json      # 每日对话记录
│   └── ...
├── index.html               # 主页面
├── style.css                # 样式文件
├── script.js                # JavaScript逻辑
├── worker.js                # Cloudflare Workers代理代码
└── README.md                # 项目说明文档
```

## 注意事项

1. **API密钥安全**：
   - GitHub Token和OpenAI API Key仅保存在您的浏览器本地存储中，不会上传到任何服务器
   - 请妥善保管您的API密钥，不要与他人分享

2. **GitHub仓库权限**：
   - 确保您的GitHub Token具有足够的仓库访问权限
   - 如果使用私有仓库，请确保您的Token具有私有仓库访问权限

3. **通义千问API费用**：
   - 使用通义千问API会产生费用，请关注您的API使用情况
   - 建议设置API使用限额，避免意外费用

4. **代理服务器配置**：
   - 部署到GitHub Pages后必须配置代理服务器才能正常使用AI功能
   - 推荐使用Cloudflare Workers作为代理服务，配置简单且免费
   - 确保代理服务器地址正确配置，否则无法调用通义千问API

4. **浏览器兼容性**：
   - 建议使用最新版本的Chrome、Firefox、Safari或Edge浏览器
   - 确保浏览器支持LocalStorage功能

## 本地开发

如果您想在本地运行和开发此项目，可以使用以下命令：

1. 安装依赖（仅本地Python应用需要）：
   ```
   pip install -r requirements.txt
   ```

2. 启动本地Web服务器：
   ```
   python -m http.server 8000
   ```

3. 访问`http://localhost:8000`

## 扩展和定制

### 自定义提示词

您可以在`prompts`文件夹中添加或修改提示词文件，支持任意数量的提示词。

### 修改AI模型

在`script.js`文件中，您可以修改OpenAI API的模型参数：

```javascript
const body = {
    model: 'gpt-3.5-turbo',  // 可以修改为其他模型，如gpt-4
    messages
};
```

### 调整样式

在`style.css`文件中，您可以自定义应用的样式和布局。

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request，一起改进这个学习平台！