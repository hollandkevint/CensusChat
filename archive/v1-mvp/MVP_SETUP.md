# CensusChat MVP Setup Guide

## 🚀 Interactive Chat Interface with Anthropic API

This guide will get your CensusChat MVP running with:
- ✅ Interactive chat interface on the landing page
- ✅ Anthropic Sonnet 4 powered query processing
- ✅ Real-time natural language to demographic data conversion
- ✅ Mock data responses while Census data loading is in progress
- ✅ Professional healthcare-focused UI

## Prerequisites

1. **Node.js 18+** installed
2. **Anthropic API Key** (required for AI-powered queries)
3. **Census API Key** (optional but recommended for full data loading)

## Quick Start

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Configure API Keys

1. **Get Anthropic API Key** (Required):
   - Visit https://console.anthropic.com/
   - Create account and generate API key
   - Copy the key

2. **Get Census API Key** (Optional):
   - Visit https://api.census.gov/data/key_signup.html
   - Fill out registration form
   - Wait for approval email (1-2 business days)

3. **Configure Environment Variables**:
   ```bash
   cd backend
   # Edit .env file
   nano .env
   
   # Add your keys:
   ANTHROPIC_API_KEY=your_anthropic_key_here
   CENSUS_API_KEY=your_census_key_here
   ```

### Step 3: Initialize Foundation Data (Optional)

```bash
cd backend
npm run init-data
```

**Note**: This will work with mock data even without API keys, but real Census data requires the CENSUS_API_KEY.

### Step 4: Start the Servers

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend  
npm run dev
```

### Step 5: Test the Interactive Chat

1. Open http://localhost:3000
2. Scroll to the "Ask in English, Get Excel Results in 2 Seconds" section
3. Try example queries:
   - "Show me Medicare eligible seniors in Florida with income over $50k"
   - "Find senior care demographics in Texas counties"
   - "Population of California cities over 100,000"

## 🧠 AI-Powered Query Processing

With your Anthropic API key configured, the system will:

1. **Parse Natural Language**: Convert healthcare queries to structured analysis
2. **Extract Entities**: Identify locations, demographics, age groups, income ranges  
3. **Generate SQL**: Create appropriate queries for Census data
4. **Provide Explanations**: AI-generated insights about the results
5. **Suggest Follow-ups**: Recommend related questions for deeper analysis

## 📊 Current MVP Features

### ✅ Implemented
- Interactive chat interface replacing static demo
- Anthropic Sonnet 4 integration for NLP
- Query processing with structured analysis
- Mock data responses with realistic healthcare demographics
- Excel/CSV download placeholders
- Professional landing page with healthcare focus
- Error handling and loading states
- Mobile-responsive chat design

### 🚧 Coming Next
- Real Census data integration (when API keys configured)
- Actual Excel/CSV export functionality
- User authentication and query history
- Advanced data visualizations
- Query result caching

## 🔧 Technical Architecture

```
Frontend (Next.js) → API Proxy → Backend (Express.js) → Anthropic API
                                                     ↓
                                                 Census API
                                                     ↓
                                                  DuckDB
```

### Key Components:
- **ChatInterface.tsx**: React component for interactive chat
- **anthropicService.ts**: Anthropic API integration with Sonnet 4
- **query.routes.ts**: API endpoint processing natural language queries
- **DataLoadingOrchestrator**: Census data loading and management

## 🏥 Healthcare Demo Scenarios

Try these example queries to showcase the healthcare focus:

1. **Medicare Advantage Analysis**:
   - "Medicare eligible seniors in Florida with household income over $75k"
   - "Senior population by county in Texas for Medicare Advantage planning"

2. **Senior Care Market Research**:
   - "Demographics for assisted living in California - age 75+ with income $40k+"
   - "Senior care target population in North Carolina counties"

3. **Health System Planning**:
   - "Population density and age demographics for hospital planning in Georgia"
   - "Healthcare service area analysis for seniors in Arizona"

## 🎯 MVP Success Metrics

- ✅ Interactive chat replaces static demo
- ✅ Natural language queries processed with AI
- ✅ Professional healthcare-focused presentation
- ✅ Sub-3 second response times (with mock data)
- ✅ Mobile-responsive interface
- ✅ Error handling and user guidance

## 🚀 Next Development Phase

**Week 2 Priorities**:
1. **Real Data Integration**: Connect processed queries to actual Census data
2. **Export Functionality**: Implement actual Excel/CSV downloads
3. **Query History**: Add user sessions and query persistence
4. **Advanced NLP**: Handle more complex query patterns
5. **Data Visualization**: Add charts and graphs to results

## 🔐 Security Notes

- API keys are properly secured in environment variables
- CORS configured for localhost development
- Input validation on query processing
- Error messages don't expose sensitive information

## 📞 Support & Next Steps

**If you encounter issues**:
1. Check that both servers are running (ports 3000 and 3001)
2. Verify Anthropic API key is valid and has credits
3. Check browser console for any errors
4. Ensure network requests to `/api/v1/queries` are successful

**Ready for production?**
1. Add Census API key for real data
2. Configure production database
3. Set up proper authentication
4. Deploy to your hosting provider

---

**🎉 Congratulations! Your CensusChat MVP with AI-powered chat is now running!**

The interactive chat interface now powers your landing page, demonstrating the core value proposition of natural language to demographic data conversion powered by Anthropic's Sonnet 4.