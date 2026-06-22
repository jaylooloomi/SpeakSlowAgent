const { ipcMain } = require("electron");
const { spawnSync, spawn } = require("child_process");
const catalog = require("../agentCatalog.js");

function probe(cmd, args) {
  try { const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, timeout: 8000 }); return r.status === 0; }
  catch { return false; }
}

// Anthropic 登入的被動退路(claude 未裝時用):env / ~/.claude.json oauthAccount / 認證檔。
function anthropicFileLogin() {
  try {
    if (process.env.ANTHROPIC_API_KEY) return true;
    const os = require("os"), fs = require("fs"), path = require("path");
    try { const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8")); if (j && j.oauthAccount) return true; } catch {}
    return fs.existsSync(path.join(os.homedir(), ".claude", ".credentials.json"));
  } catch { return false; }
}

// 開一個可見的終端機視窗跑指令(登入/安裝需使用者互動或看進度)。
function openTerminal(args) {
  try {
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", "cmd", "/k", ...args], { detached: true, windowsHide: false });
    else spawn("sh", ["-c", args.join(" ")], { detached: true });
  } catch (e) {}
}
// 即時、非互動執行(登出);忽略結果。
function runSync(cmd, args) { try { spawnSync(cmd, args, { windowsHide: true, timeout: 15000 }); } catch (e) {} }

module.exports = function register(ctx) {
  // 五列後端狀態。codex 已裝才查 ChatGPT 登入(避開本機殘留 ~/.codex 的誤判)。
  ipcMain.handle("agent-detect-backends", () => {
    const claudeCode = probe("claude", ["--version"]);
    const codex = probe("codex", ["--version"]);
    return {
      claudeCode,
      ollama: probe("ollama", ["--version"]),
      anthropic: (claudeCode && probe("claude", ["auth", "status"])) || anthropicFileLogin(),
      codex,
      chatgpt: codex && probe("codex", ["login", "status"]),
    };
  });

  // 模型清單。engine="codex" → 固定 ChatGPT 模型;否則 Claude/Ollama catalog(可 live 掃描)。
  ipcMain.handle("agent-list-models", async (e, opts) => {
    const { engine = "claude-code", showAll = false, live = false } = opts || {};
    if (engine === "codex") {
      return {
        engine: "codex",
        default: catalog.CODEX_DEFAULT_MODEL,
        models: catalog.CODEX_MODELS.map((name) => ({ name, tier: "chatgpt" })),
      };
    }
    let available = null;
    if (live) {
      try {
        const res = await fetch(catalog.CATALOG_URL, { signal: AbortSignal.timeout(8000) });
        available = catalog.parseCloudModels(await res.text());
      } catch { available = null; }
    }
    return {
      engine: "claude-code",
      claudeModel: catalog.CLAUDE_MODEL,
      default: catalog.DEFAULT_MODEL,
      models: catalog.listModels({ showAll, available }),
      live: !!available,
    };
  });

  ipcMain.handle("agent-get-config", () => ({
    cli: ctx.databaseManager.getSetting("agent_cli", "claude-code"),
    model: ctx.databaseManager.getSetting("agent_model", catalog.CLAUDE_MODEL),
    codexModel: ctx.databaseManager.getSetting("agent_codex_model", catalog.CODEX_DEFAULT_MODEL),
    workMode: ctx.databaseManager.getSetting("agent_work_mode", "general"),
    enabled: ctx.databaseManager.getSetting("agent_mode_enabled", false) === true,
    projectDir: ctx.databaseManager.getSetting("agent_project_dir", ""),
  }));

  ipcMain.handle("agent-set-config", (e, patch) => {
    const map = {
      cli: "agent_cli", model: "agent_model", codexModel: "agent_codex_model",
      workMode: "agent_work_mode", enabled: "agent_mode_enabled", projectDir: "agent_project_dir",
    };
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
    const cli = ctx.databaseManager.getSetting("agent_cli", "claude-code");
    const model = cli === "codex"
      ? ctx.databaseManager.getSetting("agent_codex_model", catalog.CODEX_DEFAULT_MODEL)
      : ctx.databaseManager.getSetting("agent_model", catalog.CLAUDE_MODEL);
    return ctx.agentManager.runTask({ prompt: text, model, cwd: resolveCwd(), cli });
  });
  ipcMain.handle("agent-stop-task", () => ctx.agentManager.stop());
  ipcMain.handle("agent-cancel-task", (e, id) => ctx.agentManager.cancel(id));

  // 安裝 / 登入 / 登出 / 切換帳號 ----------------------------------------
  ipcMain.handle("agent-install-claude", () => { require("electron").shell.openExternal("https://docs.anthropic.com/en/docs/claude-code/setup"); return { success: true }; });
  ipcMain.handle("agent-install-ollama", () => { require("electron").shell.openExternal("https://ollama.com/download"); return { success: true }; });
  ipcMain.handle("agent-install-codex", () => { openTerminal(["npm", "i", "-g", "@openai/codex"]); return { success: true }; });

  ipcMain.handle("agent-login-anthropic", () => { openTerminal(["claude", "auth", "login"]); return { success: true }; });
  ipcMain.handle("agent-logout-anthropic", () => { runSync("claude", ["auth", "logout"]); return { success: true }; });
  ipcMain.handle("agent-switch-anthropic", () => { runSync("claude", ["auth", "logout"]); openTerminal(["claude", "auth", "login"]); return { success: true }; });

  ipcMain.handle("agent-login-codex", () => { openTerminal(["codex", "login"]); return { success: true }; });
  ipcMain.handle("agent-logout-codex", () => { runSync("codex", ["logout"]); return { success: true }; });
  ipcMain.handle("agent-switch-codex", () => { runSync("codex", ["logout"]); openTerminal(["codex", "login"]); return { success: true }; });
};
