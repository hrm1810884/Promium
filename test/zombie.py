import os
import time

count = 0

pid = os.fork()
if pid == 0:
    exit(0)
while True:
    time.sleep(1)
    count += 1
    print(count)
