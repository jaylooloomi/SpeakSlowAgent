// 純函式:依執行引擎(cli)與模型組出 spawn 的 {program, args, cwd, env}。
// cli="claude-code"(預設,機制照抄 app-free-cowork/launcher.rs):
//   model "claude" → 直接跑 claude(走 Anthropic 帳號);其餘視為 ollama 模型(如
//   "gemma3:12b-cloud")→ ollama launch claude -- claude --model <m>
// cli="codex":走 OpenAI Codex CLI(走 ChatGPT 帳號)→ codex exec --json …(實測 0.141.0)。
const { CLAUDE_MODEL } = require("./agentCatalog.js");

const CLAUDE_FLAGS = (systemPrompt, prompt) => [
  "--append-system-prompt", systemPrompt,
  "--dangerously-skip-permissions",
  "-p", "--output-format", "stream-json", "--verbose",
  prompt,
];

function buildAgentSpawn({ prompt, model, cwd, systemPrompt, cli = "claude-code" }) {
  if (cli === "codex") {
    // Codex 無 --append-system-prompt → 系統提示前綴進 prompt。
    // --dangerously-bypass-approvals-and-sandbox = Claude 的 --dangerously-skip-permissions 對等。
    return {
      program: "codex",
      args: [
        "exec", "--json", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox",
        "-m", model, "-C", cwd, `${systemPrompt}\n\n${prompt}`,
      ],
      cwd,
      env: {},
    };
  }
  if (model === CLAUDE_MODEL || model === "anthropic") { // "anthropic" = 舊設定相容
    return { program: "claude", args: CLAUDE_FLAGS(systemPrompt, prompt), cwd, env: {} };
  }
  // ollama 透傳路徑(model = ollama 模型名,如 "gemma3:12b-cloud")
  return {
    program: "ollama",
    args: ["launch", "claude", "--", "claude", "--model", model, ...CLAUDE_FLAGS(systemPrompt, prompt)],
    cwd,
    env: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: "16384" },
  };
}

// 解析 claude stream-json 的一行 JSONL。回傳 {kind:'text'|'result', text, isError?} 或 null(略過)。
function parseStreamJsonLine(line) {
  let obj;
  try { obj = JSON.parse(line); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  if (obj.type === "assistant" && obj.message?.content) {
    const text = obj.message.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    return text ? { kind: "text", text } : null;
  }
  if (obj.type === "result") {
    return { kind: "result", text: typeof obj.result === "string" ? obj.result : "", isError: obj.is_error === true };
  }
  return null;
}

// 解析 codex exec --json 的一行 JSONL(實測 codex-cli 0.141.0)。
// 回傳 {kind:'text'|'result', text, isError?} 或 null(略過)。
function parseCodexJsonLine(line) {
  let obj;
  try { obj = JSON.parse(line); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const type = obj.type || (obj.msg && obj.msg.type);

  if (type === "item.completed" && obj.item) {
    const it = obj.item;
    if (it.type === "agent_message") {
      const text = typeof it.text === "string" ? it.text : (typeof it.message === "string" ? it.message : "");
      return text ? { kind: "text", text } : null;
    }
    if (it.type === "error") return null; // 項目級錯誤(如外掛警告)非致命,略過
    return null;
  }
  // 增量串流版本相容(本版直接給全文,但其他版本可能是 delta)
  if (type === "item.delta" || type === "agent_message_delta") {
    const d = obj.delta != null ? obj.delta : (obj.msg && obj.msg.delta); // delta 可能在頂層或 msg 內
    const text = typeof d === "string" ? d : (d && (d.text || d.message)) || "";
    return text ? { kind: "text", text } : null;
  }
  if (type === "agent_message" && (obj.text || obj.message)) {
    return { kind: "text", text: obj.text || obj.message };
  }
  if (type === "turn.completed") return { kind: "result", text: "" }; // 終點(最終文字已由 agent_message 累積)
  if (type === "error") return { kind: "result", text: typeof obj.message === "string" ? obj.message : "", isError: true };
  return null;
}

module.exports = { buildAgentSpawn, parseStreamJsonLine, parseCodexJsonLine };
