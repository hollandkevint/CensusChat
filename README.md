# CensusChat

> Natural language interface for US Census data - ask questions in plain English, get instant insights

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/username/CensusChat/actions/workflows/ci.yml/badge.svg)](https://github.com/username/CensusChat/actions/workflows/ci.yml)

## 🎯 What is CensusChat?

CensusChat democratizes access to US Census data by allowing anyone to query demographic information using natural language instead of complex SQL or API calls. Built for researchers, journalists, analysts, and anyone who needs quick access to census insights.

### ✨ Key Features

- **Natural Language Queries** - Ask questions like "What's the population of Texas cities over 100,000?"
- **Lightning Fast** - Sub-second responses on millions of census records
- **Comprehensive Data** - Access to US Census ACS 5-year detailed tables
- **Export Options** - Download results as CSV, JSON, or Excel
- **Open Source** - Transparent, community-driven development

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- Docker and Docker Compose
- Git

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/username/CensusChat.git
cd CensusChat

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the application
docker-compose up

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3001/api/v1
```

### Local Development

```bash
# Backend setup
cd backend
npm install
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

## 📖 Documentation

- [📚 Complete Documentation](docs/README.md) - All documentation index
- [🚀 Getting Started Guide](docs/guides/getting-started.md) - Quick start for new users  
- [📡 API Documentation](docs/api/README.md) - REST API reference
- [🏗️ Architecture Overview](docs/architecture/README.md) - System architecture
- [🤝 Contributing Guide](CONTRIBUTING.md) - How to contribute

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development setup
- Submitting pull requests
- Reporting issues

## 🔒 Security

Security is a top priority. Please see our [Security Policy](SECURITY.md) for:

- Reporting vulnerabilities
- Security best practices
- Responsible disclosure

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- US Census Bureau for providing open access to demographic data
- [DuckDB](https://duckdb.org/) for high-performance analytical queries
- All our contributors and community members

## 🔗 Links

- [Documentation](https://docs.censuschat.org) (coming soon)
- [Community Forum](https://community.censuschat.org) (coming soon)
- [Report Issues](https://github.com/username/CensusChat/issues)