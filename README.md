<div align="center">

<br/>

# 聲聲慢 (SpeakSlow)

**開源免費的 Wispr Flow 替代方案 ｜ 為中文而生的本地語音輸入工具**

<img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="License">
<img src="https://img.shields.io/badge/platform-Windows-0078D6" alt="Platform">
<img src="https://img.shields.io/badge/ASR-sherpa--onnx-orange" alt="ASR">
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">

</div>

<br/>

> 厭倦 Wispr Flow 的訂閱費？想要**免費、本地、隱私**的中文語音輸入？聲聲慢就是為你做的。

**聲聲慢** 是一款注重隱私的桌面端語音輸入工具：按一下右 Alt 開始講話，講完文字**自動貼到你游標所在的位置** —— 終端機、記事本、Chrome 輸入框都行。語音辨識**完全在你電腦本地運行**，資料不離開你的機器。

### 🆚 vs Wispr Flow

| | 🎯 聲聲慢 | 💰 Wispr Flow |
|---|---|---|
| **價格** | ✅ 完全免費 | ❌ $12/月訂閱 |
| **隱私** | ✅ 本地處理，資料不上雲 | ❌ 雲端處理 |
| **中文** | ✅ 專為中文優化 | ⚠️ 通用支援 |
| **速度** | ✅ 本地 int8 模型，講完約 0.3 秒貼上 | 受網路影響 |

---

## ✨ 特色

- 🎙️ **右 Alt 一鍵切換** — 按一下開始錄音、再按一下停止並貼上；錄音中按 `Esc` 取消。
- ⚡ **極速本地辨識** — 採用 sherpa-onnx **Paraformer（int8 量化、非自回歸）**，一次解碼整句，比 Whisper 快數倍。
- 📋 **貼到游標處、不污染剪貼簿** — 貼上後自動還原你原本的剪貼簿內容。
- 🈶 **自動標點** — sherpa-onnx ct-transformer 標點模型（免 torch）。
- 🔤 **熱詞 / 字典** — 提升專有名詞辨識、自動校正常錯詞。
- 🕘 **歷史紀錄** — 內建搜尋、統計、複製、匯出。
- 🤖 **AI 文字優化（可選）** — 可接任何相容 OpenAI 的 API 做潤飾、糾錯、排版。

## 🚀 快速開始（開發）

需求：**Node.js 18+**、**Python 3.x**

```bash
# 1. 取得專案
git clone https://github.com/Jeffrey0117/speakslow.git
cd speakslow

# 2. Node 依賴
npm install
npx electron-builder install-app-deps   # 安裝原生模組的 Electron 預編譯檔

# 3. Python 環境 + sherpa-onnx
python -m venv .venv
.venv/Scripts/python.exe -m pip install sherpa-onnx numpy

# 4. 下載模型（離線辨識 + 標點 + 串流）
.venv/Scripts/python.exe download_all_models.py

# 5. 啟動
npm run dev
```

> 模型檔較大（約 250MB～），已在 `.gitignore` 排除，需執行 `download_all_models.py` 下載。

## 🛠️ 技術棧

- **前端**：React 19、Tailwind CSS、Vite
- **桌面端**：Electron
- **語音辨識（本地）**：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) — Paraformer（離線）、Zipformer（串流）、ct-transformer（標點）
- **資料庫**：better-sqlite3
- **全域熱鍵**：uiohook-napi

## 🙏 致謝

本專案基於以下優秀的開源專案：

- [SpeakSlow (yan5xu/speakslow)](https://github.com/yan5xu/speakslow) — 原始專案，本專案在其基礎上改用 sherpa-onnx 引擎並重做 UI 與互動。
- [sherpa-onnx (k2-fsa)](https://github.com/k2-fsa/sherpa-onnx) — 本地語音辨識引擎。
- [Wispr Flow](https://wisprflow.ai/) — 產品概念的啟發。

## 📄 授權

本專案採用 [Apache License 2.0](LICENSE)。
