// 简体中文翻译
export default {
  // 应用名称
  appName: '蛐蛐',

  // 设置页面
  settings: {
    title: '设置',
    generalSettings: '一般设置',
    generalDescription: '应用的基本设置选项。',
    notifications: '显示通知',
    notificationsDesc: '控制是否显示操作成功等提示通知',
    language: '界面语言',
    languageDesc: '选择应用界面显示的语言',
    convertTranscription: '转换识别结果',
    convertTranscriptionDesc: '将语音识别结果转换为当前语言',

    permissions: '权限管理',
    permissionsDesc: '测试和管理应用权限，确保麦克风和辅助功能正常工作。',
    micPermission: '麦克风权限',
    micPermissionDesc: '录制语音所需的权限',
    testMic: '测试麦克风',
    accessibilityPermission: '辅助功能权限',
    accessibilityPermissionDesc: '自动粘贴文本所需的权限',
    testPermission: '测试权限',

    aiConfig: 'AI配置',
    aiConfigDesc: '配置AI模型以优化和增强语音识别结果。如果API Key无效或未填写，优化功能将自动禁用。',
    enableAI: '启用AI文本优化',
    apiKey: 'API Key',
    apiKeyPlaceholder: '请输入您的AI API Key',
    apiKeyDesc: '用于AI文本优化功能的API密钥',
    baseUrl: 'API Base URL',
    baseUrlDesc: 'AI服务的API端点地址，支持OpenAI兼容的API',
    aiModel: 'AI模型',
    aiModelDesc: '选择用于文本优化的AI模型。推荐使用阿里云Qwen3模型获得更好的中文处理效果。',
    predefinedModel: '预定义模型',
    customModel: '自定义模型',
    customModelPlaceholder: '输入自定义模型名称',
    aliRecommend: '阿里云推荐',

    testConfig: '测试配置',
    testConfigDesc: '测试当前编辑的配置（无需保存）',
    testing: '测试中...',
    testSuccess: 'AI配置测试成功',
    testFailed: 'AI配置测试失败',

    saveSettings: '保存设置',
    saving: '保存中...',
    saveSuccess: '设置保存成功',
    saveFailed: '保存设置失败',

    about: '关于蛐蛐',
    aboutDesc: '基于FunASR和AI的中文语音转文字应用',
    features: {
      recognition: '高精度中文语音识别',
      ai: 'AI智能文本优化',
      realtime: '实时语音处理',
      privacy: '隐私保护设计'
    }
  },

  // 主界面
  app: {
    history: '历史记录',
    settings: '设置',
    needDownload: '需要下载AI模型文件才能开始使用',
    downloading: '正在下载模型文件...',
    loading: '模型加载中，请稍候...',
    modelError: '模型错误',
    modelNotReady: '模型未就绪，请稍候...',
    recording: '正在录音，再次点击停止',
    processing: '正在识别语音...',
    optimizing: 'AI正在优化文本，请稍候...',
    clickToRecord: '点击麦克风或按 {hotkey} 开始录音',
    startRecording: '按 [{hotkey}] 开始录音',

    aiOptimized: 'AI优化后',
    aiOptimizing: 'AI正在优化文本...',
    copyOriginal: '复制识别文本',
    copyOptimized: '复制优化文本',
    paste: '粘贴优化文本',
    export: '导出文本'
  },

  // 通知消息
  notifications: {
    enabled: '已启用通知',
    disabled: '已关闭通知',
    aiEnabled: '已启用AI文本优化',
    aiDisabled: '已关闭AI文本优化',
    copied: '文本已复制到剪贴板',
    copyFailed: '无法复制文本到剪贴板',
    pasted: '文本已自动粘贴到当前输入框',
    pasteToClipboard: '文本已复制到剪贴板，请手动粘贴',
    pasteFailed: '粘贴失败',
    pasteFailedDesc: '请检查辅助功能权限。文本已复制到剪贴板 - 请手动使用 Cmd+V 粘贴。',
    exported: '文本已导出到文件',
    exportFailed: '无法导出文本文件',
    transcriptionComplete: '语音识别完成',
    aiComplete: 'AI文本优化完成',
    aiFailedUsedOriginal: '已粘贴原始识别文本',
    downloadStarted: '开始下载模型文件...',
    downloadComplete: '模型下载完成，正在加载...',
    downloadFailed: '模型下载失败',
    pleaseDownload: '请先下载AI模型文件',
    modelDownloading: '模型正在下载中，请稍候...',
    modelLoading: '模型正在加载中，请稍候...',
    modelNotReady: '模型未就绪，请稍候...',
    languageChanged: '语言已切换'
  },

  // 语言选项
  languages: {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文'
  }
};
