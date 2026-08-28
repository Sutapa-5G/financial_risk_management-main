export const inr = (n: number, digits = 0) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** Indian compact notation: Crore (1,00,00,000) / Lakh (1,00,000), not M/B. */
export const compactInr = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 1 : 2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 1 : 2)}L`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
};

export const pct = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`;

export const num = (n: number, digits = 0) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
