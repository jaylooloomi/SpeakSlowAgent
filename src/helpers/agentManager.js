const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const { buildAgentSpawn, parseStreamJsonLine, parseCodexJsonLine } = require("./agentSpawn.js");

// 預設 agent 系統提示:要它「直接動手做」而非只解釋。
const AGENT_SYSTEM_PROMPT =
  "你是使用者電腦上的執行型助理。使用者用語音下達指令,請直接動手完成(建立/修改檔案、執行命令)," +
  "不要只解釋步驟。完成後用一句繁體中文回報結果。";

// claude 執行檔:優先 ~/.local/bin/claude(.exe),否則靠 PATH。
function claudeProgram() {
  const p = path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
  try { require("fs").accessSync(p); return p; } catch { return "claude"; }
}

class AgentManager {
  // deps:{ spawn, emit } 供測試注入(預設用真 child_process.spawn 與廣播到所有視窗)。
  constructor(logger, windowManager, deps = {}) {
    this.logger = logger || console;
    this.windowManager = windowManager;
    this._spawn = deps.spawn || spawn;
    this._emitFn = deps.emit || null;
    this.current = null; // { id, child, status, prompt }
    this.queue = [];      // [{ id, prompt, model, cwd, cli }]
    this.nextId = 1;
  }

  isBusy() { return !!this.current && this.current.status === "running"; }

  // 不再拒絕:忙碌則排隊(status "queued"),否則直接起。一次只跑一個。
  runTask({ prompt, model, cwd, cli }) {
    if (!prompt || !prompt.trim()) return { success: false, error: "空白指令" };
    const id = this.nextId++;
    const item = { id, prompt, model, cwd, cli: cli || "claude-code" };
    if (this.isBusy()) {
      this.queue.push(item);
      this._emit({ id, status: "queued", prompt, text: "" });
    } else {
      this._start(item);
    }
    return { success: true, id };
  }

  _start(item) {
    const { id, prompt, model, cwd, cli } = item;
    const spec = buildAgentSpawn({ prompt, model, cwd, systemPrompt: AGENT_SYSTEM_PROMPT, cli });
    if (spec.program === "claude") spec.program = claudeProgram();

    let child;
    try {
      child = this._spawn(spec.program, spec.args, { cwd, env: { ...process.env, ...spec.env }, windowsHide: true });
    } catch (e) {
      this.current = null;
      this._emit({ id, status: "error", prompt, text: "啟動失敗: " + e.message });
      this._next();
      return;
    }
    this.current = { id, child, status: "running", prompt };
    this._emit({ id, status: "running", prompt, text: "" });

    const parse = cli === "codex" ? parseCodexJsonLine : parseStreamJsonLine;
    let buf = "";
    let lastText = "";
    let lastItemError = "";
    child.stdout.on("data", (chunk) => {
      if (!this.current || this.current.child !== child) return; // 過時 child(被 stop/取代)不可再發事件
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        const ev = parse(line.trim());
        if (!ev) continue;
        if (ev.kind === "text") { lastText += ev.text; this._emit({ id, status: "running", prompt, text: lastText }); }
        else if (ev.kind === "message") { lastText += (lastText ? "\n" : "") + ev.text; this._emit({ id, status: "running", prompt, text: lastText }); }
        else if (ev.kind === "itemError") { lastItemError = ev.text || lastItemError; } // 非致命,僅留診斷
        else if (ev.kind === "result") lastText = ev.text || lastText;
      }
    });
    child.stderr.on("data", (d) => this.logger.info && this.logger.info("[agent stderr] " + d.toString().slice(0, 200)));
    // 過時事件守衛:被 stop()/取代後,舊 child 的 close/error 不可動到 this.current 或再排空。
    child.on("error", (e) => {
      if (!this.current || this.current.child !== child) return;
      this.current = null;
      this._emit({ id, status: "error", prompt, text: "啟動失敗: " + e.message });
      this._next();
    });
    child.on("close", (code) => {
      if (!this.current || this.current.child !== child) return;
      this.current = null;
      // 非零退出且沒有任何輸出時,退而用項目級錯誤訊息當診斷(否則面板只看到 ❌ 沒原因)。
      const text = code === 0 ? lastText : (lastText || lastItemError || "");
      this._emit({ id, status: code === 0 ? "done" : "error", prompt, text });
      this._next();
    });
  }

  _next() {
    if (this.current || this.queue.length === 0) return;
    this._start(this.queue.shift());
  }

  // 取消:排隊項 → 移除;當前項 → 等同 stop。
  cancel(id) {
    const i = this.queue.findIndex((t) => t.id === id);
    if (i >= 0) {
      const [item] = this.queue.splice(i, 1);
      this._emit({ id, status: "cancelled", prompt: item.prompt, text: "已取消" });
      return { success: true };
    }
    if (this.current && this.current.id === id) return this.stop();
    return { success: false, error: "找不到任務" };
  }

  stop() {
    if (this.current && this.current.child) { try { this.current.child.kill(); } catch (e) {} }
    if (this.current) {
      this._emit({ id: this.current.id, status: "stopped", prompt: this.current.prompt, text: "已停止" });
      this.current = null;
    }
    this._next(); // 停掉當前後,接著跑佇列下一個
    return { success: true };
  }

  _emit(payload) {
    if (this._emitFn) { this._emitFn(payload); return; } // 測試注入
    // 廣播到所有視窗:主視窗(App.jsx 通知)與設定視窗(AgentPanel 任務列表)都要收到。
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        if (w && !w.isDestroyed()) w.webContents.send("agent-task-update", payload);
      }
    } catch (e) { /* 視窗尚未就緒 / 無視窗 */ }
  }
}

module.exports = AgentManager;
