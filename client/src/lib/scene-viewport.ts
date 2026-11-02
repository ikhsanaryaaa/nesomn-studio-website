/** Fit logical scene into actual available space without changing document dimensions. */
export function fitScene(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
) {
  if (![width, height, availableWidth, availableHeight].every((v) => Number.isFinite(v) && v > 0))
    return 1;
  return Math.min(1, availableWidth / width, availableHeight / height);
}
