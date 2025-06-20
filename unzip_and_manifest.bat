@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Unzips all archives in the 'images' subfolder and generates manifests.
:: Place this script in the directory ONE LEVEL ABOVE your 'images' folder.
:: v2.2 - Corrected JSON string building to remove extra escapes.
:: ============================================================================

:: Set the base directory to the script's location
set "base_dir=%~dp0"
:: Set the target directory for images and archives
set "images_dir=%base_dir%images\"

echo Processing archives in: %images_dir%
echo.

:: Check if the images directory exists
if not exist "%images_dir%" (
    echo [ERROR] The 'images' subdirectory was not found in '%base_dir%'.
    echo Please make sure this script is in the parent directory of 'images\'.
    echo.
    pause
    exit /b 1
)

:: Loop through all .zip files in the 'images' directory
for %%F in ("%images_dir%*.zip") do (
    set "zip_file=%%~fF"
    set "dir_name=%%~nF"
    set "extract_path=%images_dir%!dir_name!"

    echo [INFO] Found archive: !zip_file!
    
    :: Create the destination directory
    if not exist "!extract_path!" (
        echo   [SETUP] Creating directory: !extract_path!
        mkdir "!extract_path!"
    )

    :: Unzip the file using PowerShell (built into modern Windows)
    echo   [SETUP] Extracting to !extract_path!...
    powershell -ExecutionPolicy Bypass -Command "Expand-Archive -Path '!zip_file!' -DestinationPath '!extract_path!' -Force"
    
    if !errorlevel! neq 0 (
        echo   [ERROR] Failed to extract !zip_file!. Please check if the file is valid and not locked.
    ) else (
        echo   [SUCCESS] Extracted successfully.
        
        :: Check if manifest exists, if not, create it.
        if not exist "!extract_path!\manifest.json" (
            echo   [MANIFEST] 'manifest.json' not found. Generating...
            set "json_list="
            
            :: Scan the new directory for image files
            for /F "delims=" %%f in ('dir /b /a-d /o:n "!extract_path!\*.jpg" "!extract_path!\*.jpeg" "!extract_path!\*.png" "!extract_path!\*.gif" "!extract_path!\*.webp" 2^>nul') do (
                set "current_filename=%%~nxf"
                echo      Found: !current_filename!
                
                :: Correctly build the JSON list without escape characters
                if not defined json_list (
                    set "json_list="!current_filename!""
                ) else (
                    set "json_list=!json_list!,"!current_filename!""
                )
            )
            
            :: Write the manifest file
            if defined json_list (
                (echo {"images":[!json_list!]}) > "!extract_path!\manifest.json"
                echo   [MANIFEST] Created 'manifest.json' in !dir_name!
            ) else (
                echo   [MANIFEST] No images found in !dir_name!. Empty manifest created.
                (echo {"images":[]}) > "!extract_path!\manifest.json"
            )
        ) else (
            echo   [MANIFEST] 'manifest.json' already exists. Skipping generation.
        )
    )
    echo.
)

echo ==================================================
echo  Processing Complete.
echo ==================================================
echo.
echo The window will not close until you press a key.
pause
exit /b 0
