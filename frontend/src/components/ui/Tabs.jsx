// Inline underline-style tabs (matches the Miftaxul look). Controlled: parent
// passes `items` with `{key, label, count?}` and the current `value` plus an
// `onChange(key)` callback.
export default function Tabs({ items, value, onChange }) {
  return (
    <div className="tab-list" role="tablist">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={`tab-item ${active ? 'tab-item-active' : ''}`}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? 'bg-brand-chart/15 text-brand-chart' : 'bg-surface-muted text-ink-muted'
                }`}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
