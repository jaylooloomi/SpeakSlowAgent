# QuQu ASR 優化指南

## 第一部分：不改架構的優化

### 已完成的優化

| 優化項目 | 原設定 | 新設定 | 效果 |
|---------|-------|-------|------|
| ASR ncpu | 4 (固定) | 動態 (max 8) | 多核 CPU 更快 |
| VAD max_segment | 60s | 30s | 分段更快 |
| batch_size_s | 60 | 30 | 短音訊處理更快 |
| 串流 chunk_size | [0,10,5] | [0,8,4] | 600ms → 480ms 延遲 |
| 前端 AudioContext | 每次創建 | 預熱復用 | 減少轉換延遲 |
| 串流模型預載 | 首次使用時載入 | 啟用設定時預載 | 消除首次延遲 |

---

### 還可以做的優化（不改架構）

#### 1. ONNX 量化推理

```python
# funasr_server.py
self.asr_model = AutoModel(
    model="damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    quantize=True,  # 啟用量化
    # ...
)
```

- **預期效果**：提升 40% 速度，精度幾乎不變
- **風險**：需要確認 FunASR 版本支援

#### 2. 更激進的串流參數

```python
# chunk_size 從 [0, 8, 4] 改為 [0, 6, 3]
chunk_size = [0, 6, 3]  # 360ms 延遲
```

- **預期效果**：延遲從 480ms → 360ms
- **風險**：可能影響準確度

#### 3. 前端音訊處理優化

- 使用 Web Worker 進行 WAV 轉換，不阻塞主線程
- 錄音時就開始準備 AudioContext，不等停止

#### 4. 調整 encoder/decoder chunk look back

```python
encoder_chunk_look_back = 2  # 從 4 降到 2
decoder_chunk_look_back = 0  # 從 1 降到 0
```

- **預期效果**：減少上下文依賴，加快處理
- **風險**：可能影響長句準確度

#### 5. 熱詞優化

```python
hotword = "常用詞1 常用詞2 常用詞3"
```

- **預期效果**：特定詞彙識別率提升到 97%+
- **適用場景**：有固定詞彙的使用場景

---

## 第二部分：改架構的優化

### 方案 A：換成 SenseVoice + sherpa-onnx（推薦）

**優點**：
- 比 Whisper 更快、更準（40 萬小時資料訓練）
- 非自回歸架構 = 極低延遲
- 支援中英日韓粵語
- GPU (TensorRT) 加速可達 526x real-time
- sherpa-onnx 部署簡單，支援離線、跨平台

**整合步驟**：
1. 安裝 sherpa-onnx
2. 下載 SenseVoice 模型
3. 修改 funasr_server.py 改用 sherpa-onnx
4. 前端不需改動

**範例程式碼**：

```python
import sherpa_onnx

recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
    model="sensevoice-small",
    tokens="tokens.txt",
    num_threads=4,
    use_itn=True,
)

# 辨識
stream = recognizer.create_stream()
stream.accept_waveform(16000, audio_samples)
recognizer.decode_stream(stream)
result = stream.result.text
```

### 方案 B：加入 Silero VAD

**優點**：
- 超輕量，幾乎不佔資源
- 比 FunASR FSMN VAD 更快
- 可以在前端跑（WebAssembly）

**整合方式**：
1. 前端用 Silero VAD 檢測語音段落
2. 只發送有聲音的段落到後端
3. 減少後端處理量

### 方案 C：兩階段辨識

**流程**：
```
用戶說話
    ↓
[Paraformer-streaming 即時顯示]
    ↓
用戶停止
    ↓
[Paraformer-large 最終修正]
    ↓
顯示準確結果
```

**優點**：
- 感知延遲極低
- 最終結果準確

**缺點**：
- 需要載入兩個模型
- 記憶體佔用增加

### 方案 D：雲端 API 備援

**可選服務**：
- Groq Whisper API（免費額度，超快）
- Azure Speech Services
- Google Cloud Speech-to-Text

**整合方式**：
- 本地辨識失敗或信心低時，自動切換到雲端
- 或者作為「高準確度模式」選項

---

## 優化優先級建議

### 短期（不改架構）

1. 已完成基礎參數優化
2. 嘗試 ONNX 量化
3. 嘗試更激進的 chunk_size

### 中期（小改架構）

1. 加入 Silero VAD 前端預處理
2. 實作兩階段辨識

### 長期（大改架構）

1. 評估並整合 SenseVoice
2. 加入雲端 API 備援

---

## 效能基準測試建議

測試不同設定的效能：

```bash
# 測試不同 chunk_size
chunk_size = [0, 10, 5]  # 600ms 延遲（原始）
chunk_size = [0, 8, 4]   # 480ms 延遲（目前）
chunk_size = [0, 6, 3]   # 360ms 延遲（激進）
chunk_size = [0, 5, 2]   # 300ms 延遲（極速）

# 測試指標
# - 首字延遲（First Token Latency）
# - 辨識準確度（Character Error Rate）
# - CPU 使用率
# - 記憶體佔用
```

---

## 附錄：FunASR 參數參考

### AutoModel 參數

| 參數 | 說明 | 建議值 |
|------|------|--------|
| ncpu | CPU 線程數 | min(cpu_count, 8) |
| quantize | 啟用量化 | True（可加速 40%）|
| device | 運算設備 | "cpu" 或 "cuda" |

### transcribe 參數

| 參數 | 說明 | 建議值 |
|------|------|--------|
| batch_size_s | 批次大小（秒） | 30（短音訊）/ 60（長音訊）|
| use_vad | 啟用 VAD | True |
| use_punc | 啟用標點恢復 | True |
| hotword | 熱詞列表 | 根據使用場景設定 |

### Streaming 參數

| 參數 | 說明 | 建議值 |
|------|------|--------|
| chunk_size | [history, current, lookahead] | [0, 8, 4] |
| encoder_chunk_look_back | 編碼器回看 | 4（準確）/ 2（快速）|
| decoder_chunk_look_back | 解碼器回看 | 1（準確）/ 0（快速）|
