@echo off
echo ========================================
echo WASAPI Capture Auto-Compiler
echo ========================================

:: check for cl.exe (Visual Studio)
where cl.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Found MSVC (cl.exe)
    echo Compiling wasapi_capture.cpp...
    cl.exe /O2 /EHsc wasapi_capture.cpp /link /out:wasapi_capture.exe ole32.lib advapi32.lib

    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] Compilation complete: wasapi_capture.exe
        exit /b 0
    ) else (
        echo [ERROR] Compilation failed.
        exit /b 1
    )
)

:: check for g++ (MinGW)
where g++ >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Found g++
    echo Compiling wasapi_capture.cpp...
    g++ -O2 -o wasapi_capture.exe wasapi_capture.cpp -lole32 -lmfplat -lmf -lmfreadwrite -lwmcodecdspuuid -luuid
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] Compilation complete: wasapi_capture.exe
        exit /b 0
    ) else (
        echo [ERROR] Compilation failed.
        exit /b 1
    )
)

echo [WARNING] No compiler found in PATH.
echo.
echo To compile this tool, please open a "Developer Command Prompt for VS 2019/2022"
echo and run this script again, or run:
echo.
echo   cl /O2 /EHsc wasapi_capture.cpp
echo.
echo Press any key to exit...
pause
exit /b 1
