# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of CensusChat seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Reporting Process

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@censuschat.org**

Please include the following information in your report:

- A description of the vulnerability
- Steps to reproduce the issue
- Possible impact of the vulnerability
- Any suggested fixes or mitigations

### Response Timeline

- **Acknowledgment**: We will acknowledge your email within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Updates**: We will send you regular updates on our progress
- **Resolution**: We aim to resolve critical vulnerabilities within 90 days

### Responsible Disclosure

We request that you:

- Give us reasonable time to investigate and fix the issue
- Do not publicly disclose the vulnerability until we have released a fix
- Do not exploit the vulnerability for malicious purposes

## Security Best Practices

### For Users

1. **Environment Variables**
   - Always use strong, unique passwords
   - Never commit `.env` files to version control
   - Use different credentials for each environment

2. **Database Security**
   - Change default database passwords
   - Use SSL connections in production
   - Regularly backup your data

3. **API Keys**
   - Keep Census API keys secure
   - Use read-only permissions when possible
   - **Rotate keys on schedule**:
     - Development: Every 6 months
     - Staging: Every 3 months
     - Production: Every 1 month
   - See [API_KEY_SETUP.md](API_KEY_SETUP.md) for rotation instructions

### For Developers

1. **Code Security**
   - Never hardcode secrets in source code
   - Use environment variables for all sensitive data
   - Validate all user inputs
   - Sanitize SQL queries (we use parameterized queries)

2. **Dependencies**
   - Keep dependencies up to date
   - Use `npm audit` to check for vulnerabilities
   - Enable Dependabot for automated updates

3. **Docker Security**
   - Use non-root users in containers
   - Keep base images updated
   - Scan images for vulnerabilities

4. **Pre-commit Secret Scanning**
   - Install git-secrets or gitleaks to prevent committing secrets
   - Setup instructions:
   ```bash
   # Install husky for git hooks
   npm install --save-dev husky
   npx husky install

   # Add pre-commit hook to scan for secrets
   npx husky add .husky/pre-commit "npm run secret-scan"
   ```
   - Add to `package.json`:
   ```json
   "scripts": {
     "secret-scan": "git diff --cached --name-only | grep -E '\\.(js|ts|jsx|tsx|json|env)$' | xargs grep -E '(sk-ant-api03|ANTHROPIC_API_KEY|CENSUS_API_KEY)' && exit 1 || exit 0"
   }
   ```

## Security Features

### Current Implementation

- **Input Validation**: All API inputs are validated using Joi schemas
- **SQL Injection Prevention**: Only SELECT statements allowed, parameterized queries
- **Authentication**: JWT-based with secure secret requirements
- **Rate Limiting**: Implemented to prevent abuse
- **CORS**: Configurable origins for cross-origin requests
- **Encryption**: Data encrypted at rest and in transit

### Security Headers

CensusChat implements the following security headers:

- `Helmet.js` for various security headers
- `CORS` with restricted origins
- `Content Security Policy` (CSP)
- `X-Frame-Options`
- `X-Content-Type-Options`

## Infrastructure Security

### Environment Separation

- **Development**: Local environment with debugging enabled
- **Staging**: Production-like environment for testing
- **Production**: Hardened environment with security monitoring

### Data Security

- **Personal Data**: We only process aggregated Census data (no PII)
- **User Data**: Minimal user information stored, encrypted at rest
- **Backups**: Regular encrypted backups with retention policies

## Compliance

CensusChat follows these security standards:

- **OWASP Top 10**: Protection against common web vulnerabilities
- **Data Minimization**: Only collect necessary data
- **Transparency**: Open source for security auditing

## Security Monitoring

We monitor for:

- Failed authentication attempts
- Unusual query patterns
- System resource abuse
- Dependency vulnerabilities

## API Key Rotation Policy

### Rotation Schedule

| Environment | Rotation Frequency | Responsibility |
|-------------|-------------------|----------------|
| Development | Every 6 months | Developers |
| Staging | Every 3 months | DevOps Team |
| Production | Every 1 month | Security Team |

### Rotation Process

#### Anthropic API Key:
1. Generate new key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Update environment variables
3. Deploy and test
4. Delete old key from console
5. Update documentation with rotation date

#### Census API Key:
1. Request new key at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)
2. Receive key via email (1-2 business days)
3. Update environment variables
4. Deploy and test
5. Old key expires after 90 days of inactivity

### Emergency Key Revocation

If a key is compromised:
1. **Immediately revoke** the exposed key at provider console
2. **Generate new key** and update all environments
3. **Scan git history** for exposed credentials
4. **Clean git history** if needed (use BFG Repo-Cleaner)
5. **Document incident** and update security procedures

## Contact

For security-related questions or concerns:

- **Email**: kevin@kevintholland.com
- **Security Issues**: Report via [GitHub Security Advisories](https://github.com/hollandkevint/CensusChat/security/advisories)
- **GPG Key**: [Coming Soon]

---

Thank you for helping keep CensusChat and our users safe!