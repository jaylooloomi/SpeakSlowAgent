# 串流辨識功能規格文檔

## 概述

實現即時串流語音辨識功能，讓用戶在說話的同時就能看到辨識結果，提供更好的即時反饋體驗。

**關鍵：** 串流辨識需要使用專門的 **Zipformer Transducer** 模型，與離線辨識使用的 Paraformer 模型不同。

---

## 模型說明

### 離線模型 (目前使用)
- **名稱：** `sherpa-onnx-paraformer-zh-2023-09-14`
- **類型：** Non-streaming (離線/批處理)
- **特點：** 準確度高，但需要等錄音結束才能辨識
- **狀態：** ✅ 已下載

### 串流模型
- **名稱：** `sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20`
- **類型：** Streaming (即時串流)
- **特點：** 邊說邊辨識，支援熱詞功能
- **大小：** ~540MB
- **狀態：** ✅ 已下載
- **位置：** `poc-sherpa/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/`

### 模型比較
| 特性 | Paraformer (離線) | Zipformer (串流) |
|------|------------------|------------------|
| 即時辨識 | ❌ | ✅ |
| 熱詞功能 | ❌ | ✅ |
| 中英混合 | 中文為主 | ✅ 雙語 |
| 準確度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 延遲 | 高（需等錄音結束） | 低（即時） |

---

## 現狀分析

### 已完成 ✅
| 模塊 | 狀態 | 說明 |
|------|------|------|
| **串流模型** | ✅ 已下載 | Zipformer 模型已下載並解壓 |
| `useStreamingRecording` Hook | ✅ 100% | 前端錄音、VAD、數據發送邏輯完整 |
| 設定頁面 UI | ✅ 100% | 串流模式開關已實現 |
| Sherpa-ONNX 串流 API | ✅ 可用 | 庫本身支持串流 |
| Silero VAD | ✅ 已整合 | Python 端已實現語音活動檢測 |
| 音頻預處理 | ✅ 已整合 | 音量正規化、降噪已實現 |

### 未完成 🚫
| 模塊 | 狀態 | 說明 |
|------|------|------|
| IPC 通道 | ✅ 已完成 | `ipcHandlers.js` 第 133-168 行 |
| SherpaManager 串流方法 | ✅ 已完成 | `streamingStart/Feed/End` 已實現 |
| Python 服務器命令 | ✅ 已完成 | `stream_init/feed/end` 已實現 |
| 雙模型支援 | ✅ 已完成 | Paraformer + Zipformer |

---

## 架構設計

### 數據流

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Renderer)                           │
├─────────────────────────────────────────────────────────────────┤
│  useStreamingRecording Hook                                      │
│  ┌─────────┐    ┌─────────┐    ┌──────────────┐                 │
│  │ 麥克風  │ -> │  VAD    │ -> │ 音頻數據發送  │                 │
│  │ 捕獲    │    │ 靜音檢測 │    │ (每300ms)    │                 │
│  └─────────┘    └─────────┘    └──────────────┘                 │
│                                       │                          │
│                                       ▼                          │
│                              IPC: streaming-feed                 │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        主進程 (Main)                             │
├─────────────────────────────────────────────────────────────────┤
│  IPCHandlers                        SherpaManager               │
│  ┌────────────────┐                ┌────────────────┐           │
│  │ streaming-start│ <------------> │ streamingStart │           │
│  │ streaming-feed │ <------------> │ streamingFeed  │           │
│  │ streaming-end  │ <------------> │ streamingEnd   │           │
│  └────────────────┘                └────────────────┘           │
│                                           │                      │
│                                           ▼                      │
│                                    stdin/stdout                  │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Python 服務器 (sherpa_server.py)             │
├─────────────────────────────────────────────────────────────────┤
│  命令處理器                                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐ │
│  │ stream_init    │    │ stream_feed    │    │ stream_end     │ │
│  │ 初始化串流會話  │    │ 接收音頻數據   │    │ 完成並返回結果  │ │
│  └────────────────┘    └────────────────┘    └────────────────┘ │
│          │                     │                     │          │
│          ▼                     ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Sherpa-ONNX 串流辨識引擎                        ││
│  │  recognizer.create_stream() -> accept_waveform() -> result  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 功能規格

### 1. Python 服務器串流命令

#### 1.1 `stream_init` - 初始化串流會話

