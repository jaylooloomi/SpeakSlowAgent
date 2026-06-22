const { ipcMain } = require("electron");
const { spawnSync } = require("child_process");
const catalog = require("../agentCatalog.js");

function probe(cmd, args) {
  try { const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true }); return r.status === 0; }
  catch { return false; }
}

// Anthropic 登入偵測為 best-effort:檢查 Claude Code 的認證檔是否存在。
// (跨平台不一定可靠 → 偵測不到時 UI 仍會提供「登入」按鈕。)
function anthropicLoggedIn() {
  try {
    const os = require("os"); const fs = require("fs"); const path = require("path");
    const p = path.join(os.homedir(), ".claude", ".credentials.json");
    return fs.existsSync(p);
  } catch { return false; }
}

module.exports = function register(ctx) {
  ipcMain.handle("agent-detect-backends", () => ({
    claudeCode: probe("claude", ["--version"]),
    ollama: probe("ollama", ["--version"]),
    anthropic: anthropicLoggedIn(),
  }));

  // 模型清單(挑選器用)。live=true 時打 ollama.com/api/tags 實際掃描可用性,
  // 失敗則回退靜態 catalog。incompatible 永遠隱藏;subscription 需 showAll 才出現。
  ipcMain.handle("agent-list-models", async (e, opts) => {
    const { showAll = false, live = false } = opts || {};
    let available = null;
    if (live) {
      try {
        const res = await fetch(catalog.CATALOG_URL, { signal: AbortSignal.timeout(8000) });
        available = catalog.parseCloudModels(await res.text());
      } catch { available = null; }
    }
    return {
      claudeModel: catalog.CLAUDE_MODEL,
      default: catalog.DEFAULT_MODEL,
      models: catalog.listModels({ showAll, available }),
      live: !!available,
    };
  });

  ipcMain.handle("agent-get-config", () => ({
    model: ctx.databaseManager.getSetting("agent_model", catalog.CLAUDE_MODEL),
    workMode: ctx.databaseManager.getSetting("agent_work_mode", "general"),
    enabled: ctx.databaseManager.getSetting("agent_mode_enabled", false) === true,
    projectDir: ctx.databaseManager.getSetting("agent_project_dir", ""),
  }));

  ipcMain.handle("agent-set-config", (e, patch) => {
    const map = { model: "agent_model", workMode: "agent_work_mode", enabled: "agent_mode_enabled", projectDir: "agent_project_dir" };
    for (const [k, v] of Object.entries(patch || {})) { if (map[k]) ctx.databaseManager.setSetting(map[k], v); }
    return { success: true };
  });

  function resolveCwd() {
    const workMode = ctx.databaseManager.getSetting("agent_work_mode", "general");
    const projectDir = ctx.databaseManager.getSetting("agent_project_dir", "");
    if (workMode === "project" && projectDir) return projectDir;
    const dir = require("path").join(require("electron").app.getPath("downloads"), "SpeakSlowAgent");
    try { require("fs").mkdirSync(dir, { recursive: true }); } catch (e) {}
    return dir;
  }

  ipcMain.handle("agent-run-task", (e, text) => {
    if (!text || !text.trim()) return { success: false, error: "空白指令" };
    const model = ctx.databaseManager.getSetting("agent_model", catalog.CLAUDE_MODEL);
    return ctx.agentManager.runTask({ prompt: text, model, cwd: resolveCwd() });
  });
  ipcMain.handle("agent-stop-task", () => ctx.agentManager.stop());

  ipcMain.handle("agent-install-claude", () => { require("electron").shell.openExternal("https://docs.anthropic.com/en/docs/claude-code/setup"); return { success: true }; });
  ipcMain.handle("agent-install-ollama", () => { require("electron").shell.openExternal("https://ollama.com/download"); return { success: true }; });
  ipcMain.handle("agent-login-anthropic", () => {
    // 開一個終端跑 claude(互動式,使用者在裡面 /login)
    try {
      const { spawn } = require("child_process");
      if (process.platform === "win32") spawn("cmd", ["/c", "start", "cmd", "/k", "claude"], { detached: true });
      else spawn("sh", ["-c", "claude"], { detached: true });
    } catch (e) {}
    return { success: true };
  });
};
