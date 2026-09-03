@echo off
chcp 65001 >nul
python -X utf8 "%~dp0local_server.py"
if errorlevel 1 pause
