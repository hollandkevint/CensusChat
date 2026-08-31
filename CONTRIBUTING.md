# Contributing to CensusChat

First off, thank you for considering contributing to CensusChat! It's people like you that make CensusChat such a great tool for democratizing access to Census data.

## Ground rules

Be civil and assume good faith. Keep discussion on the technical substance. The
maintainer may close or lock anything that stops being productive.

There is no auth, no user accounts, and no billing in this repo. It is a self-hosted
tool you run against your own Census API key. Please do not file issues or PRs that
assume a hosted service, a signup flow, or a paid tier exists.

## How Can I Contribute?

### Reporting bugs

Open a [bug report](https://github.com/hollandkevint/CensusChat/issues/new?template=bug_report.yml).
The template asks for the reproduction steps, error output, and environment. Search
existing issues first. Redact your `ANTHROPIC_API_KEY` and `CENSUS_API_KEY` from anything
you paste.

Security vulnerabilities do not go in public issues. Use
[GitHub Security Advisories](https://github.com/hollandkevint/CensusChat/security/advisories/new).

### Suggesting enhancements

Open a [feature request](https://github.com/hollandkevint/CensusChat/issues/new?template=feature_request.yml).
Lead with the problem you hit, not the solution you have in mind.

### Pull requests

1. Fork the repo and branch from `main`.
2. Add tests for behavior you add or change. Backend tests live in `backend/src/__tests__/`.
3. Update the docs if you changed an API or a setup step.
4. Run the checks in the "Verifying your change" section below. CI runs the same ones.
5. Fill in the PR template, including the claims checkbox if you touched a public surface.

## Development Setup

### Prerequisites

- Node.js 20+
- Docker with the Compose plugin (`docker compose`)
- Git
- An Anthropic API key and a US Census API key. See [API_KEY_SETUP.md](API_KEY_SETUP.md).

### Setup

```bash
git clone https://github.com/yourusername/CensusChat.git
cd CensusChat

make setup-env          # copies env.example to .env
# edit .env: ANTHROPIC_API_KEY, CENSUS_API_KEY, JWT_SECRET, passwords

make install            # npm install in backend/ and frontend/
make dev                # docker compose up (backend :3001, frontend :3000)
```

`make dev` starts Postgres, Redis, the backend, and the frontend. Census data is not
bundled. Loading it is a separate long-running step (`make load-data`, hours), so many
changes are easier to work on against the test suites than against a live query.

Backend tests run without Docker: `cd backend && npm test`.

### Development workflow

1. **Branch**: `git checkout -b feature/my-change`
2. **Make your changes**, with conventional commit messages (see below).
3. **Verify** with the commands in the next section.
4. **Push** and open a PR against `main`.

## Verifying your change

Run what CI runs. `.github/workflows/ci.yml` is the source of truth; these are the same
commands.

```bash
# Backend: lint, types, unit tests, build
cd backend && npm run lint && npm run typecheck && npm test && npm run build

# Frontend: lint, types, build. There is no frontend unit-test suite.
cd frontend && npm run lint && npm run typecheck && npm run build

# Frontend end-to-end (Playwright, backend API mocked)
cd frontend && npx playwright install --with-deps chromium && npm run test:e2e

# Public-surface claim guard
bash scripts/check-marketing-claims.sh
```

`make lint`, `make typecheck`, `make test`, and `make test-e2e` wrap the same commands.

CI also builds both Docker images and runs `docker compose config`. If you changed a
Dockerfile or `docker-compose.yml`, build locally before pushing.

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

- ESLint is the enforced check. `npm run lint` in `backend/` and in `frontend/` must pass;
  CI runs both. There is no repo-wide Prettier config and no `format` script, so match the
  style of the file you are editing rather than reformatting it.
- TypeScript with `strict` mode. `npm run typecheck` must pass.
- Use meaningful variable and function names.
- Write JSDoc comments for public APIs.

### Testing

- Backend uses Jest. Tests live in `backend/src/__tests__/`, mirroring the `src/` layout.
- Frontend has no unit-test suite. UI behavior is covered by Playwright specs in
  `frontend/e2e/`, which run against a mocked backend API.
- Add a test that fails without your change. A test that passes either way proves nothing.
- All tests must pass before you open the PR.

## Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Follow security best practices
- Report security vulnerabilities privately through
  [GitHub Security Advisories](https://github.com/hollandkevint/CensusChat/security/advisories/new),
  not in a public issue. See [SECURITY.md](SECURITY.md).
- Run `npm run secret-scan` in `backend/` before you push

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

- Read [QUICK_START.md](QUICK_START.md) and [API_KEY_SETUP.md](API_KEY_SETUP.md) first.
  Most local-run problems are covered there.
- Still stuck? Open an issue. GitHub Discussions is not enabled on this repo.
- Ask questions inline on your own pull request.

Thank you for contributing to CensusChat.