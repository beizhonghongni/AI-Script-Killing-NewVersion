# 清理重复的页面文件
$targetDir = "c:\Mingli\Projects\AI-Script-Killing-NewVersion\src\app\room\[id]"

# 删除所有非 page.js 的页面文件
Remove-Item "$targetDir\page.tsx" -Force -ErrorAction SilentlyContinue
Remove-Item "$targetDir\page_new.tsx" -Force -ErrorAction SilentlyContinue  
Remove-Item "$targetDir\page_simple.tsx" -Force -ErrorAction SilentlyContinue
Remove-Item "$targetDir\temp.tsx" -Force -ErrorAction SilentlyContinue

Write-Host "清理完成！"
Get-ChildItem -Path $targetDir
