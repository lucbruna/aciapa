@echo off
title ACIAPA - Build PKG Portavel
cls
echo.
echo  =================================================================
echo   ACIAPA -- Build PKG Portavel
echo  =================================================================
echo.

echo  [1/4] Compilando frontend...
call npm run build
if %errorlevel% neq 0 ( echo  [ERRO] Build falhou! & exit /b 1 )

echo  [2/4] Recompilando better-sqlite3 para Node 18...
cd node_modules\better-sqlite3
npx node-gyp rebuild --target=18.5.0 --arch=x64 --dist-url=https://nodejs.org/dist
if %errorlevel% neq 0 ( echo  [ERRO] Recompilacao falhou! & exit /b 1 )
cd ..\..

echo  [3/4] Empacotando com pkg...
if not exist "dist-exe" mkdir dist-exe
npx pkg server.js --targets node18-win-x64 --output dist-exe\aciapa.exe --compress GZip
if %errorlevel% neq 0 ( echo  [ERRO] PKG falhou! & exit /b 1 )

echo  [4/4] Copiando assets...
if not exist "dist-exe\dist" mkdir dist-exe\dist
xcopy /E /I /Y dist dist-exe\dist > nul
if not exist "dist-exe\node_modules" mkdir dist-exe\node_modules
xcopy /E /I /Y node_modules\better-sqlite3 dist-exe\node_modules\better-sqlite3 > nul

echo  [4b/4] Recompilando better-sqlite3 para Node local...
cd node_modules\better-sqlite3
npx node-gyp rebuild > nul 2>&1
cd ..\..

echo.
echo  =================================================================
echo   Build concluido com sucesso!
echo.
echo   Para executar:
echo     cd dist-exe
echo     aciapa.exe
echo.
echo   Ou use o atalho: dist-exe\run.bat
echo  =================================================================
pause
