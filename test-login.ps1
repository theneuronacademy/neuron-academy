# Start dev server in background
$server = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -PassThru
Start-Sleep 15

# Test login
try {
    $response = Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/auth/admin/login" -Headers @{"Content-Type"="application/json"} -Body '{"phone":"+919711917317","password":"wrongpassword"}'
    $response.Content
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd()
}

# Keep server running
Read-Host "Press Enter to stop server"
Stop-Process -Id $server.Id