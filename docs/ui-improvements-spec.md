# UI 改进规格文档

## 概述
本文档描述 ququ 语音转文字应用的 UI 改进计划，包含三个主要功能。

---

## 功能 1：通知控制

### 问题
- AI 优化相关的 toast 通知太频繁
- 用户关闭 AI 优化后仍会看到相关通知
- 没有全局控制通知显示的选项

### 解决方案
1. 在设置页面添加「显示通知」开关
2. AI 优化关闭时，不显示 AI 相关通知
3. 通知开关控制所有非错误类通知

### 修改文件
- `src/settings.jsx` - 添加通知开关 UI
- `src/App.jsx` - 根据设置控制 toast 显示
- `src/hooks/useRecording.js` - 根据设置控制 AI 通知

### 设置项
```javascript
{
  enable_notifications: true,  // 默认开启，可关闭
}
```

---

## 功能 2：文字显示 UI 调整

### 问题
- 当前复制按钮在卡片底部，有分隔线
- 应该让文字有卡片效果，按钮在右上角

### 解决方案
重新设计 TextDisplay 组件布局：
- 文字区域有卡片/背景效果
- 复制按钮移到右上角（绝对定位）
- 移除底部分隔线

### 修改文件
- `src/App.jsx` - TextDisplay 组件

### UI 设计
```
┌─────────────────────────────┐
│ 识别的文字内容...        [📋]│
│ 可以是多行显示              │
└─────────────────────────────┘
```

---

## 功能 3：繁体中文支持

### 问题
- 目前 UI 全部是简体中文
- 语音识别结果是简体中文
- 没有语言切换选项

### 解决方案
1. 创建 i18n 国际化系统
2. 支持简体中文 (zh-CN) 和繁体中文 (zh-TW)
3. 在设置页面添加语言切换
4. UI 文字根据语言设置显示
5. 识别结果可选择转换为繁体

### 修改文件
- `src/i18n/` - 新建国际化目录
  - `src/i18n/index.js` - i18n 配置
  - `src/i18n/zh-CN.js` - 简体中文
  - `src/i18n/zh-TW.js` - 繁体中文
- `src/settings.jsx` - 添加语言切换 UI
- `src/App.jsx` - 使用 i18n
- `src/hooks/useRecording.js` - 识别结果转换

### 设置项
```javascript
{
  language: 'zh-TW',  // 'zh-CN' | 'zh-TW'，默认繁体
  convert_transcription: true,  // 是否将识别结果转换为当前语言
}
```

### 转换方案
使用 OpenCC 或类似库进行简繁转换：
- npm 包：`opencc-js`
- 轻量级，纯 JavaScript 实现

---

## 实施顺序

### Phase 1: 通知控制
1. 添加通知设置项
2. 修改 toast 调用逻辑
3. commit: `feat: add notification toggle in settings`

### Phase 2: 文字显示 UI
1. 重新设计 TextDisplay 布局
2. 复制按钮移到右上角
3. commit: `feat: improve text display UI with copy button in corner`

### Phase 3: 繁体中文支持
1. 安装 opencc-js
2. 创建 i18n 系统
3. 添加语言切换设置
4. 翻译所有 UI 文字
5. 添加识别结果转换
6. commit: `feat: add Traditional Chinese support with i18n`

---

## 测试清单

- [ ] 通知开关可以正常切换并保存
- [ ] 关闭通知后不显示成功类 toast
- [ ] 错误通知仍然显示（安全考虑）
- [ ] 复制按钮在右上角且可点击
- [ ] 文字完整显示无截断
- [ ] 语言切换后 UI 立即更新
- [ ] 识别结果正确转换为繁体
- [ ] 设置持久化正常
