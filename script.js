// 全局配置
let config = {
    githubToken: '',
    openaiApiKey: '',
    repoOwner: '',
    repoName: '',
    proxyUrl: '',
    aiModel: 'qwen-turbo',
    notionApiKey: '',
    notionDatabaseId: '',
    webhookUrl: '',
    uiStyle: 'github'
};

// 课程列表和学习进度存储
let courseProgress = {
    currentCourse: null,
    currentModule: null,
    modulesCompleted: [],
    learningHistory: [],
    availableCourses: [],
    coursesLearned: []
};

// 检查并创建GitHub目录（通过创建.gitkeep文件）
async function ensureGitHubDirectory(directoryPath) {
    try {
        // 检查配置是否完整
        if (!config.githubToken || !config.repoOwner || !config.repoName) {
            console.warn('GitHub配置不完整，无法确保目录存在');
            return false;
        }
        
        // 创建.gitkeep文件来确保目录存在
        const filePath = `${directoryPath}/.gitkeep`;
        const content = '';
        const message = `Ensure directory ${directoryPath} exists`;
        
        // 直接尝试创建.gitkeep文件，不管目录是否存在
        // GitHub API会自动创建不存在的父目录
        const success = await saveGitHubFile(filePath, content, message);
        return success;
    } catch (error) {
        console.error('确保GitHub目录存在时发生错误:', error);
        // 即使目录创建失败，也尝试继续保存文件，因为GitHub API可能会自动创建目录
        return true;
    }
}

// 保存课程进度到GitHub
async function saveCourseProgressToGitHub() {
    try {
        // 确保配置了GitHub相关信息
        if (!config.githubToken || !config.repoOwner || !config.repoName) {
            console.warn('GitHub配置不完整，无法保存课程进度到GitHub');
            return false;
        }
        
        console.log('尝试保存课程进度到GitHub...');
        
        // 保存到GitHub的courseList目录
        const filePath = 'courseList/courseProgress.json';
        const content = JSON.stringify(courseProgress, null, 2);
        const message = `Update course progress - ${new Date().toISOString()}`;
        
        // 首先尝试直接保存文件（GitHub API通常会自动创建目录）
        let success = await saveGitHubFile(filePath, content, message);
        if (success) {
            console.log('课程进度已保存到GitHub:', filePath);
            return true;
        }
        
        console.error('直接保存失败，尝试分步创建目录和文件...');
        
        // 第一步：确保conversations目录存在（参考已验证的工作方式）
        const todayFile = getTodayFilename();
        const testConversationPath = `conversations/${todayFile}`;
        const testContent = JSON.stringify([], null, 2);
        const testMessage = `Test directory creation - ${new Date().toISOString()}`;
        
        // 尝试保存一个空的对话文件来确保目录结构正常
        const testSaveSuccess = await saveGitHubFile(testConversationPath, testContent, testMessage);
        if (testSaveSuccess) {
            console.log('测试对话文件保存成功，目录结构正常');
        }
        
        // 第二步：再次尝试保存课程进度文件
        success = await saveGitHubFile(filePath, content, message);
        if (success) {
            console.log('课程进度已保存到GitHub:', filePath);
            return true;
        }
        
        console.error('保存课程进度到GitHub失败');
        return false;
    } catch (error) {
        console.error('保存课程进度到GitHub时发生错误:', error);
        return false;
    }
}

// 从GitHub加载课程进度
async function loadCourseProgressFromGitHub() {
    try {
        // 确保配置了GitHub相关信息
        if (!config.githubToken || !config.repoOwner || !config.repoName) {
            console.warn('GitHub配置不完整，无法从GitHub加载课程进度');
            return false;
        }
        
        // 从GitHub的courseList目录加载
        const filePath = 'courseList/courseProgress.json';
        const content = await getGitHubFile(filePath);
        
        if (content) {
            courseProgress = JSON.parse(content);
            localStorage.setItem('courseProgress', JSON.stringify(courseProgress));
            console.log('课程进度已从GitHub加载');
            return true;
        } else {
            console.warn('GitHub上不存在课程进度文件，使用本地存储');
            return false;
        }
    } catch (error) {
        console.error('从GitHub加载课程进度时发生错误:', error);
        return false;
    }
}



// 保存课程进度
async function saveCourseProgress() {
    // 保存到本地存储
    localStorage.setItem('courseProgress', JSON.stringify(courseProgress));
    
    // 尝试保存到GitHub
    const savedToGitHub = await saveCourseProgressToGitHub();
    
    return savedToGitHub;
}

// 加载课程进度
async function loadCourseProgress() {
    // 优先从GitHub加载
    const loadedFromGitHub = await loadCourseProgressFromGitHub();
    
    // 如果GitHub加载失败，使用本地存储
    if (!loadedFromGitHub) {
        const savedProgress = localStorage.getItem('courseProgress');
        if (savedProgress) {
            courseProgress = JSON.parse(savedProgress);
        }
    }
    
    console.log('课程进度已加载。');
}







// 初始化课程进度
async function initializeApp() {
    await loadCourseProgress();
    loadStyle();
    loadConfig();
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);

// Notion API调用函数
async function notionApiCall(endpoint, method = 'GET', body = null) {
    try {
        if (!config.notionApiKey || !config.notionDatabaseId) {
            alert('未配置Notion API密钥或数据库ID！');
            return null;
        }
        
        const url = `https://api.notion.com/v1${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${config.notionApiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        };
        
        const options = {
            method,
            headers
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
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

// 同步学习进度到Notion
async function syncProgressToNotion(progressData) {
    if (!config.notionDatabaseId) {
        alert('未配置Notion数据库ID！');
        return false;
    }
    
    const notionData = {
        parent: {
            database_id: config.notionDatabaseId
        },
        properties: {
            '日期': {
                date: {
                    start: new Date(progressData.date).toISOString()
                }
            },
            '科目': {
                title: [
                    {
                        text: {
                            content: progressData.subject
                        }
                    }
                ]
            },
            '模块': {
                rich_text: [
                    {
                        text: {
                            content: progressData.module
                        }
                    }
                ]
            },
            '时长': {
                number: progressData.duration
            },
            '状态': {
                select: {
                    name: progressData.status
                }
            },
            '可信度': {
                select: {
                    name: progressData.credibility
                }
            },
            '摘要': {
                rich_text: [
                    {
                        text: {
                            content: progressData.summary
                        }
                    }
                ]
            },
            '挑战': {
                rich_text: [
                    {
                        text: {
                            content: progressData.challenge
                        }
                    }
                ]
            }
        }
    };
    
    const result = await notionApiCall('/pages', 'POST', notionData);
    return result !== null;
}

// 从Notion同步数据到本地
async function syncDataFromNotion() {
    if (!config.notionDatabaseId) {
        alert('未配置Notion数据库ID！');
        return false;
    }
    
    const filter = {
        property: '日期',
        date: {
            on_or_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 同步最近30天的数据
        }
    };
    
    const result = await notionApiCall(`/databases/${config.notionDatabaseId}/query`, 'POST', { filter });
    
    if (result) {
        // 处理同步回来的数据
        const syncedProgress = result.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                subject: props['科目']?.title[0]?.text?.content || '',
                module: props['模块']?.rich_text[0]?.text?.content || '',
                duration: props['时长']?.number || 0,
                status: props['状态']?.select?.name || '',
                summary: props['摘要']?.rich_text[0]?.text?.content || '',
                challenge: props['挑战']?.rich_text[0]?.text?.content || '',
                credibility: props['可信度']?.select?.name || '中',
                date: props['日期']?.date?.start || new Date().toISOString()
            };
        });
        
        // 合并到本地数据
        const localProgress = getProgressData();
        const notionIds = new Set(syncedProgress.map(p => p.id));
        
        // 只保留本地没有的Notion数据
        const newProgress = syncedProgress.filter(p => !localProgress.some(local => local.id === p.id));
        
        // 保存合并后的数据
        if (newProgress.length > 0) {
            const allProgress = [...localProgress, ...newProgress];
            saveProgressData(allProgress);
            updateProgressDisplay();
            updateSubjectModuleDropdowns();
            
            alert(`成功从Notion同步了 ${newProgress.length} 条学习记录！`);
            return true;
        } else {
            alert('没有新的数据需要同步！');
            return false;
        }
    }
    
    return false;
}

// 集简云Webhook调用函数
async function webhookCall(data) {
    try {
        if (!config.webhookUrl) {
            console.log('未配置集简云Webhook URL！');
            return false;
        }
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Webhook调用失败: ${response.status} ${await response.text()}`);
        }
        
        console.log('集简云Webhook调用成功！');
        return true;
    } catch (error) {
        console.error('Webhook调用错误:', error);
        return false;
    }
}

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
        if (document.getElementById('notion-api-key')) {
            document.getElementById('notion-api-key').value = config.notionApiKey;
        }
        if (document.getElementById('notion-database-id')) {
            document.getElementById('notion-database-id').value = config.notionDatabaseId;
        }
        if (document.getElementById('webhook-url')) {
            document.getElementById('webhook-url').value = config.webhookUrl;
        }
        if (document.getElementById('style-selector')) {
            document.getElementById('style-selector').value = config.uiStyle;
        }
    }
    // 应用当前UI风格
    applyUIStyle(config.uiStyle);
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
    if (document.getElementById('notion-api-key')) {
        config.notionApiKey = document.getElementById('notion-api-key').value;
    }
    if (document.getElementById('notion-database-id')) {
        config.notionDatabaseId = document.getElementById('notion-database-id').value;
    }
    if (document.getElementById('webhook-url')) {
        config.webhookUrl = document.getElementById('webhook-url').value;
    }
    if (document.getElementById('style-selector')) {
        config.uiStyle = document.getElementById('style-selector').value;
    }
    localStorage.setItem('learningPlatformConfig', JSON.stringify(config));
    // 应用保存的UI风格
    applyUIStyle(config.uiStyle);
    alert('配置保存成功！');
}

