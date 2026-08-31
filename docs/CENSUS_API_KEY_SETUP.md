# Census API Key Setup Guide

## Overview

The Census Data Loading System can operate with or without a Census API key, but having an API key significantly improves performance and capabilities.

## Without API Key (Default)

### Limitations
- **Daily Limit**: 500 API calls per day per IP address
- **Rate Limiting**: Stricter throttling during peak hours
- **Performance**: Limited concurrent processing capability
- **Foundation Phase**: Cannot complete full foundation phase (requires ~200 API calls)

### What You Can Do
- **Limited Testing**: Load ~25 ZIP codes or 5 counties
- **Development**: Full system testing with mocks
- **Proof of Concept**: Demonstrate system capabilities

### Configuration
No additional setup required. System automatically detects missing API key and adapts:

```typescript
// Automatic detection
const rateLimitInfo = censusApiService.getRateLimitInfo();
console.log(rateLimitInfo.hasKey); // false
console.log(rateLimitInfo.dailyLimit); // "500 queries per day"
```

## With API Key (Recommended)

### Benefits
- **Daily Limit**: 10,000+ API calls per day
- **Better Performance**: Higher concurrent request limits
- **Full Loading**: Complete all loading phases
- **Production Ready**: Suitable for production deployment

### Performance Comparison

| Feature | Without Key | With Key |
|---------|-------------|----------|
| Daily API Calls | 500 | 10,000+ |
| Foundation Phase | ❌ Partial | ✅ Complete |
| Concurrent Workers | 2-3 | 5-8 |
| Full State Loading | ❌ Limited | ✅ Yes |
| Production Use | ❌ No | ✅ Yes |

## Obtaining a Census API Key

### Step 1: Register for an API Key

1. **Visit Registration Page**
   ```
   https://api.census.gov/data/key_signup.html
   ```

2. **Fill Out Registration Form**
   - Organization name (your company/project)
   - Email address (business email preferred)
   - Intended use description
   - Website (if applicable)

3. **Provide Use Case Description**
   
   **Example Description:**
   ```
   We are developing CensusChat, a natural language interface for 
   U.S. Census data analysis. The API key will be used to:
   
   - Load American Community Survey 5-year estimates
   - Process data for states, counties, ZIP codes, and census tracts
   - Support demographic and economic analysis
   - Provide data visualization and insights
   
   Expected usage: ~2,000-5,000 API calls per day for data loading
   and real-time user queries.
   ```

4. **Submit Application**
   - Review terms of service
   - Submit registration form
   - Wait for approval email (usually within 1-2 business days)

### Step 2: API Key Approval

You'll receive an email with:
- Your unique API key (40-character string)
- Usage guidelines and terms
- Technical documentation links

**Example API Key Format:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

### Step 3: Configure API Key

#### Environment Variable (Recommended)
Add to your `.env` file:

```bash
# Census API Configuration
CENSUS_API_KEY=your_actual_api_key_here
```

#### Verification
Test your API key configuration:

```bash
# Check configuration
npm run dev

# In logs, look for:
✅ Configuration loaded successfully
   API Key: Configured (first 8 chars: a1b2c3d4...)
```

#### Programmatic Verification
```typescript
import { censusApiService } from './services/censusApiService';

const rateLimitInfo = censusApiService.getRateLimitInfo();
console.log('Has API Key:', rateLimitInfo.hasKey);
console.log('Daily Limit:', rateLimitInfo.dailyLimit);

// Expected output with key:
// Has API Key: true
// Daily Limit: Unlimited
```

## API Key Security

### Environment Variables
**✅ Correct: Use environment variables**
```bash
# .env file
CENSUS_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

**❌ Incorrect: Hard-coded in source**
```typescript
// DON'T DO THIS
const apiKey = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0";
```

### Production Security
- Store in secure environment variable service
- Use secrets management (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate keys periodically
- Monitor usage for anomalies

### Docker Configuration
```dockerfile
# Dockerfile
ENV CENSUS_API_KEY=""

# docker-compose.yml
services:
  backend:
    environment:
      - CENSUS_API_KEY=${CENSUS_API_KEY}
```

## Testing API Key Setup

### Basic Test
```bash
# Test API key with simple query
curl "https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E&for=state:06&key=YOUR_API_KEY"
```

### System Test
```bash
# Start the system
npm run dev

