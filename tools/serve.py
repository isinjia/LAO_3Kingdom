"""로컬 미리보기 서버. PORT 환경변수(기본 8000)로 프로젝트 루트를 제공한다.
에셋(이미지·음원·SD 텍스처)은 1시간 캐시, html/js/css는 매번 재검증한다."""
import http.server, os, functools
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(os.environ.get("PORT", "8000"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        p = self.path.split("?")[0]
        if p.endswith((".webp", ".png", ".jpg", ".mp3", ".ogg")):
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
