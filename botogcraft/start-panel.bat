@echo off
set "NODE=C:\Program Files\nodejs\node.exe"
set "NPM=C:\Program Files\nodejs\npm.cmd"
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0bot"
if not exist node_modules call "%NPM%" install
cd /d "%~dp0panel"
"%NODE%" server.js
if errorlevel 1 pause
