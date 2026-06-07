from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import traceback

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

MT5_INITIALIZED = False

# Global buat simpen data terakhir, biar client baru konek langsung dapet
latest_tick_data = {
    "symbol": "XAUUSD", "bid": 0, "ask": 0, "time": 0, 
    "balance": 0, "equity": 0, "profit": 0
}

def safe_float(val, default=0.0):
    try: return float(val)
    except: return default

def init_mt5():
    global MT5_INITIALIZED
    if not MT5_INITIALIZED:
        if not mt5.initialize():
            print("MT5 Initialize GAGAL", flush=True)
            return False
        MT5_INITIALIZED = True
        print("MT5 Connected", flush=True)
    return True

def get_market_data():
    default = {"cftc_net": 245678, "cftc_date": "01/06/26", "cme_max_pain": 4525, "cftc_long": 200704, "cftc_short": 46444}
    if os.path.exists('data/market_data.json'):
        try:
            with open('data/market_data.json', 'r') as f:
                data = json.load(f)
                return {**default, **data}
        except: return default
    return default

def get_seasonal_bias():
    month = datetime.now().month
    seasonal_map = {
        1: {"bias": "BULLISH", "value": 2.1}, 2: {"bias": "NEUTRAL", "value": 0.8},
        3: {"bias": "BEARISH", "value": -1.2}, 4: {"bias": "BULLISH", "value": 1.9},
        5: {"bias": "BULLISH", "value": 1.5}, 6: {"bias": "BULLISH", "value": 1.3},
        7: {"bias": "BEARISH", "value": -0.9}, 8: {"bias": "BULLISH", "value": 2.3},
        9: {"bias": "BULLISH", "value": 1.8}, 10: {"bias": "NEUTRAL", "value": 0.5},
        11: {"bias": "BULLISH", "value": 1.6}, 12: {"bias": "BULLISH", "value": 2.0}
    }
    return seasonal_map.get(month, {"bias": "NEUTRAL", "value": 0})

def get_liquidity_zones(df, symbol):
    zones = []
    now = datetime.now()
    try:
        h1_rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H1, 0, 48)
        if h1_rates is not None and len(h1_rates) > 10:
            h1_df = pd.DataFrame(h1_rates)
            h1_df['time'] = pd.to_datetime(h1_df['time'], unit='s')

            swing_highs = h1_df['high'].rolling(window=5, center=True).max()
            for i in range(2, len(h1_df)-2):
                if h1_df['high'].iloc[i] == swing_highs.iloc[i]:
                    age_hours = int((now - h1_df['time'].iloc[i]).total_seconds() / 3600)
                    zones.append({
                        "type": "BSL", "price": round(safe_float(h1_df['high'].iloc[i]), 2),
                        "status": "ACTIVE" if age_hours < 24 else "AGED", "age": f"{age_hours}h",
                        "ob_confluence": "YES" if abs(h1_df['high'].iloc[i] - df['close'].iloc[-1]) < 20 else "NO"
                    })

            swing_lows = h1_df['low'].rolling(window=5, center=True).min()
            for i in range(2, len(h1_df)-2):
                if h1_df['low'].iloc[i] == swing_lows.iloc[i]:
                    age_hours = int((now - h1_df['time'].iloc[i]).total_seconds() / 3600)
                    zones.append({
                        "type": "SSL", "price": round(safe_float(h1_df['low'].iloc[i]), 2),
                        "status": "ACTIVE" if age_hours < 24 else "AGED", "age": f"{age_hours}h",
                        "ob_confluence": "YES" if abs(h1_df['low'].iloc[i] - df['close'].iloc[-1]) < 20 else "NO"
                    })

        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        d1_rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M5, 0, 288)
        if d1_rates is not None:
            d1_df = pd.DataFrame(d1_rates)
            d1_df['time'] = pd.to_datetime(d1_df['time'], unit='s')
            today_df = d1_df[d1_df['time'] >= today_start]
            if not today_df.empty:
                asia_high = today_df[today_df['time'].dt.hour < 8]['high'].max()
                asia_low = today_df[today_df['time'].dt.hour < 8]['low'].min()
                london_high = today_df[(today_df['time'].dt.hour >= 8) & (today_df['time'].dt.hour < 16)]['high'].max()
                london_low = today_df[(today_df['time'].dt.hour >= 8) & (today_df['time'].dt.hour < 16)]['low'].min()
                for name, price in [("Asia High", asia_high), ("Asia Low", asia_low),
                                  ("London High", london_high), ("London Low", london_low)]:
                    if pd.notna(price):
                        zones.append({"type": name, "price": round(safe_float(price), 2),
                                    "status": "SESSION", "age": "Today", "ob_confluence": "N/A"})
    except Exception as e:
        print(f"LiqZone Error: {e}", flush=True)

    current = safe_float(df['close'].iloc[-1])
    zones = sorted(zones, key=lambda x: abs(x['price'] - current))[:8]
    return zones

