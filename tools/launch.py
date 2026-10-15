"""게임 실행기: 로컬 서버를 띄우고 기본 브라우저로 게임을 연다. (게임 실행.bat 에서 호출)
- 이 게임의 서버가 이미 떠 있으면 그대로 연다
- 8000번을 다른 프로그램이 쓰고 있으면 8001~8010 중 빈 포트를 쓴다
- 창을 닫거나 Ctrl+C 를 누르면 서버가 종료된다"""
import functools
import http.server
import os
import socket
import sys
import threading
import urllib.request
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = "라스트오리진 삼국지"


def ours(port):
    """그 포트에서 이 게임이 이미 서비스 중인가"""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/index.html", timeout=1.5) as r:
            return MARK in r.read().decode("utf-8", "ignore")
    except Exception:
        return False


def free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        p = self.path.split("?")[0]
        self.send_header("Cache-Control", "public, max-age=3600" if p.endswith((".webp", ".png", ".jpg", ".mp3", ".ogg")) else "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


def main():
    for port in range(8000, 8011):
        if free(port):
            break
        if ours(port):  # 사용 중인 포트만 이 게임 서버인지 확인한다
            url = f"http://localhost:{port}/index.html"
            print(f"이미 실행 중인 게임 서버를 엽니다: {url}")
            webbrowser.open(url)
            return
    else:
        print("8000~8010 포트가 모두 사용 중입니다. 다른 프로그램을 종료한 뒤 다시 실행해 주세요.")
        input("엔터를 누르면 닫힙니다.")
        return
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=ROOT))
    url = f"http://localhost:{port}/index.html"
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    print("=" * 52)
    print(f"  {MARK} : 서버 실행 중")
    print(f"  주소: {url}")
    print("  이 창을 닫으면 게임 서버가 꺼집니다.")
    print("=" * 52)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
