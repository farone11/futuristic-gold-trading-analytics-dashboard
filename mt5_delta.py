import MetaTrader5 as mt5
import json
import os
from datetime import datetime

mt5.initialize()

symbol = "XAUUSDc"

# FIX: copy_ticks_from, BUKAN copy_ticks_from_pos
ticks = mt5.copy_ticks_from(symbol, datetime.now().timestamp(), 500, mt5.COPY_TICKS_ALL)

cvd = 0
for tick in ticks:
    if tick.last >= tick.ask:
        cvd += tick.volume
    elif tick.last <= tick.bid:
        cvd -= tick.volume

tick = mt5.symbol_info_tick(symbol)

output = {
    "cvd": int(cvd),
    "price": round(tick.ask, 2),
    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "updated": datetime.now().strftime("%Y-%m-%d %H:%M") + " WIB",
    "symbol": symbol
}

with open('cvd.json', 'w') as f:
    json.dump(output, f, indent=2)

os.system('git add cvd.json')
os.system('git commit -m "Update CVD [skip ci]"')
os.system('git push')

mt5.shutdown()
print("SUCCESS:", output)
print("PUSHED TO GITHUB")