// 应用UI风格
function applyUIStyle(styleName) {
    // 移除所有风格类
    document.body.classList.remove('style-github', 'style-dark', 'style-light', 'style-modern');
    
    // 添加选中的风格类
    if (styleName !== 'github') {
        document.body.classList.add(`style-${styleName}`);
    }
    
    // 更新配置
    config.uiStyle = styleName;
}

// 加载保存的UI风格
function loadStyle() {
    const savedStyle = localStorage.getItem('selectedStyle') || 'github';
    const styleSelector = document.getElementById('style-selector');
    if (styleSelector) {
        styleSelector.value = savedStyle;
        applyUIStyle(savedStyle);
    }
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

// 检查是否是课程选择请求
function isCourseSelection(message) {
    // 检查是否有可用课程
    if (!courseProgress.availableCourses || courseProgress.availableCourses.length === 0) {
        return false;
    }
    
    // 匹配课程选择的模式
    const selectionPatterns = [
        // 直接输入序号
        /^\s*[0-9]+\s*$/,  // 1, 2, 3
        /^\s*[0-9]+\.\s*$/,  // 1., 2., 3.
        
        // 中文数字选择
        /^\s*第[一二三四五六七八九十]+个\s*$/,  // 第一个, 第二个
        /^\s*第[一二三四五六七八九十]+项\s*$/,  // 第一项, 第二项
        
        // 包含课程名称的选择
        /^\s*(选|学习|我要学)\s*(.+?)\s*$/,  // 选JavaScript基础, 学习Python入门
        
        // 自然语言选择
        /^\s*(我想学习|我选择|选择)\s*(第?[0-9]+(?:\.\s*)?|.+?)\s*$/,  // 我想学习第1个, 我选择Python
        
        // 仅数字或课程名
        /^\s*([0-9]+|.+?)\s*$/
    ];
    
    // 检查是否匹配任何选择模式
    return selectionPatterns.some(pattern => pattern.test(message));
}

// 解析课程选择
function parseCourseSelection(message) {
    // 检查是否有可用课程
    if (!courseProgress.availableCourses || courseProgress.availableCourses.length === 0) {
        return null;
    }
    
    // 标准化消息
    let normalizedMessage = message.trim().toLowerCase();
    
    // 处理直接序号选择
    const directNumberMatch = normalizedMessage.match(/^\s*([0-9]+)\s*\.?(?:\s*|$)/);
    if (directNumberMatch) {
        const courseIndex = parseInt(directNumberMatch[1]) - 1;
        if (courseIndex >= 0 && courseIndex < courseProgress.availableCourses.length) {
            return courseProgress.availableCourses[courseIndex];
        }
    }
    
    // 处理中文数字选择
    const chineseNumbers = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };
    const chineseNumberMatch = normalizedMessage.match(/^\s*第([一二三四五六七八九十]+)(个|项|)\s*$/);
    if (chineseNumberMatch) {
        const numberStr = chineseNumberMatch[1];
        const courseIndex = (chineseNumbers[numberStr] || 0) - 1;
        if (courseIndex >= 0 && courseIndex < courseProgress.availableCourses.length) {
            return courseProgress.availableCourses[courseIndex];
        }
    }
    
    // 处理包含"选"或"学习"的选择
    const learnPattern = normalizedMessage.match(/^\s*(选|学习|我要学)\s*(.+?)\s*$/);
    if (learnPattern) {
        normalizedMessage = learnPattern[2];
    }
    
    // 处理"我想学习"或"我选择"的模式
    const wantLearnPattern = normalizedMessage.match(/^\s*(我想学习|我选择|选择)\s*(第?[0-9]+(?:\.\s*)?|.+?)\s*$/);
    if (wantLearnPattern) {
        normalizedMessage = wantLearnPattern[2];
    }
    
    // 再次检查是否是数字
    const numberMatch = normalizedMessage.match(/^\s*第?([0-9]+)\s*\.?(?:\s*|$)/);
    if (numberMatch) {
        const courseIndex = parseInt(numberMatch[1]) - 1;
        if (courseIndex >= 0 && courseIndex < courseProgress.availableCourses.length) {
            return courseProgress.availableCourses[courseIndex];
        }
    }
    
    // 模糊匹配课程名称
    const matchedCourse = courseProgress.availableCourses.find(course => 
        course.name.toLowerCase().includes(normalizedMessage) || 
        normalizedMessage.includes(course.name.toLowerCase())
    );
    
    return matchedCourse;
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
        // 先获取文件的sha值（如果存在）
        let sha = null;
        const getResponse = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${path}`, {
            headers: {
                'Authorization': `token ${config.githubToken}`
            }
        });
        
        if (getResponse.ok) {
            const existingFile = await getResponse.json();
            sha = existingFile.sha;
        }
        
        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(content)))
        };
        
        if (sha) {
            // 文件存在，更新
            const response = await fetch(`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${config.githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ...body, sha })
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
    messageDiv.innerHTML = markdownToHtml(content);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 简单的Markdown解析器
