// 純函式:依模型組出 spawn Claude Code 的 {program, args, cwd, env}。
// 機制照抄 app-free-cowork/launcher/src-tauri/src/launcher.rs:
//  model "anthropic" → 直接跑 claude;其餘視為 ollama 模型 → ollama launch claude -- claude --model <m>
const CLAUDE_FLAGS = (systemPrompt, prompt) => [
  "--append-system-prompt", systemPrompt,
  "--dangerously-skip-permissions",
  "-p", "--output-format", "stream-json", "--verbose",
  prompt,
];

function buildAgentSpawn({ prompt, model, cwd, systemPrompt }) {
  if (model === "anthropic") {
    return { program: "claude", args: CLAUDE_FLAGS(systemPrompt, prompt), cwd, env: {} };
  }
  // ollama 透傳路徑(model = ollama 模型名,如 "qwen2.5:cloud")
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

module.exports = { buildAgentSpawn, parseStreamJsonLine };