# Test loading with foundation phase
curl -X POST http://localhost:3001/api/v1/data-loading/start \
  -H "Content-Type: application/json" \
  -d '{"phases": ["foundation"]}'

# Monitor progress
curl http://localhost:3001/api/v1/data-loading/progress
```

### Expected Results with API Key
```json
{
  "success": true,
  "progress": {
    "totalJobs": 150,
    "completedJobs": 25,
    "apiCallsUsed": 89,
    "apiCallsRemaining": 9911,
    "status": "loading"
  }
}
```

## Rate Limiting and Usage

### With API Key Rate Limits
- **Concurrent Requests**: 50 simultaneous requests
- **Daily Limit**: 10,000 requests (increases with usage justification)
- **Burst Handling**: Better tolerance for traffic spikes

### System Adaptation
The system automatically adapts when an API key is detected:

```typescript
// LoadingConfiguration automatically adjusts
if (config.api.census.apiKey) {
  this.config.apiRateLimit.dailyLimit = 10000;
  this.config.apiRateLimit.burstLimit = 50;
  this.config.maxConcurrentJobs = 5;
}
```

### Monitoring Usage
Track your API usage:

```bash
# Get current usage
curl http://localhost:3001/api/v1/data-loading/analytics

# Response includes API usage
{
  "analytics": {
    "apiUsage": {
      "callsUsed": 1245,
      "callsRemaining": 8755,
      "usagePercentage": "12.45%"
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Invalid API Key
**Error:** `Census API request failed: 400 Bad Request`

**Solutions:**
- Verify key format (40 characters, alphanumeric)
- Check for extra spaces or characters
- Confirm key is activated

#### 2. API Key Not Detected
**Symptoms:** System reports no API key despite configuration

**Solutions:**
```bash
# Check environment variable
echo $CENSUS_API_KEY

# Restart application
npm run dev

# Verify in configuration
grep CENSUS_API_KEY .env
```

#### 3. Rate Limits Still Low
**Issue:** System shows 500-call limit despite API key

**Solutions:**
- Restart application after adding key
- Verify key format
- Check application logs for configuration messages

#### 4. Key Suspended/Revoked
**Error:** `Census API request failed: 403 Forbidden`

**Solutions:**
- Contact Census Bureau API support
- Review usage patterns for compliance
- Check email for suspension notices

### Debug API Key Issues

#### Logging
Enable detailed API logging:

```typescript
// Enable debug logging
process.env.DEBUG = 'census-api:*';

// Check API calls
console.log('API URL:', buildApiUrl(query));
console.log('Has Key:', !!this.apiKey);
```

#### Manual Testing
Test API key directly:

```bash
# Test with curl
curl -v "https://api.census.gov/data/2022/acs/acs5?get=NAME&for=state:01&key=YOUR_KEY"

# Expected response with key
HTTP/1.1 200 OK
[["NAME","state"],["Alabama","01"]]
```

## Support and Resources

### Census Bureau Support
- **Email**: cnmp.developers.list@census.gov
- **Documentation**: https://www.census.gov/developers/
- **API Status**: https://status.census.gov/

### Common Questions

**Q: How long does API key approval take?**
A: Usually 1-2 business days, can be up to 1 week during high-volume periods.

**Q: Can I use the same key for multiple applications?**
A: Yes, but usage is tracked per key across all applications.

**Q: What happens if I exceed the daily limit?**
A: Requests return 429 (Too Many Requests) until the daily reset.

**Q: Can I request a higher daily limit?**
A: Yes, contact Census Bureau with usage justification.

**Q: Is there a cost for Census API access?**
A: No, Census API access is free for all users.

### Best Practices

#### Development
- Use separate keys for development/production
- Test with limited data first
- Monitor usage during development

#### Production
- Implement proper error handling for rate limits
- Cache responses when possible
- Use connection pooling
- Monitor key usage and health

#### Security
- Store keys securely
- Rotate keys periodically
- Monitor for unusual usage patterns
- Use HTTPS for all API calls

---

**Next Steps After API Key Setup:**

1. ✅ **Verify Configuration**: Confirm key is detected
2. ✅ **Run Foundation Phase**: Test full loading capability
3. ✅ **Monitor Usage**: Track API call consumption
4. ✅ **Production Deployment**: Deploy with confidence

With an API key configured, your Census Data Loading System can operate at full capacity and load comprehensive demographic data efficiently.