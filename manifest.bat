@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Portable Manifest Creation Script for Windows Batch
:: v2.1 - Corrected JSON string building to remove extra escapes.
:: ============================================================================
::
:: This script scans the folder it is currently in for image files and 
:: creates a 'manifest.json' file in this same folder.
::
:: USAGE:
:: Just drop this .bat file into any folder of images and double-click it.
::
:: ============================================================================


:: Set the target directory to the script's own directory.
set "target_directory=%~dp0"

echo Processing folder: %target_directory%

set "output_file=%target_directory%manifest.json"
set "json_list="

echo.
echo Finding images in this directory...

for /F "delims=" %%f in ('dir /b /a-d /o:n "%target_directory%*.jpg" "%target_directory%*.jpeg" "%target_directory%*.png" "%target_directory%*.gif" "%target_directory%*.webp" 2^>nul') do (
    
    set "current_filename=%%~nxf"

    :: Exclude the script's own name from the list.
    if /i not "!current_filename!"=="%~nx0" (
        echo   Found: !current_filename!
    
        :: Correctly build the JSON list without escape characters
        if not defined json_list (
            set "json_list="!current_filename!""
        ) else (
            set "json_list=!json_list!,"!current_filename!""
        )
    )
)

:: If at least one file was found, write the final JSON.
echo.
echo Writing manifest to: %output_file%

:: Write the final, complete JSON string to the manifest file.
(echo {"images":[!json_list!]}) > "%output_file%"

echo.
echo ==================================================
echo  Success! Manifest created successfully.
echo ==================================================
echo.

timeout /t 3 /nobreak >nul

endlocal
