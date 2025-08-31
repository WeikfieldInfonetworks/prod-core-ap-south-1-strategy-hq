@echo off
echo.
echo 🚀 Setting up Strategy HQ Dashboard...
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo ✅ Node.js %node -v% detected

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📄 Creating .env file...
    (
        echo # Backend Server Configuration
        echo VITE_API_URL=http://localhost:3000
        echo VITE_SOCKET_URL=http://localhost:3000/live
        echo.
        echo # Dashboard Configuration
        echo VITE_APP_TITLE=Strategy HQ Dashboard
        echo VITE_REFRESH_INTERVAL=1000
    ) > .env
    echo ✅ .env file created
)

echo.
echo 🎉 Setup complete! 
echo.
echo 📋 Next steps:
echo    1. Ensure your backend server is running on http://localhost:3000
echo    2. Run 'npm run dev' to start the development server
echo    3. Open http://localhost:5173 in your browser
echo.
echo 🔧 Available commands:
echo    npm run dev              - Start development server
echo    npm run build            - Build for production  
echo    npm run preview          - Preview production build
echo    npm run lint             - Run ESLint
echo    node create-sample-users.js - Create sample users for testing
echo.

REM Check if backend is running
echo 🔍 Checking backend connection...
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Backend server is not running on http://localhost:3000
    echo    Please start your backend server first, then run 'npm run dev'
    pause
) else (
    echo ✅ Backend server is running
    echo.
    echo 🚀 Starting development server...
    call npm run dev
)
