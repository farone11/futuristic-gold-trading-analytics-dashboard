import asyncio
from playwright.async_api import async_playwright
import pandas as pd
import json
from datetime import datetime
import pytz
import os

async def get_cme_oi():
    async with async_playwright() as p:
        print("Launching browser with stealth mode...")
        # 1. LAUNCH BROWSER ANTI-BLOCK
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-http2', # Fix HTTP2 error
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080},
            locale='en-US'
        )
        
        # Hapus jejak bot
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        
        url = "https://www.cmegroup.com/tools-information/quikstrike/open-interest-heatmap.html"
        print(f"Opening {url}")
        
        # 2. RETRY 3X KALO GAGAL
        for attempt in range(3):
            try:
                await page.goto(url, wait_until='networkidle', timeout=90000)
                break
            except Exception as e:
                print(f"Attempt {attempt+1} failed: {e}")
                if attempt == 2:
                    raise
                await page.wait_for_timeout(5000)
        
        print("Waiting for QuikStrike iframe...")
        # CME pake iframe, tunggu iframe ke-load
        await page.wait_for_selector('iframe', timeout=60000)
        frame = page.frame_locator('iframe').first
        
        print("Waiting for table in iframe...")
        await frame.locator('table').first.wait_for(timeout=60000)
        await page.wait_for_timeout(10000) # Kasih waktu render data
        
        print("Extracting table...")
        html = await frame.locator('html').inner_html()
        tables = pd.read_html(html)
        
        df = None
        for i, table in enumerate(tables):
            cols = str(table.columns).upper()
            if 'STRIKE' in cols and ('CALL' in cols or ' C ' in cols):
                df = table
                print(f"Found OI table at index {i}")
                break
        
        if df is None:
            raise Exception("Tabel OI tidak ketemu. CME mungkin ubah layout.")
            
        await browser.close()
        
        # 3. BERSIHIN DATA
        print("Cleaning data...")
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [' '.join(col).strip() for col in df.columns.values]
            
        df.columns = [str(c).upper().strip() for c in df.columns]
        
        # Cari kolom Strike, Call, Put
        strike_col = next((c for c in df.columns if 'STRIKE' in c), None)
        call_col = next((c for c in df.columns if 'CALL' in c or c == 'C'), None)
        put_col = next((c for c in df.columns if 'PUT' in c or c == 'P'), None)
        
        if not all([strike_col, call_col, put_col]):
            raise Exception(f"Kolom gak lengkap. Found: {df.columns.tolist()}")
            
        df = df[[strike_col, call_col, put_col]].copy()
        df.columns = ['STRIKE', 'C', 'P']
        df = df.dropna()
        
        df['C'] = pd.to_numeric(df['C'], errors='coerce').fillna(0)
        df['P'] = pd.to_numeric(df['P'], errors='coerce').fillna(0)
        df['total_oi'] = df['C'] + df['P']
        df = df[df['total_oi'] > 100].sort_values('total_oi', ascending=False).head(10)
        
        if len(df) == 0:
            raise Exception("No OI data > 100. Market closed or no liquidity.")
        
        cme_data = {
            "date": datetime.now(pytz.timezone('America/Chicago')).strftime("%Y-%m-%d"),
            "source": "CME QuikStrike OI",
            "max_pain_strikes": df.to_dict('records'),
            "updated": datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%Y-%m-%d %H:%M:%S WIB")
        }
        return cme_data

async def main():
    try:
        print("=== START CME SCRAPER V3 ===")
        cme_oi = await get_cme_oi()
        
        json_path = "institutional_flow.json"
        if os.path.exists(json_path):
            with open(json_path, "r") as f:
                data = json.load(f)
        else:
            data = {}
        
        data['cme_options_oi'] = cme_oi
        
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
        
        print("=== SUCCESS ===")
        print(f"Top Strike: ${cme_oi['max_pain_strikes'][0]['STRIKE']} OI: {cme_oi['max_pain_strikes'][0]['total_oi']}")
        
    except Exception as e:
        print(f"=== FATAL ERROR ===\n{str(e)}")
        # Biar gak bikin workflow merah kalo weekend gak ada data
        if "No OI data" in str(e) or "Market closed" in str(e):
            print("Market closed. Skipping update.")
            exit(0)
        raise

if __name__ == "__main__":
    asyncio.run(main())
