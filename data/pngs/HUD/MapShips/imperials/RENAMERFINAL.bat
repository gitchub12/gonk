@echo off
setlocal enabledelayedexpansion

:: ====================================
:: >>>>> CONFIGURATION <<<<<
set "BASENAME=droidship"
set "FILETYPE=png"
set "STARTNUM=1"
set "PADDING=2"
:: PADDING: 2=01-99, 3=001-999, 4=0001-9999
:: ====================================

echo.
echo ========================================
echo Sequential File Renamer
echo ========================================
echo Basename: %BASENAME%
echo Filetype: *.%FILETYPE%
echo Starting: %STARTNUM%
echo Padding:  %PADDING% digits
echo ========================================
echo.

:: Count files
set "TOTALFILES=0"
for %%f in (*.%FILETYPE%) do set /a TOTALFILES+=1

if %TOTALFILES%==0 (
    echo No .%FILETYPE% files found.
    pause
    exit /b
)

echo Found %TOTALFILES% .%FILETYPE% files.
echo.

:: PASS 1: Rename with zero-padded temp names
echo Pass 1: Creating temp files...
for %%f in (*.%FILETYPE%) do (
    set "name=%%~nf"
    
    :: Use PowerShell to extract just the numbers
    for /f %%n in ('powershell -command "if ('!name!' -match '\d+') { [int]($matches[0]) } else { 99999 }"') do set "num=%%n"
    
    :: Pad to 10 digits
    set "padded=0000000000!num!"
    set "padded=!padded:~-10!"
    
    ren "%%f" "temp_!padded!.%FILETYPE%"
)

echo Pass 1 complete.
echo.

:: PASS 2: Rename to final format
echo Pass 2: Final renaming...
set "COUNTER=%STARTNUM%"

for /f "tokens=*" %%f in ('dir /b /on temp_*.%FILETYPE%') do (
    set "NUM=!COUNTER!"
    if %PADDING%==2 if !COUNTER! LSS 10 set "NUM=0!COUNTER!"
    if %PADDING%==3 (
        if !COUNTER! LSS 10 set "NUM=00!COUNTER!"
        if !COUNTER! GEQ 10 if !COUNTER! LSS 100 set "NUM=0!COUNTER!"
    )
    if %PADDING%==4 (
        if !COUNTER! LSS 10 set "NUM=000!COUNTER!"
        if !COUNTER! GEQ 10 if !COUNTER! LSS 100 set "NUM=00!COUNTER!"
        if !COUNTER! GEQ 100 if !COUNTER! LSS 1000 set "NUM=0!COUNTER!"
    )
    
    echo [!NUM!] --^> %BASENAME%_!NUM!.%FILETYPE%
    ren "%%f" "%BASENAME%_!NUM!.%FILETYPE%"
    set /a COUNTER+=1
)

echo.
echo ========================================
echo Done! Renamed !TOTALFILES! files.
echo ========================================
echo.
pause