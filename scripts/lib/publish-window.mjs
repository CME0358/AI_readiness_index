const MAX_EARLY_WAIT_MS = 70 * 60_000;

export function millisecondsUntilPublishTarget(targetIso, now = new Date()) {
  if (!targetIso) return 0;
  const target = new Date(targetIso);
  if (Number.isNaN(target.getTime())) throw new Error('Invalid publish target ISO');
  const waitMs = target.getTime() - now.getTime();
  if (waitMs <= 0) return 0;
  if (waitMs > MAX_EARLY_WAIT_MS) {
    throw new Error(`Publish target is unexpectedly far in the future: ${waitMs}ms`);
  }
  return waitMs;
}

export { MAX_EARLY_WAIT_MS };
