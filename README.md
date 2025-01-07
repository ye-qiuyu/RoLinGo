# RoLinGo - 智能图像分析与标注工具

RoLinGo 是一个结合 AWS Rekognition 和 OpenAI 的智能图像分析工具，能够自动识别图像中的物体并提供详细的场景描述。

## 主要功能

### 图像分析
- 使用 AWS Rekognition 进行精确的物体检测和位置标注
- 通过 OpenAI 生成流畅自然的场景描述
- 智能关键词提取和优化

### 智能处理
- 自动过滤相似关键词，保留置信度最高的结果
- 过滤基础关键词（如 "person"），提供更有价值的识别结果
- 智能去重：自动过滤 OpenAI 生成的与 AWS 重复的关键词

### 可视化展示
- 自动在图像上标注检测到的物体位置
- 清晰展示场景描述和关键特征
- 支持英文输出，提供更专业的分析结果

## 技术栈

### 前端
- React + TypeScript
- Vite 构建工具
- Zustand 状态管理
- Ant Design 组件库

### 后端
- Node.js + Express
- AWS Rekognition API
- OpenAI GPT-4V API

## 环境要求

- Node.js >= 14.0.0
- AWS 账号和相关配置
- OpenAI API Key

## 配置说明

1. 创建 `.env` 文件在 server 目录下：
```
AWS_ACCESS_KEY_ID=你的AWS访问密钥ID
AWS_SECRET_ACCESS_KEY=你的AWS秘密访问密钥
OPENAI_API_KEY=你的OpenAI API密钥
```

2. 安装依赖：
```bash
# 前端依赖
npm install

# 后端依赖
cd server
npm install
```

3. 启动服务：
```bash
# 启动后端服务
cd server
npm start

# 启动前端开发服务器
npm run dev
```

## 最新更新

- 优化了关键词处理逻辑：
  - 自动过滤 "person" 等基础关键词
  - 智能处理相似关键词组，保留最优结果
  - 新增 OpenAI 关键词去重功能，避免与 AWS 结果重复
- 所有 AI 生成内容改为英文输出，提供更专业的分析结果
- 优化了界面展示效果和用户体验

## 使用说明

1. 打开应用后，可以选择上传图片或使用相机拍摄
2. 系统会自动进行图像分析和标注
3. 分析结果包括：
   - AWS 物体检测结果（带位置标注）
   - OpenAI 场景描述（英文）
   - 优化后的关键词列表（已去重）
   - 场景类型分类

## 注意事项

- 确保图片格式支持（支持 jpg、png 等常见格式）
- 图片大小建议不超过 5MB
- 需要稳定的网络连接以确保 API 调用正常

## 开发计划

- [ ] 添加批量处理功能
- [ ] 支持自定义关键词过滤
- [ ] 优化图像压缩算法
- [ ] 添加历史记录功能

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License
