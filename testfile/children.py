import subprocess

command = ["python3","load.py"]
proc = subprocess.Popen(command)  #->コマンドが実行される(処理の終了は待たない)
result = proc.communicate()  #->終了を待つ