# Contributing to Smart Attendance System

First off, thank you for considering contributing to the Smart Attendance System! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear descriptive title**
- **Detailed description** of the issue
- **Steps to reproduce** the behavior
- **Expected behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, browser, Node version)
- **Additional context**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear descriptive title**
- **Detailed description** of the suggested enhancement
- **Use case** - explain why this enhancement would be useful
- **Possible implementation** (if you have ideas)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

## 💻 Development Setup

### Prerequisites

- Node.js 18+
- pnpm package manager
- Supabase account
- Git

### Setup Steps

```bash
# 1. Fork and clone your fork
git clone https://github.com/YOUR_USERNAME/ATTENDANCE-TRACKING-SYSTEM.git
cd ATTENDANCE-TRACKING-SYSTEM

# 2. Add upstream remote
git remote add upstream https://github.com/moinn31/ATTENDANCE-TRACKING-SYSTEM.git

# 3. Install dependencies
pnpm install

# 4. Create .env.local (copy from .env.example if available)
# Add your Supabase credentials

# 5. Setup database
# Run scripts/01-init-schema.sql in Supabase SQL Editor

# 6. Start development server
pnpm dev
```

### Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── scanner/           # Face scanning interface
│   ├── students/          # Student management
│   └── analytics/         # Analytics dashboard
├── components/            # React components
│   ├── ui/               # UI components (shadcn)
│   └── *.tsx             # Custom components
├── lib/                   # Utilities and libraries
│   └── supabase/         # Supabase client setup
├── scripts/               # Database and utility scripts
└── styles/               # Global styles
```

## 🔄 Pull Request Process

1. **Update documentation** for any changes to public APIs or user-facing features
2. **Update the README.md** with details of changes if applicable
3. **Follow the coding standards** outlined below
4. **Ensure all tests pass** (when tests are implemented)
5. **Request review** from maintainers
6. **Address feedback** from code reviews

### PR Checklist

- [ ] Code follows the project's coding standards
- [ ] Comments added for complex logic
- [ ] Documentation updated (if applicable)
- [ ] No console.log statements (use proper logging)
- [ ] TypeScript types are properly defined
- [ ] Responsive design tested (mobile/tablet/desktop)
- [ ] Browser compatibility checked

## 📝 Coding Standards

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Define proper **interfaces and types**
- Use **async/await** instead of promises
- Use **functional components** with hooks
- Avoid **any** type unless absolutely necessary

```typescript
// Good
interface Student {
  id: string
  name: string
  email: string
}

async function getStudent(id: string): Promise<Student> {
  // implementation
}

// Bad
function getStudent(id: any): any {
  // implementation
}
```

### React Components

- Use **functional components** with hooks
- Extract complex logic into **custom hooks**
- Keep components **small and focused**
- Use **proper TypeScript types** for props
- Add **error boundaries** for error handling

```tsx
// Good
interface StudentCardProps {
  student: Student
  onEdit: (id: string) => void
}

export function StudentCard({ student, onEdit }: StudentCardProps) {
  // implementation
}

// Bad
export function StudentCard(props: any) {
  // implementation
}
```

### File Naming

- **Components**: PascalCase (`StudentCard.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Hooks**: camelCase with 'use' prefix (`useStudents.ts`)
- **Types**: PascalCase (`StudentTypes.ts`)

### Styling

- Use **Tailwind CSS** utility classes
- Follow existing **design tokens** from `globals.css`
- Ensure **responsive design** (mobile-first)
- Support **dark mode** with appropriate color variables

### Security

- **Never commit** `.env.local` or secrets
- Use **environment variables** for sensitive data
- Implement **proper authentication checks**
- Follow **RLS policies** for database access
- Sanitize **user inputs**

## 📤 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(scanner): add confidence threshold filter

Adds ability to filter detected faces by confidence score.
Users can set minimum confidence level in settings.

Closes #123
```

```
fix(auth): resolve login redirect issue

Fixed infinite redirect loop when accessing protected routes.
Updated middleware to properly handle session state.

Fixes #456
```

## 🧪 Testing

When the test suite is implemented:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## 🐛 Debugging

- Use browser DevTools for frontend debugging
- Check Network tab for API issues
- Review Supabase logs for backend errors
- Use React DevTools for component inspection

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## ❓ Questions?

Feel free to:
- Open an issue for questions
- Join discussions in GitHub Discussions
- Contact the maintainers

## 🙏 Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute! 🎉

---

**Repository**: [github.com/moinn31/ATTENDANCE-TRACKING-SYSTEM](https://github.com/moinn31/ATTENDANCE-TRACKING-SYSTEM)
