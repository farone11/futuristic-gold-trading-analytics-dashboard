from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import traceback
import logging
import time
from threading import Lock

# ===== LOGGING SETUP =====
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# MetaTrader5 hanya tersedia di Windows, Railway = Linux
MT5_AVAILABLE = False
mt5 = None
try:
    import MetaTrader5 as mt5_module
    mt5 = mt5_module
    MT5_AVAILABLE = True
    logger.info("✅ MetaTrader5 tersedia (Windows mode)")
except ImportError:
    logger.info("⚠  MetaTrader5 tidak tersedia (Linux/Railway mode - gunakan /api/mt5-tick push)")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False,
)

MT5_INITIALIZED = False
tick_data_lock = Lock()
last_broadcast_time = 0

# Global data buat WebSocket
latest_tick_data = {
    "symbol": "XAUUSDc", "bid": 0, "ask": 0, "time": 0,
    "balance": 0, "equity": 0, "profit": 0, "price": 0,
    "retail_long": 65, "retail_short": 35,
    "signal_status": "STANDBY", "entry": 0, "sl": 0, "tp1": 0, "tp2": 0,
    "reason": "Waiting for MT5 data...",
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
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    try:
        return int(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def init_mt5():
    global MT5_INITIALIZED
    if not MT5_AVAILABLE:
        return False
    if not MT5_INITIALIZED:
        try:
            if not mt5.initialize():
                logger.error("❌ MT5 Initialize gagal")
                return False
            MT5_INITIALIZED = True
            logger.info("✅ MT5 Connected")
        except Exception as e:
            logger.error(f"MT5 init error: {e}")
            return False
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
        except Exception as e:
            logger.warning(f"Error reading market_data.json: {e}")
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

# ====== ENDPOINT: TERIMA DATA PUSH DARI mt5_push_railway.py ======
@app.route("/api/mt5-tick", methods=["POST"])
def receive_mt5_tick():
    global latest_tick_data, last_broadcast_time
    try:
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "No JSON data"}), 400
        
        with tick_data_lock:
            latest_tick_data.update(data)
            latest_tick_data["price"] = data.get("bid", latest_tick_data.get("price", 0))
            if "balance" in data:
                latest_tick_data["balance"] = data["balance"]
            elif "account" in data and isinstance(data["account"], dict):
                latest_tick_data["balance"] = data["account"].get("balance", 0)
            latest_tick_data["updated"] = datetime.now().strftime("%H:%M:%S")
        
        now_ts = time.time()
        if now_ts - last_broadcast_time >= 1.0:
            socketio.emit('signal', latest_tick_data, namespace='/ws/signals')
            last_broadcast_time = now_ts
        
        balance = latest_tick_data.get("balance", 0)
        logger.info(f"✅ Tick received | Price: ${data.get('bid', 0):.2f} | Bal: ${balance:.0f}")
        return jsonify({"status": "ok", "timestamp": latest_tick_data["updated"]})
        
    except Exception as e:
        logger.error(f"❌ Error /api/mt5-tick: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

# ====== WEBSOCKET ======
@socketio.on('connect', namespace='/ws/signals')
def ws_connect():
    logger.info("✅ WebSocket client connected")
    with tick_data_lock:
        emit('signal', latest_tick_data.copy())

@socketio.on('disconnect', namespace='/ws/signals')
def ws_disconnect():
    logger.info("⚠  WebSocket client disconnected")

# ====== ENDPOINT UTAMA ======
@app.route('/api')
@app.route('/api/dashboard')  # Alias biar nggak 404
def get_data():
    try:
        market_data = get_market_data()
        seasonal = get_seasonal_bias()
        
        # Mode 1: MT5 langsung
        if MT5_AVAILABLE and init_mt5():
            try:
                symbol_broker = "XAUUSDc"
                rates = mt5.copy_rates_from_pos(symbol_broker, mt5.TIMEFRAME_M15, 0, 100)
                if rates is not None and len(rates) > 0:
                    df = pd.DataFrame(rates)
                    last_price = safe_float(df.iloc[-1]['close'])
                    ob_bullish = False
                    if len(df) > 4:
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
                    logger.info(f"📊 API (MT5 mode) | {signal_status} | Score: {confluence_score}/5")
                    
                    return jsonify({
                        "price": round(last_price, 2),
                        "bias": bias,
                        "smc_active": int(ob_bullish),
                        "signal_status": signal_status,
                        "entry": entry,
                        "sl": sl,
                        "tp1": tp1,
                        "tp2": tp2,
                        "confluence_score": confluence_score,
                        "session": session,
                        "seasonal_bias": seasonal["bias"],
                        "seasonal_value": safe_float(seasonal["value"]),
                        "retail_long": latest_tick_data.get("retail_long", 65),
                        "retail_short": latest_tick_data.get("retail_short", 35),
                        "cftc_net": int(market_data.get("cftc_net", 0)),
                        "cftc_date": str(market_data.get("cftc_date", "")),
                        "cme_max_pain": int(market_data.get("cme_max_pain", 4525)),
                        "account": latest_tick_data.get("account", {}),
                        "positions": latest_tick_data.get("positions", []),
                        "liquidity_zones": latest_tick_data.get("liquidity_zones", []),
                        "updated": now.strftime("%H:%M:%S"),
                        "error": None,
                        "mode": "live_mt5"
                    })
            except Exception as e:
                logger.warning(f"⚠  MT5 live mode error: {e}")

        # Mode 2: Push dari mt5_push_railway.py
        with tick_data_lock:
            tick = latest_tick_data.copy()
        
        logger.info(f"📊 API (push mode) | {tick.get('signal_status', 'STANDBY')}")
        
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
            "error": None,
            "mode": "pushed_data"
        })
        
    except Exception as e:
        logger.error(f"❌ API error: {e}", exc_info=True)
        return jsonify({"error": str(e), "message": "Internal server error"}), 500

