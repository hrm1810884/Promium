import os
import time

count = 0

pid = os.fork()
if pid==0:
    exit(0)
while 1:
    time.sleep(1)
    count += 1
    print(count)