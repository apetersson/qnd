import React from "react";

interface ProgressBarProps {
  progress: number; // fraction in [0..1]
}

/**
 * Format a percentage value (in 0–100) so that it always shows at least two decimal places.
 * The number of decimals is computed via log10 so that very small numbers get more decimals.
 */
function formatPercentageGeneric(pct: number): string {
  if (pct === 0) return "0.00";
  // Determine the order of magnitude of the percentage value.
  const order = Math.floor(Math.log10(pct));
  // We want to show at least 2 decimal places.
  // For example, if pct=15 then order=1 and decimals = max(2 - 1 - 1, 2) = 2.
  // If pct=0.56 then order=-1 and decimals = max(2 - (-1) - 1, 2) = 2.
  // If pct=0.00000123 then order=-7 and decimals = max(2 - (-7) - 1, 2) = 8.
  const decimals = Math.max(2 - order - 1, 2);
  if (decimals >= 100) return "HEATH DEATH OF THE UNIVERSE!!";
  return pct.toFixed(decimals);
}

const ProgressBar: React.FC<ProgressBarProps> = ({progress}) => {
  // Clamp progress to [0..1] just in case
  const clamped = Math.max(0, Math.min(1, progress));
  // Convert fraction to percentage in [0, 100]
  const computedWidth = clamped * 100;
  const displayPercentage = formatPercentageGeneric(computedWidth);

  return (
    <div
      style={{
        width: "300px",
        height: "20px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        overflow: "hidden",
        backgroundColor: "#f5f5f5",
        marginTop: "10px",
        position: "relative",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${computedWidth}%`,
          backgroundColor: "#4caf50",
          transition: "width 0.2s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "bold",
          color: "#000",
          pointerEvents: "none",
        }}
      >
        {displayPercentage}%
      </div>
    </div>
  );
};

export default ProgressBar;
