import json
from datetime import datetime

# Data y20 dari Market-Bulls. Update manual setahun sekali aja
seasonal_data = {
    "Gold": {
        "Jan": 28.7974, "Feb": 6.6279, "Mar": -6.7776, "Apr": 12.53,
        "May": 1.7466, "Jun": -6.2012, "Jul": 16.4344, "Aug": 25.1191,
        "Sep": -11.9058, "Oct": 3.1369, "Nov": -0.4019, "Dec": 6.4724
    },
    "updated": "2026-01-01"
}

# Ambil bulan sekarang
current_month = datetime.now().strftime('%b') # May
current_bias = seasonal_data["Gold"][current_month]

data = {
    "current_month": current_month,
    "bias_value": current_bias,
    "bias": "BULLISH" if current_bias > 5 else "BEARISH" if current_bias < -5 else "NEUTRAL",
    "strong_months": ["Jan", "Jul", "Aug"],
    "weak_months": ["Mar", "Jun", "Sep"],
    "updated": datetime.now().strftime('%Y-%m-%d')
}

with open('seasonal.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"SUCCESS: Seasonal bias {current_month} = {data['bias']}")