:: BROWSERFIREFOXHIDE Run-JSON-to-TOON.bat 
@echo off
echo =========================================================
echo  STEP 1: Copying .js and .html from GONK -> GONKTEST...
echo =========================================================
:: /E copies all subfolders
:: /IS overwrites files even if they are the same
:: /NFL /NDL /NJH /NJS makes the log output clean
robocopy "E:\gonk" "E:\gonktest" *.js /E /IS /NFL /NDL /NJH /NJS
robocopy "E:\gonk" "E:\gonktest" *.html /E /IS /NFL /NDL /NJH /NJS
echo.
echo =========================================================
echo  STEP 2: Converting JSON -> TOON...
echo =========================================================
:: This calls the script from your permanent tools folder
node "E:\gonk_tools\json-to-toon.js"
echo.
echo ---
echo ALL STEPS COMPLETE. Press any key to exit.
pause > nul