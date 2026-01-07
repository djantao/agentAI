// 全局配置
let config = {
    githubToken: '',
    openaiApiKey: '',
    repoOwner: '',
    repoName: '',
    proxyUrl: '',
    aiModel: 'qwen-turbo'
};

// 加载配置
function loadConfig() {
    const savedConfig = localStorage.getItem('learningPlatformConfig');
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        document.getElementById('github-token').value = config.githubToken;
        document.getElementById('openai-api-key').value = config.openaiApiKey;
        document.getElementById('repo-owner').value = config.repoOwner;
        document.getElementById('repo-name').value = config.repoName;
        if (document.getElementById('proxy-url')) {
            document.getElementById('proxy-url').value = config.proxyUrl;
        }
        if (document.getElementById('ai-model')) {
            document.getElementById('ai-model').value = config.aiModel;
        }
    }
}

// 保存配置
function saveConfig() {
    config.githubToken = document.getElementById('github-token').value;
    config.openaiApiKey = document.getElementById('openai-api-key').value;
    config.repoOwner = document.getElementById('repo-owner').value;
    config.repoName = document.getElementById('repo-name').value;
    if (document.getElementById('proxy-url')) {
        config.proxyUrl = document.getElementById('proxy-url').value;
    }
    if (document.getElementById('ai-model')) {
        config.aiModel = document.getElementById('ai-model').value;
    }
    localStorage.setItem('learningPlatformConfig', JSON.stringify(config));
    alert('配置保存成功！');
}

// GitHub API调用函数
async function githubApiCall(path, method = 'GET', body = null) {
    const url = `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/${path}`;
    const headers = {
        'Authorization': `token ${config.githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
    };
    
    const options = {
        method,
        headers
    };
    
    if (body) {
        options.body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.status} ${await response.text()}`);
        }
        return await response.json();
    } catch (error) {
        console.error('GitHub API Call Error:', error);
        alert(`GitHub API调用失败: ${error.message}`);
        return null;
    }
}

// 阿里通义千问API调用函数
async function tongyiApiCall(messages) {
    try {
        // 检查是否配置了代理服务器
        if (!config.proxyUrl) {
            // 将OpenAI格式的messages转换为通义千问的prompt格式
            const prompt = messages.map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`).join('\n');
            
            // 显示提示信息给用户
            console.log('通义千问API请求信息:');
            console.log('API密钥:', config.openaiApiKey);
            console.log('提示词:', prompt);
            
            alert('未配置代理服务器！\n\n由于浏览器安全限制（CORS），无法直接调用通义千问API。\n\n解决方案：\n1. 配置Cloudflare Workers代理地址\n2. 或在本地运行代理服务器\n\n请求信息已输出到浏览器控制台，请查看。');
            
            // 返回一个模拟响应
            return '未配置代理服务器。请在设置中配置代理地址，或查看浏览器控制台获取请求信息。';
        }
        
        // 使用配置的代理服务器
        const url = config.proxyUrl;
        const headers = {
            'Content-Type': 'application/json'
        };
        
        const body = {
            messages: messages,
            apiKey: config.openaiApiKey,
            model: config.aiModel
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error(`代理服务错误: ${response.status} ${await response.text()}`);
        }
        
        const data = await response.json();
        return data.output.text;
    } catch (error) {
        console.error('通义千问API调用失败:', error);
        alert(`通义千问API调用失败: ${error.message}`);
        return null;
    }
}

// 获取文件内容
async function getGitHubFile(path) {
    try {
        const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${path}`, {
            headers: {
                'Authorization': `token ${config.githubToken}`
            }
        });
        
        if (response.status === 404) {
            return null; // 文件不存在
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.status}`);
        }
        
        const data = await response.json();
        return atob(data.content);
    } catch (error) {
        console.error('Get GitHub File Error:', error);
        return null;
    }
}

// 保存文件到GitHub
async function saveGitHubFile(path, content, message) {
    try {
        const existingFile = await getGitHubFile(path);
        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(content)))
        };
        
        if (existingFile) {
            // 文件存在，更新
            const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${config.githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ...body, sha: existingFile.sha })
            });
            return response.ok;
        } else {
            // 文件不存在，创建
            const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${config.githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            return response.ok;
        }
    } catch (error) {
        console.error('Save GitHub File Error:', error);
        return false;
    }
}

// 获取今天的对话文件名
function getTodayFilename() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.json`;
}

// 加载今天的对话记录
async function loadTodaysConversation() {
    const filename = getTodayFilename();
    const content = await getGitHubFile(`conversations/${filename}`);
    if (content) {
        try {
            return JSON.parse(content);
        } catch (error) {
            console.error('Parse conversation error:', error);
            return [];
        }
    }
    return [];
}

// 保存今天的对话记录
async function saveTodaysConversation(messages) {
    const filename = getTodayFilename();
    const content = JSON.stringify(messages, null, 2);
    return await saveGitHubFile(`conversations/${filename}`, content, `Update conversation: ${filename}`);
}

// 显示消息
function displayMessage(role, content) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 发送消息
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const userMessage = messageInput.value.trim();
    
    if (!userMessage) return;
    
    // 清空输入框
    messageInput.value = '';
    
    // 显示用户消息
    displayMessage('user', userMessage);
    
    // 加载对话历史
    let conversation = await loadTodaysConversation();
    
    // 添加用户消息到历史
    conversation.push({ role: 'user', content: userMessage });
    
    // 调用通义千问API
    const assistantResponse = await tongyiApiCall(conversation);
    
    if (assistantResponse) {
        // 显示助手回复
        displayMessage('assistant', assistantResponse);
        
        // 添加助手回复到历史
        conversation.push({ role: 'assistant', content: assistantResponse });
        
        // 保存对话
        await saveTodaysConversation(conversation);
    }
}

