import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAgentSpawn, parseStreamJsonLine, parseCodexJsonLine } from "../src/helpers/agentSpawn.js";

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

test("codex: via `codex exec --json`, full bypass, model, cwd, sys-prompt prefixed", () => {
  const s = buildAgentSpawn({ prompt: "整理桌面", model: "gpt-5-codex", cwd: "C:\\w", systemPrompt: "SYS", cli: "codex" });
  assert.equal(s.program, "codex");
  assert.deepEqual(s.args, [
    "exec", "--json", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox",
    "-m", "gpt-5-codex", "-C", "C:\\w", "SYS\n\n整理桌面",
  ]);
  assert.equal(s.cwd, "C:\\w");
});

test("cli defaults to claude-code when omitted (regression)", () => {
  const s = buildAgentSpawn({ prompt: "hi", model: "claude", cwd: "C:\\w", systemPrompt: "SYS" });
  assert.equal(s.program, "claude");
});

test("parseCodexJsonLine: agent_message item.completed → message (full, not delta)", () => {
  const line = JSON.stringify({ type: "item.completed", item: { id: "item_1", type: "agent_message", text: "hi" } });
  assert.deepEqual(parseCodexJsonLine(line), { kind: "message", text: "hi" });
});
test("parseCodexJsonLine: item-level error → itemError (non-fatal diagnostic)", () => {
  const line = JSON.stringify({ type: "item.completed", item: { id: "item_0", type: "error", message: "plugin warning" } });
  assert.deepEqual(parseCodexJsonLine(line), { kind: "itemError", text: "plugin warning" });
});
test("parseCodexJsonLine: streamed delta variant → text", () => {
  assert.deepEqual(parseCodexJsonLine(JSON.stringify({ type: "item.delta", delta: { text: "par" } })), { kind: "text", text: "par" });
  assert.deepEqual(parseCodexJsonLine(JSON.stringify({ msg: { type: "agent_message_delta", delta: "tial" } })), { kind: "text", text: "tial" });
});
test("parseCodexJsonLine: turn.completed → result (terminal)", () => {
  assert.deepEqual(parseCodexJsonLine(JSON.stringify({ type: "turn.completed", usage: {} })), { kind: "result", text: "" });
});
test("parseCodexJsonLine: top-level error → isError result", () => {
  assert.deepEqual(parseCodexJsonLine(JSON.stringify({ type: "error", message: "boom" })), { kind: "result", text: "boom", isError: true });
});
test("parseCodexJsonLine: noise / thread.started → null", () => {
  assert.equal(parseCodexJsonLine("not json"), null);
  assert.equal(parseCodexJsonLine(JSON.stringify({ type: "thread.started", thread_id: "x" })), null);
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
