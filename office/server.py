#!/usr/bin/env python3
"""Agent Office server: static UI + cached /api/state (stdlib only)."""
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
CTL = os.path.expanduser("~/.claude-control/bin/ctl.py")
CACHE_TTL = 4.0
BANTER = os.path.expanduser("~/.claude-control/state/banter.json")

_lock = threading.Lock()
_cache = {"ts": 0.0, "body": None}

DIST = os.path.join(BASE, "web", "dist")  # React build (`pnpm build` in office/web)
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
         ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
         ".woff2": "font/woff2", ".map": "application/json"}


def fetch_state():
    """Return (status, body_bytes). Successful bodies are cached for CACHE_TTL."""
    with _lock:
        if _cache["body"] is not None and time.time() - _cache["ts"] < CACHE_TTL:
            return 200, _cache["body"]
        try:
            p = subprocess.run(
                ["python3", CTL, "state-json"],
                capture_output=True, text=True, timeout=15,
            )
            if p.returncode != 0:
                raise RuntimeError((p.stderr or "ctl.py exited %d" % p.returncode).strip()[-300:])
            json.loads(p.stdout)  # validate
            body = p.stdout.encode("utf-8")
        except Exception as e:  # noqa: BLE001
            return 500, json.dumps({"error": str(e) or e.__class__.__name__}).encode("utf-8")
        _cache["ts"], _cache["body"] = time.time(), body
        return 200, body


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def _send(self, code, body, ctype):
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/state":
            code, body = fetch_state()
            return self._send(code, body, "application/json")
        if path == "/api/banter":
            try:
                with open(BANTER) as f:
                    body = f.read().encode("utf-8")
                json.loads(body)
            except (OSError, ValueError):
                body = b'{"lines":[]}'
            return self._send(200, body, "application/json")
        if path == "/sample-state.json":
            return self._file(os.path.join(BASE, "sample-state.json"))
        rel = os.path.normpath(path.lstrip("/")) if path != "/" else "index.html"
        target = os.path.join(DIST, rel)
        if rel.startswith("..") or not os.path.isfile(target):
            target = os.path.join(DIST, "index.html")  # SPA fallback
        self._file(target)

    def _file(self, target):
        try:
            with open(target, "rb") as f:
                body = f.read()
        except OSError:
            return self._send(404, b"not built yet: run `pnpm build` in ~/.claude-control/office/web", "text/plain")
        self._send(200, body, TYPES.get(os.path.splitext(target)[1], "application/octet-stream"))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    srv.daemon_threads = True
    if os.environ.get("OFFICE_BANTER", "1") != "0":
        import banter
        threading.Thread(target=banter.loop, name="banter", daemon=True).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
