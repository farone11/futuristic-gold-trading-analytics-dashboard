@echo off
cd /d C:\Users\DELL\Desktop\futuristic-gold-trading-analytics-dashboard
echo ========================================
echo FARONE GOLD AI - AUTO UPDATE ALL DATA
echo ========================================
echo.

python mt5_liquidity.py
python mt5_delta.py
python mt5_orderblock.py
python mt5_cot.py
python mt5_seasonal.py

echo Pushing to GitHub...
git add *.json
git commit -m "Auto Update All Data %date% %time% [skip ci]"
git push origin master

echo Done! Dashboard updated: %date% %time%
pause