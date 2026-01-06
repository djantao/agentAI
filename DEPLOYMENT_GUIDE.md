# GitHub学习平台部署指南

本指南将详细说明如何将学习平台部署到GitHub上并成功运行。

## 一、创建GitHub仓库

1. 登录您的GitHub账号
2. 点击右上角的「+」图标，选择「New repository」
3. 填写仓库信息：
   - **Repository name**：输入仓库名称（如 `learning-platform`）
   - **Description**：（可选）输入仓库描述
   - **Visibility**：选择「Public」或「Private」均可
   - 不要勾选「Add a README file」等初始化选项
4. 点击「Create repository」创建仓库

## 二、上传项目代码

### 方法一：通过Git命令行上传

1. 打开本地终端（命令提示符/PowerShell/终端）
2. 导航到项目文件夹：
   ```bash
   cd d:\daima\trea\aillearning\agentlearning
   ```
3. 初始化Git仓库：
   ```bash
   git init
   ```
4. 添加所有文件：
   ```bash
   git add .
   ```
5. 提交代码：
   ```bash
   git commit -m "Initial commit"
   ```
6. 关联GitHub仓库：
   ```bash
   git remote add origin https://github.com/[YOUR_USERNAME]/[REPOSITORY_NAME].git
   ```
   （替换 `[YOUR_USERNAME]` 和 `[REPOSITORY_NAME]` 为实际信息）
7. 推送到GitHub：
   ```bash
   git push -u origin main
   ```

### 方法二：通过GitHub Desktop上传

1. 下载并安装 [GitHub Desktop](https://desktop.github.com/)
2. 登录GitHub账号
3. 点击「File」→「Add Local Repository」
4. 选择项目文件夹，点击「Add Repository」
5. 在「Changes」标签页，输入提交信息
6. 点击「Commit to main」
7. 点击「Push origin」推送到GitHub

## 三、等待GitHub Pages自动部署

项目已配置GitHub Pages自动部署：

1. 代码推送到GitHub后，GitHub Actions会自动开始部署
2. 查看部署状态：
   - 进入GitHub仓库页面
   - 点击「Actions」标签页
   - 查看「Deploy GitHub Pages」工作流的运行状态
3. 部署完成后，您可以通过以下URL访问应用：
   ```
   https://[YOUR_USERNAME].github.io/[REPOSITORY_NAME]/
   ```
   （首次部署可能需要几分钟时间）

## 四、配置Cloudflare Workers（解决跨域问题）

### 1. 注册Cloudflare账号

- 访问 [Cloudflare Workers官网](https://workers.cloudflare.com/)
- 点击「Sign Up」免费注册账号
- 按照提示完成邮箱验证和登录

### 2. 创建Workers

1. 登录后，点击左侧菜单中的「Workers & Pages」
2. 点击「Create application」→「Create Worker」
3. 输入Worker名称（如 `tongyi-proxy`），点击「Deploy」
4. 部署完成后，点击「Edit code」进入编辑器
5. 在编辑器中，删除默认代码
6. 复制项目中 `worker.js` 文件的全部内容粘贴进去
7. 点击「Deploy」按钮重新部署

### 3. 获取Worker URL

- 部署成功后，在Workers详情页面可以看到Worker URL
- 复制该URL（如：`https://tongyi-proxy.your-username.workers.dev`）

## 五、使用应用

1. 访问GitHub Pages应用：
   ```
   https://[YOUR_USERNAME].github.io/[REPOSITORY_NAME]/
   ```

2. 配置API和代理：
   - 在应用页面顶部输入框中，填写以下信息：
     - **GitHub Token**：您的GitHub个人访问令牌
     - **通义千问API Key**：您的阿里云通义千问API密钥
     - **仓库所有者**：您的GitHub用户名
     - **仓库名称**：您创建的仓库名称
     - **代理服务器地址**：您刚才获取的Cloudflare Workers URL
   - 点击「保存配置」按钮

3. 开始使用功能：
   - 「与AI对话」：与通义千问进行学习和复习对话
   - 「生成复习计划」：根据学习情况生成复习计划
   - 「生成习题」：生成针对性的学习习题
   - 「提示词管理」：管理学习和复习方法的提示词

## 六、常见问题排查

### 1. GitHub Pages无法访问

- 检查部署状态：在GitHub仓库的「Actions」标签页查看部署是否成功
- 检查仓库设置：进入「Settings」→「Pages」查看部署状态和URL
- 等待几分钟：首次部署可能需要时间生效

### 2. AI功能无法使用

- 检查代理URL是否正确：确保输入的Cloudflare Workers URL格式正确
- 检查API密钥：确认GitHub Token和通义千问API Key有效
- 检查浏览器控制台：按下F12打开开发者工具，查看控制台是否有错误信息

### 3. 跨域错误

- 确保Cloudflare Workers已正确部署
- 检查worker.js代码是否完整复制
- 确认Worker URL已正确输入到应用中

## 七、注意事项

1. **API密钥安全**：
   - GitHub Token和通义千问API Key仅保存在您的浏览器本地存储中
   - 请妥善保管您的API密钥，不要与他人分享

2. **GitHub仓库权限**：
   - 确保您的GitHub Token具有足够的仓库访问权限
   - 如果使用私有仓库，请确保Token具有私有仓库访问权限

3. **Cloudflare Workers配额**：
   - Cloudflare Workers免费套餐包含每天10万次请求，完全满足个人使用需求
   - 超过配额后API调用会失败，可考虑升级套餐

4. **通义千问API费用**：
   - 使用通义千问API会产生费用，请关注您的API使用情况
   - 建议设置API使用限额，避免意外费用

如果您在部署过程中遇到任何问题，可以查看项目的「Issues」页面或联系技术支持。

祝您使用愉快！
