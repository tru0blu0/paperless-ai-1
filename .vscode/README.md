# VS Code Configuration for Paperless-AI Development

This directory contains a comprehensive VS Code configuration tailored specifically for paperless-ai development, including GitHub Copilot integration and development workflow optimization.

## 🚀 Quick Setup

### 1. Install Recommended Extensions

Install these extensions for the best development experience:

**Essential Extensions:**
- GitHub Copilot
- GitHub Copilot Chat
- Python (Microsoft)
- Pylance
- Docker
- Remote - Containers / Dev Containers

**Code Quality & Formatting:**
- ESLint
- Prettier - Code formatter
- Black Formatter (Python)

**Productivity & Git:**
- GitLens — Git superpowers
- TODO Tree
- Better Comments
- REST Client (for API testing)

**Optional but Recommended:**
- Google Gemini Code Assist (if available)
- Live Share (for pair programming)
- Code Spell Checker
- Settings Sync

### 2. Configure MCP (Model Context Protocol)

1. Copy the example MCP configuration:
   ```bash
   cp .vscode/mcp.json.example .vscode/mcp.json
   ```

2. Edit `.vscode/mcp.json` and replace placeholders:
   - `${CLOUD_AI_API_KEY}` - Your cloud AI service API key
   - `${PAPERLESS_API_URL}` - Your Paperless-ngx instance URL
   - `${PAPERLESS_API_TOKEN}` - Your Paperless-ngx API token

3. **Security Note**: The `.vscode/mcp.json` file is automatically excluded from git to protect your API keys.

## 📁 Configuration Files Overview

### `.vscode/settings.json`
Enhanced workspace settings including:
- Python development with Black formatting and Flake8 linting
- Node.js/JavaScript development with ESLint and Prettier
- Docker integration
- GitHub Copilot configuration
- File exclusions for better performance
- Terminal and git configurations

### `.vscode/tasks.json` 
Pre-configured development tasks:
- **Docker Compose**: Start/stop services
- **Development Servers**: Node.js and Python RAG service
- **Testing**: Both Python (pytest) and Node.js tests
- **Linting**: ESLint for JavaScript, Flake8 for Python
- **Formatting**: Prettier for JavaScript, Black for Python
- **Container Management**: Shell access, log viewing, rebuilding

### `.vscode/keybindings.json`
Productivity keyboard shortcuts:
- `Ctrl+Alt+R` - Start Docker Compose stack
- `Ctrl+Alt+D` - Stop Docker Compose stack
- `Ctrl+Alt+S` - Start Node.js dev server
- `Ctrl+Alt+P` - Start Python RAG service
- `Ctrl+Alt+F` - Format current document
- `Ctrl+Alt+L` - Lint JavaScript files
- `Ctrl+Shift+L` - Lint Python files
- `Ctrl+Alt+B` - Rebuild Docker container
- And more...

### `.vscode/chatmodes.json`
AI assistant chat modes tailored for paperless-ai:
- **paperless-ai-dev** - General development assistance
- **refactor-assistant** - Safe code refactoring
- **security-audit** - Security vulnerability assessment
- **test-writer** - Comprehensive test generation
- **docker-expert** - Container and deployment help
- **api-designer** - REST API design and documentation
- **pr-assistant** - Pull request descriptions and reviews

### `.vscode/mcp.json.example`
Model Context Protocol configuration template with:
- Local development server setup
- Cloud AI service integration
- Paperless-ngx context integration
- Security policies and rate limiting
- Project-specific context definitions

## 🛠 Development Workflows

### Starting Development Environment

1. **Full Docker Stack:**
   - Press `Ctrl+Alt+R` or run task "Compose: Up (dev)"
   - This starts both Node.js and Python services

2. **Local Development:**
   - Press `Ctrl+Alt+S` to start Node.js server (nodemon)
   - Press `Ctrl+Alt+P` to start Python RAG service
   - Use for faster iteration during development

### Testing

- **Run All Tests:** Use Command Palette → "Tasks: Run Task" → "Test: Python (pytest)" or "Test: Node.js"
- **Python Tests:** `Ctrl+Shift+P` → "Python: Run All Tests"
- **Watch Mode:** Tests run automatically on save (configured in settings)

