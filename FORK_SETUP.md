# Forking CensusChat - Quick Setup Guide

Welcome! This guide will help you set up your own CensusChat instance in ~15 minutes.

---

## 📋 Prerequisites

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/) (for PostgreSQL/Redis)
- **Git** - [Download here](https://git-scm.com/downloads)

---

## 🚀 Step 1: Fork & Clone Repository

### 1.1 Fork on GitHub
1. Click the **"Fork"** button at the top of this page
2. Select your GitHub account as the destination
3. Wait for fork to complete

### 1.2 Clone YOUR Fork
```bash
# Replace YOUR_USERNAME with your GitHub username
git clone https://github.com/YOUR_USERNAME/CensusChat.git
cd CensusChat
```

---

## 🔑 Step 2: Get API Keys (FREE - 15 minutes)

You need two API keys. See **[API_KEY_SETUP.md](API_KEY_SETUP.md)** for detailed instructions.

### Quick Version:

#### Anthropic API Key ($5 free credit)
1. Visit [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Sign up or log in
3. Click "Create Key"
4. Copy key immediately (starts with `sk-ant-api03-`)

#### Census Bureau API Key (100% Free)
1. Visit [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)
2. Fill out form (name, email, organization)
3. Submit request
4. Check email for your 40-character key (arrives in 5 min - 2 days)

**Tip**: You can start setup while waiting for Census key!

---

## ⚙️ Step 3: Configure Environment

### 3.1 Backend Configuration
```bash
# Copy environment template
cd backend
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor
```

### 3.2 Add Your API Keys
Find these lines in `backend/.env` and replace with your actual keys:

```bash
# Replace these placeholder values:
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE  # ← Paste your Anthropic key
CENSUS_API_KEY=your-40-character-census-key-here  # ← Paste your Census key
```

**Save and close** the file.

---

## 🐳 Step 4: Start Services

### 4.1 Start Docker Services
```bash
# From project root
docker-compose up -d

# Verify services running
docker-compose ps
# Should show: postgres, redis (both "Up")
```

### 4.2 Install & Start Backend
```bash
cd backend
npm install
npm run dev

# You should see:
# ✅ Anthropic API configured
# ✅ Census API configured
# 🚀 Server running on http://localhost:3001
```

**Keep this terminal open!**

### 4.3 Install & Start Frontend (New Terminal)
```bash
# Open NEW terminal window
cd CensusChat/frontend
npm install
npm run dev

# You should see:
# ▲ Next.js ready on http://localhost:3000
```

**Keep this terminal open too!**

---

## ✅ Step 5: Test Your Setup

### 5.1 Open Application
Visit: **http://localhost:3000**

### 5.2 Try a Test Query
Type in the chat interface:
```
Show me all counties in California
```

**Expected Result**:
- ✅ Returns 58 California counties
- ✅ Shows explanation box (blue)
- ✅ Shows suggested refinements (purple buttons)

### 5.3 Try More Queries
```
Medicare eligible seniors in Florida
Top 5 states by population
Counties with median income over $75,000
```

---

## 🎉 Success!

You now have your own CensusChat instance running!

**What's Next?**
- Explore different queries
- Check out [QUICK_START.md](QUICK_START.md) for more features
- Read [docs/](docs/) for detailed guides
- Start building! 🚀

---

## 🐛 Troubleshooting

### Issue: "Anthropic API key not configured"
**Solution:**
```bash
# Verify .env file exists and has your key
cd backend
cat .env | grep ANTHROPIC_API_KEY
# Should show: ANTHROPIC_API_KEY=sk-ant-api03-...

# Restart backend
npm run dev
```

### Issue: "Census API rate limit exceeded"
**Solution:**
- Without key: 500 requests/day per IP
- With key: 10,000+ requests/day
- Wait until midnight EST or get an API key

### Issue: "CORS errors in browser console"
**Solution:**
```bash
# Verify CORS_ORIGIN in backend/.env
grep CORS_ORIGIN backend/.env
# Should include: http://localhost:3000,http://localhost:3003

# Restart backend after changes
```

### Issue: "Cannot connect to database"
**Solution:**
```bash
# Check Docker services
docker-compose ps

# If not running, start them
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### Issue: "Module not found" errors
**Solution:**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# For both backend and frontend
```

---

## 📚 Additional Resources

### Documentation
- **[API_KEY_SETUP.md](API_KEY_SETUP.md)** - Detailed API key guide
- **[QUICK_START.md](QUICK_START.md)** - Full development setup
- **[SECURITY.md](SECURITY.md)** - Security best practices
- **[docs/](docs/)** - Complete documentation

### Development
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute
- **[docs/architecture/](docs/architecture/)** - System architecture
- **[docs/api/](docs/api/)** - API documentation

### Community
- **GitHub Issues**: [Report bugs](https://github.com/hollandkevint/CensusChat/issues)
- **Discussions**: [Ask questions](https://github.com/hollandkevint/CensusChat/discussions)
- **Pull Requests**: Contribute improvements!

---

## 🔐 Security Reminders

Before committing any code:

1. **Never commit `.env` files** - Already in `.gitignore` ✅
2. **Run secret scan**: `cd backend && npm run secret-scan`
3. **Review [SECURITY.md](SECURITY.md)** before contributing
4. **Rotate API keys quarterly** - Set calendar reminder

---

## 🤝 Need Help?

1. **Check Troubleshooting** section above
2. **Read [API_KEY_SETUP.md](API_KEY_SETUP.md)** for detailed API key help
3. **Search [existing issues](https://github.com/hollandkevint/CensusChat/issues)**
4. **Open a new issue** with:
   - Your OS (Mac/Windows/Linux)
   - Node.js version (`node --version`)
   - Error messages (full output)
   - Steps to reproduce

---

## 📝 Quick Command Reference

```bash
# Start everything
docker-compose up -d
cd backend && npm run dev  # Terminal 1
cd frontend && npm run dev  # Terminal 2

# Stop everything
docker-compose down
# Press Ctrl+C in both terminals

# Run tests
cd backend && npm test

# Check for secrets before commit
cd backend && npm run secret-scan

# Update dependencies
npm update
```

---

**Happy coding!** 🎉 If CensusChat helps your work, consider giving it a ⭐ star!

**Questions?** Open an issue: https://github.com/hollandkevint/CensusChat/issues
