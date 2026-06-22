import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAgentSpawn, parseStreamJsonLine } from "../src/helpers/agentSpawn.js";

test("claude: runs claude directly, no --model, not via ollama", () => {
  const s = buildAgentSpawn({ prompt: "整理桌面", model: "claude", cwd: "C:\\w", systemPrompt: "SYS" });
  assert.equal(s.program, "claude");
  assert.deepEqual(s.args, [
    "--append-system-prompt", "SYS", "--dangerously-skip-permissions",
    "-p", "--output-format", "stream-json", "--verbose", "整理桌面",
  ]);
  assert.equal(s.cwd, "C:\\w");
  assert.equal(s.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, undefined);
});

test("ollama: via `ollama launch claude`, with --model and output cap", () => {
  const s = buildAgentSpawn({ prompt: "hi", model: "gemma3:12b-cloud", cwd: "C:\\g", systemPrompt: "SYS" });
  assert.equal(s.program, "ollama");
  assert.deepEqual(s.args, [
    "launch", "claude", "--", "claude", "--model", "gemma3:12b-cloud",
    "--append-system-prompt", "SYS", "--dangerously-skip-permissions",
    "-p", "--output-format", "stream-json", "--verbose", "hi",
  ]);
  assert.equal(s.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, "16384");
});

test("parse assistant text event → extract text", () => {
  const line = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "好的,我來整理。" }] } });
  assert.deepEqual(parseStreamJsonLine(line), { kind: "text", text: "好的,我來整理。" });
});
test("parse result event → final text + isError", () => {
  const line = JSON.stringify({ type: "result", subtype: "success", result: "完成", is_error: false });
  assert.deepEqual(parseStreamJsonLine(line), { kind: "result", text: "完成", isError: false });
});
test("non-JSON / unrelated line → null (skip)", () => {
  assert.equal(parseStreamJsonLine("not json"), null);
  assert.equal(parseStreamJsonLine(JSON.stringify({ type: "system" })), null);
});
