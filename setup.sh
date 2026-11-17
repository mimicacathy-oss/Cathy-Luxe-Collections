#!/bin/bash

# Cathy Luxe Collections - Linux/Mac Setup Script
# This script checks for Node.js, installs dependencies, creates .env file,
# and seeds the database.

echo "========================================"
echo "  Cathy Luxe Collections Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
echo "[1/5] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Please download and install Node.js LTS from https://nodejs.org"
    echo "Then run this script again."
    exit 1
fi
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"
echo ""

# Check if npm is installed
echo "[2/5] Checking for npm..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "npm version: $NPM_VERSION"
echo ""

# Install dependencies
echo "[3/5] Installing project dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies."
    exit 1
fi
echo "Dependencies installed successfully."
echo ""

# Create .env file if it doesn't exist
echo "[4/5] Configuring environment variables..."
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    
    # Generate a random JWT secret
    JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    sed -i "s/change_this_to_a_long_random_string/$JWT_SECRET/" .env
    
    echo ".env file created with random JWT secret."
else
    echo ".env file already exists. Skipping."
fi
echo ""

# Seed the database
echo "[5/5] Seeding database..."
echo "This will clear existing data and create sample data."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run seed
    if [ $? -ne 0 ]; then
        echo "ERROR: Database seeding failed."
        echo "Make sure MongoDB is running and MONGO_URI is correct in .env"
        exit 1
    fi
    echo "Database seeded successfully."
else
    echo "Database seeding skipped."
fi
echo ""

echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "To start the application:"
echo "  npm start        (production)"
echo "  npm run dev      (development with auto-restart)"
echo ""
echo "Default login:"
echo "  Email:    admin@perfume.com"
echo "  Password: admin123"
echo ""
echo "Access the app at: http://localhost:3000"
echo ""
