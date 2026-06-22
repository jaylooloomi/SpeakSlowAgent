import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAgentSpawn } from "../src/helpers/agentSpawn.js";

test("anthropic: runs claude directly, no --model, not via ollama", () => {
  const s = buildAgentSpawn({ prompt: "整理桌面", model: "anthropic", cwd: "C:\\w", systemPrompt: "SYS" });
  assert.equal(s.program, "claude");
  assert.deepEqual(s.args, [
    "--append-system-prompt", "SYS", "--dangerously-skip-permissions",
    "-p", "--output-format", "stream-json", "--verbose", "整理桌面",
  ]);
  assert.equal(s.cwd, "C:\\w");
  assert.equal(s.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, undefined);
});

test("ollama: via `ollama launch claude`, with --model and output cap", () => {
  const s = buildAgentSpawn({ prompt: "hi", model: "qwen2.5:cloud", cwd: "C:\\g", systemPrompt: "SYS" });
  assert.equal(s.program, "ollama");
  assert.deepEqual(s.args, [
    "launch", "claude", "--", "claude", "--model", "qwen2.5:cloud",
    "--append-system-prompt", "SYS", "--dangerously-skip-permissions",
    "-p", "--output-format", "stream-json", "--verbose", "hi",
  ]);
  assert.equal(s.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, "16384");
});
