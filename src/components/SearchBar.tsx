"use client";

import { useState } from "react";

interface SearchBarProps {
  /** 初始关键词（从 URL 读入） */
  defaultValue?: string;
  /** 提交回调 */
  onSearch: (keyword: string) => void;
  /** 占位文案 */
  placeholder?: string;
}

export default function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "输入标题、作者或诗句…",
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  const submit = () => onSearch(value);

  return (
    <div className="search-bar">
      <input
        className="search-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        autoFocus
      />
      <button className="search-btn" onClick={submit}>
        搜索
      </button>
    </div>
  );
}
