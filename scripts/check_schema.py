import urllib.request, json

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Ymt5Z3BwcGxrbnlucndtdG1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMxNDg5NiwiZXhwIjoyMDkyODkwODk2fQ.uT9CWgUxbexehLt-0T7zv2wm4TYMzEXerQKgLfJdAL8"
url = "https://kzbkygppplknynrwmtmf.supabase.co/rest/v1/interpreters?limit=1"
req = urllib.request.Request(url, headers={
    "apikey": token,
    "Authorization": f"Bearer {token}",
    "Prefer": "return=representation",
})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
if data:
    print("COLUMNS FOUND:", sorted(data[0].keys()))
    print("FIRST ENTRY:", json.dumps(data[0], indent=2, default=str))
