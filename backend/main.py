from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import traceback
 
# MetaTrader5 hanya tersedia di Windows, Railway = Linux
# Jadi kita import dengan fallback graceful
MT5_AVAILABLE = False
mt5 = None
try:
    import MetaTrader5 as mt5_module
    mt5 = mt5_module
    MT5_AVAILABLE = True
    print("MetaTrader5 tersedia", flush=True)
except ImportError:
    print("MetaTrader5 tidak tersedia (Linux/Railway mode - gunakan /api/mt5-tick push)", flush=True)
 
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
 
MT5_INITIALIZED = False
 
# Global data buat WebSocket (diisi oleh mt5_push_railway.py dari Windows)
latest_tick_data = {
    "symbol": "XAUUSD", "bid": 0, "ask": 0, "time": 0,
    "balance": 0, "equity": 0, "profit": 0, "price": 0,
    "retail_long": 65, "retail_short": 35,
    "signal_status": "STANDBY", "entry": 0, "sl": 0, "tp1": 0, "tp2": 0,
    "reason": "Menunggu data dari MT5...",
    "confluence_score": 0, "rr_ratio": 0,
    "cftc_net": 245678, "cftc_long": 200704, "cftc_short": 46444,
    "cftc_date": "01/06/26", "cme_max_pain": 4525,
    "bias": "NEUTRAL", "session": "Asia",
    "seasonal_bias": "BULLISH", "seasonal_value": 1.3,
    "account": {"balance": 0, "equity": 0, "daily_pnl": 0, "weekly_dd": 0, "risk_pct": 0, "kelly": 0, "avg_rr": 0, "exposure": 0},
    "positions": [],
    "liquidity_zones": [],
    "updated": "--:--:--"
}
 
def safe_float(val, default=0.0):
    try: return float(val)
    except: return default
 
def init_mt5():
    global MT5_INITIALIZED
    if not MT5_AVAILABLE:
        return False
    if not MT5_INITIALIZED:
        if not mt5.initialize():
            print("MT5 Initialize GAGAL", flush=True)
            return False
        MT5_INITIALIZED = True
        print("MT5 Connected", flush=True)
    return True
 
def get_market_data():
    default = {
        "cftc_net": latest_tick_data.get("cftc_net", 245678),
        "cftc_date": latest_tick_data.get("cftc_date", "01/06/26"),
        "cme_max_pain": latest_tick_data.get("cme_max_pain", 4525),
        "cftc_long": latest_tick_data.get("cftc_long", 200704),
        "cftc_short": latest_tick_data.get("cftc_short", 46444)
    }
    data_path = os.path.join(os.path.dirname(__file__), 'data', 'market_data.json')
    if os.path.exists(data_path):
        try:
            with open(data_path, 'r') as f:
                data = json.load(f)
                return {**default, **data}
        except:
            return default
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
 
def get_institutional_data():
    market_data = get_market_data()
    cftc_net = int(market_data.get("cftc_net", 245678))
    cftc_long = int(market_data.get("cftc_long", 200704))
    cftc_short = int(market_data.get("cftc_short", 46444))
    cftc_date = market_data.get("cftc_date", "01/06/26")
 
    retail_long = latest_tick_data.get("retail_long", 65)
    retail_short = latest_tick_data.get("retail_short", 35)
 
    cftc_norm = min(100, max(0, (cftc_net / 3000)))
    retail_contrarian = 100 - retail_long
    smi = int((cftc_norm * 0.7) + (retail_contrarian * 0.3))
    smi_bias = "BULLISH" if smi > 60 else "BEARISH" if smi < 40 else "NEUTRAL"
 
    return {
        "cftc": {"net": cftc_net, "long": cftc_long, "short": cftc_short, "date": cftc_date},
        "retail": {"long": retail_long, "short": retail_short, "source": "Live MT5"},
        "smi": {"value": smi, "bias": smi_bias, "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    }
 
# ====== ENDPOINT: TERIMA DATA PUSH DARI mt5_push_railway.py (Windows) ======
@app.route("/api/mt5-tick", methods=["POST"])
def receive_mt5_tick():
    global latest_tick_data
    try:
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "No JSON data"}), 400
        latest_tick_data.update(data)
        latest_tick_data["price"] = data.get("bid", latest_tick_data.get("price", 0))
        latest_tick_data["updated"] = datetime.now().strftime("%H:%M:%S")
        # Broadcast ke semua client WebSocket
        socketio.emit('signal', latest_tick_data, namespace='/ws/signals')
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Tick: {data.get('bid')} Bal:{data.get('balance')}", flush=True)
        return jsonify({"status": "ok"})
    except Exception as e:
        print(f"Error /api/mt5-tick: {e}", flush=True)
        return jsonify({"status": "error", "message": str(e)}), 500
 
