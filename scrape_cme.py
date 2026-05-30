import asyncio
from playwright.async_api import async_playwright
import pandas as pd
import json
from datetime import datetime
import pytz
import os

async def get_cme_oi():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print("1. Buka CME QuikStrike...")
        url = "https://www.cmegroup.com/tools-information/quikstrike/open-interest-heatmap.html"
        await page.goto(url, wait_until='networkidle', timeout=90000)
        
        # Tunggu tabel + klik Gold Options
        print("2. Pilih Gold OG...")
        await page.wait_for_selector('button:has-text("PRODUCT (OG)")', timeout=30000)
        await page.click('button:has-text("PRODUCT (OG)")')
        await page.wait_for_timeout(5000)
        
        # Ambil HTML tabel
        print("3. Ambil data tabel...")
        html = await page.content()
        tables = pd.read_html(html)
        
        # Cari tabel yg ada STRIKE, C, P
        df = None
        for table in tables:
            if 'STRIKE' in str(table.columns) and 'C' in str(table.columns):
                df = table
                break
        
        if df is None:
            raise Exception("Tabel OI tidak ketemu")
            
        await browser.close()
        
        # Bersihin data
        print("4. Bersihin data...")
        # Flatten multilevel columns kalo ada
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(0)
            
        df = df[['STRIKE', 'C', 'P']].dropna()
        df['C'] = pd.to_numeric(df['C'], errors='coerce').fillna(0)
        df['P'] = pd.to_numeric(df['P'], errors='coerce').fillna(0)
        df['total_oi'] = df['C'] + df['P']
        df = df.sort_values('total_oi', ascending=False).head(10)
        
        cme_data = {
            "date": datetime.now(pytz.timezone('America/Chicago')).strftime("%Y-%m-%d"),
            "source": "CME QuikStrike OI",
            "max_pain_strikes": df.to_dict('records'),
            "updated": datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%Y-%m-%d %H:%M:%S WIB")
        }
        return cme_data

async def main():
    print("Start scrape CME OI...")
    cme_oi = await get_cme_oi()
    
    # Baca JSON lama
    json_path = "institutional_flow.json"
    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            data = json.load(f)
    else:
        data = {}
    
    # Update key CME
    data['cme_options_oi'] = cme_oi
    
    # Tulis ulang
    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)
    
    print("CME OI added:", cme_oi['max_pain_strikes'][:3])

if __name__ == "__main__":
    asyncio.run(main())
