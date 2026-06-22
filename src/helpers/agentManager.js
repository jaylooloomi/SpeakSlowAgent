const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const { buildAgentSpawn, parseStreamJsonLine } = require("./agentSpawn.js");

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
  constructor(logger, windowManager) {
    this.logger = logger || console;
    this.windowManager = windowManager;
    this.current = null; // { id, child, status, prompt }
    this.nextId = 1;
  }

  isBusy() { return !!this.current && this.current.status === "running"; }

  runTask({ prompt, model, cwd }) {
    if (this.isBusy()) return { success: false, error: "已有任務執行中" };
    const id = this.nextId++;
    const spec = buildAgentSpawn({ prompt, model, cwd, systemPrompt: AGENT_SYSTEM_PROMPT });
    if (spec.program === "claude") spec.program = claudeProgram();
    const child = spawn(spec.program, spec.args, {
      cwd,
      env: { ...process.env, ...spec.env },
      windowsHide: true,
    });
    this.current = { id, child, status: "running", prompt };
    this._emit({ id, status: "running", prompt, text: "" });

    let buf = "";
    let lastText = "";
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        const ev = parseStreamJsonLine(line.trim());
        if (!ev) continue;
        if (ev.kind === "text") { lastText += ev.text; this._emit({ id, status: "running", prompt, text: lastText }); }
        if (ev.kind === "result") lastText = ev.text || lastText;
      }
    });
    child.stderr.on("data", (d) => this.logger.info && this.logger.info("[agent stderr] " + d.toString().slice(0, 200)));
    child.on("error", (e) => { this.current = null; this._emit({ id, status: "error", prompt, text: "啟動失敗: " + e.message }); });
    child.on("close", (code) => {
      const status = code === 0 ? "done" : "error";
      this.current = null;
      this._emit({ id, status, prompt, text: lastText });
    });
    return { success: true, id };
  }

  stop() {
    if (this.current && this.current.child) { try { this.current.child.kill(); } catch (e) {} }
    if (this.current) { this._emit({ id: this.current.id, status: "stopped", prompt: this.current.prompt, text: "已停止" }); this.current = null; }
    return { success: true };
  }

  _emit(payload) {
    // 廣播到所有視窗:主視窗(App.jsx 監聽通知)與設定視窗(AgentPanel 任務列表)
    // 都要收到。windowManager 不一定有 settingsWindow 參照,故直接列舉所有視窗最穩。
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        if (w && !w.isDestroyed()) w.webContents.send("agent-task-update", payload);
      }
    } catch (e) { /* 視窗尚未就緒 / 無視窗 */ }
  }
}

module.exports = AgentManager;
