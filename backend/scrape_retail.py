import asyncio
from playwright.async_api import async_playwright
import json
from datetime import datetime
import pytz

async def get_myfxbook_sentiment():
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "https://www.myfxbook.com/community/outlook/XAUUSD"
        print(f"Opening {url}")
        await page.goto(url, wait_until='domcontentloaded', timeout=90000)
        await page.wait_for_timeout(5000)
        
        # Tunggu element muncul
        await page.wait_for_selector('#outlookProgressLong', timeout=30000)
        
        long_pct = await page.locator('#outlookProgressLong').get_attribute('data-value')
        short_pct = await page.locator('#outlookProgressShort').get_attribute('data-value')
        lots_text = await page.locator('#totalLots').inner_text()
        
        await browser.close()
        
        return {
            "symbol": "XAUUSD",
            "long_pct": float(long_pct),
            "short_pct": float(short_pct),
            "lots": int(lots_text.replace(',', '')),
            "updated": datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%Y-%m-%d %H:%M:%S WIB"),
            "source": "Myfxbook Outlook"
        }

async def main():
    try:
        data = await get_myfxbook_sentiment()
        with open("retail_sentiment.json", "w") as f:
            json.dump(data, f, indent=2)
        print("SUCCESS:", data)
    except Exception as e:
        print("ERROR:", e)
        fallback = {
            "symbol": "XAUUSD", "long_pct": 65.0, "short_pct": 35.0, "lots": 0,
            "updated": datetime.now(pytz.timezone('Asia/Jakarta')).strftime("%Y-%m-%d %H:%M:%S WIB"),
            "source": "Fallback"
        }
        with open("retail_sentiment.json", "w") as f:
            json.dump(fallback, f, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
