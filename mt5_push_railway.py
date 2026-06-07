"""
mt5_push_railway.py
====================
MT5 Real-time Data Pusher → Railway API
Jalankan di Windows PC dengan MetaTrader 5 untuk push live data ke dashboard.

SETUP:
  1. pip install MetaTrader5 requests pandas
  2. Buka MetaTrader 5, login ke akun broker
  3. Buka chart XAUUSD atau XAUUSDc (sesuaikan di config)
  4. python mt5_push_railway.py

TROUBLESHOOTING:
  - Jika error "Chart not found", pastikan chart sudah dibuka di MT5
  - Jika error koneksi Railway, cek internet dan URL yang benar
  - Monitor logs untuk debug setiap push
"""

import MetaTrader5 as mt5
import requests
import time
import json
from datetime import datetime, timedelta
import pandas as pd
import traceback
from typing import Dict, List, Optional

# ===== KONFIGURASI =====
RAILWAY_URL = "https://future-production-67e6.up.railway.app"
SYMBOL = "XAUUSDc"  # Sesuaikan: XAUUSD, XAUUSDm, XAUUSDc, GOLD, dll
PUSH_INTERVAL = 2   # Detik - jangan terlalu cepat (API rate limit)
TIMEOUT = 5         # Request timeout
DEBUG = True        # Print debug info
# =======================

