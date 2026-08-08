const PREPARING_STATES = new Set(["requesting_permission", "calibrating", "countdown"]);

export async function handlePageVisibility({ hidden, sessionState, stop, abort }) {
  if (!hidden) {
    return "ignored";
  }
  if (sessionState === "running") {
    await stop("pageHidden");
    return "finalized";
  }
  if (PREPARING_STATES.has(sessionState)) {
    await abort();
    return "aborted";
  }
  return "ignored";
}
