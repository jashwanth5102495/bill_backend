#!/bin/bash

echo "🚀 Setting up Billboard Backend API..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
    echo "   Run: sudo systemctl start mongod"
    echo "   Or: brew services start mongodb/brew/mongodb-community"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads

# Set up environment variables
if [ ! -f .env ]; then
    echo "📝 Environment file already exists"
else
    echo "⚠️  Please configure your .env file with proper values"
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Make sure MongoDB is running"
echo "2. Update .env file with your configuration"
echo "3. Run: npm run dev"
echo ""
echo "📊 API will be available at: http://localhost:3000/api"
echo "🏥 Health check: http://localhost:3000/api/health"