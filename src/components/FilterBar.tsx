"use client";

interface FilterBarProps {
  /** 全部可选朝代 */
  dynasties: string[];
  /** 全部可选体裁 */
  forms: string[];
  activeDynasty?: string;
  activeForm?: string;
  onDynastyChange: (dynasty: string | undefined) => void;
  onFormChange: (form: string | undefined) => void;
}

export default function FilterBar({
  dynasties,
  forms,
  activeDynasty,
  activeForm,
  onDynastyChange,
  onFormChange,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <span className="filter-label">朝代：</span>
      <button
        className={`filter-chip ${!activeDynasty ? "active" : ""}`}
        onClick={() => onDynastyChange(undefined)}
      >
        全部
      </button>
      {dynasties.map((d) => (
        <button
          key={d}
          className={`filter-chip ${activeDynasty === d ? "active" : ""}`}
          onClick={() => onDynastyChange(activeDynasty === d ? undefined : d)}
        >
          {d}
        </button>
      ))}

      <span className="filter-label">体裁：</span>
      <button
        className={`filter-chip ${!activeForm ? "active" : ""}`}
        onClick={() => onFormChange(undefined)}
      >
        全部
      </button>
      {forms.map((f) => (
        <button
          key={f}
          className={`filter-chip ${activeForm === f ? "active" : ""}`}
          onClick={() => onFormChange(activeForm === f ? undefined : f)}
        >
          {f || "未知"}
        </button>
      ))}
    </div>
  );
}