// 生成复习计划
async function generateReviewPlan() {
    const subject = document.getElementById('subject-input').value.trim();
    if (!subject) {
        alert('请输入科目名称！');
        return;
    }
    
    const resultDiv = document.getElementById('review-plan-result');
    resultDiv.textContent = '正在生成复习计划...';
    
    // 获取学习和复习方法提示词
    const learningEfficiency = await getGitHubFile('prompts/learning_efficiency.md');
    const forgettingCurve = await getGitHubFile('prompts/forgetting_curve.md');
    
    // 构建提示词
    const prompt = `
        作为一个学习顾问，根据以下信息为${subject}制定基于高效学习方法论和遗忘曲线的复习计划：
        
        高效学习方法论：
        ${learningEfficiency || '无高效学习方法提示词'}
        
        遗忘曲线复习原理：
        ${forgettingCurve || '无遗忘曲线提示词'}
        
        请制定一个详细的复习计划，包括：
        1. 基于遗忘曲线的个性化复习间隔
        2. 高效学习方法的应用建议
        3. 每日复习内容和时间安排
        4. 复习效果评估方法
        5. 知识点优先级排序
    `;
    
    // 调用通义千问API
    const plan = await tongyiApiCall([{ role: 'user', content: prompt }]);
    
    if (plan) {
        resultDiv.textContent = plan;
    } else {
        resultDiv.textContent = '生成复习计划失败，请检查API配置！';
    }
}

// 生成习题
async function generateExercises() {
    const subject = document.getElementById('exercise-subject').value.trim();
    const topic = document.getElementById('exercise-topic').value.trim();
    const difficulty = document.getElementById('exercise-difficulty').value;
    const count = document.getElementById('exercise-count').value;
    
    if (!subject || !topic) {
        alert('请输入科目和主题！');
        return;
    }
    
    const resultDiv = document.getElementById('exercise-result');
    resultDiv.textContent = '正在生成习题...';
    
    // 构建提示词
    const prompt = `
        作为一个${subject}老师，请为${topic}主题生成${count}道${difficulty}难度的习题。
        
        习题格式：
        1. 题目内容
        答案：
        解析：
        
        请确保习题质量高，能够有效测试学生对知识点的理解。
    `;
    
    // 调用通义千问API
    const exercises = await tongyiApiCall([{ role: 'user', content: prompt }]);
    
    if (exercises) {
        resultDiv.textContent = exercises;
    } else {
        resultDiv.textContent = '生成习题失败，请检查API配置！';
    }
}