# ====== WEBSOCKET ======
@socketio.on('connect', namespace='/ws/signals')
def ws_connect():
    print("Client connected to WebSocket", flush=True)
    emit('signal', latest_tick_data)
 
@socketio.on('disconnect', namespace='/ws/signals')
def ws_disconnect():
    print("Client disconnected", flush=True)
 
# ====== ENDPOINT UTAMA ======
@app.route('/api')
def get_data():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] API HIT", flush=True)
    market_data = get_market_data()
    seasonal = get_seasonal_bias()
 
    # Kalau ada MT5 langsung (Windows), gunakan live. Kalau tidak, pakai latest_tick_data
    if MT5_AVAILABLE and init_mt5():
        try:
            symbol_broker = "XAUUSDc"
            rates = mt5.copy_rates_from_pos(symbol_broker, mt5.TIMEFRAME_M15, 0, 100)
            if rates is not None:
                df = pd.DataFrame(rates)
                last_price = safe_float(df.iloc[-1]['close'])
                ob_bullish = bool((df.iloc[-4]['close'] < df.iloc[-4]['open']) and (df.iloc[-1]['close'] > df.iloc[-4]['high']))
                ema50 = safe_float(df['close'].ewm(span=50).mean().iloc[-1])
                bias = "BULLISH" if last_price > ema50 else "BEARISH"
 
                confluence_dict = {
                    "maxwell_ai": bool(bias == "BULLISH"),
                    "order_block": bool(ob_bullish),
                    "liquidity": bool(4520 < last_price < 4545),
                    "cot": bool(int(market_data.get("cftc_net", 0)) > 200000),
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
 
                now = datetime.now()
                session = "London" if 8 <= now.hour <= 16 else "NY" if 13 <= now.hour <= 21 else "Asia"
 
                return jsonify({
                    "price": round(last_price, 2),
                    "bias": bias, "smc_active": int(ob_bullish),
                    "signal_status": signal_status, "entry": entry, "sl": sl, "tp1": tp1, "tp2": tp2,
                    "confluence_score": confluence_score, "session": session,
                    "seasonal_bias": seasonal["bias"], "seasonal_value": safe_float(seasonal["value"]),
                    "retail_long": latest_tick_data.get("retail_long", 65),
                    "retail_short": latest_tick_data.get("retail_short", 35),
                    "cftc_net": int(market_data.get("cftc_net", 0)),
                    "cftc_date": str(market_data.get("cftc_date", "")),
                    "cme_max_pain": int(market_data.get("cme_max_pain", 4525)),
                    "account": latest_tick_data.get("account", {}),
                    "positions": latest_tick_data.get("positions", []),
                    "liquidity_zones": latest_tick_data.get("liquidity_zones", []),
                    "updated": now.strftime("%H:%M:%S"), "error": None
                })
        except Exception as e:
            print(f"MT5 live error: {e}", flush=True)
 
    # ---- FALLBACK: Railway Linux mode, data dari push ----
    tick = latest_tick_data
    return jsonify({
        "price": tick.get("price", tick.get("bid", 0)),
        "bias": tick.get("bias", "NEUTRAL"),
        "smc_active": 0,
        "signal_status": tick.get("signal_status", "STANDBY"),
        "entry": tick.get("entry", 0),
        "sl": tick.get("sl", 0),
        "tp1": tick.get("tp1", 0),
        "tp2": tick.get("tp2", 0),
        "confluence_score": tick.get("confluence_score", 0),
        "session": tick.get("session", "Asia"),
        "seasonal_bias": seasonal["bias"],
        "seasonal_value": safe_float(seasonal["value"]),
        "retail_long": tick.get("retail_long", 65),
        "retail_short": tick.get("retail_short", 35),
        "cftc_net": int(market_data.get("cftc_net", 245678)),
        "cftc_date": str(market_data.get("cftc_date", "01/06/26")),
        "cme_max_pain": int(market_data.get("cme_max_pain", 4525)),
        "account": tick.get("account", {}),
        "positions": tick.get("positions", []),
        "liquidity_zones": tick.get("liquidity_zones", []),
        "updated": tick.get("updated", "--:--:--"),
        "error": None
    })
 
@app.route('/api/signals')
def get_signals():
    """Alias untuk /api - dipakai beberapa halaman frontend"""
    return get_data()
 
@app.route('/api/institutional')
def institutional():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] INSTITUTIONAL HIT", flush=True)
    try:
        data = get_institutional_data()
        return jsonify(data)
    except Exception as e:
        print(f"Institutional Error: {traceback.format_exc()}", flush=True)
        return jsonify({"error": str(e)})
 
@app.route('/health')
def health():
    return jsonify({"status": "ok", "mt5_available": MT5_AVAILABLE, "mt5_connected": MT5_INITIALIZED})
 
if __name__ == '__main__':
    print("="*50, flush=True)
    print("FARONE API v3.1 - RAILWAY WEBSOCKET READY", flush=True)
    print("="*50, flush=True)
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
