import React, { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { useTranslation } from "../i18n";

/**
 * 迷你模式：獨立小視窗（類似系統媒體浮窗）。
 * 扁平橫條：左邊小圖示（錄音中變紅）、右邊狀態與最近一句文字、最右展開鈕。
 * 錄音照常走全域快捷鍵（右 Alt / 右 Ctrl），這裡只是狀態顯示。
 */
const MiniBar = () => {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [lastText, setLastText] = useState("");

  useEffect(() => {
    const offStart = window.electronAPI?.onTypelessStartRecording?.(() => setRecording(true));
    const offStop = window.electronAPI?.onTypelessStopRecording?.(() => {
      setRecording(false);
      // 等主視窗辨識+存檔完成後，撈最近一筆顯示
      setTimeout(async () => {
        try {
          const rows = await window.electronAPI?.getTranscriptions?.(1, 0);
          const row = Array.isArray(rows) ? rows[0] : rows?.data?.[0];
          if (row) setLastText(row.processed_text || row.text || "");
        } catch (e) { /* ignore */ }
      }, 2500);
    });
    const offCancel = window.electronAPI?.onTypelessCancelRecording?.(() => setRecording(false));
    return () => {
      if (typeof offStart === "function") offStart();
      if (typeof offStop === "function") offStop();
      if (typeof offCancel === "function") offCancel();
    };
  }, []);

  return (
    <div
      className="h-screen w-screen flex items-center gap-3 px-3 bg-gray-900/95 rounded-xl border border-gray-700/70 shadow-2xl overflow-hidden select-none"
      style={{ WebkitAppRegion: "drag" }}
    >
      {/* 左：圖示方塊（錄音中變紅閃） */}
      <div
        className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          recording ? "bg-red-500 animate-pulse" : "bg-gray-800"
        }`}
      >
        <img src="./icon.png" alt="" className="w-7 h-7 rounded-md" draggable="false" />
      </div>

      {/* 右：狀態 + 最近一句 */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold leading-tight ${recording ? "text-red-400" : "text-white"}`}>
          {recording ? t("panel.recordingIndicator") : t("panel.miniIdle")}
        </div>
        <div className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
          {lastText || t("appName")}
        </div>
      </div>

      {/* 展開回主面板 */}
      <button
        onClick={() => window.electronAPI?.closeMiniMode?.()}
        title={t("panel.miniExpand")}
        style={{ WebkitAppRegion: "no-drag" }}
        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default MiniBar;