function markdownToHtml(markdown) {
    // 标题
    markdown = markdown.replace(/^#\s(.+)$/gm, '<h1>$1</h1>');
    markdown = markdown.replace(/^##\s(.+)$/gm, '<h2>$2</h2>');
    markdown = markdown.replace(/^###\s(.+)$/gm, '<h3>$3</h3>');
    
    // 粗体
    markdown = markdown.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体
    markdown = markdown.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // 无序列表
    markdown = markdown.replace(/^-\s(.+)$/gm, '<li>$1</li>');
    markdown = markdown.replace(/(?:<li>.*?<\/li>)+/gs, '<ul>$&</ul>');
    
    // 有序列表
    markdown = markdown.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');
    markdown = markdown.replace(/(?:<li>.*?<\/li>)+/gs, '<ol>$&</ol>');
    
    // 代码块
    markdown = markdown.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
    
    // 行内代码
    markdown = markdown.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // 链接
    markdown = markdown.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 分隔线
    markdown = markdown.replace(/^---$/gm, '<hr>');
    
    // 段落
    markdown = markdown.replace(/^(?!<h|<ul|<ol|<li|<pre|<code).+$/gm, '<p>$&</p>');
    
    return markdown;
}

// 发送消息
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const userMessage = messageInput.value.trim();
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (!userMessage) return;
    
    // 显示加载状态
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }
    
    // 清空输入框
    messageInput.value = '';
    
    // 显示用户消息
    displayMessage('user', userMessage);
    
    try {
    
    // 加载对话历史
    let conversation = await loadTodaysConversation();
    
    // 限制对话历史长度，只保留最近5轮对话
    if (conversation.length > 10) {
        conversation = conversation.slice(-10);
    }
    
    // 添加用户消息到历史
    conversation.push({ role: 'user', content: userMessage });
    
    // 检查是否是课程请求或课程选择
    let assistantResponse = '';
    
    // 检查是否是请求学习课程
    const courseRequestPatterns = [
        /(学习|想学|了解|入门).*(课程|课|教程|知识|技能)/i,
        /推荐.*(课程|课|教程)/i,
        /我想学习.*$/i,
        /可以教我.*吗？?/i
    ];
    
    let isCourseRequest = false;
    for (const pattern of courseRequestPatterns) {
        if (pattern.test(userMessage)) {
            isCourseRequest = true;
            break;
        }
    }
    
    if (isCourseRequest) {
        // 生成课程列表的优化提示词
        const coursePrompt = conversation.slice(-1).concat([{
            role: 'system',
            content: '你是一个专业的课程规划师，请根据用户的学习需求，首先精准识别用户想要学习的具体内容和主题。然后为该主题设计一个完整的学习路径，必须分为初中高三个难度级别。\n\n每个课程必须严格包含以下信息：\n1. 序号（阿拉伯数字）\n2. 课程名称（简洁明了，反映课程核心内容）\n3. 课程简介（不超过80字，突出该课程在学习路径中的作用和价值）\n4. 适合难度（只能是：初级/中级/高级，确保三个级别都有覆盖）\n\n请严格按照以下格式输出，不要添加任何额外内容：\n1. 课程名称：[名称]，简介：[简介]，难度：[难度]\n2. 课程名称：[名称]，简介：[简介]，难度：[难度]\n...\n\n要求：\n1. 必须覆盖初级、中级、高级三个难度级别\n2. 课程顺序要符合学习的渐进性和逻辑性\n3. 每个级别至少包含2-3门课程\n4. 课程内容要与用户的学习需求高度相关'
        }]);
        
        assistantResponse = await tongyiApiCall(coursePrompt);
        
        if (assistantResponse) {
            // 显示助手回复
            displayMessage('assistant', assistantResponse);
            
            // 添加助手回复到历史
            conversation.push({ role: 'assistant', content: assistantResponse });
            
            // 保存对话
            await saveTodaysConversation(conversation);
            
            // 保存课程列表到courseProgress
            courseProgress.availableCourses = courseProgress.availableCourses || [];
            // 尝试解析生成的课程列表
            const courseLines = assistantResponse.split('\n').filter(line => line.match(/^\d+\./));
            const courses = courseLines.map(line => {
                const match = line.match(/^(\d+)\.\s*课程名称：(.+?)，简介：(.+?)，难度：(.+?)$/);
                if (match) {
                    // 根据难度生成默认模块
                    let modules = [];
                    if (match[4] === '初级') {
                        modules = ['基础知识', '概念理解', '简单应用'];
                    } else if (match[4] === '中级') {
                        modules = ['核心原理', '实践应用', '案例分析'];
                    } else if (match[4] === '高级') {
                        modules = ['高级特性', '深入理解', '综合应用', '优化技巧'];
                    }
                    
                    return {
                        id: match[1],
                        name: match[2],
                        description: match[3],
                        difficulty: match[4],
                        modules: modules // 添加modules字段
                    };
                }
                return null;
            }).filter(Boolean);
            
            if (courses.length > 0) {
                courseProgress.availableCourses = courses;
                await saveCourseProgress();
                // 延迟显示课程选择界面，确保对话已保存
                setTimeout(() => showCourseSelection(), 500);
            }
        } else {
            // 如果API调用失败，显示错误信息
            const errorMessage = '很抱歉，我暂时无法生成课程列表。请检查API配置或稍后重试。';
            displayMessage('assistant', errorMessage);
            conversation.push({ role: 'assistant', content: errorMessage });
            await saveTodaysConversation(conversation);
        }
    }
    // 检查是否是选择课程
    else if (isCourseSelection(userMessage)) {
        // 解析用户选择的课程
        const selectedCourse = parseCourseSelection(userMessage);
        if (selectedCourse) {
            // 使用统一的费曼学习法教学函数
            await startFeynmanLearning(selectedCourse);
        }
    }
    // 正常对话
    else {
        // 调用通义千问API
        assistantResponse = await tongyiApiCall(conversation);
        
        if (assistantResponse) {
            // 显示助手回复
            displayMessage('assistant', assistantResponse);
            
            // 添加助手回复到历史
            conversation.push({ role: 'assistant', content: assistantResponse });
            
            // 保存对话
            await saveTodaysConversation(conversation);
        } else {
            // 如果API调用失败，显示错误信息
            const errorMessage = '很抱歉，我暂时无法提供回复。请检查API配置或稍后重试。';
            displayMessage('assistant', errorMessage);
            conversation.push({ role: 'assistant', content: errorMessage });
            await saveTodaysConversation(conversation);
        }
    }
    } catch (error) {
        console.error('发送消息失败:', error);
        const errorMessage = '很抱歉，处理消息时发生错误，请重试';
        displayMessage('assistant', errorMessage);
        
        // 保存错误消息到对话历史
        let conversation = await loadTodaysConversation();
        conversation.push({ role: 'assistant', content: errorMessage });
        await saveTodaysConversation(conversation);
    } finally {
        // 隐藏加载状态
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
        
        // 确保对话面板可见
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer && chatContainer.classList.contains('hidden')) {
            chatContainer.classList.remove('hidden');
        }
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
    resultDiv.textContent = '正在生成个性化复习计划...';
    
    // 构建个性化学习数据
    const today = new Date().toISOString();
    
    // 筛选与输入科目相关的学习数据
    const relevantCourses = courseProgress.coursesLearned?.filter(course => 
        course.name.includes(subject) || 
        Object.values(course.moduleMastery || {}).some(module => module.name.includes(subject))
    ) || [];
    
    // 收集相关模块数据
    const relevantModules = [];
    relevantCourses.forEach(course => {
        if (course.moduleMastery) {
            Object.values(course.moduleMastery).forEach(module => {
                relevantModules.push({
                    course: course.name,
                    module: module.name,
                    masteryLevel: module.masteryLevel,
                    lastLearnedDate: module.lastLearnedDate,
                    learningCount: module.learningCount,
                    reviewCount: module.reviewCount,
                    nextReviewDate: module.nextReviewDate,
                    isOverdue: module.nextReviewDate && module.nextReviewDate <= today
                });
            });
        }
    });
    
    // 如果没有直接相关的课程，使用所有学习数据
    const finalCourses = relevantCourses.length > 0 ? relevantCourses : courseProgress.coursesLearned || [];
    const finalModules = relevantModules.length > 0 ? relevantModules : [];
    
    // 获取学习和复习方法提示词
    const learningEfficiency = await getGitHubFile('prompts/learning_efficiency.md');
    const forgettingCurve = await getGitHubFile('prompts/forgetting_curve.md');
    
    // 构建个性化提示词
    const prompt = `
        作为一个学习顾问，根据以下个性化学习数据、高效学习方法论和遗忘曲线原理，为${subject}制定详细的复习计划：
        
        个性化学习数据：
        1. 相关课程信息：
        ${JSON.stringify(finalCourses.map(course => ({
            name: course.name,
            difficulty: course.difficulty,
            firstLearnedDate: course.firstLearnedDate,
            lastLearnedDate: course.lastLearnedDate,
            learningCount: course.learningCount,
            moduleCount: course.moduleMastery ? Object.keys(course.moduleMastery).length : 0
        })), null, 2)}
        
        2. 相关模块详细数据：
        ${finalModules.length > 0 ? JSON.stringify(finalModules, null, 2) : '暂无详细模块数据'}
        
        3. 当前日期：${today}
        
        高效学习方法论：
        ${learningEfficiency || '无高效学习方法提示词'}
        
        遗忘曲线复习原理：
        ${forgettingCurve || '无遗忘曲线提示词'}
        
        请制定一个高度个性化的复习计划，包括：
        1. 基于模块掌握度和遗忘曲线的个性化复习间隔
        2. 针对每个模块的复习优先级（掌握度低、逾期未复习的模块优先）
        3. 每日复习内容和合理的时间安排
        4. 结合费曼学习法的高效复习方法建议
        5. 复习效果评估方法（如何判断是否真正掌握）
        6. 根据掌握度提升情况的动态调整策略
        7. 短期（1周）和长期（1个月）复习目标
        
        请以清晰、结构化的方式呈现，突出个性化特点，语言通俗易懂，便于执行。
    `;
    
    // 调用通义千问API
    const plan = await tongyiApiCall([{ role: 'user', content: prompt }]);
    
    if (plan) {
        resultDiv.textContent = plan;
        
        // 发送Webhook通知到集简云
        webhookCall({
            type: 'review_plan_generated',
            data: {
                subject: subject,
                plan: plan,
                date: new Date().toISOString(),
                personalized: true,
                relevantCourseCount: finalCourses.length,
                relevantModuleCount: finalModules.length
            }
        });
    } else {
        resultDiv.textContent = '生成个性化复习计划失败，请检查API配置！';
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
        
        // 发送Webhook通知到集简云
        webhookCall({
            type: 'exercises_generated',
            data: {
                subject: subject,
                topic: topic,
                difficulty: difficulty,
                count: count,
                exercises: exercises,
                date: new Date().toISOString()
            }
        });
    } else {
        resultDiv.textContent = '生成习题失败，请检查API配置！';
    }
}

// 生成高效学习综合建议
async function generateEfficientLearningSuggestions() {
    let resultDiv = document.getElementById('learning-suggestions-result');
    if (!resultDiv) {
        // 如果没有结果显示区域，创建一个临时的
        resultDiv = document.createElement('div');
        resultDiv.id = 'learning-suggestions-result';
        resultDiv.style.cssText = 'margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px;';
        document.body.appendChild(resultDiv);
    }
    
    resultDiv.textContent = '正在生成高效学习建议...';
    
    try {
        // 构建完整的学习数据概览
        const today = new Date().toISOString();
        
        // 计算整体学习统计
        const totalCourses = courseProgress.coursesLearned?.length || 0;
        const totalModules = courseProgress.coursesLearned?.reduce((count, course) => 
            count + (course.moduleMastery ? Object.keys(course.moduleMastery).length : 0), 0
        ) || 0;
        const totalLearningSessions = courseProgress.learningHistory?.length || 0;
        
        // 识别需要复习的模块（按优先级排序）
        const modulesToReview = [];
        const masteredModules = [];
        
        courseProgress.coursesLearned?.forEach(course => {
            if (course.moduleMastery) {
                Object.values(course.moduleMastery).forEach(module => {
                    if (module.nextReviewDate && module.nextReviewDate <= today) {
                        modulesToReview.push({
                            course: course.name,
                            module: module.name,
                            masteryLevel: module.masteryLevel,
                            lastLearnedDate: module.lastLearnedDate,
                            daysSinceLastReview: Math.ceil((new Date(today) - new Date(module.lastLearnedDate)) / (1000 * 60 * 60 * 24)),
                            isUrgent: module.masteryLevel < 3 // 掌握度低的模块更紧急
                        });
                    } else if (module.masteryLevel >= 4) {
                        masteredModules.push({
                            course: course.name,
                            module: module.name,
                            masteryLevel: module.masteryLevel
                        });
                    }
                });
            }
        });
        
        // 按优先级排序（掌握度低的模块优先）
        modulesToReview.sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return a.masteryLevel - b.masteryLevel;
        });
        
        // 分析学习模式
        const recentLearningSessions = courseProgress.learningHistory?.slice(-10) || [];
        const mostActiveCourses = {};
        const mostActiveModules = {};
        
        recentLearningSessions.forEach(session => {
            if (session.course) {
                mostActiveCourses[session.course] = (mostActiveCourses[session.course] || 0) + 1;
            }
            if (session.module && session.module !== '全部内容') {
                mostActiveModules[session.module] = (mostActiveModules[session.module] || 0) + 1;
            }
        });
        
        // 转换为数组并排序
        const sortedCourses = Object.entries(mostActiveCourses)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);
        
        const sortedModules = Object.entries(mostActiveModules)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        // 获取高效学习和遗忘曲线提示词
        const learningEfficiency = await getGitHubFile('prompts/learning_efficiency.md');
        const forgettingCurve = await getGitHubFile('prompts/forgetting_curve.md');
        
        // 构建综合提示词
        const prompt = `
            作为一个资深学习顾问，基于以下全面的个性化学习数据、高效学习方法论和遗忘曲线原理，为用户生成一份综合性的高效学习建议报告：
            
            一、学习数据概览：
            1. 整体统计：
               - 已学习课程数：${totalCourses}
               - 已学习模块数：${totalModules}
               - 总学习次数：${totalLearningSessions}
            
            2. 当前需要复习的模块（按优先级排序，共${modulesToReview.length}个）：
               ${modulesToReview.length > 0 ? JSON.stringify(modulesToReview.slice(0, 10), null, 2) : '暂无需要复习的模块'}
            
            3. 已掌握的模块（共${masteredModules.length}个）：
               ${masteredModules.length > 0 ? JSON.stringify(masteredModules.slice(0, 10), null, 2) : '暂无完全掌握的模块'}
            
            4. 近期学习活跃情况：
               - 最近学习最多的课程：${sortedCourses.map(([course, count]) => `${course} (${count}次)`).join(', ') || '暂无学习记录'}
               - 最近学习最多的模块：${sortedModules.map(([module, count]) => `${module} (${count}次)`).join(', ') || '暂无学习记录'}
            
            5. 最近10次学习记录：
               ${JSON.stringify(recentLearningSessions, null, 2)}
            
            二、学习原理参考：
            1. 高效学习方法论：
               ${learningEfficiency || '无高效学习方法提示词'}
            
            2. 遗忘曲线原理：
               ${forgettingCurve || '无遗忘曲线提示词'}
            
            三、建议生成要求：
            请基于以上数据和原理，生成一份结构清晰、实用性强的高效学习建议报告，包括但不限于：
            
            1. 个性化学习状态评估：
               - 优点和进步点
               - 需要改进的地方
               - 整体学习效率评分
            
            2. 紧急复习计划（接下来7天）：
               - 每日需要复习的模块和时间建议
               - 针对每个模块的复习方法推荐
            
            3. 长期学习策略（1个月）：
               - 学习内容优先级排序
               - 新模块学习与旧模块复习的平衡建议
               - 学习目标设定建议
            
            4. 学习方法个性化推荐：
               - 根据学习历史和模块类型推荐最合适的学习方法
               - 如何结合费曼学习法、番茄工作法等提高效率
            
            5. 模块掌握度提升建议：
               - 针对不同掌握度的模块制定不同的学习策略
               - 如何将掌握度从低级别提升到高级别
            
            6. 学习习惯养成建议：
               - 如何建立可持续的学习习惯
               - 如何保持学习动力
            
            请以自然、友好的语言呈现，避免过于技术化的术语，确保用户能够轻松理解和执行这些建议。
        `;
        
        // 调用通义千问API
        const suggestions = await tongyiApiCall([{ role: 'user', content: prompt }]);
        
        if (suggestions) {
            resultDiv.textContent = suggestions;
        } else {
            resultDiv.textContent = '生成高效学习建议失败，请检查API配置！';
        }
        
    } catch (error) {
        console.error('生成高效学习建议错误:', error);
        resultDiv.textContent = `生成高效学习建议失败: ${error.message}`;
    }
}

