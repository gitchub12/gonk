@echo off
setlocal enabledelayedexpansion

:: Initialize counter
set /a counter=1

:: Loop through PNG files in alphabetical order
for %%f in (*.png) do (
    ren "%%f" "irongolem!counter!.png"
    set /a counter+=1
)

echo Done renaming files.
pause
