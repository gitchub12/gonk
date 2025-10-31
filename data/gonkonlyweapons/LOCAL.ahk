#NoEnv
#SingleInstance Force
#Persistent
#ClipboardTimeout 2000  ; Wait up to 2 seconds for clipboard access - fixes sporadic clipboard issues
SendMode Input
SetWorkingDir %A_ScriptDir%

; Enhanced SNAP & TEST tool
Gui, Main:New, +AlwaysOnTop +ToolWindow -MaximizeBox -MinimizeBox, SNAP & TEST
Gui, Main:Color, 0x1E1E1E
Gui, Main:Font, s9 Bold c0xFFFFFF, Segoe UI

; Backup status indicator at top (clickable to reset) - shortened text to fit
Gui, Main:Font, s14 Bold c0xFFFFFF, Segoe UI
Gui, Main:Add, Text, x5 y-3 w98 h21 Center VCenter gResetBackupTimer vBackupStatus, B^ 0m
Gui, Main:Font, s9 Bold c0xFFFFFF, Segoe UI

; GAME TEST button (wide)
Gui, Main:Font, s8 Bold c0xFFFFFF, Segoe UI
Gui, Main:Add, Button, x5 y20 w98 h25 gStartTest vTestButton, GAME TEST

; MAIN SNAP button
Gui, Main:Add, Button, x5 y47 w48 h25 gMainSnap vMainSnapButton, MAIN`nSNAP

; BACKUP button (moved to top right)
Gui, Main:Add, Button, x55 y47 w48 h25 gCreateBackup vBackupButton, BACK`nUP

; MID SNAP button
Gui, Main:Add, Button, x5 y74 w48 h25 gMidSnap vMidSnapButton, MID`nSNAP

; KILL button
Gui, Main:Add, Button, x55 y74 w48 h25 gKillAll vKillButton, KILL

; ALL SNAP button
Gui, Main:Add, Button, x5 y101 w48 h25 gAllSnap vAllSnapButton, ALL`nSNAP

; NOTE PASTE button
Gui, Main:Add, Button, x55 y101 w48 h25 gOpenNotes vNotesButton, NOTE`nPASTE

; CLIPBOARD MONITOR toggle button (new)
Gui, Main:Add, Button, x5 y128 w98 h25 gToggleClipboardMonitor vClipMonitorButton, CLIP MON`nOFF
Gui, Main:Font, s9 Bold c0xFFFFFF, Segoe UI

; Show GUI
SysGet, Monitor, MonitorPrimary
SysGet, MonitorWorkArea, MonitorWorkArea, %Monitor%
guiX := MonitorWorkAreaRight - 108 - 20
guiY := (MonitorWorkAreaBottom - MonitorWorkAreaTop - 158) / 2 + MonitorWorkAreaTop  ; Adjusted for new button
Gui, Main:Show, w108 h158 x%guiX% y%guiY%  ; Adjusted height

; Make semi-transparent and always on top
WinSet, Transparent, 51, SNAP & TEST
WinSet, AlwaysOnTop, On, SNAP & TEST

; Variables
serverPID := 0
snapCount := 0
currentPort := 8000
excludePatterns := ".md,.bin,.exe,.dll,.tmp,node_modules,.git,.ahk,.bat,.txt,.ini,.ico"
backupPath := "E:\0gonkdocumentation\checkpoints"
clipboardMonitorActive := false
lastClipboard := ""
lastOpenedFile := ""  ; Track which file we last opened

; Initialize backup timer with proper logic
mostRecentBackupTime := 0
Loop, Files, %backupPath%\*, D
{
    FileGetTime, folderTime, %A_LoopFileFullPath%, M
    if (folderTime > mostRecentBackupTime)
        mostRecentBackupTime := folderTime
}

; Calculate actual time since last backup
if (mostRecentBackupTime > 0) {
    currentTime := A_Now
    EnvSub, currentTime, %mostRecentBackupTime%, Minutes
    actualMinutesSinceBackup := currentTime
} else {
    actualMinutesSinceBackup := 0
}

; At startup, display shows actual time since backup (the BIG scary number)
displayMinutesSinceReset := actualMinutesSinceBackup
lastResetTime := A_TickCount - (actualMinutesSinceBackup * 60000)  ; Set reset time in the past
hasBeenManuallyReset := false

; Start backup timer
SetTimer, UpdateBackupTimer, 30000

return

ToggleClipboardMonitor:
    clipboardMonitorActive := !clipboardMonitorActive
    
    if (clipboardMonitorActive) {
        ; Fix clipboard chain by clearing and resetting
        lastClipboard := ""
        lastOpenedFile := ""  ; Reset the last opened file too
        Clipboard := Clipboard  ; This forces Windows to refresh the clipboard chain
        Sleep, 100
        
        ; Turn on monitoring
        GuiControl, Main:, ClipMonitorButton, CLIP MON`nON
        SetTimer, MonitorClipboard, 500  ; Check every 500ms
        
        ; Get GUI position for tooltip
        Gui, Main:+LastFound
        WinGetPos, guiX, guiY, guiW, guiH
        tooltipX := guiX
        tooltipY := guiY + guiH + 10
        ToolTip, Clipboard monitor ON - Reset clipboard chain, %tooltipX%, %tooltipY%
    } else {
        ; Turn off monitoring
        GuiControl, Main:, ClipMonitorButton, CLIP MON`nOFF
        SetTimer, MonitorClipboard, Off
        
        ; Get GUI position for tooltip
        Gui, Main:+LastFound
        WinGetPos, guiX, guiY, guiW, guiH
        tooltipX := guiX
        tooltipY := guiY + guiH + 10
        ToolTip, Clipboard monitor OFF, %tooltipX%, %tooltipY%
    }
    
    SetTimer, RemoveTooltip, 2000
return

