"""Optional private HTTP health listener for per-container platforms."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import time

def start_health(port, health_path='/tmp/qris-health'):
    if not port:
        return None
    if not port.isascii() or not port.isdigit() or not 1024 <= int(port) <= 65535:
        raise ValueError('QRIS_HEALTH_PORT must be an unprivileged port (1024-65535)')
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            status = 404
            ok = False
            if self.path == '/health/live':
                status, ok = 200, True
            elif self.path in ('/', '/health/ready'):
                try:
                    age = time.time() - int(Path(health_path).read_text())
                    ok = 0 <= age < 120
                except (OSError, ValueError):
                    pass
                status = 200 if ok else 503
            body = b'{"ok":true}' if ok else b'{"ok":false}'
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)
        do_HEAD = do_GET
        def log_message(self, *_):
            pass
    server = ThreadingHTTPServer(('0.0.0.0', int(port)), Handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
