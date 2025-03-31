// BoardGridStyles.ts
import { CSSProperties } from "react";

export const boardGridCommonStyle = (boardWidth: number, isOverlay: boolean = false): CSSProperties => {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${boardWidth}, 40px)`,
    gap: 2,
    ...(isOverlay
        ? { position: "absolute", top: 0, left: 0, pointerEvents: "none", opacity: 0.5 }
        : { marginTop: 20 }
    )
  };
};
