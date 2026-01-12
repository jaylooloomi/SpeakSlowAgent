# VAD 優化規格

## 現況

### 目前實作
- Silero VAD 模型 (`silero_vad.onnx`, 644KB)
- 僅用於離線模式，串流模式未使用
- 參數固定，無法調整

### 目前參數
```python
threshold = 0.5           # 語音檢測閾值
min_silence_duration = 0.25  # 最小靜音時長
min_speech_duration = 0.25   # 最小語音時長
max_speech_duration = 15.0   # 最大語音時長
window_size = 512         # 窗口大小
```

## 問題

1. **串流模式浪費運算** - 所有音訊都送辨識，包含靜音
2. **參數無法調整** - 不同環境需要不同設定
3. **無法關閉 VAD** - 某些場景可能不需要

## 優化目標

### Phase 1: 串流 VAD 整合
- 在串流模式中使用 VAD 過濾靜音
- 只有偵測到語音時才送辨識
- 減少無效運算

### Phase 2: 參數可調
- 新增 VAD 設定到設定頁面
- 支援不同預設模式（安靜環境、吵雜環境）

## 技術方案

### 串流 VAD 架構

```
音訊輸入 → [VAD 檢測] → 有語音? → [ASR 辨識] → 輸出
                ↓
              靜音 → 跳過（不送辨識）
```

### 實作方式

#### 方案 A: 前端 VAD（推薦）
在瀏覽器/Electron 端做 VAD，只傳送有語音的片段

優點：
- 減少 IPC 傳輸量
- 後端負載更低

缺點：
- 需要前端 VAD 實作

#### 方案 B: 後端 VAD
在 `stream_feed()` 中加入 VAD 檢測

優點：
- 實作簡單
- 複用現有 Silero VAD

缺點：
- 音訊仍需傳到後端

### 推薦：方案 B（先做）

修改 `stream_feed()`:

```python
def stream_feed(self, session_id, audio_data, is_final=False):
    # 1. 解碼音訊
    samples = self._decode_audio(audio_data)

    # 2. VAD 檢測
    if self.streaming_vad_enabled:
        is_speech = self._check_speech(samples)
        if not is_speech and not is_final:
            # 靜音，跳過辨識
            return {
                "success": True,
                "partial_text": session["last_text"],  # 保持上次結果
                "is_speech": False,
            }

    # 3. 送辨識（有語音或 is_final）
    stream.accept_waveform(16000, samples)
    # ...
```

### VAD 檢測方法

```python
def _check_speech(self, samples):
    """快速檢測是否有語音"""
    # 使用 Silero VAD 的單次檢測
    # 或簡單的能量閾值檢測

    # 方法 1: 能量檢測（快速）
    energy = np.sqrt(np.mean(samples ** 2))
    return energy > self.vad_energy_threshold

    # 方法 2: Silero VAD（精確但較慢）
    # self.vad.accept_waveform(samples)
    # return self.vad.is_speech()
```

## UI 設計

### 設定頁面 - VAD 設定

```
┌─────────────────────────────────────────────┐
│  🎙️ VAD 語音活動檢測                         │
├─────────────────────────────────────────────┤
│                                             │
│  啟用 VAD    [✓]                            │
│                                             │
│  靈敏度: ━━━━━●━━━━━ 中等                    │
│  (低 = 更容易觸發，高 = 更嚴格過濾)          │
│                                             │
│  預設模式:                                   │
│  ○ 安靜環境（推薦）                          │
│  ○ 一般環境                                  │
│  ○ 吵雜環境                                  │
│  ○ 自訂                                      │
│                                             │
│  [進階設定 ▼]                               │
│  ┌─────────────────────────────────────┐   │
│  │ 檢測閾值: 0.5                        │   │
│  │ 最小靜音: 0.25 秒                    │   │
│  │ 最小語音: 0.25 秒                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## 預設模式參數

| 模式 | threshold | min_silence | min_speech | 說明 |
|------|-----------|-------------|------------|------|
| 安靜 | 0.3 | 0.5 | 0.1 | 辦公室、書房 |
| 一般 | 0.5 | 0.25 | 0.25 | 預設 |
| 吵雜 | 0.7 | 0.15 | 0.3 | 咖啡廳、戶外 |

## 實作步驟

### Phase 1: 串流 VAD（後端）
1. [ ] `sherpa_server.py` - 新增 `_check_speech()` 方法
2. [ ] `stream_feed()` - 加入 VAD 檢測邏輯
3. [ ] 返回 `is_speech` 狀態給前端
4. [ ] 前端顯示 VAD 狀態指示器

### Phase 2: 參數可調
1. [ ] 新增 `get_vad_config` / `set_vad_config` API
2. [ ] IPC handlers
3. [ ] 設定頁面 UI
4. [ ] 預設模式切換

### Phase 3: 效能監控
1. [ ] 顯示 VAD 跳過比例
2. [ ] 顯示節省的運算量
3. [ ] 效能統計面板

## 效能目標

| 指標 | 目前 | 目標 |
|------|------|------|
| 串流 VAD 過濾率 | 0% | >30% |
| 延遲增加 | N/A | <10ms |
| CPU 額外負載 | N/A | <5% |

## 注意事項

1. VAD 誤判會導致漏字，寧可多送不要少送
2. is_final 時必須送辨識，不能跳過
3. 保持上次辨識結果，避免 UI 閃爍
