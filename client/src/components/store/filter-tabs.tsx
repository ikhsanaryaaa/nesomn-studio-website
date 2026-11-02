/** Tab filter kategori untuk katalog. Controlled lewat props. */
export function FilterTabs({
  options,
  active,
  onChange,
}: {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="catalogue-filters">
      {options.map((opt) => (
        <button
          key={opt.value}
          aria-pressed={opt.value === active}
          style={{ minHeight: 'var(--space-control)' }}
          onClick={() => onChange(opt.value)}
          className={
            opt.value === active ? 'catalogue-filter catalogue-filter--active' : 'catalogue-filter'
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
