@echo off
chcp 65001 >nul
title LAO 3Kingdom
cd /d "%~dp0"
where py >nul 2>nul && (py -3 tools\launch.py & goto :eof)
where python >nul 2>nul && (python tools\launch.py & goto :eof)
echo Python 3 is not installed. Install it from https://www.python.org/downloads/ and run again.
pause
