Set s = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
s.Run """C:\mekanizm-whatsapp\start.bat""", 0, False
For Each l In Array("p1", "p2")
  If fso.FolderExists("C:\mkwa-personal\session-" & l) Then s.Run """C:\mekanizm-whatsapp\start-personal.bat"" " & l, 0, False
Next
