@echo off
setlocal enabledelayedexpansion

:: ====================================
:: >>>>> SET YOUR CUSTOM NAME HERE <<<<<
set "BASENAME=hologonk"
:: >>>>> SET START OFFSET (0 = keep original numbers) <<<<<
set "START=0"
:: ====================================

for %%f in (*.png) do (
    set "name=%%~nf"
    set "ext=%%~xf"

    :: if the filename is numeric, calculate new number
    for /f "tokens=1 delims=" %%n in ("!name!") do (
        set /a newnum=%%n+START
        ren "%%f" "!BASENAME!_!newnum!!ext!"
    )
)

echo Renaming complete. Press any key to exit...
pause >nul
