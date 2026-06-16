import React from "react";

// 語音符號管理：看內建對照、加自己的觸發詞（很燙 → 🔥）。存 DB、即時生效。
export default function EmojiManager({ t }) {
  const [builtin, setBuiltin] = React.useState({});
  const [custom, setCustom] = React.useState({});
  const [query, setQuery] = React.useState("");
  const [newKey, setNewKey] = React.useState("");
  const [newVal, setNewVal] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const b = await window.electronAPI?.getBuiltinEmojis?.();
        const c = await window.electronAPI?.getCustomEmojis?.();
        setBuiltin((b && b.builtin) || {});
        setCustom((c && c.emojis) || {});
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setCustom(next);
    try { await window.electronAPI?.setCustomEmojis?.(next); } catch (e) { /* ignore */ }
  };
  const add = async () => {
    const k = newKey.trim();
    const v = newVal.trim();
    if (!k || !v) return;
    await persist({ ...custom, [k]: v });
    setNewKey("");
    setNewVal("");
  };
  const remove = async (k) => {
    const next = { ...custom };
    delete next[k];
    await persist(next);
  };

  const q = query.trim().toLowerCase();
  const builtinList = Object.entries(builtin).filter(
    ([k, v]) => !q || k.toLowerCase().includes(q) || (v && v.includes(query.trim()))
  );
  const customList = Object.entries(custom);

  const chip =
    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700/60 text-sm text-gray-800 dark:text-gray-200";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("settings.emoji.title")}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("settings.emoji.desc")}</p>
      </div>

      {/* 新增自訂 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{t("settings.emoji.addTitle")}</div>
        <div className="flex items-center gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={t("settings.emoji.keyPlaceholder")}
            className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <span className="text-gray-400">→</span>
          <input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("settings.emoji.emojiPlaceholder")}
            className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
          />
          <button
            onClick={add}
            disabled={!newKey.trim() || !newVal.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
          >
            {t("settings.emoji.addBtn")}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{t("settings.emoji.usageHint")}</p>

        {/* 自訂清單 */}
        {customList.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-3">
            {customList.map(([k, v]) => (
              <span key={k} className={chip}>
                <span className="text-lg leading-none">{v}</span>
                <span className="text-gray-500 dark:text-gray-400">{k}</span>
                <button
                  onClick={() => remove(k)}
                  className="ml-0.5 text-gray-400 hover:text-red-500"
                  aria-label="delete"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-3">{t("settings.emoji.customEmpty")}</p>
        )}
      </div>

      {/* 內建對照（唯讀，可搜尋） */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {t("settings.emoji.builtinTitle")}（{Object.keys(builtin).length}）
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings.emoji.searchPlaceholder")}
            className="w-40 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-gray-400">…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {builtinList.map(([k, v]) => (
                <span key={k} className={chip}>
                  <span className="text-lg leading-none">{v}</span>
                  <span className="text-gray-500 dark:text-gray-400">{k}</span>
                </span>
              ))}
              {builtinList.length === 0 && <p className="text-xs text-gray-400">{t("settings.emoji.noMatch")}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
