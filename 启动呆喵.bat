@echo off
chcp 65001 >nul
rem 切换到脚本所在目录（%~dp0），使 bat 在任何位置都能运行
cd /d "%~dp0"
start "" /B npx electron .
