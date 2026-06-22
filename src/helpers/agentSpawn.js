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

module.exports = { buildAgentSpawn };