MonitorClipboard:
    ; Always show what's happening
    Gui, Main:+LastFound
    WinGetPos, guiX, guiY, guiW, guiH
    tooltipX := guiX
    tooltipY := guiY + guiH + 10
    
    ; Try to access clipboard with error handling
    currentClip := ""
    clipError := false
    
    ; Method 1: Try ClipboardAll first for large content
    clipSize := StrLen(ClipboardAll)
    if (clipSize > 0) {
        ; For large clipboards, use a different approach
        if (clipSize > 10000) {
            ToolTip, Large clipboard detected (%clipSize% bytes) - processing..., %tooltipX%, %tooltipY%
            Sleep, 100
        }
        
        ; Try multiple times for large content
        Loop, 3 {
            currentClip := Clipboard
            if (currentClip != "") {
                break
            }
            Sleep, 100
        }
    }
    
    ; If still empty, try alternate method
    if (currentClip = "") {
        ; Force clipboard refresh
        ClipWait, 0.5
        currentClip := Clipboard
        
        ; If still empty, check if it's really empty or an error
        if (currentClip = "" && ClipboardAll != "") {
            clipError := true
            clipSize := StrLen(ClipboardAll)
            ToolTip, CLIPBOARD ERROR: Cannot read clipboard (size: %clipSize% bytes)!, %tooltipX%, %tooltipY%
            SetTimer, RemoveTooltip, 5000
            return
        }
    }
    
    ; Show what we got
    clipDisplay := SubStr(currentClip, 1, 50)
    if (StrLen(currentClip) > 50)
        clipDisplay .= "..."
    
    ; Check if changed - use hash for large content
    currentHash := ""
    if (StrLen(currentClip) > 1000) {
        ; For large content, compare first 500 + last 500 chars as a simple hash
        currentHash := SubStr(currentClip, 1, 500) . "..." . SubStr(currentClip, -500)
    } else {
        currentHash := currentClip
    }
    
    ; Check against last clipboard
    if (currentHash = lastClipboard && currentClip != "") {
        ; Still show activity for debugging
        clipLen := StrLen(currentClip)
        ToolTip, Clipboard unchanged (%clipLen% chars): %clipDisplay%, %tooltipX%, %tooltipY%
        SetTimer, RemoveTooltip, 1000
        return
    }
    
    if (currentClip = "") {
        ToolTip, Clipboard empty, %tooltipX%, %tooltipY%
        SetTimer, RemoveTooltip, 1000
        return
    }
    
    ; Update last clipboard with hash
    lastClipboard := currentHash
    
    ; Show we detected a change
    clipLen := StrLen(currentClip)
    ToolTip, CLIPBOARD CHANGED (%clipLen% chars): %clipDisplay%, %tooltipX%, %tooltipY%
    Sleep, 200  ; Brief pause to show the change
    
    ; EXCLUSIONS: Check for patterns to skip
    ; Skip if clipboard contains "js:" (JavaScript error format)
    if (InStr(currentClip, "js:")) {
        ToolTip, Skipped: JS error line format detected, %tooltipX%, %tooltipY%
        SetTimer, RemoveTooltip, 5000
        return
    }
    
    ; Skip if clipboard starts with "Starting enhanced server on port"
    if (InStr(currentClip, "Starting enhanced server on port") = 1) {
        ToolTip, Skipped: Server startup message, %tooltipX%, %tooltipY%
        SetTimer, RemoveTooltip, 5000
        return
    }
    
    ; Get first 3 lines
    StringSplit, clipLines, currentClip, `n, `r
    firstThreeLines := ""
    Loop, 3
    {
        if (A_Index <= clipLines0)
            firstThreeLines .= clipLines%A_Index% . "`n"
    }
    
    ; Look for file patterns in the first 3 lines
    targetPath := ""
    targetFile := ""
    
    ; First check for comment lines with paths
    if (RegExMatch(firstThreeLines, "//\s*([^\s]+\.(js|html|json)\b)", match)) {
        targetPath := match1
        ToolTip, Found file in comment: %targetPath%, %tooltipX%, %tooltipY%
        Sleep, 500
    }
    ; If not found, look for any file pattern
    else if (RegExMatch(firstThreeLines, "([a-zA-Z0-9_\-/\\]+\.(js|html|json)\b)", match)) {
        targetPath := match1
        ToolTip, Found file pattern: %targetPath%, %tooltipX%, %tooltipY%
        Sleep, 500
    }
    
    if (targetPath != "") {
        ; Convert forward slashes to backslashes
        StringReplace, targetPath, targetPath, /, \, All
        
        ; Extract just the filename
        SplitPath, targetPath, targetFile
        
        ; Check if we already opened this file
        if (targetFile = lastOpenedFile) {
            ToolTip, Skipped: %targetFile% already opened, %tooltipX%, %tooltipY%
            SetTimer, RemoveTooltip, 5000
            return
        }
        
        ToolTip, Searching for: %targetFile%..., %tooltipX%, %tooltipY%
        Sleep, 300
        
        ; Track where we searched
        searchLog := "Searched in:`n"
        
        ; First try the full path from script directory
        if (FileExist(A_ScriptDir . "\" . targetPath)) {
            foundPath := A_ScriptDir . "\" . targetPath
            searchLog .= "- Found via full path!`n"
        }
        ; If not found, search for just the filename
        else {
            searchLog .= "- Main folder"
            
            ; Search in main folder
            Loop, Files, %A_ScriptDir%\%targetFile%
            {
                foundPath := A_LoopFileFullPath
                searchLog .= " (FOUND!)`n"
                break
            }
            
            if (foundPath = "")
                searchLog .= " (not found)`n"
            
            ; If not found, search in engine folder
            if (foundPath = "" && FileExist(A_ScriptDir . "\engine")) {
                searchLog .= "- Engine folder"
                Loop, Files, %A_ScriptDir%\engine\%targetFile%, R
                {
                    foundPath := A_LoopFileFullPath
                    searchLog .= " (FOUND!)`n"
                    break
                }
                if (foundPath = "")
                    searchLog .= " (not found)`n"
            }
            
            ; If not found, search in debug folder
            if (foundPath = "" && FileExist(A_ScriptDir . "\debug")) {
                searchLog .= "- Debug folder"
                Loop, Files, %A_ScriptDir%\debug\%targetFile%, R
                {
                    foundPath := A_LoopFileFullPath
                    searchLog .= " (FOUND!)`n"
                    break
                }
                if (foundPath = "")
                    searchLog .= " (not found)`n"
            }
            
            ; If still not found and it's a JSON file, search in data subfolders
            if (foundPath = "" && RegExMatch(targetFile, "i)\.json$")) {
                searchLog .= "- Data folders"
                Loop, Files, %A_ScriptDir%\data\*.json, R
                {
                    if (A_LoopFileName = targetFile) {
                        foundPath := A_LoopFileFullPath
                        searchLog .= " (FOUND!)`n"
                        break
                    }
                }
                if (foundPath = "")
                    searchLog .= " (not found)`n"
            }
            
            ; If still not found and it's a JS file, do a deep search
            if (foundPath = "" && RegExMatch(targetFile, "i)\.js$")) {
                searchLog .= "- All folders (deep search)"
                Loop, Files, %A_ScriptDir%\*.js, R
                {
                    if (A_LoopFileName = targetFile) {
                        foundPath := A_LoopFileFullPath
                        searchLog .= " (FOUND!)`n"
                        break
                    }
                }
                if (foundPath = "")
                    searchLog .= " (not found)`n"
            }
        }
        
        ; If file found, open it
        if (foundPath != "") {
            ; Show we're opening it
            StringReplace, relativePath, foundPath, %A_ScriptDir%\
            ToolTip, Opening: %relativePath%..., %tooltipX%, %tooltipY%
            
            ; Check if it's an HTML file
            SplitPath, foundPath, , , fileExt
            StringLower, fileExt, fileExt
            
            ; Open the file - ALWAYS use notepad for HTML files
            if (fileExt = "html" || fileExt = "htm") {
                Run, notepad.exe "%foundPath%"
            } else {
                Run, %foundPath%
            }
            
            ; Remember which file we opened
            lastOpenedFile := targetFile
            
            ; Wait and do the paste operations
            Sleep, 1000
            Send, {Ctrl down}a{Ctrl up}
            Sleep, 100
            Send, {Ctrl down}v{Ctrl up}
            Sleep, 100
            Send, {Ctrl down}w{Ctrl up}
            
            ; Final success message
            ToolTip, SUCCESS: Opened %relativePath%, %tooltipX%, %tooltipY%
            SetTimer, RemoveTooltip, 5000
            SetTimer, MonitorClick, 50
        } else {
            ; Show detailed not found message
            ToolTip, FILE NOT FOUND: %targetFile%`n%searchLog%, %tooltipX%, %tooltipY%
            SetTimer, RemoveTooltip, 5000
        }
    } else {
        ; No file pattern detected
        displayText := SubStr(currentClip, 1, 50)
        if (StrLen(currentClip) > 50)
            displayText .= "..."
        StringReplace, displayText, displayText, `n, \n, All
        StringReplace, displayText, displayText, `r, \r, All
        
        ToolTip, No file pattern found in:`n%displayText%, %tooltipX%, %tooltipY%
        SetTimer, RemoveTooltip, 5000
    }
return

MonitorClick:
    ; Check if mouse button was clicked
    if (GetKeyState("LButton", "P") || GetKeyState("RButton", "P")) {
        ToolTip
        SetTimer, RemoveTooltip, Off
        SetTimer, MonitorClick, Off
    }
return

MainSnap:
    GuiControl, Main:, MainSnapButton, ...
    
    ; Force refresh of file system cache
    DllCall("kernel32.dll\FlushFileBuffers", "Ptr", -1)
    
    FormatTime, timestamp, , yyyy-MM-dd HH:mm:ss
    snapCount++
    
    ; MAIN SNAP - main folder + engine folder + data overview
    mainFiles := ""
    mainCount := 0
    engineFiles := ""
    engineCount := 0
    dataOverview := ""
    
    ; Parse exclude patterns
    StringSplit, excludeArray, excludePatterns, `,
    
    ; Scan main folder files
    Loop, Files, %A_ScriptDir%\*.*
    {
        skipFile := false
        Loop, %excludeArray0%
        {
            pattern := excludeArray%A_Index%
            if (InStr(A_LoopFileName, pattern)) {
                skipFile := true
                break
            }
        }
        
        if (skipFile)
            continue
        
        ; Apply OG logic
        fileName := A_LoopFileName
        SplitPath, fileName, , , ext, nameNoExt
        
        if (RegExMatch(nameNoExt, "(.+)og$", match)) {
            nonOgFile := match1 . "." . ext
            if (FileExist(A_ScriptDir . "\" . nonOgFile)) {
                continue
            }
        }
        
        mainCount++
        
        FileGetSize, sizeBytes, %A_LoopFileFullPath%
        if (sizeBytes >= 1024) {
            sizeDisplay := Round(sizeBytes/1024,1) . "KB"
        } else {
            sizeDisplay := sizeBytes . "B"
        }
        
        FileGetTime, modTime, %A_LoopFileFullPath%, M
        FormatTime, timeStr, %modTime%, yyyy-MM-dd HH:mm
        
        mainFiles .= A_LoopFileName . " [" . sizeDisplay . "] " . timeStr . "`n"
    }
    
    ; Scan engine folder if it exists
    if (FileExist(A_ScriptDir . "\engine")) {
        Loop, Files, %A_ScriptDir%\engine\*.*, R
        {
            ; Skip test folders
            if (InStr(A_LoopFileFullPath, "\test\"))
                continue
                
            skipFile := false
            Loop, %excludeArray0%
            {
                pattern := excludeArray%A_Index%
                if (InStr(A_LoopFileName, pattern)) {
                    skipFile := true
                    break
                }
            }
            
            if (skipFile)
                continue
            
            ; Apply OG logic
            fileName := A_LoopFileName
            SplitPath, fileName, , , ext, nameNoExt
            
            if (RegExMatch(nameNoExt, "(.+)og$", match)) {
                nonOgFile := match1 . "." . ext
                SplitPath, A_LoopFileFullPath, , dirPath
                if (FileExist(dirPath . "\" . nonOgFile)) {
                    continue
                }
            }
            
            engineCount++
            
            FileGetSize, sizeBytes, %A_LoopFileFullPath%
            if (sizeBytes >= 1024) {
                sizeDisplay := Round(sizeBytes/1024,1) . "KB"
            } else {
                sizeDisplay := sizeBytes . "B"
            }
            
            FileGetTime, modTime, %A_LoopFileFullPath%, M
            FormatTime, timeStr, %modTime%, yyyy-MM-dd HH:mm
            
            StringReplace, relativePath, A_LoopFileFullPath, %A_ScriptDir%\engine\
            ; Convert backslashes to forward slashes for display
            StringReplace, relativePath, relativePath, \, /, All
            engineFiles .= relativePath . " [" . sizeDisplay . "] " . timeStr . "`n"
        }
    }
    
    ; Data folder overview
    if (FileExist(A_ScriptDir . "\data")) {
        Loop, Files, %A_ScriptDir%\data\*, D
        {
            folderName := A_LoopFileName
            folderSize := 0
            fileCount := 0
            latestTime := 0
            jsonFiles := ""
            
            Loop, Files, %A_ScriptDir%\data\%folderName%\*.*, R
            {
                ; Skip test folders
                if (InStr(A_LoopFileFullPath, "\test\"))
                    continue
                    
                skipFile := false
                Loop, %excludeArray0%
                {
                    pattern := excludeArray%A_Index%
                    if (InStr(A_LoopFileName, pattern)) {
                        skipFile := true
                        break
                    }
                }
                
                if (skipFile)
                    continue
                
                fileCount++
                FileGetSize, fileSize, %A_LoopFileFullPath%
                folderSize += fileSize
                FileGetTime, fileTime, %A_LoopFileFullPath%, M
                if (fileTime > latestTime)
                    latestTime := fileTime
                
                ; Check for JSON files
                SplitPath, A_LoopFileName, , , ext
                StringLower, ext, ext
                if (ext = "json") {
                    StringReplace, relativePath, A_LoopFileFullPath, %A_ScriptDir%\data\%folderName%\
                    ; Convert backslashes to forward slashes for display
                    StringReplace, relativePath, relativePath, \, /, All
                    jsonFiles .= "    " . relativePath . "`n"
                }
            }
            
            if (fileCount > 0) {
                if (folderSize >= 1048576) {
                    sizeDisplay := Round(folderSize/1048576,1) . "MB"
                } else {
                    sizeDisplay := Round(folderSize/1024,1) . "KB"
                }
                
                FormatTime, timeStr, %latestTime%, yyyy-MM-dd HH:mm
                dataOverview .= "data/" . folderName . "/ [" . fileCount . " files, " . sizeDisplay . "] " . timeStr . "`n"
                
                if (jsonFiles != "")
                    dataOverview .= jsonFiles
            }
        }
    }
    
    ; Build main snapshot
    FormatTime, timestamp, , yyyy-MM-dd HH:mm
    snapshot := "Current state of project files, overview at " . timestamp . "`n"
    snapshot .= "Path: " . A_ScriptDir . "`n`n"
    
    snapshot .= "MAIN FOLDER (" . mainCount . " files):`n"
    snapshot .= mainFiles . "`n"
    
    if (engineCount > 0) {
        snapshot .= "ENGINE FOLDER (" . engineCount . " files):`n"
        snapshot .= engineFiles . "`n"
    }
    
    if (dataOverview != "") {
        snapshot .= "DATA OVERVIEW:`n"
        snapshot .= dataOverview
    }
    
    snapshot .= "=== END OVERVIEW ==="
    
    Clipboard := snapshot
    
    ToolTip, MAIN SNAP #%snapCount%: %mainCount% main + %engineCount% engine files -> Clipboard, 300, 80
    SetTimer, RemoveTooltip, 2000
    
    WinSet, Transparent, 51, SNAP & TEST
    GuiControl, Main:, MainSnapButton, MAIN`nSNAP
return

MidSnap:
    GuiControl, Main:, MidSnapButton, ...
    
    ; Force refresh of file system cache
    DllCall("kernel32.dll\FlushFileBuffers", "Ptr", -1)
    
    snapCount++
    
    ; Build clean header - NO OLD HEADERS ANYWHERE
    FormatTime, timestamp, , yyyy-MM-dd HH:mm
    snapshot := "Current state of project files, mid-level review at " . timestamp . "`n"
    snapshot .= "Path: " . A_ScriptDir . "`n`n"
    
    ; Parse exclude patterns
    StringSplit, excludeArray, excludePatterns, `,
    
    ; Main folder files with OG logic
    mainFiles := ""
    mainCount := 0
    
    Loop, Files, %A_ScriptDir%\*.*
    {
        skipFile := false
        Loop, %excludeArray0%
        {
            pattern := excludeArray%A_Index%
            if (InStr(A_LoopFileName, pattern)) {
                skipFile := true
                break
            }
        }
        
        if (skipFile)
            continue
        
        ; Apply OG logic
        fileName := A_LoopFileName
        SplitPath, fileName, , , ext, nameNoExt
        
        if (RegExMatch(nameNoExt, "(.+)og$", match)) {
            nonOgFile := match1 . "." . ext
            if (FileExist(A_ScriptDir . "\" . nonOgFile)) {
                continue
            }
        }
        
        mainCount++
        FileGetSize, sizeBytes, %A_LoopFileFullPath%
        if (sizeBytes >= 1024) {
            sizeDisplay := Round(sizeBytes/1024,1) . "KB"
        } else {
            sizeDisplay := sizeBytes . "B"
        }
        FileGetTime, modTime, %A_LoopFileFullPath%, M
        FormatTime, timeStr, %modTime%, yyyy-MM-dd HH:mm
        mainFiles .= A_LoopFileName . " [" . sizeDisplay . "] " . timeStr . "`n"
    }
    
    snapshot .= "MAIN (" . mainCount . " files):`n" . mainFiles . "`n"
    
    ; Engine folder - everything including subfolders
    if (FileExist(A_ScriptDir . "\engine")) {
        engineFiles := ""
        engineCount := 0
        
        Loop, Files, %A_ScriptDir%\engine\*.*, R
        {
            ; Skip test folders
            if (InStr(A_LoopFileFullPath, "\test\"))
                continue
                
            skipFile := false
            Loop, %excludeArray0%
            {
                pattern := excludeArray%A_Index%
                if (InStr(A_LoopFileName, pattern)) {
                    skipFile := true
                    break
                }
            }
            
            if (skipFile)
                continue
            
            ; Apply OG logic
            fileName := A_LoopFileName
            SplitPath, fileName, , , ext, nameNoExt
            
            if (RegExMatch(nameNoExt, "(.+)og$", match)) {
                nonOgFile := match1 . "." . ext
                SplitPath, A_LoopFileFullPath, , dirPath
                if (FileExist(dirPath . "\" . nonOgFile)) {
                    continue
                }
            }
            
            engineCount++
            
            FileGetSize, sizeBytes, %A_LoopFileFullPath%
            if (sizeBytes >= 1024) {
                sizeDisplay := Round(sizeBytes/1024,1) . "KB"
            } else {
                sizeDisplay := sizeBytes . "B"
            }
            FileGetTime, modTime, %A_LoopFileFullPath%, M
            FormatTime, timeStr, %modTime%, yyyy-MM-dd HH:mm
            
            StringReplace, relativePath, A_LoopFileFullPath, %A_ScriptDir%\engine\
            engineFiles .= relativePath . " [" . sizeDisplay . "] " . timeStr . "`n"
        }
        
        snapshot .= "ENGINE (" . engineCount . " files):`n" . engineFiles . "`n"
    }
    
    ; Data folder - file type analysis by subfolder
    if (FileExist(A_ScriptDir . "\data")) {
        snapshot .= "DATA FILE TYPES BY FOLDER:`n"
        
        Loop, Files, %A_ScriptDir%\data\*, D
        {
            topLevelFolder := A_LoopFileName
            
            ; Check if this folder has subfolders
            hasSubfolders := false
            Loop, Files, %A_ScriptDir%\data\%topLevelFolder%\*, D
            {
                hasSubfolders := true
                break
            }
            
            if (hasSubfolders) {
                ; Analyze each subfolder separately
                Loop, Files, %A_ScriptDir%\data\%topLevelFolder%\*, D
                {
                    subfolderName := A_LoopFileName
                    
                    ; Initialize counters for this subfolder
                    folderTypes := {}
                    
                    Loop, Files, %A_ScriptDir%\data\%topLevelFolder%\%subfolderName%\*.*, R
                    {
                        ; Skip test folders
                        if (InStr(A_LoopFileFullPath, "\test\"))
                            continue
                            
                        skipFile := false
                        Loop, %excludeArray0%
                        {
                            pattern := excludeArray%A_Index%
                            if (InStr(A_LoopFileName, pattern)) {
                                skipFile := true
                                break
                            }
                        }
                        
                        if (skipFile)
                            continue
                        
                        ; Apply OG logic
                        fileName := A_LoopFileName
                        SplitPath, fileName, , , ext, nameNoExt
                        
                        if (RegExMatch(nameNoExt, "(.+)og$", match)) {
                            nonOgFile := match1 . "." . ext
                            SplitPath, A_LoopFileFullPath, , dirPath
                            if (FileExist(dirPath . "\" . nonOgFile)) {
                                continue
                            }
                        }
                        
                        StringLower, ext, ext
                        
                        if (ext != "") {
                            ; Initialize counters
                            if (!folderTypes[ext "_count"])
                                folderTypes[ext "_count"] := 0
                            if (!folderTypes[ext "_size"])
                                folderTypes[ext "_size"] := 0
                            if (!folderTypes[ext "_latest"])
                                folderTypes[ext "_latest"] := 0
                            
                            folderTypes[ext "_count"]++
                            
                            FileGetSize, fileSize, %A_LoopFileFullPath%
                            folderTypes[ext "_size"] += fileSize
                            
                            FileGetTime, fileTime, %A_LoopFileFullPath%, M
                            if (fileTime > folderTypes[ext "_latest"])
                                folderTypes[ext "_latest"] := fileTime
                        }
                    }
                    
                    ; Output file type summary for this subfolder
                    hasFiles := false
                    folderOutput := ""
                    extensions := "png,jpg,jpeg,gif,wav,mp3,ogg,js,json,html,css,md"
                    StringSplit, extArray, extensions, `,
                    
                    Loop, %extArray0%
                    {
                        ext := extArray%A_Index%
                        count := folderTypes[ext "_count"]
                        if (count > 0) {
                            hasFiles := true
                            totalSize := folderTypes[ext "_size"]
                            latestTime := folderTypes[ext "_latest"]
                            
                            if (totalSize >= 1048576) {
                                sizeDisplay := Round(totalSize/1048576,1) . "MB"
                            } else if (totalSize >= 1024) {
                                sizeDisplay := Round(totalSize/1024,1) . "KB"
                            } else {
                                sizeDisplay := totalSize . "B"
                            }
                            
                            FormatTime, timeStr, %latestTime%, yyyy-MM-dd HH:mm
                            folderOutput .= "  " . ext . ": " . count . " files [" . sizeDisplay . "] latest: " . timeStr . "`n"
                        }
                    }
                    
                    if (hasFiles) {
                        snapshot .= "data/" . topLevelFolder . "/" . subfolderName . "/:`n"
                        snapshot .= folderOutput
                    }
                }
            } else {
                ; No subfolders, analyze the top-level folder directly
                folderTypes := {}
                
                Loop, Files, %A_ScriptDir%\data\%topLevelFolder%\*.*, R
                {
                    ; Skip test folders
                    if (InStr(A_LoopFileFullPath, "\test\"))
                        continue
                        
                    skipFile := false
                    Loop, %excludeArray0%
                    {
                        pattern := excludeArray%A_Index%
                        if (InStr(A_LoopFileName, pattern)) {
                            skipFile := true
                            break
                        }
                    }
                    
                    if (skipFile)
                        continue
                    
                    ; Apply OG logic
                    fileName := A_LoopFileName
                    SplitPath, fileName, , , ext, nameNoExt
                    
                    if (RegExMatch(nameNoExt, "(.+)og$", match)) {
                        nonOgFile := match1 . "." . ext
                        SplitPath, A_LoopFileFullPath, , dirPath
                        if (FileExist(dirPath . "\" . nonOgFile)) {
                            continue
                        }
                    }
                    
                    StringLower, ext, ext
                    
                    if (ext != "") {
                        if (!folderTypes[ext "_count"])
                            folderTypes[ext "_count"] := 0
                        if (!folderTypes[ext "_size"])
                            folderTypes[ext "_size"] := 0
                        if (!folderTypes[ext "_latest"])
                            folderTypes[ext "_latest"] := 0
                        
                        folderTypes[ext "_count"]++
                        
                        FileGetSize, fileSize, %A_LoopFileFullPath%
                        folderTypes[ext "_size"] += fileSize
                        
                        FileGetTime, fileTime, %A_LoopFileFullPath%, M
                        if (fileTime > folderTypes[ext "_latest"])
                            folderTypes[ext "_latest"] := fileTime
                    }
                }
                
                ; Output file type summary for this top-level folder
                hasFiles := false
                folderOutput := ""
                extensions := "png,jpg,jpeg,gif,wav,mp3,ogg,js,json,html,css,md"
                StringSplit, extArray, extensions, `,
                
                Loop, %extArray0%
                {
                    ext := extArray%A_Index%
                    count := folderTypes[ext "_count"]
                    if (count > 0) {
                        hasFiles := true
                        totalSize := folderTypes[ext "_size"]
                        latestTime := folderTypes[ext "_latest"]
                        
                        if (totalSize >= 1048576) {
                            sizeDisplay := Round(totalSize/1048576,1) . "MB"
                        } else if (totalSize >= 1024) {
                            sizeDisplay := Round(totalSize/1024,1) . "KB"
                        } else {
                            sizeDisplay := totalSize . "B"
                        }
                        
                        FormatTime, timeStr, %latestTime%, yyyy-MM-dd HH:mm
                        folderOutput .= "  " . ext . ": " . count . " files [" . sizeDisplay . "] latest: " . timeStr . "`n"
                    }
                }
                
                if (hasFiles) {
                    snapshot .= "data/" . topLevelFolder . "/:`n"
                    snapshot .= folderOutput
                }
            }
        }
        
        snapshot .= "`n"
    }
    
    ; Process other folders (except test/archive)
    Loop, Files, %A_ScriptDir%\*, D
    {
        folderName := A_LoopFileName
        if (folderName = "engine" or folderName = "data" or folderName = "test" or folderName = "archive")
            continue
        
        StringUpper, folderNameUpper, folderName
        snapshot .= folderNameUpper . " FOLDER:`n"
        otherFiles := ""
        otherCount := 0
        
        Loop, Files, %A_ScriptDir%\%folderName%\*.*, R
        {
            ; Skip files in test folders or archive folders
            if (InStr(A_LoopFileFullPath, "\test\") || InStr(A_LoopFileFullPath, "\archive\"))
                continue
            
            skipFile := false
            Loop, %excludeArray0%
            {
                pattern := excludeArray%A_Index%
                if (InStr(A_LoopFileName, pattern)) {
                    skipFile := true
                    break
                }
            }
            
            if (skipFile)
                continue
            
            ; Apply OG logic
            fileName := A_LoopFileName
            SplitPath, fileName, , , ext, nameNoExt
            
            if (RegExMatch(nameNoExt, "(.+)og$", match)) {
                nonOgFile := match1 . "." . ext
                SplitPath, A_LoopFileFullPath, , dirPath
                if (FileExist(dirPath . "\" . nonOgFile)) {
                    continue
                }
            }
            
            otherCount++
            
            FileGetSize, sizeBytes, %A_LoopFileFullPath%
            if (sizeBytes >= 1024) {
                sizeDisplay := Round(sizeBytes/1024,1) . "KB"
            } else {
                sizeDisplay := sizeBytes . "B"
            }
            FileGetTime, modTime, %A_LoopFileFullPath%, M
            FormatTime, timeStr, %modTime%, yyyy-MM-dd HH:mm
            
            StringReplace, relativePath, A_LoopFileFullPath, %A_ScriptDir%\%folderName%\
            ; Convert backslashes to forward slashes for display
            StringReplace, relativePath, relativePath, \, /, All
            otherFiles .= relativePath . " [" . sizeDisplay . "] " . timeStr . "`n"
        }
        
        snapshot .= otherFiles . "`n"
    }
    
    snapshot .= "=== END MID-LEVEL REVIEW ==="
    
    Clipboard := snapshot
    
    ToolTip, MID SNAP #%snapCount% -> Clipboard, 300, 80
    SetTimer, RemoveTooltip, 2000
    
    WinSet, Transparent, 51, SNAP & TEST
    GuiControl, Main:, MidSnapButton, MID`nSNAP
return

StartTest:
    GuiControl, Main:, TestButton, ...
    
    ; Enhanced cleanup using the working method from old version
    Gosub, KillAll
    Sleep, 1000
    
    ; Auto-detect available port
    currentPort := 8000
    Loop, 10 {
        RunWait, netstat -an | find ":%currentPort%" > nul, , Hide
        if (ErrorLevel = 1) {
            break
        }
        currentPort++
    }
    
    ; Start Python server
    serverCmd := "cd /d """ . A_ScriptDir . """ && echo Starting enhanced server on port " . currentPort . "... && python -m http.server " . currentPort
    Run, cmd /k "%serverCmd%", , , serverPID
    
    ; Position CMD window
    SysGet, MonitorPrimary, MonitorPrimary
    SysGet, Mon, Monitor, %MonitorPrimary%
    
    cmdX := MonRight - 850
    cmdY := MonTop + 99
    cmdW := 800
    cmdH := 400
    
    if (serverPID > 0) {
        WinMove, ahk_pid %serverPID%, , %cmdX%, %cmdY%, %cmdW%, %cmdH%
        WinSetTitle, ahk_pid %serverPID%, , Python Server - PORT %currentPort%
    }
    
    Sleep, 1000
    
    ; Chrome positioning
    chromeX := MonLeft + 50
    chromeY := MonTop + 50
    chromeW := MonRight - MonLeft - 700
    chromeH := MonBottom - MonTop - 100
    
    ; Auto-detect HTML file
    htmlFiles := "index.html,gonkpope.html,main.html,app.html,test.html,testing.html"
    StringSplit, htmlArray, htmlFiles, `,
    targetFile := ""
    
    Loop, %htmlArray0%
    {
        testFile := htmlArray%A_Index%
        if (FileExist(A_ScriptDir . "\" . testFile)) {
            targetFile := testFile
            break
        }
    }
    
    ; Launch Chrome in regular mode
    if (targetFile != "") {
        targetURL := "http://localhost:" . currentPort . "/" . targetFile
        Run, chrome.exe "%targetURL%"
    } else {
        targetURL := "http://localhost:" . currentPort . "/"
        Run, chrome.exe "%targetURL%"
        targetFile := "directory listing"
    }
    
    Sleep, 1500
    WinWait, ahk_exe chrome.exe, , 3
    if (!ErrorLevel) {
        WinGet, newChromeList, List, ahk_exe chrome.exe
        Loop, %newChromeList%
        {
            WinGetTitle, title, % "ahk_id " . newChromeList%A_Index%
            if (InStr(title, "localhost") || InStr(title, currentPort)) {
                WinMaximize, % "ahk_id " . newChromeList%A_Index%
                Sleep, 500
                WinMove, % "ahk_id " . newChromeList%A_Index%, , %chromeX%, %chromeY%, %chromeW%, %chromeH%
                WinActivate, % "ahk_id " . newChromeList%A_Index%
                
                ; Wait half second then hard refresh once
                Sleep, 500
                Send, {Ctrl down}{Shift down}r{Shift up}{Ctrl up}
                break
            }
        }
    }
    
    ToolTip, Server: localhost:%currentPort% | File: %targetFile%, 300, 120
    SetTimer, RemoveTooltip, 3000
    
    WinSet, Transparent, 51, SNAP & TEST
    GuiControl, Main:, TestButton, GAME TEST
return

KillAll:
    GuiControl, Main:, KillButton, ...
    
    ; Kill Python processes
    RunWait, taskkill /F /IM python.exe, , Hide
    
    ; Enhanced Chrome tab cleanup from working old version - cycle through tabs 1-5
    WinActivate, ahk_exe chrome.exe
    Sleep, 200
    
    ; Check tabs 1-5
    Loop, 5 {
        Send, {Ctrl down}%A_Index%{Ctrl up}
        Sleep, 100
        
        ; Get the title of the current tab
        WinGetTitle, currentTitle, A
        
        ; Check if this tab contains localhost/Gonk content
        if (InStr(currentTitle, "localhost") || InStr(currentTitle, "127.0.0.1") || InStr(currentTitle, currentPort) || InStr(currentTitle, "Gonk P0P3") || InStr(currentTitle, "Gonk") || InStr(currentTitle, "Jedi Missionary")) {
            Send, ^w
            Sleep, 100
        }
    }
    
    ; Kill ALL CMD windows using both methods for reliability
    WinGet, cmdList, List, ahk_exe cmd.exe
    if (cmdList > 0) {
        Loop, %cmdList%
        {
            WinClose, % "ahk_id " . cmdList%A_Index%
        }
    }
    
    ; Also close console windows
    WinGet, consoleList, List, ahk_class ConsoleWindowClass
    if (consoleList > 0) {
        Loop, %consoleList%
        {
            WinClose, % "ahk_id " . consoleList%A_Index%
        }
    }
    
    ; Kill all notepad instances (will prompt for save if needed)
    WinGet, notepadList, List, ahk_exe notepad.exe
    if (notepadList > 0) {
        Loop, %notepadList%
        {
            WinClose, % "ahk_id " . notepadList%A_Index%
        }
    }
    
    ; Close Explorer windows except AHK folder and Downloads
    ; Get current AHK folder name for comparison
    SplitPath, A_ScriptDir, currentFolder
    
    WinGet, explorerList, List, ahk_class CabinetWClass
    if (explorerList > 0) {
        keepAHKOpen := false
        keepDownloadsOpen := false
        ahkWindowID := 0
        downloadsWindowID := 0
        
        ; First pass: identify which windows to keep
        Loop, %explorerList%
        {
            explorerID := explorerList%A_Index%
            WinGetTitle, title, ahk_id %explorerID%
            
            ; Check if it's the AHK folder (title should end with the folder name)
            if (InStr(title, currentFolder) and (InStr(title, currentFolder) = StrLen(title) - StrLen(currentFolder) + 1)) {
                if (!keepAHKOpen) {
                    keepAHKOpen := true
                    ahkWindowID := explorerID
                }
            }
            
            ; Check if it's Downloads folder
            if (InStr(title, "Downloads") and !keepDownloadsOpen) {
                keepDownloadsOpen := true
                downloadsWindowID := explorerID
            }
        }
        
        ; Second pass: close all except the ones we want to keep
        Loop, %explorerList%
        {
            explorerID := explorerList%A_Index%
            
            ; Keep this window open if it's our designated AHK or Downloads window
            if (explorerID = ahkWindowID or explorerID = downloadsWindowID) {
                continue
            }
            
            ; Close all other explorer windows
            WinClose, ahk_id %explorerID%
            Sleep, 50
        }
    }
    
    serverPID := 0
    
    ToolTip, All processes and windows killed, 400, 180
    SetTimer, RemoveTooltip, 2000
    
    GuiControl, Main:, KillButton, KILL
return

AllSnap:
    GuiControl, Main:, AllSnapButton, ...
    
    ; Force refresh of file system cache
    DllCall("kernel32.dll\FlushFileBuffers", "Ptr", -1)
    
    snapCount++
    
    ; ALL SNAP - every file with exclusions applied
    FormatTime, timestamp, , yyyy-MM-dd HH:mm
    snapshot := "Current state of project files, detailed view at " . timestamp . "`n"
    snapshot .= "Path: " . A_ScriptDir . "`n`n"
    
    ; Group files by directory for organization
    allFiles := ""
    fileCount := 0
    currentDir := ""
    
    StringSplit, excludeArray, excludePatterns, `,
    
    Loop, Files, %A_ScriptDir%\*.*, R
    {
        ; Skip test folders and excluded file types
        if (InStr(A_LoopFileFullPath, "\test\"))
            continue
            
        skipFile := false
        Loop, %excludeArray0%
        {
            pattern := excludeArray%A_Index%
            if (InStr(A_LoopFileName, pattern)) {
                skipFile := true
                break
            }
        }
        
        if (skipFile)
            continue
        
        ; Apply OG logic
        fileName := A_LoopFileName
        SplitPath, fileName, , , ext, nameNoExt
        
        if (RegExMatch(nameNoExt, "(.+)og$", match)) {
            nonOgFile := match1 . "." . ext
            SplitPath, A_LoopFileFullPath, , dirPath
            if (FileExist(dirPath . "\" . nonOgFile)) {
                continue
            }
        }
            
        fileCount++
        
        ; Get directory path relative to project
        StringReplace, relativePath, A_LoopFileFullPath, %A_ScriptDir%\
        SplitPath, relativePath, fileName, dirPath
        
        ; Use compression - show full path for first file in directory
        if (dirPath != currentDir) {
            currentDir := dirPath
            if (dirPath != "") {
                ; Convert backslashes to forward slashes for display
                StringReplace, displayPath, dirPath, \, /, All
                allFiles .= "`n" . displayPath . "/`n"
            }
        }
        
        ; File info with full timestamp
        FileGetSize, sizeBytes, %A_LoopFileFullPath%
        if (sizeBytes >= 1048576) {
            sizeDisplay := Round(sizeBytes/1048576,1) . "MB"
        } else if (sizeBytes >= 1024) {
            sizeDisplay := Round(sizeBytes/1024,1) . "KB"
        } else {
            sizeDisplay := sizeBytes . "B"
        }
        
        FileGetTime, modTime, %A_LoopFileFullPath%, M
        FormatTime, timeStr, %modTime%, yyyy-MM-dd HH:mm
        
        if (dirPath != "") {
            filePrefix := "  "
        } else {
            filePrefix := ""
        }
        allFiles .= filePrefix . fileName . " [" . sizeDisplay . "] " . timeStr . "`n"
    }
    
    snapshot .= "ALL FILES (" . fileCount . " items):" . allFiles
    snapshot .= "`n=== END DETAILED VIEW ==="
    
    Clipboard := snapshot
    
    ToolTip, ALL SNAP #%snapCount%: %fileCount% files -> Clipboard, 300, 80
    SetTimer, RemoveTooltip, 2000
    
    WinSet, Transparent, 51, SNAP & TEST
    GuiControl, Main:, AllSnapButton, ALL`nSNAP
return

CreateBackup:
    GuiControl, Main:, BackupButton, ...
    
    ; Create timestamped folder name (M D HHMM format)
    FormatTime, timestamp, , M d HHmm
    backupFolder := backupPath . "\" . timestamp
    
    ; Create the backup directory
    FileCreateDir, %backupFolder%
    
    if (ErrorLevel) {
        ToolTip, Failed to create backup folder, 300, 80
        SetTimer, RemoveTooltip, 2000
        GuiControl, Main:, BackupButton, BACK`nUP
        return
    }
    
    ; Copy all files except test folders and .ahk files
    filesCopied := 0
    Loop, Files, %A_ScriptDir%\*.*, R
    {
        ; Skip test folders and .ahk files
        if (InStr(A_LoopFileFullPath, "\test\") || RegExMatch(A_LoopFileName, "\.ahk$"))
            continue
        
        ; Get relative path
        StringReplace, relativePath, A_LoopFileFullPath, %A_ScriptDir%\
        
        ; Create destination path
        destPath := backupFolder . "\" . relativePath
        SplitPath, destPath, , destDir
        
        ; Create destination directory if needed
        FileCreateDir, %destDir%
        
        ; Copy the file
        FileCopy, %A_LoopFileFullPath%, %destPath%
        if (!ErrorLevel)
            filesCopied++
    }
    
    ; Update backup timestamp and reset display timer to 0
    mostRecentBackupTime := A_Now
    displayMinutesSinceReset := 0
    lastResetTime := A_TickCount
    hasBeenManuallyReset := true
    
    GuiControl, Main:+c0x00FF00, BackupStatus
    GuiControl, Main:, BackupStatus, B^ 0m
    
    ToolTip, Backup created: %filesCopied% files copied to %timestamp%, 300, 80
    SetTimer, RemoveTooltip, 3000
    
    GuiControl, Main:, BackupButton, BACK`nUP
return

OpenNotes:
    GuiControl, Main:, NotesButton, ...
    
    ; Open notepad and paste clipboard
    Run, notepad.exe
    Sleep, 1000
    Send, {Ctrl down}v{Ctrl up}
    
    GuiControl, Main:, NotesButton, NOTE`nPASTE
return

ResetBackupTimer:
    ; Reset the display timer when clicked - START FROM 0
    displayMinutesSinceReset := 0
    lastResetTime := A_TickCount
    hasBeenManuallyReset := true
    
    ; Update display immediately
    GuiControl, Main:+c0x00FF00, BackupStatus
    GuiControl, Main:, BackupStatus, B^ 0m
    
    ToolTip, Backup timer reset, 300, 50
    SetTimer, RemoveTooltip, 1000
return

UpdateBackupTimer:
    ; Calculate display minutes (time since last reset)
    currentTick := A_TickCount
    elapsedMs := currentTick - lastResetTime
    displayMinutesSinceReset := Round(elapsedMs / 60000)
    
    ; Calculate actual minutes since last backup for color logic
    currentTime := A_Now
    if (mostRecentBackupTime > 0) {
        actualTime := currentTime
        EnvSub, actualTime, %mostRecentBackupTime%, Minutes
        actualMinutesSinceBackup := actualTime
    } else {
        actualMinutesSinceBackup := displayMinutesSinceReset
    }
    
    ; Color logic: RED if actual time since backup is >90 minutes - even brighter red
    if (actualMinutesSinceBackup > 90) {
        GuiControl, Main:+c0xFF5050, BackupStatus
    } else {
        GuiControl, Main:+c0x00FF00, BackupStatus
    }
    
    ; Display shows time since reset (starts BIG at startup, then counts from reset)
    GuiControl, Main:, BackupStatus, B^ %displayMinutesSinceReset%m
return

RemoveTooltip:
    ToolTip
    SetTimer, RemoveTooltip, Off
    SetTimer, MonitorClick, Off
return

; Enhanced hotkeys - make sure these point to the correct functions
F3::Gosub, MainSnap
F2::Gosub, StartTest
F4::Gosub, KillAll

; Cleanup on exit
OnExit, CleanupAndExit

CleanupAndExit:
    if (serverPID > 0) {
        Process, Close, %serverPID%
    }
    RunWait, taskkill /F /IM python.exe, , Hide
    ExitApp

MainGuiClose:
    Gosub, CleanupAndExit