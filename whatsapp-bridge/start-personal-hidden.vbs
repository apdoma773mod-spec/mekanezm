Set s = CreateObject("WScript.Shell")
line = "p1"
If WScript.Arguments.Count > 0 Then line = WScript.Arguments(0)
s.Run """C:\mekanizm-whatsapp\start-personal.bat"" " & line, 0, False
