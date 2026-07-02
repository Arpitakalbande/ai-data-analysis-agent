import urllib.request
import sys

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    'Content-Disposition: form-data; name="file"; filename="test.csv"\r\n'
    'Content-Type: text/csv\r\n\r\n'
    'a,b\n1,2\n'
    f'\r\n--{boundary}--\r\n'
).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:8000/upload',
    data=body,
    method='POST',
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)

try:
    with urllib.request.urlopen(req, timeout=20) as response:
        print('status', response.status)
        print(response.read().decode())
except Exception as exc:
    print('error', repr(exc))
    sys.exit(1)
