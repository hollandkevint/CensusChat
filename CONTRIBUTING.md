# Contributing to CensusChat

First off, thank you for considering contributing to CensusChat! It's people like you that make CensusChat such a great tool for democratizing access to Census data.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what behavior you expected
- **Include screenshots** if applicable
- **Include your environment details** (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List some examples** of how the enhancement would be used

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git

### Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/CensusChat.git
cd CensusChat

# Set up environment
make setup-env
# Edit .env with your configuration

# Install dependencies
make install

# Start development environment
make dev
```

### Development Workflow

1. **Create a branch**: `git checkout -b feature/my-new-feature`
2. **Make your changes** with proper commit messages
3. **Test your changes**: `make test`
4. **Lint your code**: `make lint`
5. **Type check**: `make typecheck`
6. **Commit your changes**: `git commit -am 'Add some feature'`
7. **Push to the branch**: `git push origin feature/my-new-feature`
8. **Submit a pull request**

## Coding Standards

### General Guidelines

- Write clear, readable code
- Use TypeScript for type safety
- Follow the existing code style
- Write meaningful commit messages
- Add tests for new functionality

### Commit Messages

We use conventional commits. Format: `type(scope): description`

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `test`: Adding missing tests
- `chore`: Changes to build process or auxiliary tools

Examples:
- `feat(api): add census data filtering`
- `fix(query): handle malformed natural language input`
- `docs(readme): update installation instructions`

### Code Style

- Use Prettier for formatting
- Use ESLint for linting
- Follow TypeScript best practices
- Use meaningful variable and function names
- Write JSDoc comments for public APIs

### Testing

- Write unit tests for new functions
- Write integration tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage

## Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Follow security best practices
- Report security vulnerabilities privately to security@censuschat.org

## Documentation

- Update README.md if needed
- Document new APIs
- Update inline code comments
- Write clear PR descriptions

## Marketing and Public Claims

Public surfaces are `README.md`, `index.md`, `_config.yml`, `landing/`, `docs/landing/`,
`marketing/`, `content/`, and user-visible strings in `frontend/src/`.

**Every factual claim on a public surface must be checkable against a file in this repo.**
That means a number, a percentage, a customer, an outcome, a benchmark, or a capability
you can point at a file and line for.

Concretely:

- **No customers, testimonials, or customer outcomes** until a real one exists and has
  given permission. There is no auth or billing in this repo, so there are no customers.
- **No performance number you have not measured and committed the evidence for.**
  If you cannot run the measurement, write the claim as a target and say it is a target.
- **No coverage, uptime, hit-rate, or scale figure** without a committed report or a
  configured threshold backing it.
- **Cite the source in your PR description** for any claim you add. `README.md:37` is a
  citation; "we discussed it" is not.
- **If you cannot substantiate it, cut it.** Do not soften it. A vaguer version of an
  unsupported claim is still an unsupported claim.

`scripts/check-marketing-claims.sh` runs in CI and blocks a specific list of claims that
were removed once already. It only catches strings someone thought to add, so it is a
backstop for repeat offenders, not a substitute for the rule above. When you remove an
unsupported claim, add its pattern to that script so it cannot come back.

## Getting Help

- Join our discussions on GitHub
- Ask questions in pull requests
- Review existing issues and documentation

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special thanks in major version releases

Thank you for contributing to CensusChat! 🎉