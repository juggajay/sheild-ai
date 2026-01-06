#!/bin/bash
#
# RiskShield AI - Development Environment Setup Script
# =====================================================
# This script sets up the development environment for RiskShield AI,
# an autonomous Certificate of Currency (COC) compliance platform.
#

set -e  # Exit on error

echo "=========================================="
echo "RiskShield AI - Environment Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_requirement() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed.${NC}"
        echo "Please install $1 and try again."
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $1 found"
}

echo "Checking requirements..."
check_requirement "node"
check_requirement "npm"
check_requirement "git"

# Check Node.js version (requires 18+)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required. Found version $NODE_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js version $(node -v) is compatible"

echo ""
echo "Setting up project..."

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies if node_modules doesn't exist or package.json has changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# Check for environment file
if [ ! -f ".env.local" ]; then
    echo ""
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
    echo "Creating .env.local template..."
    cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
CONVEX_DEPLOY_KEY=your_convex_deploy_key

# OpenAI Configuration (for GPT-4V document processing)
OPENAI_API_KEY=your_openai_api_key

# SendGrid Configuration (for email)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Twilio Configuration (for SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PORTAL_URL=http://localhost:3000/portal

# Feature Flags
NEXT_PUBLIC_ENABLE_SMS_ALERTS=false
NEXT_PUBLIC_ENABLE_EMAIL_OAUTH=false
EOF
    echo ""
    echo -e "${YELLOW}Please edit .env.local with your actual configuration values${NC}"
    echo ""
fi

# Run database migrations if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "Checking Supabase setup..."
    if [ -d "supabase" ]; then
        echo "Running database migrations..."
        supabase db push --local 2>/dev/null || echo -e "${YELLOW}Note: Run 'supabase start' for local development${NC}"
    fi
else
    echo -e "${YELLOW}Note: Install Supabase CLI for local database development${NC}"
    echo "  npm install -g supabase"
fi

# Generate Convex functions if convex directory exists
if [ -d "convex" ] && command -v npx &> /dev/null; then
    echo "Setting up Convex..."
    npx convex dev --once 2>/dev/null || echo -e "${YELLOW}Note: Run 'npx convex dev' to start Convex development server${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "The application will be available at:"
echo "  - Main App:    http://localhost:3000"
echo "  - Portal:      http://localhost:3000/portal"
echo ""
echo "Before running, ensure you have:"
echo "  1. Created a Supabase project and added credentials to .env.local"
echo "  2. Created a Convex project and added credentials to .env.local"
echo "  3. Added your OpenAI API key to .env.local"
echo ""
echo "For email/SMS features, also configure:"
echo "  - SendGrid API key"
echo "  - Twilio credentials"
echo ""
echo "Happy coding!"