### Code Quality

- **Auto-formatting:** Enabled on save for all file types
- **Linting:** Real-time linting with ESLint (JS) and Flake8 (Python)
- **Manual Formatting:** `Ctrl+Alt+F`
- **Manual Linting:** `Ctrl+Alt+L` (JS) or `Ctrl+Shift+L` (Python)

### Docker Operations

- **View Logs:** `Ctrl+Alt+V` or task "Docker: View Logs"
- **Rebuild Container:** `Ctrl+Alt+B` or task "Docker: Rebuild Container"  
- **Shell Access:** Run task "Run: Docker Shell (paperless-ai)"

## 🤖 AI Assistant Usage

### GitHub Copilot Chat Modes

Access specialized chat modes via the Command Palette:

1. **Development Questions:**
   ```
   @workspace /mode paperless-ai-dev
   How do I add a new AI provider to the configuration system?
   ```

2. **Security Reviews:**
   ```
   @workspace /mode security-audit
   Audit the API token handling in routes/setup.js for potential vulnerabilities.
   ```

3. **Test Generation:**
   ```
   @workspace /mode test-writer
   Create comprehensive tests for the document analysis pipeline.
   ```

### Prompt Templates

Use these templates in Copilot Chat:

**Code Change Request:**
```
In file [path/to/file.js], implement [specific functionality] with proper error handling, input validation, and tests. Consider security implications and maintain compatibility with existing code.
```

**Security Audit:**
```
Audit [file/directory] for security vulnerabilities including: API token exposure, input validation, SQL injection, XSS, and insecure configurations. Provide specific fixes with code examples.
```

**Test Generation:**
```
Generate comprehensive tests for [function/module] including success cases, error conditions, edge cases, and proper mocking of external services (Paperless-ngx API, AI providers).
```

## 🔒 Security Best Practices

1. **API Keys**: Never commit `mcp.json` or any files containing API keys
2. **Environment Variables**: Use `.env` files (already in .gitignore)
3. **Sensitive Data**: Added patterns to exclude credentials, keys, and secrets
4. **Code Review**: Use the security-audit chat mode for vulnerability assessments
5. **Rate Limiting**: MCP configuration includes rate limits to prevent API abuse

## 🐛 Troubleshooting

### Common Issues

1. **Tasks not working**: Ensure Docker is running and docker-compose is available
2. **Python linting errors**: Check that the virtual environment is activated
3. **Copilot not working**: Ensure you're signed in to GitHub and have Copilot access
4. **Extension conflicts**: Disable conflicting extensions or check extension-specific settings

### Performance Optimization

- File exclusions are configured to ignore build artifacts, dependencies, and cache files
- Search scope is limited to relevant directories
- Python virtual environment is properly configured to avoid scanning system packages

## 📝 Customization

### Project-Specific Adjustments

1. **Service Names**: Configuration uses `paperless-ai` as the Docker service name (from docker-compose.yml)
2. **Paths**: Configured for the current project structure (routes/, services/, public/, views/)
3. **Tech Stack**: Optimized for Node.js + Python + Docker development
4. **AI Providers**: Includes settings for OpenAI, Ollama, Azure OpenAI, and custom APIs

### Adding New Tasks

Edit `.vscode/tasks.json` to add new development tasks. Follow the existing pattern:

```json
{
  "label": "My Custom Task",
  "type": "shell", 
  "command": "your-command-here",
  "group": "build",
  "presentation": {
    "reveal": "always"
  },
  "problemMatcher": []
}
```

### Extending AI Chat Modes

Add new modes to `.vscode/chatmodes.json`:

```json
{
  "id": "my-mode",
  "title": "My Custom Mode",
  "description": "Description of what this mode does",
  "system_prompt": "You are an expert in...",
  "example_user_prompt": "Example of how to use this mode"
}
```

## 🤝 Contributing

When contributing to this configuration:

1. Test changes with different development scenarios
2. Update documentation for new features
3. Ensure security best practices are maintained  
4. Consider compatibility with different developer setups
5. Use the pr-assistant chat mode to generate good PR descriptions

---

**Need Help?** Use the GitHub Copilot Chat with the appropriate mode, or check the project documentation in the main README.md file.