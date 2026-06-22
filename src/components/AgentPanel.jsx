import React, { useState, useEffect } from "react";
import { Bot, Check, X, RefreshCw, Square } from "lucide-react";

export default function AgentPanel() {
  const [backends, setBackends] = useState(null);
  const [cfg, setCfg] = useState({ model: "claude", workMode: "general", enabled: false, projectDir: "" });
  const [tasks, setTasks] = useState([]); // {id, status, prompt, text}
  const [models, setModels] = useState([]); // [{name, tier}]
  const [claudeModel, setClaudeModel] = useState("claude");
  const [showAll, setShowAll] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = () => window.electronAPI?.agentDetectBackends?.().then(setBackends).catch(() => {});
  const loadModels = (opts) => window.electronAPI?.agentListModels?.(opts).then((r) => {
    if (r) { setModels(r.models || []); setClaudeModel(r.claudeModel || "claude"); }
  }).catch(() => {});
  const checkAvailability = () => { setChecking(true); Promise.resolve(loadModels({ showAll, live: true })).finally(() => setChecking(false)); };
  useEffect(() => {
    refresh();
    window.electronAPI?.agentGetConfig?.().then(setCfg).catch(() => {});
    loadModels({ showAll: false });
  }, []);
  useEffect(() => {
    if (!window.electronAPI?.onAgentTaskUpdate) return;
    return window.electronAPI.onAgentTaskUpdate((p) => setTasks((prev) => {
      const i = prev.findIndex((t) => t.id === p.id);
      if (i >= 0) { const n = [...prev]; n[i] = p; return n; }
      return [p, ...prev].slice(0, 20);
    }));
  }, []);
  const set = (patch) => { setCfg((c) => ({ ...c, ...patch })); window.electronAPI?.agentSetConfig?.(patch); };

  const Row = ({ ok, label, action, actionLabel }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        {ok ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}{label}
      </span>
      {!ok && <button onClick={action} className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg">{actionLabel}</button>}
    </div>
  );

  const running = tasks.filter((t) => t.status === "running");
  const done = tasks.filter((t) => ["done", "error", "stopped"].includes(t.status));

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">代理 Agent</h3>
        <button onClick={refresh} title="重新偵測" className="ml-auto p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">把辨識出來的語音,交給 Claude Code 在工作目錄執行任務。開啟「Agent 模式」後,按右 Alt 講的話會交給 agent 執行(而非貼到游標)。</p>

      <div className="space-y-2 mb-5">
        <Row ok={!!backends?.claudeCode} label="Claude Code 已安裝" action={() => window.electronAPI?.agentInstallClaude?.()} actionLabel="安裝" />
        <Row ok={!!backends?.ollama} label="Ollama 已安裝" action={() => window.electronAPI?.agentInstallOllama?.()} actionLabel="安裝" />
        <Row ok={!!backends?.anthropic} label="Anthropic 已登入" action={() => window.electronAPI?.agentLoginAnthropic?.()} actionLabel="登入" />
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">模型</span>
          <div className="flex items-center gap-3">
            <button onClick={checkAvailability} disabled={checking}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">
              <RefreshCw className={"w-3 h-3" + (checking ? " animate-spin" : "")} />檢查可用性
            </button>
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showAll}
                onChange={(e) => { setShowAll(e.target.checked); loadModels({ showAll: e.target.checked }); }}
                className="w-3.5 h-3.5 accent-blue-500" />
              顯示全部
            </label>
          </div>
        </div>
        <select value={cfg.model} onChange={(e) => set({ model: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          <option value={claudeModel}>Claude(Anthropic 官方)— 你的帳號</option>
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}{m.tier === "subscription" ? " — 需訂閱" : m.tier === "unknown" ? " — 未知" : " — 免費"}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg mb-5 cursor-pointer">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Agent 模式{cfg.enabled && <span className="ml-2 text-xs text-sky-600 dark:text-sky-400">● ON</span>}</span>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="w-4 h-4 accent-sky-500" />
      </label>

      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">執行中</h4>
      {running.length === 0 ? <p className="text-xs text-gray-400 mb-3">無</p> : running.map((t) => (
        <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-2">
          <span className="text-sm truncate text-gray-800 dark:text-gray-200">{t.prompt}</span>
          <button onClick={() => window.electronAPI?.agentStopTask?.()} className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700"><Square className="w-3 h-3" />停止</button>
        </div>
      ))}
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3">已完成</h4>
      {done.length === 0 ? <p className="text-xs text-gray-400">無</p> : done.map((t) => (
        <div key={t.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-2">
          <div className="text-sm truncate text-gray-800 dark:text-gray-200">{t.status === "error" ? "❌" : t.status === "stopped" ? "⏹" : "✅"} {t.prompt}</div>
          {t.text && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap line-clamp-3">{t.text}</div>}
        </div>
      ))}
    </div>
  );
}
