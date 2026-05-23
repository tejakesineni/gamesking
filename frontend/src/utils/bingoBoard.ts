import type { BingoColumn } from "../types/game";

export function buildBingoBoard(): BingoColumn[] {
  return ["B", "I", "N", "G", "O"].map((label, columnIndex) => {
    const start = columnIndex * 15 + 1;
    const values = Array.from({ length: 15 }, (_, index) => start + index);

    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = values[index];
      values[index] = values[swapIndex];
      values[swapIndex] = current;
    }

    const selectedValues: Array<number | "FREE"> = values
      .slice(0, 5)
      .sort((left, right) => left - right);

    if (label === "N") {
      selectedValues[2] = "FREE";
    }

    return {
      label,
      values: selectedValues,
    };
  });
}
