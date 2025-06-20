@echo off
setlocal enabledelayedexpansion

:: This script gathers the content of specific project files (.bat, .html, package.json)
:: into a single text file for easy sharing and context provision.

:: Define the name of the output file.
set "outputFile=project_context.txt"

:: Create or overwrite the output file with a header indicating when it was generated.
> "%outputFile%" echo REM Project Context File Generated on %date% at %time%
echo. >> "%outputFile%"

:: --- Section for .bat files ---
echo [INFO] Looking for .bat files...
echo ======================================== >> "%outputFile%"
echo           BATCH SCRIPT FILES (.bat)      >> "%outputFile%"
echo ======================================== >> "%outputFile%"
echo. >> "%outputFile%"

:: Loop through all .bat files in the current directory.
for %%f in (*.bat) do (
    :: Check to make sure the script doesn't copy itself into the output file.
    if /i not "%%~nxf" == "%~nx0" (
        echo Writing contents of %%f...
        echo -------------------- FILE: %%f -------------------- >> "%outputFile%"
        echo. >> "%outputFile%"
        type "%%f" >> "%outputFile%"
        echo. >> "%outputFile%"
        echo. >> "%outputFile%"
    )
)

:: --- Section for .html files ---
echo [INFO] Looking for .html files...
echo ======================================== >> "%outputFile%"
echo              HTML FILES (.html)          >> "%outputFile%"
echo ======================================== >> "%outputFile%"
echo. >> "%outputFile%"

:: Loop through all .html files in the current directory.
for %%f in (*.html) do (
    echo Writing contents of %%f...
    echo -------------------- FILE: %%f -------------------- >> "%outputFile%"
    echo. >> "%outputFile%"
    type "%%f" >> "%outputFile%"
    echo. >> "%outputFile%"
    echo. >> "%outputFile%"
)

:: --- Section for .css files ---
echo [INFO] Looking for .css files...
echo ======================================== >> "%outputFile%"
echo              CSS FILES (.css)           >> "%outputFile%"
echo ======================================== >> "%outputFile%"
echo. >> "%outputFile%"

:: Loop through all .html files in the current directory.
for %%f in (*.css) do (
    echo Writing contents of %%f...
    echo -------------------- FILE: %%f -------------------- >> "%outputFile%"
    echo. >> "%outputFile%"
    type "%%f" >> "%outputFile%"
    echo. >> "%outputFile%"
    echo. >> "%outputFile%"
)

:: --- Section for .js files ---
echo [INFO] Looking for .js files...
echo ======================================== >> "%outputFile%"
echo            JAVASCRIPT FILES (.js)      >> "%outputFile%"
echo ======================================== >> "%outputFile%"
echo. >> "%outputFile%"

:: Loop through all .js files in the current directory.
for %%f in (js\*.js) do (
    echo Writing contents of %%f...
    echo -------------------- FILE: %%f -------------------- >> "%outputFile%"
    echo. >> "%outputFile%"
    type "%%f" >> "%outputFile%"
    echo. >> "%outputFile%"
    echo. >> "%outputFile%"
)

:: --- Section for package.json ---
echo [INFO] Looking for package.json...
if exist "package.json" (
    echo Writing contents of package.json...
    echo ======================================== >> "%outputFile%"
    echo               PACKAGE.JSON               >> "%outputFile%"
    echo ======================================== >> "%outputFile%"
    echo. >> "%outputFile%"
    echo -------------------- FILE: package.json -------------------- >> "%outputFile%"
    echo. >> "%outputFile%"
    type "package.json" >> "%outputFile%"
    echo. >> "%outputFile%"
    echo. >> "%outputFile%"
) else (
    echo [INFO] package.json not found. Skipping.
)

echo.
echo =========================================================
echo  All done!
echo  The contents have been written to the file: %outputFile%
echo =========================================================
echo.

:: Pause to allow the user to see the output before the window closes.
pause
