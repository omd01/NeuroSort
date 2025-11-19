# Contributing to NeuroSort

Thank you for your interest in contributing to NeuroSort! This document provides guidelines for contributors.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/omd01/NeuroSort.git
   cd NeuroSort
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Ollama and Phi-3 model**
   ```bash
   # Download Ollama from https://ollama.com
   ollama pull phi3
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

## Project Structure

- `src/main/` - Electron main process (backend)
  - `main.js` - App entry point, IPC handlers
  - `ModelManager.js` - AI lifecycle management
  - `RegexGuard.js` - Stage 1 classifier
  - `MetadataAnalyst.js` - Stage 2 classifier
  - `taxonomy.js` - Master folder structure

- `src/renderer/` - React frontend
  - `App.jsx` - Main UI orchestration
  - `ProcessingDashboard.jsx` - Real-time visualization

- `src/shared/` - IPC bridge
  - `preload.js` - Context isolation bridge

## Making Changes

### Before You Start

1. Check existing [issues](https://github.com/omd01/NeuroSort/issues) and [pull requests](https://github.com/omd01/NeuroSort/pulls)
2. Open an issue to discuss major changes before implementing
3. Fork the repository and create a feature branch

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Test thoroughly with various file types

3. **Test your changes**
   ```bash
   npm run dev
   # Test with real files in a test directory
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Commit Message Convention

We follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Style

- **JavaScript**: Use modern ES6+ syntax
- **React**: Functional components with hooks
- **Naming**: camelCase for variables, PascalCase for components
- **Indentation**: 4 spaces (not tabs)

## Areas for Contribution

### High Priority

- [ ] M1/M2 Mac native ARM builds
- [ ] Improved error handling and user feedback
- [ ] Performance optimizations for large directories (1000+ files)
- [ ] Custom taxonomy editor UI
- [ ] Multi-language support

### Medium Priority

- [ ] Additional metadata extraction (EXIF, PDF metadata)
- [ ] Duplicate file detection improvements
- [ ] Batch processing mode
- [ ] Configuration file support

### Low Priority

- [ ] Dark/Light theme toggle
- [ ] Custom keyboard shortcuts
- [ ] Processing history/undo functionality
- [ ] Optional cloud sync

## Testing

Before submitting a PR:

1. Test with at least 50 diverse files (images, docs, code, videos)
2. Verify funnel statistics are accurate
3. Check that no files are lost or misclassified
4. Test on your target platform (Windows/macOS/Linux)

## Questions?

Open an issue or reach out to [@omd01](https://github.com/omd01)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
