; Lumina Studio Plus installer hooks.
; Electron refuses to start when the install folder's ACL has an AppContainer
; package SID but no ALL APPLICATION PACKAGES (S-1-15-2-1) entry: its sandboxed
; processes cannot read the program files. Grant read/execute (what Program
; Files grants by default). The SID form works on every Windows language.
!macro customInstall
  DetailPrint "Granting ALL APPLICATION PACKAGES read access to $INSTDIR"
  nsExec::ExecToLog '"$SYSDIR\icacls.exe" "$INSTDIR" /grant *S-1-15-2-1:(OI)(CI)(RX) /Q'
  Pop $0
  DetailPrint "icacls exit code: $0"
!macroend
