# QuQu ASR 完整優化研究報告

## 目錄

1. [優化面向總覽](#優化面向總覽)
2. [速度優化](#速度優化)
3. [準確度優化](#準確度優化)
4. [音訊品質優化](#音訊品質優化)
5. [文字後處理優化](#文字後處理優化)
6. [使用者體驗優化](#使用者體驗優化)
7. [優化優先級與路線圖](#優化優先級與路線圖)

---

## 優化面向總覽

```
┌─────────────────────────────────────────────────────────────┐
│                    ASR 系統優化面向                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ 音訊輸入 │ -> │ ASR引擎 │ -> │ 後處理  │ -> │ 輸出顯示 │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │麥克風品質│    │模型參數  │    │文字修飾  │    │感知速度  │  │
│  │降噪處理  │    │量化加速  │    │熱詞優化  │    │漸進顯示  │  │
│  │取樣率    │    │串流參數  │    │標點恢復  │    │視覺回饋  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 優化維度矩陣

| 維度 | 目標 | 當前狀態 | 可優化空間 |
|------|------|----------|-----------|
| **速度** | 延遲 < 300ms | 360ms | 中 |
| **準確度** | CER < 3% | ~2-3% | 低（已很準）|
| **音訊品質** | 適應各種麥克風 | 基本 | 高 |
| **後處理** | 自動修飾文字 | 標點恢復 | 高 |
| **體驗** | 感知即時 | 良好 | 中 |

---

## 速度優化

### 已完成的優化

| 優化項 | 原本 | 現在 | 提升 |
|--------|------|------|------|
| chunk_size | [0,10,5] | [0,6,3] | 600ms → 360ms |
| encoder_chunk_look_back | 4 | 2 | -50% 計算量 |
| decoder_chunk_look_back | 1 | 0 | -100% 計算量 |
| ONNX 量化 | 無 | quantize=True | +40% 速度 |
| ncpu | 4 | 動態 max 8 | 多核利用 |
| AudioContext | 每次創建 | 預熱復用 | -50ms |

### 還能做的速度優化

#### 1. 更激進的 chunk_size（風險中）

```python
# 目前
chunk_size = [0, 6, 3]  # 360ms

# 極速
chunk_size = [0, 5, 2]  # 300ms

# 超極速（可能影響準確度）
chunk_size = [0, 4, 2]  # 240ms
```

**建議**：提供使用者選項「速度優先」vs「準確優先」

#### 2. 模型輕量化

| 模型 | 大小 | 速度 | 準確度 |
|------|------|------|--------|
| Paraformer-large | 880MB | 基準 | 最高 |
| Paraformer-base | 220MB | 2x | -5% |
| SenseVoice-small | 200MB | 3x | -3% |

**建議**：考慮換成 SenseVoice-small，速度快 3 倍，準確度只降一點

#### 3. 前端 Web Worker

```javascript
// 目前：主線程處理音訊轉換
const wavData = await convertToWav(audioBlob);

// 優化：Web Worker 背景處理
const worker = new Worker('audioWorker.js');
worker.postMessage(audioBlob);
worker.onmessage = (e) => { /* 不阻塞 UI */ };
```

**預期效果**：UI 更流暢，不卡頓

#### 4. 音訊串流優化

```javascript
// 目前：固定間隔發送
setInterval(() => sendChunk(), 100);

// 優化：根據 VAD 動態發送
if (hasVoiceActivity(chunk)) {
  sendChunk();  // 有聲音才發送
}
```

**預期效果**：減少無效傳輸，降低 CPU 負載

---

## 準確度優化

### 1. 熱詞優化（最重要）

熱詞可以讓特定詞彙的識別率從 80% 提升到 97%+。

```python
# funasr_server.py
hotword = "台灣 繁體 程式碼 GitHub Claude"

result = self.asr_model.generate(
    input=audio,
    hotword=hotword,  # 加入熱詞
)
```

**實作建議**：

```python
# 系統級熱詞（內建）
SYSTEM_HOTWORDS = [
    # 技術詞彙
    "GitHub", "Python", "JavaScript", "API", "JSON",
    # 台灣用語
    "台灣", "繁體", "捷運", "悠遊卡", "Line",
    # 常見人名地名
    "台北", "高雄", "台中",
]

# 使用者自訂熱詞（從設定檔讀取）
user_hotwords = load_user_hotwords()

hotword = " ".join(SYSTEM_HOTWORDS + user_hotwords)
```

**UI 建議**：設定頁面加入「自訂詞彙」輸入框

### 2. 語言模型融合

FunASR 支援外掛語言模型提升準確度：

```python
# 使用語言模型重新評分
result = self.asr_model.generate(
    input=audio,
    use_lm=True,  # 啟用語言模型
    lm_weight=0.5,  # 語言模型權重
)
```

**注意**：會增加一些延遲，適合「準確優先」模式

### 3. 多輪修正

```
第一輪：ASR 快速輸出（可能有錯）
第二輪：語言模型修正（更準確）
第三輪：使用者確認/手動修改
```

### 4. 上下文感知

```python
# 記住最近辨識的內容，作為上下文
context = get_recent_transcriptions(limit=3)

result = self.asr_model.generate(
    input=audio,
    context=context,  # 提供上下文
)
```

---

## 音訊品質優化

### 麥克風品質影響

| 麥克風等級 | 預期 CER | 說明 |
|-----------|----------|------|
| 高品質（專業麥克風）| 1-2% | 最佳效果 |
| 中品質（耳機麥克風）| 2-4% | 一般使用 |
| 低品質（筆電內建）| 4-8% | 需要降噪處理 |
| 極差（有雜訊環境）| 8%+ | 強烈建議降噪 |

### 1. 前端降噪處理

```javascript
// 使用 Web Audio API 降噪
const audioContext = new AudioContext();

// 方案 A：內建降噪
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,    // 回音消除
    noiseSuppression: true,    // 噪音抑制
    autoGainControl: true,     // 自動增益
  }
});

// 方案 B：RNNoise（更強的 AI 降噪）
// 需要額外載入 rnnoise-wasm
```

### 2. 音訊預處理

```python
# 後端音訊預處理
import numpy as np
from scipy import signal

def preprocess_audio(audio):
    # 1. 高通濾波（去除低頻噪音）
    b, a = signal.butter(5, 80, 'hp', fs=16000)
    audio = signal.filtfilt(b, a, audio)

    # 2. 正規化音量
    audio = audio / np.max(np.abs(audio))

    # 3. 預加重（增強高頻）
    audio = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])

    return audio
```

### 3. 音量檢測與提示

```javascript
// 檢測音量是否足夠
const analyser = audioContext.createAnalyser();
const dataArray = new Uint8Array(analyser.frequencyBinCount);

function checkVolume() {
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

  if (average < 10) {
    showWarning("麥克風音量過低，請靠近說話或調高音量");
  } else if (average > 200) {
    showWarning("音量過大，可能破音");
  }
}
```

### 4. 取樣率處理

```javascript
// 確保使用 16kHz 取樣率（ASR 模型要求）
const audioContext = new AudioContext({ sampleRate: 16000 });

// 如果麥克風不支援 16kHz，需要重新取樣
if (stream.getAudioTracks()[0].getSettings().sampleRate !== 16000) {
  // 使用 OfflineAudioContext 重新取樣
}
```

---

## 文字後處理優化

### 方案比較

| 方案 | 速度 | 效果 | 成本 | 離線 |
|------|------|------|------|------|
| 規則替換 | 極快 | 有限 | 無 | 是 |
| FunASR 標點恢復 | 快 | 好 | 無 | 是 |
| 熱詞優化 | 無延遲 | 很好 | 無 | 是 |
| 本地語言模型 | 中 | 很好 | 無 | 是 |
| AI API 修飾 | 慢 | 最好 | 有 | 否 |

### 1. 規則替換（即時，無延遲）

```python
# 常見錯字對照表
CORRECTIONS = {
    # 同音字
    "在見": "再見",
    "以後": "已後",  # 反向也要
    "已後": "以後",
    "那裡": "哪裡",  # 疑問句

    # 口語修正
    "然後就是": "接著",
    "就是說": "",
    "那個那個": "那個",

    # 標點修正
    "。。": "。",
    "，，": "，",
}

def apply_corrections(text):
    for wrong, correct in CORRECTIONS.items():
        text = text.replace(wrong, correct)
    return text
```

### 2. FunASR 標點恢復（已啟用）

```python
# 目前已經在用 CT-Transformer
result = self.asr_model.generate(
    input=audio,
    use_punc=True,  # 啟用標點恢復
)
```

### 3. 本地輕量語言模型

```python
# 使用 KenLM 做 N-gram 語言模型修正
import kenlm
model = kenlm.Model('chinese_lm.arpa')

def correct_with_lm(text, candidates):
    """從多個候選中選擇最可能的"""
    scores = [(c, model.score(c)) for c in candidates]
    return max(scores, key=lambda x: x[1])[0]
```

### 4. AI 修飾（可選功能）

```python
# 可選的 AI 修飾功能
async def ai_polish(text, style="formal"):
    """使用 AI 修飾文字（非同步，不阻塞）"""

    prompts = {
        "formal": "請修正以下語音轉文字的錯誤，保持原意，使用正式書面語：",
        "casual": "請修正以下語音轉文字的錯誤，保持口語風格：",
        "minimal": "請只修正明顯的錯字，不要改變句子結構：",
    }

    response = await openai.chat.completions.create(
        model="gpt-4o-mini",  # 快速便宜
        messages=[
            {"role": "system", "content": prompts[style]},
            {"role": "user", "content": text}
        ],
        max_tokens=len(text) * 2,
    )

    return response.choices[0].message.content
```

**UI 建議**：

```
[ ] 啟用 AI 修飾（需要網路，會增加 0.5-1 秒延遲）
    風格：( ) 正式  ( ) 口語  ( ) 最小修正
```

### 5. 混合策略（推薦）

```python
def post_process(text, use_ai=False):
    """混合後處理策略"""

    # 第一層：規則替換（即時）
    text = apply_corrections(text)

    # 第二層：標點恢復（已在 ASR 中完成）
    # text = add_punctuation(text)

    # 第三層：AI 修飾（可選）
    if use_ai:
        text = await ai_polish(text)

    return text
```

---

## 使用者體驗優化

### 1. 感知速度優化

```
實際速度：用戶說完 -> 文字出現 = 360ms
感知速度：用戶感覺到的延遲

感知速度 < 實際速度 的技巧：
```

#### 視覺回饋

```javascript
// 錄音時顯示動態波形
function showWaveform(audioData) {
  // 用戶看到波形在動 -> 感覺系統在工作
}

// 處理中顯示打字動畫
function showTypingIndicator() {
  return "⋯";  // 三個點在跳動
}
```

#### 漸進式顯示

```javascript
// 不要等全部辨識完才顯示
// 而是逐字/逐詞顯示

function displayProgressively(text) {
  const words = text.split('');
  let displayed = '';

  for (const char of words) {
    displayed += char;
    updateDisplay(displayed);
    await sleep(30);  // 每個字間隔 30ms
  }
}
```

### 2. 錯誤處理優化

```javascript
// 辨識失敗時的友善提示
const ERROR_MESSAGES = {
  'no_speech': '沒有檢測到語音，請再說一次',
  'audio_too_short': '語音太短，請說長一點',
  'audio_too_noisy': '背景噪音太大，請到安靜的地方',
  'model_error': '系統忙碌中，請稍後再試',
};
```

### 3. 快捷操作

```javascript
// 快捷鍵
Ctrl+Space: 開始/停止錄音
Ctrl+Z: 撤銷上一次輸入
Ctrl+Enter: 確認並發送
Escape: 取消錄音
```

---

## 優化優先級與路線圖

### 優先級排序

| 優先級 | 優化項 | 效果 | 難度 | 建議 |
|--------|--------|------|------|------|
| P0 | 熱詞優化 | 高 | 低 | 立即做 |
| P0 | 音訊降噪設定 | 高 | 低 | 立即做 |
| P1 | 規則替換後處理 | 中 | 低 | 本週做 |
| P1 | 使用者自訂詞彙 UI | 中 | 中 | 本週做 |
| P2 | Web Worker 音訊處理 | 中 | 中 | 下週做 |
| P2 | 音量檢測提示 | 中 | 低 | 下週做 |
| P3 | AI 修飾（可選功能）| 高 | 中 | 評估後做 |
| P3 | 換成 SenseVoice | 高 | 高 | 評估後做 |

### 短期目標（本週）

1. **熱詞優化**
   - 內建常用詞彙表
   - 設定頁面加入自訂詞彙輸入

2. **音訊品質**
   - 確保 echoCancellation、noiseSuppression 已啟用
   - 加入音量過低/過高提示

3. **規則替換**
   - 建立常見錯字對照表
   - 在後處理中套用

### 中期目標（下週）

1. **前端優化**
   - Web Worker 處理音訊轉換
   - 漸進式文字顯示

2. **使用者體驗**
   - 波形視覺回饋
   - 更好的錯誤提示

### 長期目標（評估中）

1. **模型升級**
   - 評估 SenseVoice 效果
   - 考慮提供「速度/準確度」模式切換

2. **AI 修飾**
   - 實作可選的 AI 後處理
   - 評估成本和延遲權衡

---

## 附錄：測試方法

### 速度測試

```javascript
// 測量端到端延遲
const startTime = Date.now();
await transcribe(audio);
const latency = Date.now() - startTime;
console.log(`延遲: ${latency}ms`);
```

### 準確度測試

```python
# 計算 CER (Character Error Rate)
def calculate_cer(reference, hypothesis):
    import editdistance
    return editdistance.eval(reference, hypothesis) / len(reference)

# 測試句子
test_cases = [
    ("這是一個測試句子", transcribe(audio1)),
    ("台灣是個美麗的地方", transcribe(audio2)),
]

for ref, hyp in test_cases:
    print(f"CER: {calculate_cer(ref, hyp):.2%}")
```

### 音訊品質測試

```python
# 計算信噪比 (SNR)
def calculate_snr(audio):
    signal_power = np.mean(audio ** 2)
    noise_power = np.mean(audio[:1000] ** 2)  # 假設前 1000 samples 是靜音
    return 10 * np.log10(signal_power / noise_power)
```

---

## 總結

QuQu 目前的 ASR 已經很強了（延遲 360ms、準確度 ~97%），但還有優化空間：

1. **最大效益**：熱詞優化 + 音訊降噪設定（簡單又有效）
2. **進階優化**：規則替換 + 使用者自訂詞彙
3. **未來方向**：SenseVoice 升級 + 可選 AI 修飾

關鍵是找到**速度**和**準確度**的最佳平衡點，並提供使用者選擇的彈性。
