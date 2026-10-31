# Contributing to Project Guardian MCP Server

Thank you for your interest in contributing to the Project Guardian MCP Server! This document provides guidelines for contributing to this project.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Database Considerations](#database-considerations)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Ways to Contribute

### Code Contributions
- **Bug fixes**: Fix issues in database operations, knowledge graph, or memory management
- **New features**: Add new database capabilities, graph operations, or project management features
- **Performance improvements**: Optimize database queries or graph operations
- **Documentation**: Improve documentation and examples

### Testing & Quality
- **Bug reports**: Report issues with detailed reproduction steps
- **Test coverage**: Add or improve test cases
- **Database testing**: Test with different data scenarios

### Documentation
- **README updates**: Keep documentation current
- **Examples**: Provide usage examples and tutorials
- **Database documentation**: Document schema changes and operations

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Hela-Ecosystem/project-guardian-mcp-server.git
   cd Project-Guardian-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and ensure tests pass:
   ```bash
   npm test
   ```

3. **Run linting**:
   ```bash
   npm run lint
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Commit your changes**:
   ```bash
   git commit -m "Add: brief description of your changes"
   ```

6. **Push to your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**

## Coding Standards

### General Guidelines
- Follow TypeScript best practices
- Handle database operations safely
- Implement proper error handling for database failures
- Use transactions for multi-step operations
- Validate data before database operations

### Code Style
- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Follow the existing code patterns
- Use ESLint configuration

### Commit Messages
- Use conventional commit format: `type: description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Keep first line under 50 characters
- Add detailed description for complex changes

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests
- Add unit tests for new database operations
- Add integration tests for database interactions
- Test error conditions and edge cases
- Test with different data types and relationships
- Maintain high test coverage

## Database Considerations

### Schema Changes
- Document all database schema changes
- Provide migration scripts for schema updates
- Test migrations thoroughly
- Maintain backward compatibility when possible

### Data Integrity
- Validate data before insertion
- Handle foreign key constraints properly
- Implement proper error handling for constraint violations
- Test with various data scenarios

### Performance
- Optimize database queries
- Use appropriate indexes
- Monitor query performance
- Implement caching where appropriate

## Pull Request Process

1. **Ensure all tests pass**
2. **Update documentation** if needed
3. **Add tests** for new features
4. **Follow coding standards**
5. **Write clear commit messages**
6. **Test database operations thoroughly**

### PR Checklist
- [ ] Tests pass
- [ ] Code is linted
- [ ] Documentation updated
- [ ] Database schema documented
- [ ] Data integrity verified
- [ ] Commit messages follow conventions
- [ ] PR description is clear
- [ ] Breaking changes documented

## Reporting Issues

### Bug Reports
Please include:
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Node.js version, OS, database state
- **Database logs**: Any relevant database error messages
- **Logs**: Application logs with database operations

### Feature Requests
Please include:
- **Use case**: Why this feature is needed
- **Proposed solution**: How it should work
- **Database impact**: How it affects data storage/retrieval
- **Alternatives considered**: Other approaches

## Getting Help

- **Issues**: Use GitHub issues for bugs and features
- **Discussions**: Join community discussions
- **Documentation**: Check the README and docs folder

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
