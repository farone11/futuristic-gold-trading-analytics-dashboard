import asyncio
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import pandas as pd
import json
from datetime import datetime
import pytz
import os

async def get_cme_oi():
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        page = await context.new_page()
        
        url = "https://www.cmegroup.com/tools-information/quikstrike/open-interest-heatmap.html"
        print(f"Opening {url}")
        await page.goto(url, wait_until='domcontentloaded', timeout=120000)
        
        # Tunggu tabel muncul - kasih waktu lama karena weekend lemot
        print("Waiting for table to load...")
        await page.wait_for_selector('table', timeout=60000)
        await page.wait_for_timeout(5000)
        
        # Coba klik GOLD dengan 3 cara fallback
        gold_clicked = False
        selectors = [
            'button:has-text("PRODUCT (OG)")',
            'button:has-text("GOLD")', 
            'text=GOLD',
            '[data-product="OG"]'
        ]
        
        for sel in selectors:
            try:
                print(f"Trying selector: {sel}")
                await page.click(sel, timeout=5000)
                gold_clicked = True
                print("Gold clicked!")
                await page.wait_for_timeout(5000)
                break
            except:
                continue
                
        if not gold_clicked:
            print("Warning: Could not click Gold, using default table")
        
        print("Extracting table data...")
        html = await page.content()
        tables = pd.read_html(html)
        
        # Cari tabel yg bener
        df = None
        for i, table in enumerate(tables):
            cols = str(table.columns).upper()
            if 'STRIKE' in cols and ('CALL' in cols or 'C' in cols):
                df = table
                print(f"Found OI table at index {i}")
                break
        
        if df is None:
            raise Exception("Tabel OI tidak ketemu. CME mungkin maintenance weekend.")
            
        await browser.close()
        
        # Bersihin data
        print("Cleaning data...")
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(0)
            
        # Rename kolom biar konsisten
        df.columns = [str(c).upper().strip() for c in df.columns]
        col_map = {}
        for c in df.columns:
            if 'STRIKE' in c: col_map[c] = 'STRIKE'
            if c == 'C' or 'CALL' in c: col_map[c] = 'C'
            if c == 'P' or 'PUT' in c: col_map[c] = 'P'
        
        df = df.rename(columns=col_map)
        df = df[['STRIKE', 'C', 'P']].dropna()
        
        df['C'] = pd.to_numeric(df['C'], errors='coerce').fillna(0)
        df['P'] = pd.to_numeric(df['P'], errors='coerce').fillna(0)
        df['total_oi'] = df['C'] + df['P']
        df = df[df['total_oi'] > 0].sort_values('total_oi', ascending=False).head(10)
        
        if len(df) == 0:
            raise Exception("No OI data found. Market closed or CME issue.")
        
        cme_data = {
            "date": datetime.now(pytz.timezone('America/Chicago')).strftime("%Y-%m-%d"),
            "source": "CME QuikStrike OI",
            "max_pain_strikes": df.to_dict('records'),
            "updated": datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%Y-%m-%d %H:%M:%S WIB")
        }
        return cme_data

async def main():
    try:
        print("=== START CME SCRAPER ===")
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
        print(f"CME OI updated: {len(cme_oi['max_pain_strikes'])} strikes")
        print(cme_oi['max_pain_strikes'][:3])
        
    except Exception as e:
        print(f"=== ERROR ===\n{str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
