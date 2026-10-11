@echo off
rem Uploads the Steam build (steam\content\windows + steam\content\linux) with SteamPipe, from Windows.
rem
rem   steam\upload.bat <steam_build_account> [--beta <branch>] [--preview] [--desc "text"]
rem
rem   steam\upload.bat mybuilduser --preview      dry run: checks every file, uploads nothing (logs in steam\output)
rem   steam\upload.bat mybuilduser --beta beta    upload and set the build live on the "beta" branch
rem   steam\upload.bat mybuilduser                upload only; set it live by hand in Steamworks > SteamPipe > Builds
rem
rem No password here or in any file: steamcmd asks for it, and for the Steam Guard code, the first time,
rem then remembers the login on this computer. steamcmd is looked up in %STEAMCMD%, then on the PATH,
rem then in steam\steamcmd\steamcmd.exe.
rem
rem Linux depot: Windows does not keep the Unix "executable" permission. Uploading the Linux depot from
rem Windows can leave scrapbot-city not executable, and then the game does not start on Linux and Steam Deck.
rem Prefer steam/upload.sh on Linux, macOS or WSL; this script asks before going on.
setlocal EnableExtensions
set "HERE=%~dp0"
set "GENERATED=%HERE%sdk\app_build.generated.vdf"

if "%~1"=="" goto usage
if "%~1"=="-h" goto usage
if "%~1"=="--help" goto usage
set "FIRST=%~1"
if "%FIRST:~0,1%"=="-" (
  echo The first argument must be your Steam build account name ^(see steam\README.md^).
  exit /b 2
)
set "STEAM_USER=%~1"

where node >nul 2>nul
if errorlevel 1 (
  echo node was not found: it is needed for the checks ^(the same Node.js used for npm run dist:steam^).
  exit /b 1
)

if not defined STEAMCMD (
  for /f "delims=" %%P in ('where steamcmd.exe 2^>nul') do if not defined STEAMCMD set "STEAMCMD=%%P"
)
if not defined STEAMCMD if exist "%HERE%steamcmd\steamcmd.exe" set "STEAMCMD=%HERE%steamcmd\steamcmd.exe"

rem Checks the IDs, the content folders and the options, then writes sdk\app_build.generated.vdf.
node "%HERE%prepare-upload.cjs" %*
if errorlevel 1 exit /b 1

if not defined STEAMCMD goto nosteamcmd
if not exist "%STEAMCMD%" goto nosteamcmd

echo.
echo WARNING: the Linux depot is uploaded from Windows. If Linux or Steam Deck testers report that the game
echo does not start, upload again with steam/upload.sh from Linux, macOS or WSL (steam\README.md).
choice /C YN /M "Upload anyway"
if errorlevel 2 (
  del /q "%GENERATED%" 2>nul
  exit /b 1
)

if not exist "%HERE%output" mkdir "%HERE%output"
echo.
echo Running %STEAMCMD%
echo Log in as %STEAM_USER%: steamcmd asks for the password and the Steam Guard code the first time.
echo.
"%STEAMCMD%" +login %STEAM_USER% +run_app_build "%GENERATED%" +quit
set "STATUS=%ERRORLEVEL%"
del /q "%GENERATED%" 2>nul
echo.
if "%STATUS%"=="0" (
  echo steamcmd finished. Look above for "Successfully finished AppID ... build (BuildID ...)";
  echo the build is then listed in Steamworks ^> SteamPipe ^> Builds. Logs: steam\output
) else (
  echo steamcmd failed ^(exit code %STATUS%^). Read the messages above and the logs in steam\output;
  echo steam\README.md lists the usual causes.
)
exit /b %STATUS%

:nosteamcmd
del /q "%GENERATED%" 2>nul
echo.
echo steamcmd was not found. Install it once ^(steam\README.md, step 3^):
echo   download https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip
echo   and unzip it into %HERE%steamcmd ^(so that steamcmd.exe is %HERE%steamcmd\steamcmd.exe^),
echo   or set STEAMCMD to the full path of steamcmd.exe.
exit /b 1

:usage
echo Usage: steam\upload.bat ^<steam_build_account^> [--beta ^<branch^>] [--preview] [--desc "text"]
echo.
echo   steam\upload.bat mybuilduser --preview      dry run: checks every file, uploads nothing (logs in steam\output)
echo   steam\upload.bat mybuilduser --beta beta    upload and set the build live on the "beta" branch
echo   steam\upload.bat mybuilduser                upload only; set it live in Steamworks ^> SteamPipe ^> Builds
echo.
echo No password: steamcmd asks for it the first time. Full guide: steam\README.md
exit /b 2
