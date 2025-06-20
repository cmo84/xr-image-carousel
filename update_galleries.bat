@echo off
setlocal

:: ============================================================================
:: Scans for valid galleries and updates the master 'galleries.json' file.
:: Place this script in the root project folder.
:: v3.2 - Prints found galleries to the console.
:: ============================================================================

:: --- Using simple relative paths, as the script is run from the root folder ---
set "images_dir=images"
set "output_file=galleries.json"

echo Scanning for galleries in the 'images' subfolder...
echo.

:: Check if the images directory exists
if not exist "%images_dir%" (
    echo [ERROR] 'images' directory not found next to the script.
    goto :error_exit
)

:: --- Use PowerShell for robust directory scanning and JSON creation ---
powershell -ExecutionPolicy Bypass -Command ^
    "$imagesPath = '%images_dir%';" ^
    "$galleries = Get-ChildItem -Path $imagesPath -Directory | ForEach-Object {" ^
    "    if (Test-Path -Path (Join-Path -Path $_.FullName -ChildPath 'manifest.json')) {" ^
    "        $_.Name;" ^
    "    }" ^
    "} | Sort-Object;" ^
    "if ($galleries) {" ^
    "    Write-Host '[INFO] Found the following valid galleries:';" ^
    "    $galleries | ForEach-Object { Write-Host ('  - ' + $_) };" ^
    "    $jsonObject = @{ galleries = $galleries };" ^
    "    $jsonObject | ConvertTo-Json -Compress | Set-Content -Path '%output_file%';" ^
    "    Write-Host '[SUCCESS] galleries.json has been updated successfully.';" ^
    "} else {" ^
    "    '{\"galleries\":[]}' | Set-Content -Path '%output_file%';" ^
    "    Write-Host '[INFO] No valid galleries with manifest.json were found. Created an empty galleries.json.';" ^
    "}"

if %errorlevel% neq 0 (
    echo [ERROR] PowerShell script failed. Please check for error messages above.
    goto :error_exit
)

echo.
echo ==================================================
echo  Script finished.
echo ==================================================
echo.
goto :success_pause

:error_exit
echo.
echo [FAILURE] The script encountered an error or was canceled.
echo Please review the messages above to diagnose the issue.
echo The window will not close until you press a key.
pause

:success_pause
echo Press any key to close this window.
pause >nul
