import requests, json, subprocess
from bs4 import BeautifulSoup
from datetime import datetime

try:
    # ... kode scraping lu di sini ...
    
    data = {
        "commercial_net": -185766,
        "large_spec_net": 154260,
        "cot_index_6m": 100,
        "bias": "BULLISH",
        "status": "Extreme Long",
        "updated": "2026-05-26",
        "symbol": "XAUUSD"
    }

    with open('cot.json', 'w') as f:
        json.dump(data, f, indent=2)
    print(f"SUCCESS: {data}")

    # AUTO GIT PUSH
    subprocess.run(['git', 'add', 'cot.json'])
    subprocess.run(['git', 'commit', '-m', 'Update COT [skip ci]'])
    subprocess.run(['git', 'push', 'origin', 'master'])
    print("PUSHED TO GITHUB")

except Exception as e:
    print(f"ERROR: {e}")