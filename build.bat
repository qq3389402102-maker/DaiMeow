@echo off
chcp 65001 >nul
rem DaiMeow 本地打包脚本
rem 用法：双击或命令行执行 build.bat
rem 输出：release/ 目录下的安装包和 portable exe

cd /d "%~dp0"

echo [1/3] 安装依赖...
call npm install
if errorlevel 1 (
    echo 依赖安装失败
    pause
    exit /b 1
)

echo [2/3] 构建 pet 渲染器...
call npm run build:pet
if errorlevel 1 (
    echo pet 渲染器构建失败
    pause
    exit /b 1
)

echo [3/3] 打包 EXE...
call npm run dist
if errorlevel 1 (
    echo 打包失败
    pause
    exit /b 1
)

echo.
echo 打包完成！输出目录：release\
dir /b release\*.exe 2>nul
pause