# ===== UTILITY FUNCTIONS =====
def safe_float(val, default=0.0) -> float:
    """Konversi ke float dengan fallback"""
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0) -> int:
    """Konversi ke int dengan fallback"""
    try:
        return int(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def log(msg: str, level: str = "INFO"):
    """Log dengan timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    prefix = f"[{timestamp}]"
    if level == "ERROR":
        print(f"❌ {prefix} {msg}")
    elif level == "SUCCESS":
        print(f"✅ {prefix} {msg}")
    elif level == "WARNING":
        print(f"⚠️  {prefix} {msg}")
    else:
        print(f"ℹ️  {prefix} {msg}")

# ===== MT5 DATA EXTRACTION =====
def get_price_data() -> Optional[Dict]:
    """Ambil data tick terbaru dari MT5"""
    try:
        tick = mt5.symbol_info_tick(SYMBOL)
        if tick is None:
            log(f"Tick null untuk {SYMBOL}. Pastikan chart sudah dibuka di MT5!", "WARNING")
            return None
        
        return {
            "bid": safe_float(tick.bid),
            "ask": safe_float(tick.ask),
            "price": safe_float(tick.bid),
            "symbol": SYMBOL,
            "time": safe_int(tick.time),
            "volume": safe_float(tick.volume),
        }
    except Exception as e:
        log(f"Error get_price_data: {e}", "ERROR")
        return None

def get_candle_data(timeframe=mt5.TIMEFRAME_M15, count=100) -> Optional[pd.DataFrame]:
    """Ambil historical candles untuk analisis"""
    try:
        rates = mt5.copy_rates_from_pos(SYMBOL, timeframe, 0, count)
        if rates is None or len(rates) == 0:
            log(f"Tidak ada data candle untuk {SYMBOL} {timeframe}", "WARNING")
            return None
        return pd.DataFrame(rates)
    except Exception as e:
        log(f"Error get_candle_data: {e}", "ERROR")
        return None

def get_signal(df: pd.DataFrame, price: float, cftc_net: int = 245678) -> Dict:
    """Hitung signal confluence 5-layer"""
    try:
        if df is None or len(df) < 50:
            return {"signal_status": "STANDBY", "confluence_score": 0}
        
        # 1. Maxwell AI - EMA bias
        ema50 = safe_float(df['close'].ewm(span=50).mean().iloc[-1])
        ema20 = safe_float(df['close'].ewm(span=20).mean().iloc[-1])
        bias = "BULLISH" if price > ema50 else "BEARISH"
        
        # 2. Order Block detection
        ob_bullish = False
        if len(df) > 4:
            prev_candle = df.iloc[-4]
            last_candle = df.iloc[-1]
            ob_bullish = bool(
                prev_candle['close'] < prev_candle['open'] and
                last_candle['close'] > prev_candle['high']
            )
        
        # 3. Liquidity zones proximity
        support = df['low'].tail(20).min()
        resistance = df['high'].tail(20).max()
        near_level = bool(abs(price - support) < 20 or abs(price - resistance) < 20)
        
        # 4. COT (Commitments of Traders)
        cot_bullish = bool(cftc_net > 200000)
        
        # 5. Seasonal bias
        month = datetime.now().month
        seasonal_bullish = month in [1, 4, 5, 6, 8, 9, 11, 12]
        
        # Calculate confluence score
        confluence = {
            "maxwell_ai": bias == "BULLISH",
            "order_block": ob_bullish,
            "liquidity": near_level,
            "cot": cot_bullish,
            "seasonal": seasonal_bullish,
        }
        score = sum(confluence.values())
        
        # Generate signal
        signal_status = "STANDBY"
        entry = sl = tp1 = tp2 = 0.0
        reason = f"Score {score}/5"
        
        active_confluence = [k.replace("_", " ").title() for k, v in confluence.items() if v]
        
        if score >= 3:
            if bias == "BULLISH":
                signal_status = "BUY"
                entry = round(price, 2)
                sl = round(entry - 15.0, 2)
                tp1 = round(entry + 15.0, 2)
                tp2 = round(entry + 30.0, 2)
                reason = f"BUY signal {score}/5: {', '.join(active_confluence)}"
            elif bias == "BEARISH":
                signal_status = "SELL"
                entry = round(price, 2)
                sl = round(entry + 15.0, 2)
                tp1 = round(entry - 15.0, 2)
                tp2 = round(entry - 30.0, 2)
                reason = f"SELL signal {score}/5: {', '.join(active_confluence)}"
        else:
            reason = f"Waiting - Score {score}/5 ({', '.join(active_confluence) if active_confluence else 'No confluence'})"
        
        # Determine session
        now = datetime.now()
        if 8 <= now.hour < 16:
            session = "London"
        elif 13 <= now.hour < 21:
            session = "New York"
        else:
            session = "Asia"
        
        return {
            "signal_status": signal_status,
            "bias": bias,
            "entry": entry,
            "sl": sl,
            "tp1": tp1,
            "tp2": tp2,
            "reason": reason,
            "confluence_score": score,
            "session": session,
            "confluence": confluence,
        }
    except Exception as e:
        log(f"Error get_signal: {e}", "ERROR")
        return {"signal_status": "STANDBY", "confluence_score": 0}

def get_account_info() -> Dict:
    """Ambil info akun dari MT5"""
    try:
        info = mt5.account_info()
        if info is None:
            return {
                "balance": 0, "equity": 0, "daily_pnl": 0,
                "weekly_dd": 0, "risk_pct": 0, "kelly": 2.5,
                "avg_rr": 1.5, "exposure": 0
            }
        
        balance = safe_float(info.balance)
        equity = safe_float(info.equity)
        
        # Calculate daily P&L
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        history = mt5.history_deals_get(today_start, datetime.now()) or []
        daily_pnl = sum(safe_float(d.profit) for d in history)
        
        # Calculate risk metrics
        positions = mt5.positions_get() or []
        total_risk = 0
        total_exposure = 0
        total_rr = 0
        
        for p in positions:
            entry = safe_float(p.price_open)
            sl = safe_float(p.sl)
            if sl and entry != sl:
                risk = abs(entry - sl) * safe_float(p.volume) * 100
                total_risk += risk
                total_exposure += safe_float(p.volume)
        
        risk_pct = (total_risk / balance * 100) if balance > 0 else 0
        exposure = (total_exposure / 10 * 100) if total_exposure > 0 else 0
        
        return {
            "balance": round(balance, 2),
            "equity": round(equity, 2),
            "daily_pnl": round(daily_pnl, 2),
            "weekly_dd": abs(round((balance - equity) / balance * 100, 1)) if balance > 0 else 0,
            "risk_pct": round(risk_pct, 1),
            "kelly": 2.5,
            "avg_rr": 1.5,
            "exposure": round(exposure, 1),
        }
    except Exception as e:
        log(f"Error get_account_info: {e}", "ERROR")
        return {
            "balance": 0, "equity": 0, "daily_pnl": 0,
            "weekly_dd": 0, "risk_pct": 0, "kelly": 0,
            "avg_rr": 0, "exposure": 0
        }

def get_positions() -> List[Dict]:
    """Ambil daftar posisi open dari MT5"""
    try:
        positions = mt5.positions_get() or []
        result = []
        
        for p in positions:
            entry = safe_float(p.price_open)
            sl = safe_float(p.sl)
            tp = safe_float(p.tp)
            volume = safe_float(p.volume)
            
            if sl and entry != sl:
                risk = abs(entry - sl) * volume * 100
                rr = abs(tp - entry) / abs(entry - sl) if tp else 0
            else:
                risk = 0
                rr = 0
            
            result.append({
                "symbol": p.symbol,
                "type": "BUY" if p.type == 0 else "SELL",
                "lots": round(volume, 2),
                "entry": round(entry, 2),
                "sl": round(sl, 2) if sl else 0,
                "tp": round(tp, 2) if tp else 0,
                "risk": round(risk, 2),
                "rr": round(rr, 2),
            })
        
        return result
    except Exception as e:
        log(f"Error get_positions: {e}", "ERROR")
        return []

def get_liquidity_zones(df: pd.DataFrame, price: float) -> List[Dict]:
    """Ekstrak liquidity zones dari H1 dan session levels"""
    zones = []
    try:
        if df is None or len(df) < 10:
            return zones
        
        now = datetime.now()
        
        # H1 swing highs & lows
        try:
            h1_rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_H1, 0, 48)
            if h1_rates is not None:
                h1df = pd.DataFrame(h1_rates)
                h1df['time'] = pd.to_datetime(h1df['time'], unit='s')
                
                swing_hi = h1df['high'].rolling(5, center=True).max()
                swing_lo = h1df['low'].rolling(5, center=True).min()
                
                for i in range(2, min(len(h1df) - 2, 20)):  # Limit untuk performa
                    if h1df['high'].iloc[i] == swing_hi.iloc[i]:
                        age_h = int((now - h1df['time'].iloc[i]).total_seconds() / 3600)
                        if age_h <= 48:  # Max 48 jam
                            zones.append({
                                "type": "BSL",
                                "price": round(safe_float(h1df['high'].iloc[i]), 2),
                                "status": "ACTIVE" if age_h < 24 else "AGED",
                                "age": f"{age_h}h",
                                "ob_confluence": "YES" if abs(h1df['high'].iloc[i] - price) < 20 else "NO"
                            })
                    
                    if h1df['low'].iloc[i] == swing_lo.iloc[i]:
                        age_h = int((now - h1df['time'].iloc[i]).total_seconds() / 3600)
                        if age_h <= 48:
                            zones.append({
                                "type": "SSL",
                                "price": round(safe_float(h1df['low'].iloc[i]), 2),
                                "status": "ACTIVE" if age_h < 24 else "AGED",
                                "age": f"{age_h}h",
                                "ob_confluence": "YES" if abs(h1df['low'].iloc[i] - price) < 20 else "NO"
                            })
        except Exception as e:
            log(f"Error extracting H1 zones: {e}", "WARNING")
        
        # Session levels (dari M5 hari ini)
        try:
            m5_rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M5, 0, 288)
            if m5_rates is not None:
                m5df = pd.DataFrame(m5_rates)
                m5df['time'] = pd.to_datetime(m5df['time'], unit='s')
                
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                today_df = m5df[m5df['time'] >= today_start]
                
                if not today_df.empty:
                    # Asia session (00:00 - 08:00)
                    asia_df = today_df[today_df['time'].dt.hour < 8]
                    if not asia_df.empty:
                        zones.append({
                            "type": "Asia High",
                            "price": round(safe_float(asia_df['high'].max()), 2),
                            "status": "SESSION",
                            "age": "Today",
                            "ob_confluence": "N/A"
                        })
                        zones.append({
                            "type": "Asia Low",
                            "price": round(safe_float(asia_df['low'].min()), 2),
                            "status": "SESSION",
                            "age": "Today",
                            "ob_confluence": "N/A"
                        })
                    
                    # London session (08:00 - 16:00)
                    london_df = today_df[(today_df['time'].dt.hour >= 8) & (today_df['time'].dt.hour < 16)]
                    if not london_df.empty:
                        zones.append({
                            "type": "London High",
                            "price": round(safe_float(london_df['high'].max()), 2),
                            "status": "SESSION",
                            "age": "Today",
                            "ob_confluence": "N/A"
                        })
                        zones.append({
                            "type": "London Low",
                            "price": round(safe_float(london_df['low'].min()), 2),
                            "status": "SESSION",
                            "age": "Today",
                            "ob_confluence": "N/A"
                        })
        except Exception as e:
            log(f"Error extracting session levels: {e}", "WARNING")
        
        # Sort by proximity to current price dan limit hasil
        zones = sorted(zones, key=lambda x: abs(x['price'] - price))[:12]
        
        return zones
    except Exception as e:
        log(f"Error get_liquidity_zones: {e}", "ERROR")
        return zones

def get_seasonal_data() -> Dict:
    """Hitung seasonal bias untuk emas"""
    month = datetime.now().month
    
    seasonal_map = {
        1: {"bias": "BULLISH", "value": 2.1},
        2: {"bias": "NEUTRAL", "value": 0.8},
        3: {"bias": "BEARISH", "value": -1.2},
        4: {"bias": "BULLISH", "value": 1.9},
        5: {"bias": "BULLISH", "value": 1.5},
        6: {"bias": "BULLISH", "value": 1.3},
        7: {"bias": "BEARISH", "value": -0.9},
        8: {"bias": "BULLISH", "value": 2.3},
        9: {"bias": "BULLISH", "value": 1.8},
        10: {"bias": "NEUTRAL", "value": 0.5},
        11: {"bias": "BULLISH", "value": 1.6},
        12: {"bias": "BULLISH", "value": 2.0},
    }
    
    data = seasonal_map.get(month, {"bias": "NEUTRAL", "value": 0})
    return {
        "seasonal_bias": data["bias"],
        "seasonal_value": data["value"],
        "seasonal_month": datetime.now().strftime("%B"),
    }

# ===== MAIN PUSH FUNCTION =====
def push_data_to_railway() -> bool:
    """Kumpulkan semua data dan push ke Railway API"""
    try:
        # Ambil data
        price_data = get_price_data()
        if not price_data:
            return False
        
        df = get_candle_data()
        signal_data = get_signal(df, price_data["price"])
        account_data = get_account_info()
        positions_data = get_positions()
        zones_data = get_liquidity_zones(df, price_data["price"])
        seasonal_data = get_seasonal_data()
        
        # Build payload
        payload = {
            # Price data
            **price_data,
            
            # Signal & confluence
            **signal_data,
            
            # Account & positions
            "account": account_data,
            "positions": positions_data,
            
            # Market data
            "retail_long": 65,  # Fallback - bisa diupdate dari external API
            "retail_short": 35,
            "cftc_net": 245678,  # Fallback - fetch dari CFTC jika tersedia
            "cftc_date": datetime.now().strftime("%d/%m/%y"),
            "cme_max_pain": 4525,  # Fallback
            
            # Seasonal
            **seasonal_data,
            
            # Liquidity
            "liquidity_zones": zones_data,
            
            # Meta
            "updated": datetime.now().strftime("%H:%M:%S"),
        }
        
        # Push ke Railway
        response = requests.post(
            f"{RAILWAY_URL}/api/mt5-tick",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            if DEBUG:
                log(f"Push OK | {SYMBOL} ${price_data['price']:.2f} | {signal_data.get('signal_status', 'STANDBY')} | Pos:{len(positions_data)}", "SUCCESS")
            return True
        else:
            log(f"HTTP {response.status_code} - {response.text[:100]}", "ERROR")
            return False
            
    except requests.exceptions.ConnectionError:
        log(f"Connection error ke {RAILWAY_URL}", "ERROR")
        return False
    except requests.exceptions.Timeout:
        log("Request timeout", "ERROR")
        return False
    except Exception as e:
        log(f"Push error: {e}\n{traceback.format_exc()}", "ERROR")
        return False

# ===== MAIN LOOP =====
def main():
    print("\n" + "="*60)
    print("🚀 FARONE MT5 REAL-TIME PUSHER → RAILWAY")
    print("="*60)
    print(f"Railway URL : {RAILWAY_URL}")
    print(f"Symbol      : {SYMBOL}")
    print(f"Interval    : {PUSH_INTERVAL} detik")
    print(f"Debug       : {DEBUG}")
    print("="*60 + "\n")
    
    # Initialize MT5
    if not mt5.initialize():
        log("MT5 gagal initialize. Pastikan MetaTrader 5 sudah dibuka & login.", "ERROR")
        log("Tips: Buka chart XAUUSD/XAUUSDc di MT5 sebelum jalankan script ini", "WARNING")
        return
    
    account = mt5.account_info()
    if account:
        log(f"MT5 Connected | Server: {account.server} | Account: {account.login}", "SUCCESS")
    
    fail_count = 0
    max_fails = 10
    
    try:
        while True:
            success = push_data_to_railway()
            
            if success:
                fail_count = 0
            else:
                fail_count += 1
                if fail_count >= max_fails:
                    log(f"⚠️  {max_fails} push failures in a row. Check Railway status or internet connection.", "WARNING")
                    fail_count = 0  # Reset untuk terus retry
            
            time.sleep(PUSH_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Script dihentikan oleh user")
    except Exception as e:
        log(f"Fatal error: {e}", "ERROR")
    finally:
        mt5.shutdown()
        log("MT5 disconnected", "WARNING")
        print("\n" + "="*60)
        print("Script selesai")
        print("="*60 + "\n")

if __name__ == "__main__":
    main()
