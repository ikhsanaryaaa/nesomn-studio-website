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
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={
            opt.value === active
              ? 'rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-accent-foreground'
              : 'rounded-full border border-border bg-surface-2 px-4 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground'
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
