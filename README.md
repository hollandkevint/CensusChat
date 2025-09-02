# CensusChat: Healthcare Demographics Made Simple

<div align="center">

![CensusChat](https://img.shields.io/badge/CensusChat-Healthcare%20Data-blue?style=for-the-badge&logo=health&logoColor=white)
[![Test Coverage](https://img.shields.io/badge/Test%20Coverage-89%25-green?style=for-the-badge)](docs/TESTING_INFRASTRUCTURE.md)
[![MCP Integration](https://img.shields.io/badge/MCP-Claude%20AI-purple?style=for-the-badge)](https://modelcontextprotocol.io/)

**Natural language interface to US Census data for healthcare strategy teams**

*Transform 6-week $50K demographic consulting into 6-second $297/month queries*

**[🚀 Try Demo](https://censuschat.com/demo)** • **[📖 Read Kevin's Story](https://hollandkevint.github.io/CensusChat/about/)** • **[📧 Get Early Access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access)**

</div>

---

## 🎯 **The Problem**

Healthcare strategy teams wait **6+ weeks** and pay **$50K+** for demographic analysis that CensusChat delivers in **23 minutes** for **$297/month**.

```typescript
"Show me Medicare eligible seniors in Tampa Bay with household income over $75K"
→ Instant Excel export with confidence intervals
```

---

## ⚡ **How It Works**

### **1. Natural Language Input**
Ask questions in plain English - no SQL knowledge required

### **2. AI-Powered Processing**  
- **Claude Sonnet 4** translates to validated SQL
- **Model Context Protocol** ensures security + performance
- **Census Bureau API** retrieves demographic data

### **3. Professional Output**
- Excel-ready data with statistical metadata
- PDF reports for presentations
- Tableau/Power BI integration ready

---

## 🏥 **Built for Healthcare Professionals**

**Primary Users:**
- Business Analysts at health systems and Medicare Advantage plans
- Strategy Teams planning market expansion and facility placement
- Healthcare Researchers conducting population health studies

**Proven Results:**
> *"Used to take our analytics team 2 weeks to pull Medicare Advantage market data. Now I get it in seconds and can focus on strategy instead of waiting."*  
> **— Sarah L., VP Strategy, Regional Health System**

---

## 🛠 **Technical Foundation**

### **Architecture**
```typescript
const stack = {
  backend: "Node.js 20 + TypeScript + Express",
  frontend: "Next.js 15 + React 19 + Tailwind",
  databases: "PostgreSQL + Redis + DuckDB",
  ai: "Claude Sonnet 4 + Model Context Protocol",
  deployment: "Docker + containerized testing"
};
```

### **Performance Metrics**
- **Sub-2 Second Queries** on 11M+ Census records
- **89% Test Coverage** with comprehensive CI/CD
- **80%+ Cache Hit Rate** for optimized performance
- **HIPAA-Ready Architecture** with enterprise security

**Innovation:** First healthcare platform combining MCP + Claude for validated demographic queries.

---

## 🚦 **Quick Start**

### **Development Setup**
```bash
# Clone and run
git clone https://github.com/hollandkevint/CensusChat.git
cd CensusChat
./test-runner.sh

# Start development
cd backend && npm run dev    # API (port 3001)
cd frontend && npm run dev   # Web app (port 3000)
```

### **Docker (Recommended)**
```bash
docker-compose -f docker-compose.test.yml up
# Includes: PostgreSQL + Redis + Census API mock + automated tests
```

### **Environment Variables**
```bash
ANTHROPIC_API_KEY=your-claude-api-key
CENSUS_API_KEY=your-census-api-key
DATABASE_URL=postgresql://localhost:5432/census_chat
```

---

## 📊 **Features**

### **Healthcare-Specific Queries**
- Medicare eligibility calculations (age 65+ demographics)  
- Senior care demographics for facility planning
- Population health indicators and social determinants
- Market analysis for health system expansion

### **Professional Data Export**
- Excel exports with statistical confidence intervals
- CSV files for Tableau/Power BI integration
- PDF reports for board presentations
- Real-time query iteration capability

### **Enterprise Security**
- HIPAA-ready architecture with encryption
- SOC 2 compliance planning and audit trails
- No PHI storage - only aggregated demographic data
- API rate limiting and abuse prevention

---

## 📈 **Market Impact**

**Problem We Solve:**
- **$2.8B** spent annually on demographic consulting
- **6,090** hospitals needing demographic analysis
- **30,000+** senior care facilities planning expansion

**Our Solution:**
- **200x cost reduction**: $50K → $297/month
- **300x speed improvement**: 6 weeks → 23 minutes
- **Unlimited iterations** vs. limited consultant revisions

---

## 📚 **Documentation**

### **Technical Guides**
- [Testing Infrastructure](docs/TESTING_INFRASTRUCTURE.md) - Docker setup and CI/CD
- [API Integration](docs/API_INTEGRATION_GUIDE.md) - MCP + Claude architecture
- [Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md) - Next.js component design

### **Product Resources**
- [User Personas](docs/USER_PERSONAS.md) - Healthcare analyst profiles
- [Feature Roadmap](docs/FEATURE_ROADMAP.md) - 4-week MVP development plan
- [Success Metrics](docs/SUCCESS_METRICS.md) - KPI framework

---

## 🚀 **Get Involved**

### **For Healthcare Teams**
**[📧 Request Early Access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access&body=Organization:%0ARole:%0ACurrent%20demographic%20analysis%20challenges:)** - Join 25 healthcare organizations in pilot program

### **For Developers**
**[💬 Technical Discussion](https://github.com/hollandkevint/CensusChat/discussions)** - Architecture, MCP integration, and healthcare data patterns

### **For Contributors**
- Write quality TypeScript with 90%+ test coverage
- All features must serve healthcare users
- Maintain sub-2s query response times
- Follow HIPAA-ready security practices

---

<div align="center">

**⭐ Star this repository if CensusChat helps your healthcare data work**

---

**[🚀 Try CensusChat](https://censuschat.com)** • **[📖 Documentation](docs/)** • **[💬 Community](https://github.com/hollandkevint/CensusChat/discussions)**

*Transforming healthcare demographic analysis from weeks to seconds*

---

### 👤 **About Kevin Holland**

10+ years healthcare data experience • Built for 2M+ member Medicare Advantage plans • Frustrated by $50K consulting delays

**[📖 Read Kevin's Full Story](https://hollandkevint.github.io/CensusChat/about/)** | **[📧 Get Updates](mailto:kevin@kevintholland.com?subject=CensusChat%20Updates)**

</div>