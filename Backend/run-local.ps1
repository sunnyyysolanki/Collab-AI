# Loads .env and runs the Spring Boot app on Windows PowerShell.
# Usage:  .\run-local.ps1          (runs the built jar, builds if missing)
#         .\run-local.ps1 dev      (runs via mvn spring-boot:run)

Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Write-Error ".env not found. Copy .env and fill in your values."
    exit 1
}

# Load .env into the process environment
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $idx = $line.IndexOf("=")
        $name = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Write-Host "PORT=$env:PORT  SOCKETIO_PORT=$env:SOCKETIO_PORT  MODEL=$env:GEMINI_MODEL"

if ($args[0] -eq "dev") {
    mvn spring-boot:run
} else {
    if (-not (Test-Path "target/backend-1.0.0.jar")) {
        Write-Host "Building jar..."
        mvn -q clean package -DskipTests
    }
    java -jar target/backend-1.0.0.jar
}