**請求格式：**
```json
{
  "command": "stream_init",
  "session_id": "uuid-string",
  "options": {
    "sample_rate": 16000,
    "enable_vad": true,
    "enable_punctuation": true
  }
}
```

**響應格式：**
```json
{
  "success": true,
  "session_id": "uuid-string",
  "message": "串流會話已初始化"
}
```

#### 1.2 `stream_feed` - 發送音頻數據

**請求格式：**
```json
{
  "command": "stream_feed",
  "session_id": "uuid-string",
  "audio_data": "base64-encoded-audio",
  "is_final": false
}
```

**響應格式：**
```json
{
  "success": true,
  "session_id": "uuid-string",
  "partial_text": "目前辨識到的文字",
  "is_final": false
}
```

#### 1.3 `stream_end` - 結束串流會話

**請求格式：**
```json
{
  "command": "stream_end",
  "session_id": "uuid-string"
}
```

**響應格式：**
```json
{
  "success": true,
  "session_id": "uuid-string",
  "final_text": "完整的辨識結果，帶標點符號",
  "raw_text": "原始辨識結果",
  "duration": 5.2,
  "confidence": 0.95
}
```

---

### 2. SherpaManager 串流方法

#### 2.1 `streamingStart(options)`

```javascript
/**
 * 初始化串流辨識會話
 * @param {Object} options - 選項
 * @param {number} options.sampleRate - 採樣率，預設 16000
 * @param {boolean} options.enableVad - 是否啟用 VAD
 * @param {boolean} options.enablePunctuation - 是否啟用標點恢復
 * @returns {Promise<{success: boolean, sessionId: string}>}
 */
async streamingStart(options = {}) {
  const sessionId = crypto.randomUUID();
  const command = {
    command: 'stream_init',
    session_id: sessionId,
    options: {
      sample_rate: options.sampleRate || 16000,
      enable_vad: options.enableVad !== false,
      enable_punctuation: options.enablePunctuation !== false
    }
  };

  const result = await this._sendCommand(command);
  if (result.success) {
    this.activeStreamSession = sessionId;
  }
  return result;
}
```

#### 2.2 `streamingFeed(audioData, isFinal)`

```javascript
/**
 * 發送音頻數據到串流會話
 * @param {string} audioData - Base64 編碼的音頻數據
 * @param {boolean} isFinal - 是否為最後一段
 * @returns {Promise<{success: boolean, partialText: string}>}
 */
async streamingFeed(audioData, isFinal = false) {
  if (!this.activeStreamSession) {
    return { success: false, error: '沒有活動的串流會話' };
  }

  const command = {
    command: 'stream_feed',
    session_id: this.activeStreamSession,
    audio_data: audioData,
    is_final: isFinal
  };

  return await this._sendCommand(command);
}
```

#### 2.3 `streamingEnd()`

```javascript
/**
 * 結束串流會話並獲取最終結果
 * @returns {Promise<{success: boolean, finalText: string, rawText: string}>}
 */
async streamingEnd() {
  if (!this.activeStreamSession) {
    return { success: false, error: '沒有活動的串流會話' };
  }

  const command = {
    command: 'stream_end',
    session_id: this.activeStreamSession
  };

  const result = await this._sendCommand(command);
  this.activeStreamSession = null;
  return result;
}
```

#### 2.4 `preloadStreamingModel()`

```javascript
/**
 * 預載串流模型以減少首次延遲
 * @returns {Promise<{success: boolean, already_loaded: boolean}>}
 */
async preloadStreamingModel() {
  // 串流模式使用與離線相同的模型，確保服務器已啟動即可
  if (this.serverReady) {
    return { success: true, already_loaded: true };
  }

  await this._startSherpaServer();
  return { success: true, already_loaded: false };
}
```

---

### 3. IPC 通道

**位置：** `src/helpers/ipcHandlers.js`

```javascript
// =====================================================
// 串流辨識 API
// =====================================================

ipcMain.handle("streaming-start", async (event, options) => {
  return await this.sherpaManager.streamingStart(options);
});

ipcMain.handle("streaming-feed", async (event, audioData, isFinal) => {
  return await this.sherpaManager.streamingFeed(audioData, isFinal);
});

ipcMain.handle("streaming-end", async () => {
  return await this.sherpaManager.streamingEnd();
});

ipcMain.handle("preload-streaming-model", async () => {
  return await this.sherpaManager.preloadStreamingModel();
});
```

---

