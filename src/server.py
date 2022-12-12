import os
import socket
import subprocess
import threading
import traceback
from datetime import datetime

PORT = 8000


class WebServer:
    """
    Webサーバーを表すクラス
    """

    # 実行ファイルのあるディレクトリ
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    # 静的配信するファイルを置くディレクトリ
    STATIC_ROOT = os.path.join(BASE_DIR, "static")

    def serve(self):
        """
        サーバーを起動する
        """

        print("=== サーバーを起動します ===")

        try:
            # socketを生成
            server_socket = socket.socket()
            server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

            # socketをlocalhostのポート8080番に割り当てる
            server_socket.bind(("localhost", PORT))
            server_socket.listen(10)

            while True:
                # 外部からの接続を待ち、接続があったらコネクションを確立する
                print("=== クライアントからの接続を待ちます ===")
                (client_socket, address) = server_socket.accept()
                print(f"=== クライアントとの接続が完了しました remote_address: {address} ===")

                try:
                    # クライアントから送られてきたデータを取得する
                    request = client_socket.recv(4096)

                    # リクエスト全体を
                    # 1. リクエストライン(1行目)
                    # 2. リクエストヘッダー(2行目〜空行)
                    # 3. リクエストボディ(空行〜)
                    # にパースする
                    request_line, remain = request.split(b"\r\n", maxsplit=1)
                    request_header, request_body = remain.split(b"\r\n\r\n", maxsplit=1)

                    # リクエストラインをパースする
                    method, path, http_version = request_line.decode().split(" ")

                    # pathの先頭の/を削除し、相対パスにしておく
                    relative_path = path.lstrip("/")
                    # ファイルのpathを取得
                    static_file_path = os.path.join(self.STATIC_ROOT, relative_path)
                    # ファイルからレスポンスボディを生成
                    try:
                        if "tsv" in request_line.decode("utf-8"):
                            t = threading.Thread(
                                target=server.ps, args=(static_file_path,)
                            )
                            t.start()
                            t.join()

                            with open(static_file_path, "rb") as f:
                                response_body = f.read()
                            os.remove(static_file_path)
                        else:
                            with open(static_file_path, "rb") as f:
                                response_body = f.read()

                        # レスポンスラインを生成
                        response_line = "HTTP/1.1 200 OK\r\n"

                    except OSError:
                        # ファイルが見つからなかった場合は404を返す
                        response_body = (
                            b"<html><body><h1>404 Not Found</h1></body></html>"
                        )
                        response_line = "HTTP/1.1 404 Not Found\r\n"

                    # レスポンスヘッダーを生成
                    response_header = ""
                    response_header += f"Date: {datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')}\r\n"
                    response_header += "Host: HenaServer/0.1\r\n"
                    response_header += f"Content-Length: {len(response_body)}\r\n"
                    response_header += "Connection: Close\r\n"
                    if "html" in request_line.decode("utf-8"):
                        response_header += "Content-Type: text/html\r\n"
                    elif "css" in request_line.decode("utf-8"):
                        response_header += "Content-Type: text/css\r\n"

                    # レスポンス全体を生成する
                    response = (
                        response_line + response_header + "\r\n"
                    ).encode() + response_body

                    # クライアントへレスポンスを送信する
                    client_socket.send(response)

                except Exception:
                    # リクエストの処理中に例外が発生した場合はコンソールにエラーログを出力し、
                    # 処理を続行する
                    print("=== リクエストの処理中にエラーが発生しました ===")
                    traceback.print_exc()

                finally:
                    # 例外が発生した場合も、発生しなかった場合も、TCP通信のcloseは行う
                    client_socket.close()

        finally:
            print("=== サーバーを停止します。 ===")

    def ps(self, path):
        COLUMN_NUM = 11
        try:
            res = subprocess.check_output(["ps", "auxf"])
        except:
            print("Error.")

        with open(path, "w") as f:
            txt = res.decode("utf-8").rstrip("\r\n")
            lines = txt.split("\n")

            for row, line in enumerate(lines):
                if row == 0:
                    tsv_header = "\t".join(line.split(None, COLUMN_NUM - 1))
                    f.write(tsv_header + "\t" + "GENE" + "\n")
                else:
                    split_line = line.split(None, COLUMN_NUM - 2)
                    line_head = split_line[0 : COLUMN_NUM - 2]
                    time_b_command = split_line[COLUMN_NUM - 2]
                    time, b_command = time_b_command.split(" ", 1)
                    line_head.append(time)

                    if b_command.count(r"\_"):
                        blank, command = b_command.split(r"\_ ")
                        gene = blank.count(" ") // 4 + 1
                    else:
                        command = b_command
                        gene = 0

                    tsv_head = "\t".join(line_head)
                    command = command.lstrip("[").rstrip("]")
                    f.write(tsv_head + "\t" + command + "\t" + str(gene) + "\n")


if __name__ == "__main__":
    server = WebServer()
    server.serve()
