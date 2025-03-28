export function formatMilliseconds(milliseconds: number): string {
  // For durations less than 1000ms, show in milliseconds with 2 decimal places
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(2)}ms`;
  }

  // For durations >= 1000ms, convert to seconds with 2 decimal places
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(2)}s`;
}

export function simulateDelay(milliseconds: number = 50): void {
  const startTime = performance.now();
  while (performance.now() - startTime < milliseconds) {
    // Busy wait to simulate CPU-intensive work
  }
}