@app.route('/api/signals')
def get_signals():
    return get_data()

@app.route('/api/liquidity')
@app.route('/api/liquidity-zones')
def get_liquidity():
    try:
        with tick_data_lock:
            tick = latest_tick_data.copy()

        zones = tick.get("liquidity_zones", [])
        # Fix: Frontend minta price_zone + obConfluence camelCase
        for z in zones:
            if 'price' in z and 'price_zone' not in z:
                z['price_zone'] = z['price']
            if 'ob_confluence' in z and 'obConfluence' not in z:
                z['obConfluence'] = z['ob_confluence']

        bsl_zones = [z for z in zones if z.get("type") == "BSL"]
        ssl_zones = [z for z in zones if z.get("type") == "SSL"]
        session_types = {"Asia High", "Asia Low", "London High", "London Low", "NY High", "NY Low"}
        session_zones = [z for z in zones if z.get("type") in session_types]
        active_zones = [z for z in zones if z.get("status") == "ACTIVE"]

        def extract_session(high_key, low_key):
            h = next((z["price"] for z in zones if z.get("type") == high_key), None)
            l = next((z["price"] for z in zones if z.get("type") == low_key), None)
            mid = round((h + l) / 2, 2) if h and l else None
            rng = round((h - l) * 10, 1) if h and l else None
            return {"high": h, "low": l, "mid": mid, "range": rng}

        asia_session = extract_session("Asia High", "Asia Low")
        london_session = extract_session("London High", "London Low")
        ny_session = extract_session("NY High", "NY Low")

        return jsonify({
            "buy_side_count": len(bsl_zones),
            "sell_side_count": len(ssl_zones),
            "session_count": len(session_zones),
            "active_zones": len(active_zones),
            "zones": zones,
            "liquidity_zones": zones,
            "asia_session": asia_session,
            "london_session": london_session,
            "new_york_session": ny_session,
            "timestamp": tick.get("updated", "--:--:--"),
        })
    except Exception as e:
        logger.error(f"❌ Liquidity error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/institutional')
def institutional():
    try:
        data = get_institutional_data()
        logger.info(f"📊 Institutional data | SMI: {data['smi']['value']} ({data['smi']['bias']})")
        return jsonify(data)
    except Exception as e:
        logger.error(f"❌ Institutional error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/account')
def get_account():
    with tick_data_lock:
        return jsonify(latest_tick_data.get("account", {}))

@app.route('/api/positions')
def get_positions():
    with tick_data_lock:
        return jsonify({"positions": latest_tick_data.get("positions", [])})

@app.route('/api/signal')
def get_signal():
    with tick_data_lock:
        tick = latest_tick_data.copy()
    return jsonify({
        "signal_status": tick.get("signal_status", "STANDBY"),
        "bias": tick.get("bias", "NEUTRAL"),
        "entry": tick.get("entry", 0),
        "sl": tick.get("sl", 0),
        "tp1": tick.get("tp1", 0),
        "tp2": tick.get("tp2", 0),
        "reason": tick.get("reason", ""),
        "confluence_score": tick.get("confluence_score", 0),
        "session": tick.get("session", "Asia")
    })

@app.route('/health')
def health():
    return jsonify({
        "status": "ok",
        "mode": "MT5" if MT5_AVAILABLE else "Push",
        "mt5_available": MT5_AVAILABLE,
        "mt5_connected": MT5_INITIALIZED,
        "latest_update": latest_tick_data.get("updated", "N/A"),
        "price": latest_tick_data.get("price", 0),
        "zones_count": len(latest_tick_data.get("liquidity_zones", [])),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/')
def index():
    return jsonify({
        "service": "FARONE Gold Trading Analytics API",
        "version": "3.3",
        "endpoints": {
            "/api": "Get latest trading data",
            "/api/dashboard": "Alias for /api",
            "/api/liquidity-zones": "BSL/SSL + Session levels",
            "/api/signal": "Current BUY/SELL signal",
            "/api/account": "Balance/equity",
            "/api/institutional": "COT + SMI data",
            "/api/mt5-tick": "Receive MT5 tick push (POST)",
            "/health": "Health check",
            "ws://*/ws/signals": "WebSocket real-time"
        }
    })

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 FARONE API v3.3 - RAILWAY READY")
    print("="*60)
    print(f"Mode: {'MT5 Windows' if MT5_AVAILABLE else 'Push from mt5_push_railway.py'}")
    print("="*60 + "\n")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=False,
        use_reloader=False
    )
