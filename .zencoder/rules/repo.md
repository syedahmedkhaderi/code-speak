---
description: Repository Information Overview
alwaysApply: true
---

# CodeSpeak Information

## Summary
CodeSpeak is a silent lecture accessibility tool designed for deaf/HOH CS students. It provides real-time transcription that understands code and preserves it accurately, addressing issues with standard captions that often mangle variable names, code syntax, and technical terms.

## Structure
- **backend/**: Express.js server with MongoDB integration
- **frontend/**: Web interface with EJS templates
- **ml-service/**: Machine learning service (appears to be a placeholder)

## Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: Node.js >=16.0.0
**Build System**: npm
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- express: ^4.18.2 (Web framework)
- mongoose: ^7.0.0 (MongoDB ODM)
- bcryptjs: ^3.0.2 (Password hashing)
- jsonwebtoken: ^9.0.0 (Authentication)
- axios: ^1.3.4 (HTTP client)
- cors: ^2.8.5 (Cross-origin resource sharing)
- dotenv: ^17.2.3 (Environment variables)

**Development Dependencies**:
- jest: ^30.2.0 (Testing framework)
- nodemon: ^3.1.10 (Development server)
- supertest: ^7.1.4 (HTTP testing)

## Build & Installation
```bash
# Install dependencies
cd backend
npm install

# Run development server
npm run dev

# Run production server
npm start

# Run tests
npm test

# Run database migrations
npm run migrate
```

## Projects

### Backend (Express.js API)
**Configuration File**: backend/package.json

#### Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: Node.js >=16.0.0
**Framework**: Express.js
**Database**: MongoDB

#### Dependencies
**Main Dependencies**:
- express: ^4.18.2
- mongoose: ^7.0.0
- bcryptjs: ^3.0.2
- jsonwebtoken: ^9.0.0

#### Build & Installation
```bash
cd backend
npm install
npm start
```

#### Testing
**Framework**: Jest
**Run Command**:
```bash
npm test
```

### Frontend (Web Interface)
**Technology**: HTML/CSS/JavaScript with EJS templates

#### Structure
- **public/**: Static assets (CSS, JavaScript)
- **views/**: EJS templates for pages
- **partials/**: Reusable EJS components

#### Key Files
- **public/js/recorder.js**: Audio capture
- **public/js/transcription.js**: Real-time display
- **public/js/codeHighlight.js**: Syntax highlighting
- **views/index.ejs**: Landing page
- **views/live.ejs**: Live transcription
- **views/archive.ejs**: Past lectures

### ML Service
**Status**: Placeholder directory, implementation not found
**Expected Technology**: Python with Flask (based on project description)
**Purpose**: Code detection and correction for transcriptions