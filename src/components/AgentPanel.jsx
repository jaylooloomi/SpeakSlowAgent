import React, { useState, useEffect } from "react";
import { Bot, Check, X, RefreshCw, Square, Clock } from "lucide-react";

export default function AgentPanel() {
  const [backends, setBackends] = useState(null);
  const [cfg, setCfg] = useState({ source: "anthropic", codexModel: "gpt-5-codex", ollamaModel: "minimax-m2.5:cloud", workMode: "general", enabled: false, projectDir: "" });
  const [tasks, setTasks] = useState([]); // {id, status, prompt, text}
  const [models, setModels] = useState([]); // [{name, tier, label?}]
  const [showAll, setShowAll] = useState(false);
  const [checking, setChecking] = useState(false);

  const api = window.electronAPI || {};
  const refresh = () => api.agentDetectBackends?.().then(setBackends).catch(() => {});
  const loadModels = (opts) => api.agentListModels?.(opts).then((r) => { if (r) setModels(r.models || []); }).catch(() => {});
  const checkAvailability = () => { setChecking(true); Promise.resolve(loadModels({ source: "ollama", showAll, live: true })).finally(() => setChecking(false)); };
  // 登入/登出/切換/安裝後,稍候重新偵測(登出即時;登入需在終端/瀏覽器完成)。
  const act = (fn) => { try { fn && fn(); } catch (e) {} setTimeout(refresh, 1500); };

  useEffect(() => {
    refresh();
    api.agentGetConfig?.().then((c) => { if (c) { setCfg(c); loadModels({ source: c.source || "anthropic" }); } }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!api.onAgentTaskUpdate) return;
    return api.onAgentTaskUpdate((p) => setTasks((prev) => {
      const i = prev.findIndex((t) => t.id === p.id);
      if (i >= 0) { const n = [...prev]; n[i] = p; return n; }
      return [p, ...prev].slice(0, 30);
    }));
  }, []);
  const set = (patch) => { setCfg((c) => ({ ...c, ...patch })); api.agentSetConfig?.(patch); };
  const onSource = (source) => { set({ source }); setShowAll(false); loadModels({ source }); };

  const Btn = ({ onClick, ghost, children }) => (
    <button onClick={onClick} className={"px-3 py-1 text-xs rounded-lg " + (ghost
      ? "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      : "bg-blue-500 hover:bg-blue-600 text-white")}>{children}</button>
  );
  const Section = ({ title, children }) => (
    <div className="mb-5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
  const InstallRow = ({ ok, label, onInstall }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        {ok ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}{label}
      </span>
      {!ok && <Btn onClick={() => act(onInstall)}>安裝</Btn>}
    </div>
  );
  const SourceRow = ({ k, label, loggedIn, onLogin, onLogout, onSwitch }) => {
    const selected = cfg.source === k;
    return (
      <div onClick={() => onSource(k)}
        className={"flex items-center justify-between p-3 rounded-lg cursor-pointer border " +
          (selected ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20" : "border-transparent bg-gray-50 dark:bg-gray-700/50")}>
        <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <span className={"w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 " + (selected ? "border-sky-500 bg-sky-500" : "border-gray-400 dark:border-gray-500")} />
          {label}
          {loggedIn ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {loggedIn
            ? <><Btn ghost onClick={() => act(onSwitch)}>切換</Btn><Btn ghost onClick={() => act(onLogout)}>登出</Btn></>
            : <Btn onClick={() => act(onLogin)}>登入</Btn>}
        </div>
      </div>
    );
  };

  const isOllama = cfg.source === "ollama";
  const isAnthropic = cfg.source === "anthropic";
  const modelValue = isAnthropic ? "claude" : isOllama ? cfg.ollamaModel : cfg.codexModel;
  const setModel = (v) => { if (isOllama) set({ ollamaModel: v }); else if (!isAnthropic) set({ codexModel: v }); };
  const hasCurrent = models.some((m) => m.name === modelValue); // 防止過濾後 select 值無對應選項(顯示空白)
  const labelFor = (m) => m.label || (isOllama ? m.name + (m.tier === "subscription" ? " — 需訂閱" : m.tier === "unknown" ? " — 未知" : " — 免費") : m.name);

  const running = tasks.filter((t) => t.status === "running");
  const queued = tasks.filter((t) => t.status === "queued");
  const done = tasks.filter((t) => ["done", "error", "stopped", "cancelled"].includes(t.status));
  const doneIcon = (s) => (s === "error" ? "❌" : s === "stopped" ? "⏹" : s === "cancelled" ? "🚫" : "✅");

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">代理 Agent</h3>
        <button onClick={refresh} title="重新偵測" className="ml-auto p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">把辨識出來的語音,交給所選「模型來源」在工作目錄執行任務。開啟「Agent 模式」後,按右 Alt 講的話會交給 agent 執行(而非貼到游標)。</p>

      <Section title="CLI 工具">
        <InstallRow ok={!!backends?.claudeCode} label="Claude Code 已安裝" onInstall={api.agentInstallClaude} />
        <InstallRow ok={!!backends?.codex} label="Codex 已安裝" onInstall={api.agentInstallCodex} />
        <InstallRow ok={!!backends?.ollama} label="Ollama 已安裝" onInstall={api.agentInstallOllama} />
      </Section>

      <Section title="模型來源(點選使用,並可登入 / 登出 / 切換)">
        <SourceRow k="anthropic" label="Anthropic" loggedIn={!!backends?.anthropic}
          onLogin={api.agentLoginAnthropic} onLogout={api.agentLogoutAnthropic} onSwitch={api.agentSwitchAnthropic} />
        <SourceRow k="chatgpt" label="ChatGPT" loggedIn={!!backends?.chatgpt}
          onLogin={api.agentLoginCodex} onLogout={api.agentLogoutCodex} onSwitch={api.agentSwitchCodex} />
        <SourceRow k="ollama" label="Ollama" loggedIn={!!backends?.ollamaSignedIn}
          onLogin={api.agentLoginOllama} onLogout={api.agentLogoutOllama} onSwitch={api.agentSwitchOllama} />
      </Section>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">模型選擇</h4>
          {isOllama && (
            <div className="flex items-center gap-3">
              <button onClick={checkAvailability} disabled={checking}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">
                <RefreshCw className={"w-3 h-3" + (checking ? " animate-spin" : "")} />檢查可用性
              </button>
              <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={showAll}
                  onChange={(e) => { setShowAll(e.target.checked); loadModels({ source: "ollama", showAll: e.target.checked }); }}
                  className="w-3.5 h-3.5 accent-blue-500" />
                顯示全部
              </label>
            </div>
          )}
        </div>
        <select value={modelValue} onChange={(e) => setModel(e.target.value)} disabled={isAnthropic}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-70">
          {!hasCurrent && <option value={modelValue}>{modelValue}</option>}
          {models.map((m) => <option key={m.name} value={m.name}>{labelFor(m)}</option>)}
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
          <button onClick={() => api.agentStopTask?.()} className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700"><Square className="w-3 h-3" />停止</button>
        </div>
      ))}

      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />排隊中</h4>
      {queued.length === 0 ? <p className="text-xs text-gray-400 mb-3">無</p> : queued.map((t) => (
        <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-2">
          <span className="text-sm truncate text-gray-800 dark:text-gray-200">{t.prompt}</span>
          <button onClick={() => api.agentCancelTask?.(t.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600"><X className="w-3 h-3" />取消</button>
        </div>
      ))}

      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3">已完成</h4>
      {done.length === 0 ? <p className="text-xs text-gray-400">無</p> : done.map((t) => (
        <div key={t.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-2">
          <div className="text-sm truncate text-gray-800 dark:text-gray-200">{doneIcon(t.status)} {t.prompt}</div>
          {t.text && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap line-clamp-3">{t.text}</div>}
        </div>
      ))}
    </div>
  );
}
