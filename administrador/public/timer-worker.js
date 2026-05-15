/**
 * TIMER WEB WORKER
 * Runs the call timer in a background thread so it continues
 * even when the interpreter switches browser tabs.
 * 
 * Protocol:
 *   Main -> Worker: { type: 'start', startedAt: ISO8601 }
 *   Main -> Worker: { type: 'stop' }
 *   Worker -> Main: { type: 'tick', elapsed: number }
 */

let intervalId = null;
let startedAtMs = 0;

self.onmessage = function (e) {
  const { type, startedAt } = e.data;

  if (type === 'start') {
    // Clear any previous interval
    if (intervalId) clearInterval(intervalId);

    startedAtMs = new Date(startedAt).getTime();

    // Tick every second
    intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      self.postMessage({ type: 'tick', elapsed });
    }, 1000);

    // Send immediate first tick
    const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
    self.postMessage({ type: 'tick', elapsed });
  }

  if (type === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
