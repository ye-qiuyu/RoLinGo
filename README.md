# RoLinGo - README

## 项目简介

RoLinGo 是一款基于 AI 技术的英语口语练习应用，通过图片识别场景，生成符合不同情境的地道表达，同时提供多种风格化角色选择，帮助用户自信开口，提升真实场景下的英语表达能力。项目采用移动端优先的Web开发策略，专注于提供最佳的移动端用户体验。

## 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- 现代浏览器（支持 ES6+ 特性）

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Ionic React（UI 组件）
- Zustand（状态管理）
- React Router DOM（路由管理）

### 后端
- Node.js
- Express
- AWS SDK（Rekognition API）
- OpenAI API

## 项目结构

```
RoLinGo/
├── src/                    # 前端源代码
│   ├── components/         # React 组件
│   ├── pages/             # 页面组件
│   ├── services/          # API 服务
│   ├── store/             # 状态管理
│   └── types/             # TypeScript 类型定义
├── server/                 # 后端源代码
│   ├── index.js           # 服务器入口
│   └── package.json       # 后端依赖
├── public/                 # 静态资源
│   └── data/              # 词汇表等数据
└── package.json           # 前端依赖
```

## 安装和运行

1. 克隆项目
```bash
git clone [项目地址]
cd RoLinGo
```

2. 安装前端依赖
```bash
npm install
```

3. 安装后端依赖
```bash
cd server
npm install
```

4. 环境配置
- 在项目根目录创建 `.env.local` 文件
- 在 `server` 目录创建 `.env` 文件
```env
# .env.local 示例
VITE_API_URL=http://localhost:3000

# server/.env 示例
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
OPENAI_API_KEY=your_openai_api_key
```

5. 启动服务
```bash
# 终端 1：启动前端
npm run dev

# 终端 2：启动后端
cd server
npm run dev
```

## 主要功能

### 1. 图片场景分析
- 支持上传或拍摄图片
- AWS Rekognition 物体检测
- OpenAI GPT-4 场景描述生成

### 2. 词汇学习系统
- 多级难度词汇表
- 场景相关词汇推荐
- 智能词汇过滤和分类

### 3. 移动端优化
- 响应式设计
- 触摸友好界面
- 性能优化

[... 保留原有内容 ...]

### AI 服务实现细节

#### 1. AWS Rekognition（物体检测）
- **功能**：精确识别图片中的物体和位置
- **实现流程**：
  - 图片预处理：转换为 base64 格式
  - 设置识别参数：最多50个标签，最低置信度70%
  - 返回结果：包含关键词、置信度和位置信息
  - 结果格式化：转换为百分比位置信息

#### 2. 关键词过滤系统
- **功能**：去除重复和相似的关键词
- **实现方式**：
  - 预定义相似关键词组（如人物、武器、建筑等）
  - 在每组中只保留置信度最高的关键词
  - 应用于 AWS 结果和检测结果

#### 3. OpenAI 增强（GPT-4）
- **功能**：深度理解图片内容，生成自然语言描述
- **实现流程**：
  - 输入：图片 + AWS 关键词（如有）
  - 处理：直接分析图片内容
  - 输出：
    * 详细的场景描述
    * 3-5个重要关键词
    * 场景类型分类
  - 格式处理：确保输出符合 JSON 格式

#### 4. 系统集成
- **数据流**：
  1. 图片上传 → AWS 识别
  2. 关键词过滤处理
  3. OpenAI 增强分析
  4. 结果整合展示
- **错误处理**：
  - AWS 识别失败时仍可使用 OpenAI 分析
  - 格式错误自动修复机制
  - 完整的错误日志记录
- **防重复分析机制**：
  - 使用 `useRef` 实现分析状态锁定
  - 分析过程中阻止重复请求
  - 图片切换时自动重置状态
  - 完整的状态日志记录
- **标签显示系统**：
  - **双来源标签**：
    * AWS 检测标签：黄色半透明背景，精确定位于检测物体周围
    * OpenAI 关键词标签：绿色半透明背景，随机分布在图片空白区域
  - **标签布局优化**：
    * 智能避免标签重叠（重叠度阈值 20%）
    * 自动调整位置确保在图片边界内
    * 保持标签可读性（背景模糊效果）
  - **交互体验**：
    * 标签悬停效果
    * 清晰的视觉层级（zIndex 管理）
    * 响应式布局适配

[... 保留其他原有内容 ...]
