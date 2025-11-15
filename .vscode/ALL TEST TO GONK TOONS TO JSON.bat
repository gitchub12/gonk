:: BROWSERFIREFOXHIDE Run-TOON-to-JSON.bat 
@echo off
echo =========================================================
echo  STEP 1: Copying .js and .html from GONKTEST -> GONK...
echo =========================================================
:: /E copies all subfolders
:: /IS overwrites files even if they are the same
:: /NFL /NDL /NJH /NJS makes the log output clean
robocopy "E:\gonktest" "E:\gonk" *.js /E /IS /NFL /NDL /NJH /NJS
robocopy "E:\gonktest" "E:\gonk" *.html /E /IS /NFL /NDL /NJH /NJS
echo.
echo =========================================================
echo  STEP 2: Converting TOON -> JSON...
echo =========================================================
:: This calls the script from your permanent tools folder
node "E:\gonk_tools\toon-to-json.js"
echo.
echo ---
echo ALL STEPS COMPLETE. Press any key to exit.
pause > nul