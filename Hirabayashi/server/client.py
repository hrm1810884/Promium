import requests
PORT = 8000
url = "http://localhost:" + str(PORT)

response = requests.get(url)

print(response)