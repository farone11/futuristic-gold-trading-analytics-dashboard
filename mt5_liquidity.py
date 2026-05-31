import MetaTrader5 as mt5
import pandas as pd
import json
import os
from datetime import datetime

mt5.initialize()

symbol = "XAUUSDc"
rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H1, 0, 200)
df = pd.DataFrame(rates)
current_price = mt5.symbol_info_tick(symbol).ask

liquidity_zones = []

# 1. SWING HIGH/LOW = BUY SIDE/SELL SIDE LIQUIDITY + AUTO SWEPT
for i in range(5, len(df)-5):
    # Swing High = BSL
    if df['high'][i] == max(df['high'][i-5:i+6]):
        price = float(df['high'][i])
        swept = current_price > price # Harga udah di atas BSL = kesapu
        liquidity_zones.append({
            "type": "buy_side",
            "price": price,
            "time": datetime.fromtimestamp(df['time'][i]).strftime("%Y-%m-%d %H:%M"),
            "strength": 5,
            "status": "swept" if swept else "active",
            "swept": swept
        })
    
    # Swing Low = SSL
    if df['low'][i] == min(df['low'][i-5:i+6]):
        price = float(df['low'][i])
        swept = current_price < price # Harga udah di bawah SSL = kesapu
        liquidity_zones.append({
            "type": "sell_side", 
            "price": price,
            "time": datetime.fromtimestamp(df['time'][i]).strftime("%Y-%m-%d %H:%M"),
            "strength": 5,
            "status": "swept" if swept else "active",
            "swept": swept
        })

# 2. FILTER 5 ZONA TERDEKAT DARI HARGA SEKARANG
liquidity_zones.sort(key=lambda x: abs(x['price'] - current_price))
liquidity_zones = liquidity_zones[:5]

output = {
    "zones": liquidity_zones,
    "updated": datetime.now().strftime("%Y-%m-%d %H:%M") + " WIB",
    "symbol": symbol,
    "current_price": round(current_price, 2)
}

with open('liquidity_zones.json', 'w') as f:
    json.dump(output, f, indent=2)

os.system('git add liquidity_zones.json')
os.system('git commit -m "Update Liquidity Zones [skip ci]"')
os.system('git push')

mt5.shutdown()
print("SUCCESS:", output)
print("PUSHED TO GITHUB")