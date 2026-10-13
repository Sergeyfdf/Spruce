!macro preInit
  SetRegView 64
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Spruce"
  SetRegView 32
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Spruce"
!macroend

!macro customInit
  nsExec::Exec 'taskkill /F /IM Spruce.exe'
  Sleep 500
  SetRegView 64
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Spruce"
  WriteRegStr HKCU "Software\${APP_GUID}" "InstallLocation" "$LOCALAPPDATA\Programs\Spruce"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation" "$LOCALAPPDATA\Programs\Spruce"
  SetRegView 32
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Spruce"
  WriteRegStr HKCU "Software\${APP_GUID}" "InstallLocation" "$LOCALAPPDATA\Programs\Spruce"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation" "$LOCALAPPDATA\Programs\Spruce"
!macroend

!macro customInstall
  ${if} ${Silent}
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  ${endIf}
!macroend
