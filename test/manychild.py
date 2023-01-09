import os
import random
import subprocess
import sys
import time

# 1つの親プロセスから子プロセスを大量生成するプログラム


def work():  # 子プロセスで実行する処理を定義
    wait_time = random.SystemRandom().randint(20, 30)
    pid = os.getpid()

    print("Child process is working for %d sec (PID:%s)" % (wait_time, pid))
    time.sleep(wait_time)

    return wait_time


for i in range(20):
    # 多数の子プロセスを生成
    # while文にして途中で強制終了すると、大量のプロセスが停止状態で残るので注意
    pid = os.fork()
    if pid == 0:
        result = work()
        child_pid = os.getpid()
        print("Child process worked for %dsec (PID:%s)" % (result, child_pid))
        sys.exit()

print("Main process ended (PID:%s)" % os.getpid())


time.sleep(5)  # 少し待ってps auxmwwを実行
subprocess.run(
    ["ps auxmww"], shell=True
)  # shell = Trueと指定しないと"ps aumww"が1つのコマンドとみなされてしまう
