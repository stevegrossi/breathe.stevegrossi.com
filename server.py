from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent


class ExerciseRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        translated = super().translate_path(path)
        request_path = urlsplit(path).path
        if (
            request_path != '/'
            and not Path(translated).exists()
            and not Path(request_path).suffix
        ):
            return str(ROOT / 'index.html')
        return translated


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(('127.0.0.1', port), ExerciseRequestHandler)
    print(f'Serving {ROOT} at http://localhost:{port}')
    server.serve_forever()