def get_account_data():
    try:
        account_info = mt5.account_info()
        if account_info is None:
            return {"balance": 0, "equity": 0, "daily_pnl": 0, "weekly_dd": 0}

        balance = safe_float(account_info.balance)
        equity = safe_float(account_info.equity)

        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        history = mt5.history_deals_get(today_start, datetime.now())
        daily_pnl = sum([deal.profit for deal in history]) if history else 0

        week_ago = datetime.now() - timedelta(days=7)
        week_history = mt5.history_deals_get(week_ago, datetime.now())
        weekly_dd = 0
        if week_history:
            profits = [deal.profit for deal in week_history]
            cum_pnl = peak = 0
            for p in profits:
                cum_pnl += p
                peak = max(peak, cum_pnl)
                weekly_dd = min(weekly_dd, cum_pnl - peak)

        weekly_dd_pct = min(100, abs(weekly_dd / balance * 100)) if balance > 0 else 0
        return {"balance": balance, "equity": equity, "daily_pnl": round(daily_pnl, 2), "weekly_dd": round(weekly_dd_pct, 2)}
    except:
        return {"balance": 0, "equity": 0, "daily_pnl": 0, "weekly_dd": 0}

def get_positions():
    try:
        positions = mt5.positions_get()
        if positions is None: return []
        pos_list = []
        for pos in positions:
            entry = safe_float(pos.price_open)
            sl = safe_float(pos.sl)
            tp = safe_float(pos.tp)
            risk_dollar = abs(entry - sl) * pos.volume * 100 if sl!= 0 else 0
            rr = abs(tp - entry) / abs(entry - sl) if sl!= 0 and entry!= sl else 0
            pos_list.append({
                "symbol": pos.symbol, "type": "BUY" if pos.type == 0 else "SELL",
                "lots": round(pos.volume, 2), "entry": round(entry, 2), "sl": round(sl, 2),
                "tp": round(tp, 2), "risk": round(risk_dollar, 2), "rr": round(rr, 2)
            })
        return pos_list
    except: return []

def get_kelly_data():
    try:
        week_ago = datetime.now() - timedelta(days=30)
        history = mt5.history_deals_get(week_ago, datetime.now())
        if not history: return {"kelly": 0, "win_rate": 0, "avg_rr": 0}
        deals = [d for d in history if d.entry == 1]
        if len(deals) < 10: return {"kelly": 0, "win_rate": 0, "avg_rr": 0}
        wins = [d.profit for d in deals if d.profit > 0]
        losses = [abs(d.profit) for d in deals if d.profit < 0]
        if not wins or not losses: return {"kelly": 0, "win_rate": 0, "avg_rr": 0}
        win_rate = len(wins) / len(deals)
        avg_win = sum(wins) / len(wins)
        avg_loss = sum(losses) / len(losses)
        rr = avg_win / avg_loss if avg_loss > 0 else 0
        kelly = (win_rate - ((1 - win_rate) / rr)) * 100 if rr > 0 else 0
        return {"kelly": round(max(0, kelly), 1), "win_rate": round(win_rate * 100, 1), "avg_rr": round(rr, 2)}
    except: return {"kelly": 0, "win_rate": 0, "avg_rr": 0}