// 生成加强记忆的知识点
async function generateMemoryPoints() {
    const resultDiv = document.getElementById('memory-points-result');
    resultDiv.textContent = '正在分析学习历史并生成加强记忆的知识点...';
    
    try {
        // 获取所有历史对话记录
        const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/conversations`, {
            headers: {
                'Authorization': `token ${config.githubToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取学习历史失败');
        }
        
        const files = await response.json();
        let allConversations = '';
        
        // 获取每个对话文件的内容
        for (const file of files) {
            const content = await getGitHubFile(file.path);
            if (content) {
                const messages = JSON.parse(content);
                // 提取对话内容，按时间排序
                const conversationText = messages.map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`).join('\n');
                allConversations += `\n=== ${file.name.replace('.json', '')} ===\n${conversationText}\n`;
            }
        }
        
        // 获取遗忘曲线提示词
        const forgettingCurve = await getGitHubFile('prompts/forgetting_curve.md');
        
        // 构建提示词
        const prompt = `
            作为一个学习顾问，基于以下学习历史记录和遗忘曲线原理，分析并生成需要加强记忆的知识点：
            
            学习历史记录：
            ${allConversations}
            
            遗忘曲线原理：
            ${forgettingCurve || '无遗忘曲线提示词'}
            
            请分析这些学习记录，找出：
            1. 关键知识点
            2. 可能已经遗忘的内容
            3. 需要加强记忆的重点
            4. 基于遗忘曲线的复习建议
            
            请以清晰的结构呈现，突出需要加强记忆的知识点。
        `;
        
        // 调用通义千问API
        const memoryPoints = await tongyiApiCall([{ role: 'user', content: prompt }]);
        
        if (memoryPoints) {
            resultDiv.textContent = memoryPoints;
        } else {
            resultDiv.textContent = '生成加强记忆知识点失败，请检查API配置！';
        }
    } catch (error) {
        console.error('生成加强记忆知识点错误:', error);
        resultDiv.textContent = `生成加强记忆知识点失败: ${error.message}`;
    }
}

// 切换内容面板
function switchPanel(panelId) {
    // 隐藏所有面板
    document.querySelectorAll('.content-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    // 移除所有菜单按钮的active类
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的面板
    document.getElementById(panelId).classList.remove('hidden');
    
    // 激活对应的菜单按钮
    const btnId = panelId.replace('-container', '-btn');
    if (document.getElementById(btnId)) {
        document.getElementById(btnId).classList.add('active');
    }
}

// 加载历史记录
async function loadHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '加载历史记录中...';
    
    try {
        const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/conversations`, {
            headers: {
                'Authorization': `token ${config.githubToken}`
            }
        });
        
        if (!response.ok) {
            historyList.innerHTML = '加载历史记录失败';
            return;
        }
        
        const files = await response.json();
        historyList.innerHTML = '';
        
        // 按日期排序（最新的在前面）
        files.sort((a, b) => new Date(b.name) - new Date(a.name));
        
        files.forEach(file => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.textContent = file.name.replace('.json', '');
            itemDiv.onclick = async () => {
                // 加载并显示历史对话
                const content = await getGitHubFile(file.path);
                if (content) {
                    const messages = JSON.parse(content);
                    const chatMessages = document.getElementById('chat-messages');
                    chatMessages.innerHTML = '';
                    messages.forEach(msg => {
                        displayMessage(msg.role, msg.content);
                    });
                    // 切换到对话面板
                    switchPanel('chat-container');
                }
            };
            historyList.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Load history error:', error);
        historyList.innerHTML = '加载历史记录失败';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载配置
    loadConfig();
    
    // 绑定事件
    document.getElementById('save-config').addEventListener('click', saveConfig);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            sendMessage();
        }
    });
    
    // 菜单按钮事件
    document.getElementById('chat-btn').addEventListener('click', () => switchPanel('chat-container'));
    document.getElementById('review-plan-btn').addEventListener('click', () => switchPanel('review-plan-container'));
    document.getElementById('memory-points-btn').addEventListener('click', () => switchPanel('memory-points-container'));
    document.getElementById('exercise-btn').addEventListener('click', () => switchPanel('exercise-container'));
    document.getElementById('prompts-btn').addEventListener('click', () => switchPanel('prompts-container'));
    
    // 功能按钮事件
    document.getElementById('generate-plan-btn').addEventListener('click', generateReviewPlan);
    document.getElementById('generate-memory-points-btn').addEventListener('click', generateMemoryPoints);
    document.getElementById('generate-exercise-btn').addEventListener('click', generateExercises);
    
    // 定时加载历史记录
    setInterval(loadHistory, 10000);
});
