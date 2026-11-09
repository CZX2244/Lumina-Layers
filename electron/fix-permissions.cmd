@echo off
chcp 65001 >nul
rem Lumina Studio Plus: let Electron's sandbox read this folder.
rem Grants ALL APPLICATION PACKAGES (S-1-15-2-1) read/execute only; program files are not changed.
echo.
echo 如果双击 Lumina Studio Plus.exe 没有任何反应，通常是这个文件夹的权限被其它软件改过，
echo Electron 的沙箱读不到程序文件。本脚本只给“所有应用程序包”增加读取/执行权限，不修改程序文件。
echo.
echo 文件夹：%~dp0
echo.
icacls "%~dp0." /grant *S-1-15-2-1:(OI)(CI)(RX) /Q
if errorlevel 1 goto failed
echo.
echo 完成。现在可以运行 Lumina Studio Plus.exe。
goto end
:failed
echo.
echo 没有成功。请把本文件夹移到 C:\LuminaPlus 这类自己的文件夹后再运行本脚本，或改用安装版。
:end
echo.
pause
