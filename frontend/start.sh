#!/bin/bash

# Strategy HQ Dashboard Setup Script

echo "🚀 Setting up Strategy HQ Dashboard..."

# Check if Node.js is installed
# if ! command node -v &> /dev/null; then
#     echo "❌ Node.js is not installed. Please install Node.js 18+ first."
#     exit 1
# fi

# # Check Node.js version
# NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
# if [ "$NODE_VERSION" -lt 18 ]; then
#     echo "❌ Node.js version 18+ required. Current version: $(node -v)"
#     exit 1
# fi

# echo "✅ Node.js $(node -v) detected"

# # Install dependencies
# echo "📦 Installing dependencies..."
# npm install

# if [ $? -ne 0 ]; then
#     echo "❌ Failed to install dependencies"
#     exit 1
# fi

# echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env file..."
    cat > .env << EOL
# Backend Server Configuration
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000/live

# Dashboard Configuration
VITE_APP_TITLE=Strategy HQ Dashboard
VITE_REFRESH_INTERVAL=1000
EOL
    echo "✅ .env file created"
fi

echo ""
echo "🎉 Setup complete! "
echo ""
echo "📋 Next steps:"
echo "   1. Ensure your backend server is running on http://localhost:3000"
echo "   2. Run 'npm run dev' to start the development server"
echo "   3. Open http://localhost:5173 in your browser"
echo ""
echo "🔧 Available commands:"
echo "   npm run dev              - Start development server"
echo "   npm run build            - Build for production"
echo "   npm run preview          - Preview production build"
echo "   npm run lint             - Run ESLint"
echo "   node create-sample-users.js - Create sample users for testing"
echo ""

# Check if backend is running
echo "🔍 Checking backend connection..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Backend server is running"
    echo ""
    echo "🚀 Starting development server..."
    npm run dev
else
    echo "⚠️  Backend server is not running on http://localhost:3000"
    echo "   Please start your backend server first, then run 'npm run dev'"
fi
