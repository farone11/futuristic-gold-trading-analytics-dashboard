import MetaTrader5 as mt5
import pandas as pd
import json
import os
from datetime import datetime

mt5.initialize()

symbol = "XAUUSDc"
rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H1, 0, 100)
df = pd.DataFrame(rates)

ob_list = []
for i in range(1, len(df)-1):
    body = abs(df['close'][i] - df['open'][i])
    next_body = abs(df['close'][i+1] - df['open'][i+1])
    
    if df['close'][i] < df['open'][i] and df['close'][i+1] > df['open'][i+1] and next_body > body*1.5:
        ob_list.append({
            "type": "bullish",
            "time": datetime.fromtimestamp(df['time'][i]).strftime("%Y-%m-%d %H:%M"),
            "top": float(df['high'][i]),
            "bottom": float(df['low'][i]),
            "strength": 5
        })
    
    if df['close'][i] > df['open'][i] and df['close'][i+1] < df['open'][i+1] and next_body > body*1.5:
        ob_list.append({
            "type": "bearish", 
            "time": datetime.fromtimestamp(df['time'][i]).strftime("%Y-%m-%d %H:%M"),
            "top": float(df['high'][i]),
            "bottom": float(df['low'][i]),
            "strength": 5
        })

output = {
    "H1": ob_list[-5:],
    "updated": datetime.now().strftime("%Y-%m-%d %H:%M") + " WIB",
    "symbol": symbol
}

with open('orderblocks.json', 'w') as f:
    json.dump(output, f, indent=2)

os.system('git add orderblocks.json')
os.system('git commit -m "Update OB XAUUSDc [skip ci]"')
os.system('git push')

mt5.shutdown()
print("SUCCESS:", output)
print("PUSHED TO GITHUB")