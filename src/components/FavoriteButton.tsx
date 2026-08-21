"use client";

import { useState } from "react";
import { isFavorite, addFavorite, removeFavorite } from "@/lib/favorites";

interface FavoriteButtonProps {
  id: string;
  className?: string;
}

/** 阅读页收藏按钮：切换当前诗作的本地收藏（localStorage 记 id） */
export default function FavoriteButton({
  id,
  className = "",
}: FavoriteButtonProps) {
  const [fav, setFav] = useState(() => isFavorite(id));
  const toggle = () => {
    if (fav) {
      removeFavorite(id);
    } else {
      addFavorite(id);
    }
    setFav((v) => !v);
  };
  return (
    <button
      type="button"
      className={`fav-btn ${fav ? "active" : ""} ${className}`}
      onClick={toggle}
      aria-pressed={fav}
      data-testid="fav-btn"
    >
      <span aria-hidden="true">{fav ? "♥" : "♡"}</span>
      {fav ? "已收藏" : "收藏"}
    </button>
  );
}