// 根据掌握度计算下次复习日期（基于遗忘曲线原理）
function calculateNextReviewDate(masteryLevel) {
    // 掌握度越高，复习间隔越长
    const intervals = {
        1: 1,    // 掌握度1级：1天后复习
        2: 3,    // 掌握度2级：3天后复习
        3: 7,    // 掌握度3级：7天后复习
        4: 14,   // 掌握度4级：14天后复习
        5: 30    // 掌握度5级：30天后复习
    };
    
    // 找到最接近的掌握度区间
    const masteryKey = Math.min(Math.ceil(masteryLevel), 5);
    const daysToAdd = intervals[masteryKey] || 1;
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return nextDate.toISOString();
}

// 生成加强记忆的知识点
async function generateMemoryPoints() {
    const resultDiv = document.getElementById('memory-points-result');
    resultDiv.textContent = '正在分析学习历史并生成加强记忆的知识点...';
    
    try {
        // 构建个性化学习历史数据
        let learningHistoryData = {
            learningHistory: courseProgress.learningHistory || [],
            coursesLearned: courseProgress.coursesLearned || [],
            currentDate: new Date().toISOString()
        };
        
        // 获取需要复习的模块
        const modulesToReview = [];
        const today = new Date().toISOString();
        
        if (learningHistoryData.coursesLearned) {
            learningHistoryData.coursesLearned.forEach(course => {
                if (course.moduleMastery) {
                    Object.values(course.moduleMastery).forEach(module => {
                        if (module.nextReviewDate && module.nextReviewDate <= today) {
                            modulesToReview.push({
                                course: course.name,
                                module: module.name,
                                masteryLevel: module.masteryLevel,
                                lastLearnedDate: module.lastLearnedDate,
                                learningCount: module.learningCount
                            });
                        }
                    });
                }
            });
        }
        
        // 获取遗忘曲线提示词
        const forgettingCurve = await getGitHubFile('prompts/forgetting_curve.md');
        
        // 构建个性化提示词
        const prompt = `
            作为一个学习顾问，基于以下个性化学习数据和遗忘曲线原理，分析并生成需要加强记忆的知识点：
            
            个性化学习数据：
            1. 学习历史记录（最近10条）：
            ${JSON.stringify(learningHistoryData.learningHistory.slice(-10), null, 2)}
            
            2. 已学习课程概况：
            ${JSON.stringify(learningHistoryData.coursesLearned.map(course => ({
                name: course.name,
                difficulty: course.difficulty,
                learningCount: course.learningCount,
                moduleCount: course.moduleMastery ? Object.keys(course.moduleMastery).length : 0
            })), null, 2)}
            
            3. 当前需要复习的模块（基于掌握度和复习间隔）：
            ${modulesToReview.length > 0 ? JSON.stringify(modulesToReview, null, 2) : '暂无需要复习的模块'}
            
            4. 当前日期：${learningHistoryData.currentDate}
            
            遗忘曲线原理：
            ${forgettingCurve || '无遗忘曲线提示词'}
            
            请分析这些数据，为用户生成个性化的加强记忆知识点：
            1. 基于掌握度的知识点优先级排序（掌握度低的知识点优先）
            2. 需要立即复习的内容（根据下次复习日期）
            3. 每个知识点的记忆方法建议（结合费曼学习法等）
            4. 基于遗忘曲线的复习计划
            5. 提高掌握度的具体学习建议
            
            请以清晰的结构呈现，突出个性化的学习建议，语言通俗易懂。
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

// 显示课程选择界面
function showCourseSelection() {
    // 隐藏对话面板
    document.getElementById('chat-container').classList.add('hidden');
    // 显示课程选择面板
    document.getElementById('course-selection-container').classList.remove('hidden');
    
    // 生成课程列表
    generateCourseList();
    
    // 添加返回按钮事件监听
    document.getElementById('back-to-chat-btn').onclick = () => {
        // 隐藏课程选择面板
        document.getElementById('course-selection-container').classList.add('hidden');
        // 显示对话面板
        document.getElementById('chat-container').classList.remove('hidden');
    };
}

// 显示课程选择下拉框界面
function showCourseSelectInterface() {
    // 隐藏所有其他面板
    document.querySelectorAll('.content-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    // 显示课程选择面板
    document.getElementById('course-select-container').classList.remove('hidden');
    
    // 更新课程下拉框
    updateCourseDropdown();
    
    // 添加事件监听
    document.getElementById('back-to-main-btn').onclick = () => {
        // 隐藏课程选择面板
        document.getElementById('course-select-container').classList.add('hidden');
        // 显示对话面板
        document.getElementById('chat-container').classList.remove('hidden');
    };
    
    // 添加课程选择事件
    document.getElementById('course-dropdown').onchange = () => {
        updateCourseModuleDropdown();
    };
    
    // 添加开始学习按钮事件
    document.getElementById('start-learning-btn').onclick = () => {
        startSelectedCourseLearning();
    };
}



// 更新课程下拉框
function updateCourseDropdown() {
    const courseDropdown = document.getElementById('course-dropdown');
    // 清空现有选项
    courseDropdown.innerHTML = '<option value="" selected disabled>请选择课程</option>';
    
    if (!courseProgress.availableCourses || courseProgress.availableCourses.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '暂无可用课程';
        option.disabled = true;
        courseDropdown.appendChild(option);
        return;
    }
    
    // 按难度分组课程
    const coursesByDifficulty = {
        '初级': [],
        '中级': [],
        '高级': []
    };
    
    courseProgress.availableCourses.forEach(course => {
        const difficulty = course.difficulty || '初级';
        if (coursesByDifficulty[difficulty]) {
            coursesByDifficulty[difficulty].push(course);
        } else {
            coursesByDifficulty['初级'].push(course);
        }
    });
    
    // 添加课程选项
    ['初级', '中级', '高级'].forEach(difficulty => {
        if (coursesByDifficulty[difficulty].length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = difficulty;
            courseDropdown.appendChild(optgroup);
            
            coursesByDifficulty[difficulty].forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.name;
                option.dataset.description = course.description;
                option.dataset.difficulty = course.difficulty;
                optgroup.appendChild(option);
            });
        }
    });
}

// 更新课程选择界面的模块下拉框
function updateCourseModuleDropdown() {
    const courseDropdown = document.getElementById('course-dropdown');
    const moduleDropdown = document.getElementById('module-dropdown');
    const selectedCourseId = courseDropdown.value;
    
    // 清空现有选项
    moduleDropdown.innerHTML = '<option value="" selected disabled>请选择模块</option>';
    
    if (!selectedCourseId) {
        console.log('没有选择课程');
        return;
    }
    
    // 从课程数据中获取模块（确保ID比较为字符串类型）
    const selectedCourse = courseProgress.availableCourses.find(course => String(course.id) === selectedCourseId);
    console.log('选中的课程:', selectedCourse);
    
    if (!selectedCourse) {
        console.log('未找到选中的课程');
        return;
    }
    
    // 确保模块数组存在
    if (!selectedCourse.modules || selectedCourse.modules.length === 0) {
        console.log('课程没有模块数据，创建默认模块');
        // 为课程创建默认模块
        if (selectedCourse.difficulty === '初级') {
            selectedCourse.modules = ['基础知识', '概念理解', '简单应用'];
        } else if (selectedCourse.difficulty === '中级') {
            selectedCourse.modules = ['核心原理', '实践应用', '案例分析'];
        } else if (selectedCourse.difficulty === '高级') {
            selectedCourse.modules = ['高级特性', '深入理解', '综合应用', '优化技巧'];
        } else {
            selectedCourse.modules = ['默认模块1', '默认模块2', '默认模块3'];
        }
        
        // 保存更新后的课程数据
        saveCourseProgress().catch(error => console.error('保存课程数据失败:', error));
    }
    
    // 清除现有的选项（除了第一个默认选项）
    moduleDropdown.innerHTML = '<option value="" selected disabled>请选择模块</option>';
    
    // 使用课程自带的模块列表
    if (selectedCourse.modules && selectedCourse.modules.length > 0) {
        console.log('可用模块:', selectedCourse.modules);
        
        selectedCourse.modules.forEach((module, index) => {
            const option = document.createElement('option');
            option.value = module; // 使用模块名称作为值，更直观
            option.textContent = module;
            moduleDropdown.appendChild(option);
            console.log('添加模块选项:', module);
        });
        
        // 添加自定义模块按钮
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '自定义模块...';
        moduleDropdown.appendChild(customOption);
        
        console.log('模块下拉框已更新，共', moduleDropdown.options.length, '个选项');
    } else {
        console.log('模块列表为空，无法添加选项');
    }
    
    console.log('模块下拉框更新完成');
}

// 开始学习选定的课程
async function startSelectedCourseLearning() {
    const courseDropdown = document.getElementById('course-dropdown');
    const moduleDropdown = document.getElementById('module-dropdown');
    const selectedCourseId = courseDropdown.value;
    const selectedModuleValue = moduleDropdown.value;
    
    if (!selectedCourseId || !selectedModuleValue) {
        alert('请选择课程和模块！');
        return;
    }
    
    // 获取选定的课程
    const selectedCourse = courseProgress.availableCourses.find(course => course.id === selectedCourseId);
    if (!selectedCourse) {
        alert('未找到选定的课程！');
        return;
    }
    
    let selectedModule;
    
    // 处理用户选择自定义模块的情况
    if (selectedModuleValue === 'custom') {
        const customModuleName = prompt('请输入自定义模块名称：');
        if (!customModuleName || customModuleName.trim() === '') {
            alert('请输入有效的模块名称！');
            return;
        }
        
        selectedModule = customModuleName.trim();
        
        // 将自定义模块添加到课程的模块列表中
        if (!selectedCourse.modules.includes(selectedModule)) {
            selectedCourse.modules.push(selectedModule);
            // 保存更新后的课程数据
            await saveCourseProgress();
            // 更新模块下拉框
            updateCourseModuleDropdown();
        }
    } else {
        // 直接使用模块值作为模块名称
        selectedModule = selectedModuleValue;
    }
    
    // 调用费曼学习法开始学习
    await startFeynmanLearning(selectedCourse, selectedModule);
}

// 修改startFeynmanLearning函数以支持模块学习
async function startFeynmanLearning(course, module = null) {
    // 显示加载状态
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = '正在准备费曼学习法教学...';
    loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        font-size: 16px;
        z-index: 1000;
    `;
    document.body.appendChild(loadingIndicator);
    
    try {
        // 生成费曼学习法教学内容
        let contentPrompt = `请用费曼学习法教我学习：${course.name}。课程简介：${course.description}`;
        if (module) {
            contentPrompt += `\n\n具体学习模块：${module}`;
        }
        
        const feynmanPrompt = [{
            role: 'system',
            content: '你是一个优秀的费曼学习法教师，请按照以下步骤教授用户选择的课程：\n1. 首先用5岁孩子能理解的简单语言解释课程的核心概念，避免使用任何专业术语\n2. 指出解释中可能存在的模糊点或未解释清楚的地方\n3. 回到课程内容，重新解释这些模糊点，确保用户完全理解\n4. 最后提供一个简洁明了的总结，强化学习效果\n\n如果用户指定了具体模块，请重点教授该模块的内容。\n\n请确保教学内容生动有趣，符合费曼学习法的"以教促学"理念。'
        }, {
            role: 'user',
            content: contentPrompt
        }];
        
        const teachingContent = await tongyiApiCall(feynmanPrompt);
        
        // 记录学习历史
        courseProgress.learningHistory.push({
            course: course.name,
            courseId: course.id,
            module: module || '全部内容',
            date: new Date().toISOString(),
            content: teachingContent,
            method: 'feynman',
            masteryLevel: 1 // 初始掌握度为1（1-5级）
        });
        
        // 更新课程学习进度
        if (!courseProgress.coursesLearned) {
            courseProgress.coursesLearned = [];
        }
        
        const existingCourse = courseProgress.coursesLearned.find(c => c.id === course.id);
        if (!existingCourse) {
            courseProgress.coursesLearned.push({
                id: course.id,
                name: course.name,
                difficulty: course.difficulty,
                firstLearnedDate: new Date().toISOString(),
                lastLearnedDate: new Date().toISOString(),
                learningCount: 1,
                moduleMastery: {} // 添加模块掌握度跟踪
            });
        } else {
            existingCourse.lastLearnedDate = new Date().toISOString();
            existingCourse.learningCount = (existingCourse.learningCount || 0) + 1;
            // 初始化模块掌握度对象
            if (!existingCourse.moduleMastery) {
                existingCourse.moduleMastery = {};
            }
        }
        
        // 更新模块掌握度
        if (module) {
            const courseInProgress = courseProgress.coursesLearned.find(c => c.id === course.id);
            if (!courseInProgress.moduleMastery[module]) {
                courseInProgress.moduleMastery[module] = {
                    name: module,
                    lastLearnedDate: new Date().toISOString(),
                    learningCount: 1,
                    masteryLevel: 1, // 1-5级，5级为完全掌握
                    reviewCount: 0,
                    nextReviewDate: calculateNextReviewDate(1) // 基于掌握度计算下次复习日期
                };
            } else {
                const moduleMastery = courseInProgress.moduleMastery[module];
                moduleMastery.lastLearnedDate = new Date().toISOString();
                moduleMastery.learningCount++;
                // 根据学习次数和时间间隔提升掌握度（简单规则）
                if (moduleMastery.masteryLevel < 5) {
                    moduleMastery.masteryLevel += 0.5;
                    if (moduleMastery.masteryLevel > 5) moduleMastery.masteryLevel = 5;
                }
                moduleMastery.nextReviewDate = calculateNextReviewDate(moduleMastery.masteryLevel);
            }
        }
        
        // 保存课程进度
        await saveCourseProgress();
        
        // 返回对话界面并显示教学内容
        document.querySelectorAll('.content-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        document.getElementById('chat-container').classList.remove('hidden');
        
        // 显示教学内容
        displayMessage('assistant', teachingContent);
        
        // 添加到对话历史
        let conversation = await loadTodaysConversation();
        conversation.push({ role: 'assistant', content: teachingContent });
        await saveTodaysConversation(conversation);
        
    } catch (error) {
        console.error('费曼学习法教学失败:', error);
        alert('生成教学内容失败，请稍后重试。');
    } finally {
        // 移除加载状态
        document.body.removeChild(loadingIndicator);
    }
}

// 生成课程列表
function generateCourseList() {
    const courseListDiv = document.getElementById('course-list');
    courseListDiv.innerHTML = '';
    
    if (!courseProgress.availableCourses || courseProgress.availableCourses.length === 0) {
        courseListDiv.innerHTML = '<p style="text-align: center; color: #6a737d;">暂无可用课程</p>';
        return;
    }
    
    // 按难度分组课程
    const coursesByDifficulty = {
        '初级': [],
        '中级': [],
        '高级': []
    };
    
    courseProgress.availableCourses.forEach(course => {
        const difficulty = course.difficulty || '初级';
        if (coursesByDifficulty[difficulty]) {
            coursesByDifficulty[difficulty].push(course);
        } else {
            coursesByDifficulty['初级'].push(course);
        }
    });
    
    // 按难度顺序显示课程
    ['初级', '中级', '高级'].forEach(difficulty => {
        if (coursesByDifficulty[difficulty].length > 0) {
            // 添加难度标题
            const difficultyHeader = document.createElement('h4');
            difficultyHeader.textContent = `${difficulty}课程`;
            difficultyHeader.style.cssText = `
                margin-top: 20px;
                margin-bottom: 10px;
                color: #0366d6;
                border-bottom: 1px solid #e1e4e8;
                padding-bottom: 5px;
            `;
            courseListDiv.appendChild(difficultyHeader);
            
            // 添加该难度下的所有课程
            coursesByDifficulty[difficulty].forEach(course => {
                const courseItemDiv = document.createElement('div');
                courseItemDiv.className = 'course-item';
                courseItemDiv.dataset.courseId = course.id;
                
                courseItemDiv.innerHTML = `
                    <div class="course-header">
                        <div style="display: flex; align-items: center;">
                            <span class="course-number">${course.id}.</span>
                            <span class="course-name">${course.name}</span>
                        </div>
                        <span class="course-difficulty" data-difficulty="${course.difficulty}">${course.difficulty}</span>
                    </div>
                    <div class="course-description">${course.description}</div>
                `;
                
                // 添加点击事件
                courseItemDiv.onclick = () => {
                    selectCourse(course);
                };
                
                courseListDiv.appendChild(courseItemDiv);
            });
        }
    });
}

// 选择课程
function selectCourse(course) {
    // 移除其他课程的选中状态
    document.querySelectorAll('.course-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加当前课程的选中状态
    const selectedItem = document.querySelector(`[data-course-id="${course.id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // 使用费曼学习法教学
    startFeynmanLearning(course);
}

// 开始费曼学习法教学
async function startFeynmanLearning(course) {
    // 显示加载状态
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = '正在准备费曼学习法教学...';
    loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        font-size: 16px;
        z-index: 1000;
    `;
    document.body.appendChild(loadingIndicator);
    
    try {
        // 生成费曼学习法教学内容
        const feynmanPrompt = [{
            role: 'system',
            content: '你是一个优秀的费曼学习法教师，请按照以下步骤教授用户选择的课程：\n1. 首先用5岁孩子能理解的简单语言解释课程的核心概念，避免使用任何专业术语\n2. 指出解释中可能存在的模糊点或未解释清楚的地方\n3. 回到课程内容，重新解释这些模糊点，确保用户完全理解\n4. 最后提供一个简洁明了的总结，强化学习效果\n\n请确保教学内容生动有趣，符合费曼学习法的"以教促学"理念。'
        }, {
            role: 'user',
            content: `请用费曼学习法教我学习：${course.name}。课程简介：${course.description}`
        }];
        
        const teachingContent = await tongyiApiCall(feynmanPrompt);
        
        // 记录学习历史
        courseProgress.learningHistory.push({
            course: course.name,
            courseId: course.id,
            date: new Date().toISOString(),
            content: teachingContent,
            method: 'feynman'
        });
        
        // 更新课程学习进度
        if (!courseProgress.coursesLearned) {
            courseProgress.coursesLearned = [];
        }
        
        const existingCourse = courseProgress.coursesLearned.find(c => c.id === course.id);
        if (!existingCourse) {
            courseProgress.coursesLearned.push({
                id: course.id,
                name: course.name,
                difficulty: course.difficulty,
                firstLearnedDate: new Date().toISOString(),
                lastLearnedDate: new Date().toISOString(),
                learningCount: 1
            });
        } else {
            existingCourse.lastLearnedDate = new Date().toISOString();
            existingCourse.learningCount = (existingCourse.learningCount || 0) + 1;
        }
        
        // 保存课程进度
        await saveCourseProgress();
        
        // 返回对话界面并显示教学内容
        document.getElementById('course-selection-container').classList.add('hidden');
        document.getElementById('chat-container').classList.remove('hidden');
        
        // 显示教学内容
        displayMessage('assistant', teachingContent);
        
        // 添加到对话历史
        let conversation = await loadTodaysConversation();
        conversation.push({ role: 'assistant', content: teachingContent });
        await saveTodaysConversation(conversation);
        
    } catch (error) {
        console.error('费曼学习法教学失败:', error);
        alert('生成教学内容失败，请稍后重试。');
    } finally {
        // 移除加载状态
        document.body.removeChild(loadingIndicator);
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

// 学习进度跟踪功能

// 获取学习进度数据
function getProgressData() {
    const savedData = localStorage.getItem('learningProgress');
    return savedData ? JSON.parse(savedData) : [];
}

// 保存学习进度数据
function saveProgressData(data) {
    localStorage.setItem('learningProgress', JSON.stringify(data));
}

// 记录学习进度
function recordProgress() {
    let subject = document.getElementById('subject-progress').value;
    let module = document.getElementById('module-progress').value;
    const duration = parseInt(document.getElementById('study-duration').value);
    const status = document.getElementById('study-status').value;
    const summary = document.getElementById('study-summary').value;
    const challenge = document.getElementById('study-challenge').value;

    if (!subject || !module) {
        alert('请选择科目和模块！');
        return;
    }

    // 检查是否是自定义输入
    if (subject === 'custom') {
        const customSubject = prompt('请输入自定义科目名称：');
        if (!customSubject) return;
        subject = customSubject;
    }

    if (module === 'custom') {
        const customModule = prompt('请输入自定义模块名称：');
        if (!customModule) return;
        module = customModule;
    }

    const progressData = {
        id: Date.now(),
        subject: subject,
        module: module,
        duration: duration,
        status: status,
        summary: summary,
        challenge: challenge,
        date: new Date().toISOString(),
        credibility: calculateProgressCredibility(duration, summary, status)
    };

    const allProgress = getProgressData();
    allProgress.push(progressData);
    saveProgressData(allProgress);

    alert('学习进度记录成功！');
    updateProgressDisplay();
    updateSubjectModuleDropdowns();
    
    // 发送Webhook通知到集简云
    webhookCall({
        type: 'study_progress',
        data: progressData
    });
}

// 计算学习可信度
function calculateProgressCredibility(duration, summary, status) {
    let credibility = 0;

    // 学习时长评估
    if (duration >= 30) credibility += 30;
    else if (duration >= 15) credibility += 20;
    else if (duration >= 5) credibility += 10;

    // 学习内容摘要评估
    if (summary.length >= 200) credibility += 30;
    else if (summary.length >= 100) credibility += 20;
    else if (summary.length >= 50) credibility += 10;
    else if (summary.length > 0) credibility += 5;

    // 学习状态评估
    if (status === 'focused' || status === 'practice') credibility += 20;
    else if (status === 'review') credibility += 15;
    else if (status === 'problem-solving') credibility += 15;

    // 计算可信度等级
    if (credibility >= 70) return '高';
    if (credibility >= 50) return '中';
    return '低';
}

// 显示学习进度
function updateProgressDisplay() {
    const progressData = getProgressData();
    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 计算今日学习时间
    let todayStudyTime = 0;
    let weekStudyTime = 0;
    let totalStudyTime = 0;

    progressData.forEach(progress => {
        totalStudyTime += progress.duration;
        const progressDate = new Date(progress.date);
        if (progressDate.toDateString() === today) {
            todayStudyTime += progress.duration;
        }
        if (progressDate >= weekAgo) {
            weekStudyTime += progress.duration;
        }
    });

    // 更新统计数据
    document.getElementById('today-study-time').textContent = todayStudyTime + ' 分钟';
    document.getElementById('week-study-time').textContent = weekStudyTime + ' 分钟';
    document.getElementById('total-study-time').textContent = totalStudyTime + ' 分钟';

    // 更新学习可信度
    updateProgressCredibilityDisplay();

    // 显示学习历史
    displayProgressHistory(progressData);

    // 绘制学习进度图表
    drawProgressChart(progressData);

    // 显示已学习课程和模块
    displayLearnedCourses();
}

// 更新学习可信度显示
function updateProgressCredibilityDisplay() {
    const progressData = getProgressData();
    if (progressData.length === 0) {
        document.getElementById('progress-credibility').textContent = '高';
        document.getElementById('progress-credibility').setAttribute('data-credibility', '高');
        return;
    }

    // 计算最近10次学习的平均可信度
    const recentProgress = progressData.slice(-10);
    const credibilitySum = recentProgress.reduce((sum, progress) => {
        if (progress.credibility === '高') return sum + 3;
        if (progress.credibility === '中') return sum + 2;
        return sum + 1;
    }, 0);

    const averageCredibility = credibilitySum / recentProgress.length;
    let overallCredibility = '高';
    if (averageCredibility < 1.5) overallCredibility = '低';
    else if (averageCredibility < 2.5) overallCredibility = '中';

    document.getElementById('progress-credibility').textContent = overallCredibility;
    document.getElementById('progress-credibility').setAttribute('data-credibility', overallCredibility);
}

// 显示学习历史
function displayProgressHistory(progressData) {
    const progressList = document.getElementById('progress-list');
    progressList.innerHTML = '';

    // 按日期倒序排序
    const sortedProgress = [...progressData].sort((a, b) => new Date(b.date) - new Date(a.date));

    // 只显示最近20条记录
    const recentProgress = sortedProgress.slice(0, 20);

    recentProgress.forEach(progress => {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
            <div class="progress-date">${new Date(progress.date).toLocaleString()}</div>
            <div class="progress-subject">${progress.subject} - ${progress.module}</div>
            <div class="progress-details">学习时长: ${progress.duration}分钟 | 状态: ${getStatusText(progress.status)} | 可信度: ${getCredibilityText(progress.credibility)}</div>
        `;
        progressList.appendChild(progressItem);
    });
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'focused': '专注学习',
        'review': '复习巩固',
        'practice': '练习应用',
        'problem-solving': '解决问题'
    };
    return statusMap[status] || status;
}

// 获取可信度文本
function getCredibilityText(credibility) {
    const credibilityMap = {
        'high': '高',
        'medium': '中',
        'low': '低'
    };
    return credibilityMap[credibility] || credibility;
}

// 绘制学习进度图表
function drawProgressChart(progressData) {
    const ctx = document.getElementById('progress-chart').getContext('2d');

    // 按日期分组数据
    const dailyData = {};
    progressData.forEach(progress => {
        const date = new Date(progress.date).toISOString().split('T')[0];
        if (!dailyData[date]) {
            dailyData[date] = 0;
        }
        dailyData[date] += progress.duration;
    });

    // 生成最近7天的数据
    const labels = [];
    const data = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString());
        data.push(dailyData[dateStr] || 0);
    }

    // 销毁现有图表（如果存在）
    if (window.progressChart) {
        window.progressChart.destroy();
    }

    // 创建新图表
    window.progressChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '学习时长（分钟）',
                data: data,
                backgroundColor: 'rgba(3, 102, 214, 0.6)',
                borderColor: 'rgba(3, 102, 214, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '分钟'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            }
        }
    });
}

// 显示已学习的课程和模块
function displayLearnedCourses() {
    const progressData = getProgressData();
    const coursesList = document.getElementById('learned-courses-list');
    const courses = {};

    // 按科目和模块分组
    progressData.forEach(progress => {
        if (!courses[progress.subject]) {
            courses[progress.subject] = new Set();
        }
        courses[progress.subject].add(progress.module);
    });

    coursesList.innerHTML = '';
    Object.entries(courses).forEach(([subject, modules]) => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.innerHTML = `
            <div class="course-title">${subject}</div>
            <div class="module-list">
                ${Array.from(modules).map(module => `<span class="module-tag">${module}</span>`).join('')}
            </div>
        `;
        coursesList.appendChild(courseItem);
    });
}

// 更新科目和模块下拉框
function updateSubjectModuleDropdowns() {
    const progressData = getProgressData();
    const subjectSelect = document.getElementById('subject-progress');
    const moduleSelect = document.getElementById('module-progress');
    const masterySubjectSelect = document.getElementById('mastery-subject');
    const masteryModuleSelect = document.getElementById('mastery-topic');
    const reviewSubjectSelect = document.getElementById('subject-input');
    const reviewModuleSelect = document.getElementById('module-input');
    const exerciseSubjectSelect = document.getElementById('exercise-subject');
    const exerciseModuleSelect = document.getElementById('exercise-topic');

    // 提取所有科目和模块
    const subjects = new Set();
    const modulesBySubject = {};

    // 1. 从学习进度中提取
    progressData.forEach(progress => {
        subjects.add(progress.subject);
        if (!modulesBySubject[progress.subject]) {
            modulesBySubject[progress.subject] = new Set();
        }
        modulesBySubject[progress.subject].add(progress.module);
    });

    // 2. 从课程列表中提取
    if (courseProgress.availableCourses && courseProgress.availableCourses.length > 0) {
        courseProgress.availableCourses.forEach(course => {
            // 将课程作为科目添加
            subjects.add(course.name);
            if (!modulesBySubject[course.name]) {
                modulesBySubject[course.name] = new Set();
            }
            // 将难度作为模块添加
            modulesBySubject[course.name].add(course.difficulty);
        });
    }

    // 3. 从已学习的课程中提取
    if (courseProgress.coursesLearned && courseProgress.coursesLearned.length > 0) {
        courseProgress.coursesLearned.forEach(course => {
            subjects.add(course.name);
            if (!modulesBySubject[course.name]) {
                modulesBySubject[course.name] = new Set();
            }
            modulesBySubject[course.name].add(course.difficulty);
        });
    }

    // 更新科目下拉框
    [subjectSelect, masterySubjectSelect, reviewSubjectSelect, exerciseSubjectSelect].forEach(select => {
        if (select) {
            // 保留自定义选项
            const customOption = select.querySelector('option[value="custom"]');
            select.innerHTML = '';
            select.innerHTML = '<option value="" selected disabled>选择科目</option>';

            // 添加所有科目选项
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                select.appendChild(option);
            });

            // 添加自定义选项
            const customOptionEl = document.createElement('option');
            customOptionEl.value = 'custom';
            customOptionEl.textContent = '自定义...';
            select.appendChild(customOptionEl);
        }
    });

    // 更新模块下拉框事件
    [subjectSelect, masterySubjectSelect, reviewSubjectSelect, exerciseSubjectSelect].forEach(select => {
        if (select) {
            select.addEventListener('change', function() {
                updateModuleDropdown(this.value, moduleSelect, masteryModuleSelect, reviewModuleSelect, exerciseModuleSelect);
            });
        }
    });

    // 初始化第一个下拉框的模块
    if (subjectSelect && subjectSelect.options.length > 1) {
        updateModuleDropdown(subjectSelect.value, moduleSelect, masteryModuleSelect, reviewModuleSelect, exerciseModuleSelect);
    }
}

// 更新模块下拉框
function updateModuleDropdown(selectedSubject, ...moduleSelects) {
    const progressData = getProgressData();
    const modules = new Set();

    // 提取选定科目的所有模块
    progressData.forEach(progress => {
        if (progress.subject === selectedSubject) {
            modules.add(progress.module);
        }
    });

    moduleSelects.forEach(select => {
        if (select) {
            select.innerHTML = '<option value="" selected disabled>选择模块</option>';

            // 添加所有模块选项
            modules.forEach(module => {
                const option = document.createElement('option');
                option.value = module;
                option.textContent = module;
                select.appendChild(option);
            });

            // 添加自定义选项
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = '自定义...';
            select.appendChild(customOption);
        }
    });
}

// 知识掌握评估功能

// 生成评估测试
async function generateAssessment() {
    let subject = document.getElementById('mastery-subject').value;
    let module = document.getElementById('mastery-topic').value;
    const questionCount = parseInt(document.getElementById('question-count').value);

    if (!subject || !module) {
        alert('请选择科目和模块！');
        return;
    }

    // 检查是否是自定义输入
    if (subject === 'custom') {
        const customSubject = prompt('请输入自定义科目名称：');
        if (!customSubject) return;
        subject = customSubject;
    }

    if (module === 'custom') {
        const customModule = prompt('请输入自定义模块名称：');
        if (!customModule) return;
        module = customModule;
    }

    const resultDiv = document.getElementById('assessment-test');
    const questionsContainer = document.getElementById('questions-container');

    resultDiv.classList.remove('hidden');
    questionsContainer.innerHTML = '正在生成评估测试...';

    // 调用AI生成测试
    const prompt = `
        作为一个${subject}专家，请为${module}模块生成${questionCount}道评估测试题。
        题型包括选择题和简答题的组合。
        请以JSON格式返回，包含题目、选项（如果是选择题）、答案和分值。
        JSON格式如下：
        {
            "questions": [
                {
                    "id": 1,
                    "type": "single_choice",
                    "content": "题目内容",
                    "options": {
                        "A": "选项A",
                        "B": "选项B",
                        "C": "选项C",
                        "D": "选项D"
                    },
                    "answer": "A",
                    "score": 5
                },
                {
                    "id": 2,
                    "type": "short_answer",
                    "content": "题目内容",
                    "answer": "答案内容",
                    "score": 10
                }
            ]
        }
    `;

    try {
        const response = await tongyiApiCall([{ role: 'user', content: prompt }]);
        const assessmentData = JSON.parse(response);

        // 保存评估数据到localStorage
        localStorage.setItem('currentAssessment', JSON.stringify(assessmentData));

        // 渲染测试题
        renderAssessmentQuestions(assessmentData.questions);
    } catch (error) {
        console.error('生成评估测试失败:', error);
        questionsContainer.innerHTML = '生成评估测试失败，请稍后重试。';
    }
}

// 渲染评估测试题
function renderAssessmentQuestions(questions) {
    const questionsContainer = document.getElementById('questions-container');
    questionsContainer.innerHTML = '';

    questions.forEach((question, index) => {
        const questionItem = document.createElement('div');
        questionItem.className = 'question-item';

        let questionHtml = `
            <div class="question-header">
                <span class="question-number">第 ${index + 1} 题</span>
                <span class="question-type">${question.type === 'single_choice' ? '选择题' : '简答题'}</span>
                <span class="question-score">(${question.score}分)</span>
            </div>
            <div class="question-content">${question.content}</div>
        `;

        if (question.type === 'single_choice') {
            // 渲染选择题选项
            questionHtml += '<div class="options-container">';
            Object.entries(question.options).forEach(([optionKey, optionValue]) => {
                questionHtml += `
                    <div class="option-item">
                        <input type="radio" name="question-${question.id}" id="option-${question.id}-${optionKey}" value="${optionKey}">
                        <label for="option-${question.id}-${optionKey}">${optionKey}. ${optionValue}</label>
                    </div>
                `;
            });
            questionHtml += '</div>';
        } else {
            // 渲染简答题输入框
            questionHtml += `
                <div class="question-answer">
                    <textarea class="answer-textarea" id="answer-${question.id}" rows="4" placeholder="请在此输入您的答案..."></textarea>
                </div>
            `;
        }

        questionItem.innerHTML = questionHtml;
        questionsContainer.appendChild(questionItem);
    });
}

// 提交评估测试
function submitAssessment() {
    const assessmentData = JSON.parse(localStorage.getItem('currentAssessment'));
    if (!assessmentData) {
        alert('没有找到评估测试数据！');
        return;
    }

    const questions = assessmentData.questions;
    const userAnswers = [];
    let totalScore = 0;
    let userScore = 0;

    questions.forEach(question => {
        if (question.type === 'single_choice') {
            const selectedOption = document.querySelector(`input[name="question-${question.id}"]:checked`);
            const userAnswer = selectedOption ? selectedOption.value : '';
            userAnswers.push({
                questionId: question.id,
                answer: userAnswer,
                isCorrect: userAnswer === question.answer,
                score: userAnswer === question.answer ? question.score : 0
            });
        } else {
            const userAnswer = document.getElementById(`answer-${question.id}`).value;
            // 简单的答案匹配（实际应用中需要更复杂的评分算法）
            const isCorrect = userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();
            userAnswers.push({
                questionId: question.id,
                answer: userAnswer,
                isCorrect: isCorrect,
                score: isCorrect ? question.score : 0
            });
        }

        totalScore += question.score;
        userScore += userAnswers[userAnswers.length - 1].score;
    });

    // 显示评估结果
    const resultDiv = document.getElementById('assessment-result');
    const resultSummary = document.getElementById('result-summary');
    const topicMastery = document.getElementById('topic-mastery');

    resultSummary.innerHTML = `
        <p>总得分：${userScore} / ${totalScore}</p>
        <p>正确率：${((userScore / totalScore) * 100).toFixed(1)}%</p>
        <p>掌握程度：${getMasteryLevel(userScore / totalScore)}</p>
    `;

    // 保存评估结果
    const assessmentResult = {
        id: Date.now(),
        subject: document.getElementById('mastery-subject').value,
        module: document.getElementById('mastery-topic').value,
        date: new Date().toISOString(),
        score: userScore,
        totalScore: totalScore,
        masteryLevel: getMasteryLevel(userScore / totalScore),
        questions: questions,
        answers: userAnswers
    };

    let assessmentHistory = JSON.parse(localStorage.getItem('assessmentHistory') || '[]');
    assessmentHistory.push(assessmentResult);
    localStorage.setItem('assessmentHistory', JSON.stringify(assessmentHistory));

    // 发送Webhook通知到集简云
    webhookCall({
        type: 'assessment_result',
        data: assessmentResult
    });

    resultDiv.classList.remove('hidden');
}

// 获取掌握程度等级
function getMasteryLevel(percentage) {
    if (percentage >= 0.9) return '优秀';
    if (percentage >= 0.8) return '良好';
    if (percentage >= 0.6) return '中等';
    if (percentage >= 0.4) return '及格';
    return '不及格';
}

// 学习提醒功能

// 获取提醒设置
function getReminderSettings() {
    const savedSettings = localStorage.getItem('reminderSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
        reminderTime: '20:00',
        reviewInterval: 3,
        enableDailyReminder: true,
        enableReviewReminder: true,
        enableSms: false,
        phoneNumber: '',
        smsApiKey: ''
    };
}

// 保存提醒设置
function saveReminderSettings() {
    const settings = {
        reminderTime: document.getElementById('reminder-time').value,
        reviewInterval: parseInt(document.getElementById('review-interval').value),
        enableDailyReminder: document.getElementById('enable-daily-reminder').checked,
        enableReviewReminder: document.getElementById('enable-review-reminder').checked,
        enableSms: document.getElementById('enable-sms-reminder').checked,
        phoneNumber: document.getElementById('phone-number').value,
        smsApiKey: document.getElementById('sms-api-key').value
    };

    localStorage.setItem('reminderSettings', JSON.stringify(settings));
    alert('提醒设置保存成功！');
}

// 加载提醒设置
function loadReminderSettings() {
    const settings = getReminderSettings();
    document.getElementById('reminder-time').value = settings.reminderTime;
    document.getElementById('review-interval').value = settings.reviewInterval;
    document.getElementById('enable-daily-reminder').checked = settings.enableDailyReminder;
    document.getElementById('enable-review-reminder').checked = settings.enableReviewReminder;
    document.getElementById('enable-sms-reminder').checked = settings.enableSms;
    document.getElementById('phone-number').value = settings.phoneNumber;
    document.getElementById('sms-api-key').value = settings.smsApiKey;
}

// 检查并发送提醒
function checkAndSendReminders() {
    const settings = getReminderSettings();
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);

    // 检查每日学习提醒
    if (settings.enableDailyReminder && currentTime === settings.reminderTime) {
        const todayProgress = getTodayStudyProgress();
        if (todayProgress.totalDuration < 30) {
            const message = '今天的学习时间还不足30分钟，建议继续学习！';
            showNotification('学习提醒', message);
            if (settings.enableSms) {
                sendSMSReminder({
                    type: 'daily',
                    message: message
                });
            }
        }
    }

    // 检查复习提醒
    if (settings.enableReviewReminder) {
        const reviewTopics = getTopicsToReview(settings.reviewInterval);
        if (reviewTopics.length > 0) {
            const message = `您有${reviewTopics.length}个知识点需要复习：${reviewTopics.map(t => t.subject + '-' + t.module).join(', ')}`;
            showNotification('复习提醒', message);
            if (settings.enableSms) {
                sendSMSReminder({
                    type: 'review',
                    message: message
                });
            }
        }
    }
}

// 获取今天的学习进度
function getTodayStudyProgress() {
    const progressData = getProgressData();
    const today = new Date().toDateString();
    let totalDuration = 0;
    let topicsCount = 0;
    const topics = new Set();

    progressData.forEach(progress => {
        if (new Date(progress.date).toDateString() === today) {
            totalDuration += progress.duration;
            const topicKey = progress.subject + '-' + progress.module;
            if (!topics.has(topicKey)) {
                topics.add(topicKey);
                topicsCount++;
            }
        }
    });

    return {
        totalDuration: totalDuration,
        topicsCount: topicsCount
    };
}

// 获取需要复习的知识点
function getTopicsToReview(intervalDays) {
    const progressData = getProgressData();
    const now = new Date();
    const reviewTopics = [];
    const reviewedTopics = new Set();

    progressData.forEach(progress => {
        const progressDate = new Date(progress.date);
        const daysDiff = Math.floor((now - progressDate) / (1000 * 60 * 60 * 24));
        const topicKey = progress.subject + '-' + progress.module;

        // 检查是否需要复习
        if (daysDiff >= intervalDays && !reviewedTopics.has(topicKey)) {
            reviewTopics.push({
                subject: progress.subject,
                module: progress.module,
                lastStudyDate: progress.date
            });
            reviewedTopics.add(topicKey);
        }
    });

    return reviewTopics;
}

// 显示浏览器通知
function showNotification(title, message) {
    if (!('Notification' in window)) {
        alert('此浏览器不支持桌面通知！');
        return;
    }

    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        });
    }
}

// 发送短信提醒
function sendSMSReminder(reminder) {
    const settings = getReminderSettings();
    if (!settings.enableSms || !settings.phoneNumber) {
        return;
    }

    // 这里应该调用实际的SMS API
    // 以下是模拟实现
    console.log('发送短信提醒:', {
        to: settings.phoneNumber,
        message: reminder.message,
        type: reminder.type
    });

    // 模拟成功提示
    console.log('短信提醒发送成功！');
}

// 显示即将到来的提醒
function displayUpcomingReminders() {
    const settings = getReminderSettings();
    const upcomingReminders = document.getElementById('upcoming-reminders');
    upcomingReminders.innerHTML = '';

    // 添加每日学习提醒
    if (settings.enableDailyReminder) {
        const reminderItem = document.createElement('div');
        reminderItem.className = 'upcoming-reminder-item';
        reminderItem.innerHTML = `
            <div class="reminder-time">每天 ${settings.reminderTime}</div>
            <div class="reminder-description">每日学习提醒</div>
        `;
        upcomingReminders.appendChild(reminderItem);
    }

    // 添加复习提醒
    if (settings.enableReviewReminder) {
        const reviewTopics = getTopicsToReview(settings.reviewInterval);
        if (reviewTopics.length > 0) {
            const reminderItem = document.createElement('div');
            reminderItem.className = 'upcoming-reminder-item';
            reminderItem.innerHTML = `
                <div class="reminder-time">最近 ${settings.reviewInterval} 天内</div>
                <div class="reminder-description">有 ${reviewTopics.length} 个知识点需要复习</div>
            `;
            upcomingReminders.appendChild(reminderItem);
        }
    }
}

// 显示需要复习的内容
function displayPendingReviewTopics() {
    const settings = getReminderSettings();
    const pendingReviewTopics = document.getElementById('pending-review-topics');
    const reviewTopics = getTopicsToReview(settings.reviewInterval);

    pendingReviewTopics.innerHTML = '';

    if (reviewTopics.length === 0) {
        pendingReviewTopics.innerHTML = '<div class="no-topics">当前没有需要复习的知识点</div>';
        return;
    }

    reviewTopics.forEach(topic => {
        const topicItem = document.createElement('div');
        topicItem.className = 'review-topic-item';
        topicItem.innerHTML = `
            <div class="topic-name">${topic.subject} - ${topic.module}</div>
            <div class="last-study-date">上次学习：${new Date(topic.lastStudyDate).toLocaleString()}</div>
            <button class="review-now-btn" onclick="reviewTopic('${topic.subject}', '${topic.module}')">现在复习</button>
        `;
        pendingReviewTopics.appendChild(topicItem);
    });
}

// 现在复习功能
function reviewTopic(subject, module) {
    // 切换到复习计划生成页面并填充科目和模块
    document.getElementById('subject-input').value = subject;
    switchPanel('review-plan-container');
    // 自动生成复习计划
    generateReviewPlan();
}

// 关闭详细分析模态框
function closeDetailedAnalysis() {
    document.getElementById('detailed-analysis-modal').classList.add('hidden');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载配置
    loadConfig();
    loadReminderSettings();
    loadStyle();
    
    // 绑定事件
    document.getElementById('save-config').addEventListener('click', saveConfig);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            sendMessage();
        }
    });
    
    // UI风格切换事件
    const styleSelector = document.getElementById('style-selector');
    if (styleSelector) {
        styleSelector.addEventListener('change', (e) => {
            applyUIStyle(e.target.value);
            // 保存风格选择
            config.uiStyle = e.target.value;
            localStorage.setItem('learningPlatformConfig', JSON.stringify(config));
        });
    }
    
    // 菜单按钮事件
    document.getElementById('chat-btn').addEventListener('click', () => switchPanel('chat-container'));
    document.getElementById('review-plan-btn').addEventListener('click', () => switchPanel('review-plan-container'));
    document.getElementById('memory-points-btn').addEventListener('click', () => switchPanel('memory-points-container'));
    document.getElementById('exercise-btn').addEventListener('click', () => switchPanel('exercise-container'));
    document.getElementById('progress-btn').addEventListener('click', () => {
        switchPanel('progress-container');
        updateProgressDisplay();
    });
    document.getElementById('mastery-btn').addEventListener('click', () => {
        switchPanel('mastery-container');
        updateSubjectModuleDropdowns();
    });
    document.getElementById('learning-suggestions-btn').addEventListener('click', () => switchPanel('learning-suggestions-container'));
    document.getElementById('reminder-btn').addEventListener('click', () => {
        switchPanel('reminder-container');
        displayUpcomingReminders();
        displayPendingReviewTopics();
    });
    document.getElementById('prompts-btn').addEventListener('click', () => switchPanel('prompts-container'));
    document.getElementById('select-course-btn').addEventListener('click', () => showCourseSelectInterface());
    
    // 功能按钮事件
    document.getElementById('generate-plan-btn').addEventListener('click', generateReviewPlan);
    document.getElementById('generate-memory-points-btn').addEventListener('click', generateMemoryPoints);
    document.getElementById('generate-exercise-btn').addEventListener('click', generateExercises);
    document.getElementById('record-progress-btn').addEventListener('click', recordProgress);
    document.getElementById('generate-assessment-btn').addEventListener('click', generateAssessment);
    document.getElementById('submit-assessment-btn').addEventListener('click', submitAssessment);
    document.getElementById('save-reminder-settings').addEventListener('click', saveReminderSettings);
    document.getElementById('generate-suggestions-btn').addEventListener('click', generateEfficientLearningSuggestions);
    
    // 定时加载历史记录
    setInterval(loadHistory, 10000);
    
    // 初始化页面
    updateSubjectModuleDropdowns();
    
    // 定时检查提醒
    setInterval(checkAndSendReminders, 60000); // 每分钟检查一次
});
