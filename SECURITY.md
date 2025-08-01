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
   - Rotate keys regularly

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

## Contact

For security-related questions or concerns:

- **Email**: security@censuschat.org
- **GPG Key**: [Coming Soon]

---

Thank you for helping keep CensusChat and our users safe!