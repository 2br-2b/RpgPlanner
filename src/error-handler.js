const MAX_ENTRIES = 500;
const _buf = [];
const _callbacks = new Set();

["log", "warn", "error", "info", "debug"].forEach(method => {
  const orig = console[method].bind(console);
  console[method] = (...args) => {
    orig(...args);
    _buf.push({ t: Date.now(), level: method, text: args.map(serialize).join(" ") });
    if (_buf.length > MAX_ENTRIES) _buf.shift();
  };
});

function serialize(a) {
  if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ""}`;
  if (typeof a === "object" && a !== null) {
    try { return JSON.stringify(a, null, 2); } catch { return String(a); }
  }
  return String(a);
}

export function getConsoleSnapshot() {
  return _buf.map(e => {
    const d = new Date(e.t);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    const lvl = e.level.toUpperCase().padEnd(5);
    return `[${h}:${m}:${s}.${ms}] [${lvl}] ${e.text}`;
  }).join("\n");
}

export function subscribeErrors(cb) {
  _callbacks.add(cb);
  return () => _callbacks.delete(cb);
}

function notify(info) {
  _callbacks.forEach(cb => cb(info));
}

window.addEventListener("error", e => {
  const message = e.message || "JavaScript error";
  const location = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined;
  notify({ message, location, stack: e.error?.stack });
});

window.addEventListener("unhandledrejection", e => {
  const err = e.reason;
  const message = err instanceof Error ? err.message : String(err ?? "Unhandled promise rejection");
  notify({ message, stack: err instanceof Error ? err.stack : undefined });
});
