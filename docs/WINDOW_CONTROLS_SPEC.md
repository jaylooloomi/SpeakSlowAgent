# 視窗控制功能規格文檔

## 概述

為「聲聲慢」應用程式新增用戶可控的視窗管理功能，包括：
1. **置頂開關** - 讓用戶可以開啟/關閉視窗置頂
2. **縮小到托盤** - 讓用戶可以將視窗縮小到系統托盤

## 現狀分析

### 目前實現
- 主視窗在 `windowManager.js` 中硬編碼 `alwaysOnTop: true`
- 無法讓用戶動態切換置頂狀態
- 系統托盤已存在 (`TrayManager`)，但無縮小到托盤功能

### 相關文件
| 文件 | 用途 |
|------|------|
| `src/helpers/windowManager.js` | 視窗管理核心 |
| `src/settings.jsx` | 設定頁面 UI |
| `src/helpers/database.js` | 設定持久化 |
| `src/helpers/ipcHandlers.js` | IPC 通道處理 |
| `preload.js` | 前端 API 暴露 |

---

## 功能規格

### 1. 置頂開關 (Always On Top Toggle)

#### 1.1 用戶故事
> 作為用戶，我想要能夠開啟或關閉視窗置頂功能，這樣我可以根據需要讓應用程式保持在最上層或讓其他視窗覆蓋它。

#### 1.2 設定項目
| 設定鍵 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `window_always_on_top` | boolean | `true` | 視窗是否置頂 |

#### 1.3 行為定義
- **開啟時**: 主視窗保持在所有視窗之上
- **關閉時**: 主視窗可被其他視窗覆蓋
- **即時生效**: 切換後立即應用，無需重啟
- **持久化**: 設定儲存到數據庫，下次啟動時保持

#### 1.4 UI 設計
在設定頁面「一般設定」區塊新增：

```
┌─────────────────────────────────────────────┐
│ 視窗置頂                              [開關] │
│ 讓應用程式視窗保持在其他視窗之上              │
└─────────────────────────────────────────────┘
```

#### 1.5 技術實現

**A. 新增 IPC 通道** (`ipcHandlers.js`)
```javascript
ipcMain.handle("set-always-on-top", (event, value) => {
  this.windowManager.setMainWindowAlwaysOnTop(value);
  return true;
});
```

**B. WindowManager 方法** (`windowManager.js`)
```javascript
setMainWindowAlwaysOnTop(value) {
  if (this.mainWindow && !this.mainWindow.isDestroyed()) {
    this.mainWindow.setAlwaysOnTop(value);
  }
}
```

**C. 前端 API** (`preload.js`)
```javascript
setAlwaysOnTop: (value) => ipcRenderer.invoke("set-always-on-top", value)
```

**D. 啟動時載入設定** (`windowManager.js`)
```javascript
async createMainWindow() {
  const alwaysOnTop = await this.databaseManager.getSetting('window_always_on_top', true);
  this.mainWindow = new BrowserWindow({
    // ...
    alwaysOnTop: alwaysOnTop,
    // ...
  });
}
```

---

### 2. 縮小到托盤 (Minimize to Tray)

#### 2.1 用戶故事
> 作為用戶，我想要能夠將應用程式縮小到系統托盤，這樣可以保持桌面整潔，同時應用程式仍在背景運行。

#### 2.2 設定項目
| 設定鍵 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `minimize_to_tray` | boolean | `true` | 縮小時是否隱藏到托盤 |
| `close_to_tray` | boolean | `true` | 關閉視窗時是否縮小到托盤而非退出 |

#### 2.3 行為定義

**縮小到托盤 (`minimize_to_tray`)**
- **開啟時**: 點擊縮小按鈕 → 視窗隱藏，托盤圖示保持
- **關閉時**: 點擊縮小按鈕 → 視窗正常縮小到工作列

**關閉到托盤 (`close_to_tray`)**
- **開啟時**: 點擊關閉按鈕 → 視窗隱藏到托盤（不退出應用）
- **關閉時**: 點擊關閉按鈕 → 正常關閉應用程式

**托盤操作**
- 單擊托盤圖示 → 顯示/隱藏主視窗
- 右鍵托盤圖示 → 顯示選單（顯示視窗、設定、退出）

#### 2.4 UI 設計
在設定頁面「一般設定」區塊新增：

```
┌─────────────────────────────────────────────┐
│ 縮小到系統托盤                        [開關] │
│ 縮小視窗時隱藏到系統托盤                     │
├─────────────────────────────────────────────┤
│ 關閉到系統托盤                        [開關] │
│ 關閉視窗時隱藏到托盤而非退出應用程式          │
└─────────────────────────────────────────────┘
```

#### 2.5 技術實現

**A. 攔截縮小事件** (`windowManager.js`)
```javascript
this.mainWindow.on('minimize', async (event) => {
  const minimizeToTray = await this.databaseManager.getSetting('minimize_to_tray', true);
  if (minimizeToTray) {
    event.preventDefault();
    this.mainWindow.hide();
  }
});
```

