import subprocess
from time import sleep

proc = []

for i in range(50):
    command = ["python3", "idle.py"]
    sleep(2)
    proc.append(subprocess.Popen(command))  # コマンドが実行される（処理の終了は待たない）
sleep(100)
for i in range(50):
    result = proc[i].communicate()  # 終了を待つ