### 4. 前端 API (preload.js)

```javascript
// 串流辨識 API
streamingStart: (options) => ipcRenderer.invoke("streaming-start", options),
streamingFeed: (audioData, isFinal) => ipcRenderer.invoke("streaming-feed", audioData, isFinal),
streamingEnd: () => ipcRenderer.invoke("streaming-end"),
preloadStreamingModel: () => ipcRenderer.invoke("preload-streaming-model"),
```

---

## 實現順序

### Phase 0: 下載串流模型 ✅ 已完成
1. [x] 下載 `sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2`
2. [x] 解壓到 `poc-sherpa/` 目錄
3. [x] 驗證模型文件完整性
4. [ ] 更新 sherpaManager 模型路徑配置

**下載命令：**
```bash
cd poc-sherpa
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2
tar -xjf sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2
```

**模型文件結構：**
```
sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/
├── encoder-epoch-99-avg-1.onnx      # 編碼器
├── decoder-epoch-99-avg-1.onnx      # 解碼器
├── joiner-epoch-99-avg-1.onnx       # 連接器
├── tokens.txt                        # 詞彙表
└── bpe.model                         # BPE 模型
```

### Phase 1: Python 服務器雙模型支援 ✅ 已完成
1. [x] 新增串流模型初始化方法
2. [x] 實現 Transducer 辨識器創建
3. [x] 新增 `stream_init` 命令處理
4. [x] 新增 `stream_feed` 命令處理
5. [x] 新增 `stream_end` 命令處理
6. [x] 整合 VAD 和標點恢復

### Phase 2: SherpaManager 雙模型支援 ✅ 已完成
1. [x] 新增模型類型配置 (offline/streaming)
2. [x] 新增 `activeStreamSession` 狀態追蹤
3. [x] 實現 `streamingStart()` 方法
4. [x] 實現 `streamingFeed()` 方法
5. [x] 實現 `streamingEnd()` 方法
6. [x] 實現 `preloadStreamingModel()` 方法

### Phase 3: IPC 連接 ✅ 已完成
1. [x] 解除 `ipcHandlers.js` 中串流相關的註釋
2. [x] 連接到 SherpaManager 方法
3. [x] 確保 `preload.js` 中的 API 可用

### Phase 4: 整合測試 🔄 進行中
1. [ ] 測試串流模型載入
2. [ ] 測試即時辨識結果返回
3. [ ] 測試 VAD 分段
4. [ ] 測試標點恢復
5. [ ] 測試模型切換
6. [ ] 測試錯誤處理和資源清理

---

## 技術細節

### 音頻格式
- **採樣率：** 16000 Hz
- **位深度：** 16-bit
- **聲道：** 單聲道 (Mono)
- **編碼：** PCM → Base64

### VAD 參數
- **靜音門檻：** RMS < 0.01
- **靜音持續時間：** 400ms 觸發分段
- **Silero VAD：** 用於更精確的語音檢測

### 性能目標
- **首次響應延遲：** < 500ms
- **增量更新延遲：** < 200ms
- **記憶體使用：** < 100MB 增量

---

## 相關文件

| 文件 | 用途 |
|------|------|
| `src/hooks/useStreamingRecording.js` | 前端串流錄音 Hook |
| `src/helpers/sherpaManager.js` | Sherpa 管理器 |
| `src/helpers/ipcHandlers.js` | IPC 通道處理 |
| `preload.js` | 前端 API 暴露 |
| `sherpa_server.py` | Python 辨識服務器 |
| `src/settings.jsx` | 設定頁面 |

---

## 附錄：現有前端 Hook 參考

**`useStreamingRecording.js` 關鍵邏輯：**

```javascript
// 每 300ms 發送合併的音頻數據
const sendInterval = setInterval(async () => {
  if (audioChunksRef.current.length > 0) {
    const merged = mergeAudioChunks(audioChunksRef.current);
    audioChunksRef.current = [];

    const base64 = arrayBufferToBase64(merged.buffer);
    const result = await window.electronAPI.streamingFeed(base64, false);

    if (result.success && result.partial_text) {
      setPartialText(result.partial_text);
    }
  }
}, 300);

// VAD 靜音檢測
if (rms < SILENCE_THRESHOLD) {
  silenceStartRef.current = silenceStartRef.current || Date.now();
  if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
    // 觸發分段結束
    handleSegmentEnd();
  }
}
```
