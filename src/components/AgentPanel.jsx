import React, { useState, useEffect } from "react";
import { Bot, Check, X, RefreshCw, Square, Clock } from "lucide-react";

export default function AgentPanel() {
  const [backends, setBackends] = useState(null);
  const [cfg, setCfg] = useState({ cli: "claude-code", source: "anthropic", anthropicModel: "sonnet", codexModel: "gpt-5-codex", ollamaModel: "minimax-m2.5:cloud", workMode: "general", enabled: false, projectDir: "" });
  const [tasks, setTasks] = useState([]); // {id, status, prompt, text}
  const [models, setModels] = useState([]); // [{name, tier, label?}]
  const [showAll, setShowAll] = useState(false);
  const [checking, setChecking] = useState(false);

  const api = window.electronAPI || {};
  const refresh = () => api.agentDetectBackends?.().then(setBackends).catch(() => {});
  const loadModels = (opts) => api.agentListModels?.(opts).then((r) => { if (r) setModels(r.models || []); }).catch(() => {});
  const checkAvailability = () => { setChecking(true); Promise.resolve(loadModels({ source: "ollama", showAll, live: true })).finally(() => setChecking(false)); };
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

  // 選 CLI:claude code → 來源可選 anthropic/ollama;codex → chatgpt/ollama。換 CLI 時若來源失效則改預設。
  const validSources = (cli) => (cli === "codex" ? ["chatgpt", "ollama"] : ["anthropic", "ollama"]);
  const onCli = (cli) => {
    const valid = validSources(cli);
    const source = valid.includes(cfg.source) ? cfg.source : valid[0];
    set({ cli, source });
    setShowAll(false);
    loadModels({ source });
  };
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
  const Dot = ({ on }) => <span className={"w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 " + (on ? "border-sky-500 bg-sky-500" : "border-gray-400 dark:border-gray-500")} />;

  // CLI 工具列:claude code / codex 可選(radio);ollama 僅安裝狀態。
  const CliRow = ({ k, label, installed, onInstall, selectable }) => {
    const selected = selectable && cfg.cli === k;
    return (
      <div onClick={selectable ? () => onCli(k) : undefined}
        className={"flex items-center justify-between p-3 rounded-lg border " + (selectable ? "cursor-pointer " : "") +
          (selected ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20" : "border-transparent bg-gray-50 dark:bg-gray-700/50")}>
        <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          {selectable && <Dot on={selected} />}
          {installed ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
          {label}
        </span>
        {!installed && <Btn onClick={(e) => { e.stopPropagation && e.stopPropagation(); act(onInstall); }}>安裝</Btn>}
      </div>
    );
  };
  // 模型來源列:可選(radio)+ 登入狀態 + 登入/切換/登出。
  const SourceRow = ({ k, label, loggedIn, onLogin, onLogout, onSwitch }) => {
    const selected = cfg.source === k;
    return (
      <div onClick={() => onSource(k)}
        className={"flex items-center justify-between p-3 rounded-lg cursor-pointer border " +
          (selected ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20" : "border-transparent bg-gray-50 dark:bg-gray-700/50")}>
        <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <Dot on={selected} />
          {label}
          {loggedIn ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Btn ghost onClick={() => act(loggedIn ? onSwitch : onLogin)}>{loggedIn ? "切換帳號" : "登入"}</Btn>
          <Btn ghost onClick={() => act(onLogout)}>登出</Btn>
        </div>
      </div>
    );
  };

  const SOURCE_META = {
    anthropic: { label: "Anthropic", loggedIn: !!backends?.anthropic, onLogin: api.agentLoginAnthropic, onLogout: api.agentLogoutAnthropic, onSwitch: api.agentSwitchAnthropic },
    chatgpt: { label: "ChatGPT", loggedIn: !!backends?.chatgpt, onLogin: api.agentLoginCodex, onLogout: api.agentLogoutCodex, onSwitch: api.agentSwitchCodex },
    ollama: { label: "Ollama", loggedIn: !!backends?.ollamaSignedIn, onLogin: api.agentLoginOllama, onLogout: api.agentLogoutOllama, onSwitch: api.agentSwitchOllama },
  };

  const isOllama = cfg.source === "ollama";
  const isAnthropic = cfg.source === "anthropic";
  const modelValue = isAnthropic ? cfg.anthropicModel : isOllama ? cfg.ollamaModel : cfg.codexModel;
  const setModel = (v) => { if (isAnthropic) set({ anthropicModel: v }); else if (isOllama) set({ ollamaModel: v }); else set({ codexModel: v }); };
  const hasCurrent = models.some((m) => m.name === modelValue);
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
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">把辨識出來的語音,交給所選「CLI + 模型來源」在工作目錄執行任務。開啟「Agent 模式」後,按右 Alt 講的話會交給 agent 執行(而非貼到游標)。</p>

      <Section title="CLI 工具(選擇用哪個跑 agent;Ollama 僅需安裝)">
        <CliRow k="claude-code" label="Claude Code 已安裝" installed={!!backends?.claudeCode} onInstall={api.agentInstallClaude} selectable />
        <CliRow k="codex" label="Codex 已安裝" installed={!!backends?.codex} onInstall={api.agentInstallCodex} selectable />
        <CliRow k="ollama" label="Ollama 已安裝" installed={!!backends?.ollama} onInstall={api.agentInstallOllama} selectable={false} />
      </Section>

      <Section title={`模型來源(${cfg.cli === "codex" ? "Codex" : "Claude Code"} 可用;點選使用 + 登入/切換/登出)`}>
        {validSources(cfg.cli).map((k) => {
          const m = SOURCE_META[k];
          return <SourceRow key={k} k={k} label={m.label} loggedIn={m.loggedIn} onLogin={m.onLogin} onLogout={m.onLogout} onSwitch={m.onSwitch} />;
        })}
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
        <select value={modelValue} onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
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
