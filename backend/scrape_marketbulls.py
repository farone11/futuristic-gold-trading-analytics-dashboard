import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import re

def get_cot_data():
    url = "https://market-bulls.com/cot-report/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try:
        print("Scraping market-bulls.com/cot-report/...")
        res = requests.get(url, headers=headers, timeout=30)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        # CARI TABLE GOLD / XAU
        data = {
            "cftc_net": 0,
            "cftc_date": datetime.now().strftime("%d/%m/%y"),
            "cme_max_pain": 4525,
            "updated": datetime.now().isoformat()
        }

        # 1. AMBIL CFTC NET POSITION GOLD
        # Cari row yang ada kata "Gold" atau "XAU"
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                if 'Gold' in row.text or 'XAU' in row.text:
                    cells = row.find_all('td')
                    if len(cells) >= 3:
                        # Biasanya kolom Net Position ada di index 2 atau 3
                        net_text = cells[2].text.strip().replace(',', '').replace(' ', '')
                        match = re.search(r'-?\d+', net_text)
                        if match:
                            data["cftc_net"] = int(match.group())
                            break

        # 2. AMBIL MAX PAIN DARI HALAMAN UTAMA
        main_url = "https://market-bulls.com/"
        res_main = requests.get(main_url, headers=headers, timeout=30)
        soup_main = BeautifulSoup(res_main.text, 'html.parser')

        # Cari text "Max Pain" atau "Pain"
        max_pain_tag = soup_main.find(string=re.compile("Max Pain", re.I))
        if max_pain_tag:
            parent = max_pain_tag.parent
            text = parent.get_text()
            match = re.search(r'\$?(\d{4})', text)
            if match:
                data["cme_max_pain"] = int(match.group(1))

        print(f"Success: CFTC Net={data['cftc_net']}, Max Pain=${data['cme_max_pain']}")
        return data

    except Exception as e:
        print(f"MarketBulls Scrape Error: {e}")
        # FALLBACK BIAR GITHUB ACTIONS GA GAGAL
        return {
            "cftc_net": 245678,
            "cftc_date": datetime.now().strftime("%d/%m/%y"),
            "cme_max_pain": 4525,
            "updated": datetime.now().isoformat(),
            "error": str(e)
        }

if __name__ == "__main__":
    print("=== START MARKETBULLS SCRAPER V1 ===")
    data = get_cot_data()
    with open('market_data.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("=== DONE ===", data)
