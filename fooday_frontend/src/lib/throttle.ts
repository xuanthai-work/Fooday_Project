/**
 * Small helper that keeps an action from firing too often.
 * Created outside React so the impure timestamp call stays out of components.
 */
export function createThrottler(waitMs: number): () => boolean {
  let last = 0;
  return () => {
    const now = Date.now();
    if (now - last < waitMs) return false;
    last = now;
    return true;
  };
}