**B. 攔截關閉事件** (`windowManager.js`)
```javascript
this.mainWindow.on('close', async (event) => {
  if (this.isQuitting) return; // 真正退出時不攔截

  const closeToTray = await this.databaseManager.getSetting('close_to_tray', true);
  if (closeToTray) {
    event.preventDefault();
    this.mainWindow.hide();
  }
});
```

**C. 托盤點擊事件** (`trayManager.js`)
```javascript
this.tray.on('click', () => {
  if (this.windowManager.mainWindow.isVisible()) {
    this.windowManager.mainWindow.hide();
  } else {
    this.windowManager.mainWindow.show();
  }
});
```

**D. 托盤選單更新**
```javascript
const contextMenu = Menu.buildFromTemplate([
  { label: '顯示視窗', click: () => this.windowManager.mainWindow.show() },
  { label: '設定', click: () => this.windowManager.showSettingsWindow() },
  { type: 'separator' },
  { label: '退出', click: () => {
    this.windowManager.isQuitting = true;
    app.quit();
  }}
]);
```

---

### 3. 主視窗標題列控制按鈕

#### 3.1 用戶故事
> 作為用戶，我想要在主視窗上有明顯的控制按鈕，可以快速置頂、縮小或關閉視窗。

#### 3.2 UI 設計
在主視窗右上角新增控制按鈕：

```
┌────────────────────────────────┐
│                    📌 ─ ✕     │  ← 控制按鈕區
│                               │
│      [主視窗內容]              │
│                               │
└────────────────────────────────┘

📌 = 置頂按鈕（點擊切換，已置頂時高亮）
─  = 縮小按鈕
✕  = 關閉按鈕
```

#### 3.3 按鈕行為
| 按鈕 | 圖示 | 行為 |
|------|------|------|
| 置頂 | 📌 (Pin) | 切換置頂狀態，同步更新設定 |
| 縮小 | ─ (Minimize) | 根據設定縮小或隱藏到托盤 |
| 關閉 | ✕ (Close) | 根據設定關閉或隱藏到托盤 |

#### 3.4 視覺狀態
- **置頂開啟**: 📌 圖示填充顏色（如藍色）
- **置頂關閉**: 📌 圖示空心或灰色

---

## 設定項目總覽

| 設定鍵 | 類型 | 預設值 | UI 位置 |
|--------|------|--------|---------|
| `window_always_on_top` | boolean | `true` | 設定頁 > 一般設定 |
| `minimize_to_tray` | boolean | `true` | 設定頁 > 一般設定 |
| `close_to_tray` | boolean | `true` | 設定頁 > 一般設定 |

---

## 實現順序

### Phase 1: 置頂開關 ✅ 已完成
1. [x] 新增 `window_always_on_top` 設定項
2. [x] 實現 `set-always-on-top` IPC 通道
3. [x] 修改 `createMainWindow()` 讀取設定
4. [x] 設定頁面新增置頂開關 UI
5. [x] 測試即時切換功能

### Phase 2: 縮小到托盤 ✅ 已完成
1. [x] 新增 `minimize_to_tray` 和 `close_to_tray` 設定項
2. [x] 實現縮小事件攔截
3. [x] 實現關閉事件攔截
4. [x] 設定頁面新增托盤相關開關
5. [x] 更新托盤選單

### Phase 3: 主視窗控制按鈕 ✅ 已完成
1. [x] 設計控制按鈕組件
2. [x] 實現置頂按鈕（帶狀態同步）
3. [x] 實現縮小/關閉按鈕
4. [x] 樣式調整與視覺反饋

---

## 測試案例

### 置頂功能測試
- [ ] 切換置頂開關，視窗狀態立即改變
- [ ] 重啟應用，置頂設定保持
- [ ] 置頂關閉時，其他視窗可覆蓋主視窗

### 托盤功能測試
- [ ] 縮小時隱藏到托盤（開啟設定時）
- [ ] 縮小時正常縮小（關閉設定時）
- [ ] 點擊托盤圖示顯示/隱藏視窗
- [ ] 右鍵托盤顯示選單
- [ ] 選單「退出」正確關閉應用

### 跨功能測試
- [ ] 主視窗按鈕與設定頁同步
- [ ] 多視窗場景下行為正確

---

## 附錄：現有相關代碼參考

### windowManager.js 現有結構
```javascript
class WindowManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
    this.mainWindow = null;
    // ...
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      alwaysOnTop: true,  // 目前硬編碼
      // ...
    });
  }
}
```

### 設定頁現有開關範例 (settings.jsx)
```javascript
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label>啟用 AI 優化</Label>
    <p className="text-sm text-muted-foreground">
      使用 AI 優化轉錄結果
    </p>
  </div>
  <Switch
    checked={settings.enable_ai_optimization}
    onCheckedChange={(checked) => handleToggleChange('enable_ai_optimization', checked)}
  />
</div>
```