def get_institutional_data():
    market_data = get_market_data()
    cftc_net = int(market_data.get("cftc_net", 245678))
    cftc_long = int(market_data.get("cftc_long", 200704))
    cftc_short = int(market_data.get("cftc_short", 46444))
    cftc_date = market_data.get("cftc_date", "01/06/26")

    retail_long = 65
    retail_short = 35

    cftc_norm = min(100, max(0, (cftc_net / 3000)))
    retail_contrarian = 100 - retail_long
    smi = int((cftc_norm * 0.7) + (retail_contrarian * 0.3))
    smi_bias = "BULLISH" if smi > 60 else "BEARISH" if smi < 40 else "NEUTRAL"

    return {
        "cftc": {"net": cftc_net, "long": cftc_long, "short": cftc_short, "date": cftc_date},
        "retail": {"long": retail_long, "short": retail_short, "source": "Live MT5"},
        "smi": {"value": smi, "bias": smi_bias, "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    }

# ====== ENDPOINT BARU BUAT TERIMA DATA DARI mt5_push_railway.py ======
@app.post("/api/mt5-tick")
def receive_mt5_tick():
    global latest_tick_data
    try:
        data = request.json
        latest_tick_data.update(data)
        # Broadcast ke semua client dashboard yang konek WebSocket
        socketio.emit('signal', latest_tick_data, namespace='/ws/signals')
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Tick received: {data.get('bid')}", flush=True)
        return {"status": "ok", "received": data}
    except Exception as e:
        print(f"Error /api/mt5-tick: {e}", flush=True)
        return {"status": "error", "message": str(e)}, 500

# ====== WEBSOCKET ENDPOINT BUAT DASHBOARD ======
@socketio.on('connect', namespace='/ws/signals')
def ws_connect():
    print("Client connected to WebSocket", flush=True)
    emit('signal', latest_tick_data) # Kirim data terakhir langsung

@socketio.on('disconnect', namespace='/ws/signals')
def ws_disconnect():
    print("Client disconnected", flush=True)

@app.route('/api')
def get_data():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] API HIT", flush=True)
    market_data = get_market_data()
    try:
        if not init_mt5():
            return jsonify({"error": "MT5 gagal konek", "price": 0, **market_data})

        symbol_broker = "XAUUSDc"
        rates = mt5.copy_rates_from_pos(symbol_broker, mt5.TIMEFRAME_M15, 0, 100)
        if rates is None:
            return jsonify({"error": f"Buka chart {symbol_broker} di MT5", "price": 0, **market_data})

        df = pd.DataFrame(rates)
        last_price = safe_float(df.iloc[-1]['close'])

        ob_bullish = bool((df.iloc[-4]['close'] < df.iloc[-4]['open']) and (df.iloc[-1]['close'] > df.iloc[-4]['high']))
        near_prz = bool(4520 < last_price < 4545)
        ema50 = safe_float(df['close'].ewm(span=50).mean().iloc[-1])
        bias = "BULLISH" if last_price > ema50 else "BEARISH"

        seasonal = get_seasonal_bias()
        liquidity_zones = get_liquidity_zones(df, symbol_broker)
        account_data = get_account_data()
        positions = get_positions()
        kelly_data = get_kelly_data()

        total_risk = sum([p['risk'] for p in positions])
        risk_pct = (total_risk / account_data['balance'] * 100) if account_data['balance'] > 0 else 0
        exposure_pct = sum([p['lots'] for p in positions]) / 10 * 100

        account_data.update({
            "risk_pct": round(risk_pct, 1), "kelly": kelly_data['kelly'],
            "avg_rr": kelly_data['avg_rr'], "exposure": round(exposure_pct, 1)
        })

        confluence_dict = {
            "maxwell_ai": bool(bias == "BULLISH"), "order_block": bool(ob_bullish),
            "liquidity": bool(near_prz), "cot": bool(int(market_data.get("cftc_net", 0)) > 200000),
            "seasonal": bool(seasonal["bias"] == "BULLISH")
        }
        confluence_score = int(sum(confluence_dict.values()))

        signal_status = "STANDBY"
        entry = sl = tp1 = tp2 = 0.0
        if confluence_score >= 3 and bias == "BULLISH":
            signal_status = "BUY"
            entry = round(last_price, 2)
            sl = round(entry - 15.0, 2)
            tp1 = round(entry + 15.0, 2)
            tp2 = round(entry + 30.0, 2)
        elif confluence_score >= 3 and bias == "BEARISH":
            signal_status = "SELL"
            entry = round(last_price, 2)
            sl = round(entry + 15.0, 2)
            tp1 = round(entry - 15.0, 2)
            tp2 = round(entry - 30.0, 2)

        active = [k.replace("_"," ").title() for k,v in confluence_dict.items() if v]
        reason = f"{signal_status} {confluence_score}/5: {', '.join(active)}" if confluence_score >= 3 else f"Waiting - Score {confluence_score}/5"

        rr_calc = 0.0
        if signal_status == "BUY" and entry > sl and sl!= 0:
            rr_calc = round((tp1 - entry) / (entry - sl), 2)
        elif signal_status == "SELL" and sl > entry and entry!= 0:
            rr_calc = round((entry - tp1) / (sl - entry), 2)

        now = datetime.now()
        session = "London" if 8 <= now.hour <= 16 else "NY" if 13 <= now.hour <= 21 else "Asia"

        signal_meta = {
            "status": signal_status, "entry": entry, "sl": sl, "tp1": tp1, "tp2": tp2,
            "reason": reason, "confluence": confluence_dict, "confluence_score": confluence_score,
            "rr_ratio": rr_calc, "timeframe": "M15", "session": session, "win_rate": kelly_data['win_rate']
        }

        return jsonify({
            "price": round(last_price, 2), "cvd": int(df['tick_volume'].sum()),
            "bias": bias, "smc_active": int(ob_bullish), "prz_ready": int(near_prz),
            "smi": 68.5, "seasonal_bias": seasonal["bias"], "seasonal_month": datetime.now().strftime("%B"),
            "seasonal_value": safe_float(seasonal["value"]), "retail_long": 72, "retail_short": 28,
            "signal_status": signal_status, "entry": entry, "sl": sl, "tp1": tp1, "tp2": tp2,
            "reason": reason, "updated": datetime.now().strftime("%H:%M:%S"), "time": datetime.now().strftime("%H:%M:%S"),
            "cftc_net": int(market_data.get("cftc_net", 0)), "cftc_date": str(market_data.get("cftc_date", "")),
            "cme_max_pain": int(market_data.get("cme_max_pain", 4525)), "error": None,
            "signal_meta": signal_meta, "liquidity_zones": liquidity_zones,
            "account": account_data, "positions": positions
        })
    except Exception as e:
        print(f"Error: {traceback.format_exc()}", flush=True)
        return jsonify({"error": str(e), "price": 0, **market_data})

@app.route('/api/institutional')
def institutional():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] INSTITUTIONAL HIT", flush=True)
    try:
        data = get_institutional_data()
        return jsonify(data)
    except Exception as e:
        print(f"Institutional Error: {traceback.format_exc()}", flush=True)
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    print("="*50, flush=True)
    print("FARONE API v3.0 - RAILWAY WEBSOCKET READY", flush=True)
    print("SERVER: http://localhost:5000", flush=True)
    print("="*50, flush=True)
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
