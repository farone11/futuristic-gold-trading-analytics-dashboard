@echo off
cd /d C:\Users\DELL\Desktop\futuristic-gold-trading-analytics-dashboard
echo ========================================
echo FARONE GOLD AI - AUTO UPDATE ALL DATA
echo ========================================
echo.

echo [1/4] Running Liquidity Scanner...
python mt5_liquidity.py

echo [2/4] Running CVD Scanner...
python mt5_delta.py

echo [3/4] Running Order Block Scanner...
python mt5_orderblock.py

echo [4/4] Running COT Scanner...
python mt5_cot.py

echo [5/5] Pushing to GitHub...
git add *.json
git commit -m "Auto Update All Data %date% %time% [skip ci]"
git push origin master

echo.
echo ========================================
echo Done! Dashboard updated: %date% %time%
echo ========================================
pause