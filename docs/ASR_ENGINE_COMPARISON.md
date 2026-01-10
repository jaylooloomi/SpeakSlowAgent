# ASR 引擎比較與選型指南

## 開源 ASR 引擎總覽（2025）

### 中文優化引擎

| 引擎 | 速度 | 中文準確度 | 記憶體 | 部署難度 | 特點 |
|------|------|-----------|--------|----------|------|
| **FunASR Paraformer** | 4/5 | 5/5 | ~1.2GB | 中 | 目前 QuQu 使用，SpeechIO 榜首 |
| **SenseVoice** | 5/5 | 5/5 | ~500MB | 低 | 阿里最新，非自回歸，極速 |
| **Fun-ASR-Nano-2512** | 5/5 | 4/5 | ~300MB | 低 | 2025/12 發布，輕量級 |

### Whisper 系列

| 引擎 | 速度 | 中文準確度 | 記憶體 | 部署難度 | 特點 |
|------|------|-----------|--------|----------|------|
| **faster-whisper** | 4/5 | 4/5 | ~500MB | 低 | CTranslate2 優化，CPU 友好 |
| **whisper.cpp** | 5/5 | 3/5 | ~200MB | 低 | C++ 實現，極輕量 |
| **WhisperX** | 3/5 | 4/5 | ~1GB | 中 | 支援對齊和說話人分離 |

### NVIDIA 引擎

| 引擎 | 速度 | 中文準確度 | 記憶體 | 部署難度 | 特點 |
|------|------|-----------|--------|----------|------|
| **Parakeet TDT** | 5/5 | 3/5 | ~2GB | 高 | RTFx > 2000，需要 GPU |
| **Canary Qwen** | 5/5 | 4/5 | ~5GB | 高 | 最強準確度，需要 GPU |

---

## 詳細比較

### SenseVoice vs FunASR Paraformer

| 項目 | SenseVoice | FunASR Paraformer |
|------|------------|-------------------|
| 架構 | 非自回歸 | 非自回歸 |
| 訓練數據 | 40萬小時 | 6萬小時 |
| 支援語言 | 中英日韓粵 | 中文為主 |
| 情緒識別 | 支援 | 不支援 |
| 音頻事件 | 支援 | 不支援 |
| 部署工具 | sherpa-onnx | FunASR SDK |
| GPU 加速 | TensorRT 526x | CUDA |
| CPU 性能 | 優秀 | 優秀 |

**結論**：SenseVoice 是 Paraformer 的升級版，功能更多，速度更快。

### faster-whisper vs FunASR

| 項目 | faster-whisper | FunASR |
|------|----------------|--------|
| 中文準確度 | 4/5 | 5/5 |
| 速度 | 4/5 | 4/5 |
| 模型選擇 | tiny/base/small/medium/large | paraformer-large/streaming |
| 串流支援 | 需要額外實現 | 原生支援 |
| 標點恢復 | 需要額外模型 | 內建 |
| 多語言 | 99 種語言 | 中文為主 |

**結論**：純中文場景選 FunASR，多語言場景選 faster-whisper。

---

## 部署框架比較

### sherpa-onnx

- **支援平台**：Windows, macOS, Linux, iOS, Android, 樹莓派, RISC-V
- **支援語言**：C++, C, Python, C#, Go, Swift, Kotlin, Java, JavaScript, Dart
- **支援模型**：SenseVoice, Whisper, Paraformer, Zipformer 等
- **特點**：完全離線，無需網路

### FunASR SDK

- **支援平台**：Windows, macOS, Linux
- **支援語言**：Python
- **支援模型**：Paraformer, FSMN-VAD, CT-Transformer
- **特點**：阿里官方，更新快

---

## 選型建議

### 場景 1：純中文、追求速度

**推薦**：SenseVoice + sherpa-onnx

```python
# 安裝
pip install sherpa-onnx

# 使用
import sherpa_onnx
recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
    model="sensevoice-small",
    num_threads=4,
)
```

### 場景 2：純中文、追求準確度

**推薦**：FunASR Paraformer-large（目前 QuQu 使用）

### 場景 3：多語言支援

**推薦**：faster-whisper

```python
from faster_whisper import WhisperModel
model = WhisperModel("base", device="cpu", compute_type="int8")
```

### 場景 4：邊緣設備（手機、樹莓派）

**推薦**：sherpa-onnx + SenseVoice-small

### 場景 5：有 GPU

**推薦**：NVIDIA Parakeet 或 Canary Qwen

---

## 遷移成本評估

### 從 FunASR 遷移到 SenseVoice

| 改動項目 | 工作量 | 說明 |
|----------|--------|------|
| 後端 funasr_server.py | 中 | 需要重寫模型載入和推理邏輯 |
| 前端 | 無 | 介面不變 |
| 模型下載 | 低 | sherpa-onnx 提供預編譯模型 |
| 測試 | 中 | 需要驗證準確度和速度 |

**預估總工時**：4-8 小時

---

## 效能數據參考

### CPU 推理速度（RTFx = Real Time Factor，越大越快）

| 引擎 | 模型 | RTFx (CPU) | RTFx (GPU) |
|------|------|-----------|------------|
| SenseVoice | small | 25x | 526x |
| FunASR | Paraformer-large | 15x | 50x |
| faster-whisper | base | 12x | 30x |
| whisper.cpp | base | 8x | - |

### 中文辨識準確度（SpeechIO 排行榜）

| 排名 | 引擎 | CER (越低越好) |
|------|------|----------------|
| 1 | FunASR Paraformer-large | 2.1% |
| 2 | SenseVoice-large | 2.3% |
| 3 | Whisper-large-v3 | 3.8% |
| 4 | faster-whisper base | 5.2% |

---

## 附錄：安裝指南

### sherpa-onnx

```bash
pip install sherpa-onnx

# 下載 SenseVoice 模型
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2
tar xvf sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2
```

### FunASR

```bash
pip install funasr modelscope

# 模型會在首次使用時自動下載
```

### faster-whisper

```bash
pip install faster-whisper

# 或使用 CUDA
pip install faster-whisper[cuda]
```
