import json
from datetime import datetime

def load_json(file):
    try:
        with open(file, 'r') as f:
            return json.load(f)
    except:
        return None

cvd = load_json('cvd.json')
ob = load_json('orderblocks.json')
liq = load_json('liquidity_zones.json')
cot = load_json('cot.json')
seasonal = load_json('seasonal.json')

signal = {
    "status": "STANDBY",
    "entry": 0,
    "sl": 0,
    "tp1": 0,
    "tp2": 0,
    "reason": "No confluence",
    "updated": datetime.now().strftime('%Y-%m-%d %H:%M WIB')
}

if not all([cvd, ob, liq, cot, seasonal]):
    signal["reason"] = "Missing data"
else:
    price = cvd['price']
    bsl_active = [z for z in liq['zones'] if z['type'] == 'buy_side' and not z['swept']]
    ssl_active = [z for z in liq['zones'] if z['type'] == 'sell_side' and not z['swept']]
    ob_bullish = [z for z in ob['H1'] if z['type'] == 'bullish']
    ob_bearish = [z for z in ob['H1'] if z['type'] == 'bearish']

    # LOGIC BUY
    if cot['bias'] == 'BULLISH' and seasonal['bias'] in ['BULLISH', 'NEUTRAL']:
        for ob_b in ob_bullish:
            if ob_b['bottom'] <= price <= ob_b['top']:
                signal["status"] = "BUY"
                signal["entry"] = round(ob_b['top'], 2)
                signal["sl"] = round(ob_b['bottom'] - 5, 2)
                signal["tp1"] = round(bsl_active[0]['price'], 2) if bsl_active else round(price + 20, 2)
                signal["tp2"] = round(bsl_active[1]['price'], 2) if len(bsl_active) > 1 else round(price + 40, 2)
                signal["reason"] = f"COT Bullish + Seasonal {seasonal['bias']} + OB Bullish"
                break

    # LOGIC SELL - PRIORITAS KALO COT EXTREME
    if cot['status'] == 'Extreme Long' and seasonal['bias'] == 'BEARISH':
        for ob_s in ob_bearish:
            if ob_s['bottom'] <= price <= ob_s['top']:
                signal["status"] = "SELL"
                signal["entry"] = round(ob_s['bottom'], 2)
                signal["sl"] = round(ob_s['top'] + 5, 2)
                signal["tp1"] = round(ssl_active[0]['price'], 2) if ssl_active else round(price - 20, 2)
                signal["tp2"] = round(ssl_active[1]['price'], 2) if len(ssl_active) > 1 else round(price - 40, 2)
                signal["reason"] = f"COT Extreme Long + Seasonal Bearish + OB Bearish"
                break

with open('signals.json', 'w') as f:
    json.dump(signal, f, indent=2)

print(f"SUCCESS: {signal['status']} @ {signal['entry']}")