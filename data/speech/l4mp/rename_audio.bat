@echo off
setlocal enabledelayedexpansion

for %%F in (*-101soundboards*.mp3) do (
    set "old=%%~nxF"
    set "new=!old:-101soundboards(1)=!"
    set "new=!new:-101soundboards=!"

    if exist "!new!" (
        echo [DELETE] "!old!" exists as "!new!" already
        del "%%~fF"
    ) else (
        echo [RENAME] "!old!" --> "!new!"
        ren "%%~fF" "!new!"
    )
)

echo Done.
pause
