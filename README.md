# ☁️ CloudDrive

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)
![React](https://img.shields.io/badge/React-18.3-61dafb.svg)
![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748.svg)

A full-stack, production-quality cloud storage web application inspired by Google Drive. Built with React 18, Node.js, Express, Prisma, and SQLite.

---

## ✨ Features

- **Multi-user accounts** — fully isolated storage per user (strict server-side enforcement)
- **File upload** — drag-and-drop with real-time progress bar (XMLHttpRequest), up to 100 MB
- **File preview** — images, PDFs (embedded), video player, audio player
- **Folder management** — nested folders, color picker, rename, breadcrumb navigation
- **Folder locking** — bcrypt-hashed password protection for sensitive folders
- **Star system** — star files and folders, view starred items in sidebar
- **Trash & restore** — soft-delete with restore, permanent deletion, empty trash
- **Search** — client-side search across visible files and folders
- **Sort** — by name, date modified, or file size
- **Grid / List view** — toggle with preference saved to localStorage
- **Dark mode** — full dark mode with Tailwind, toggle in header, saved to localStorage
- **Password reset** — professional HTML email via Gmail SMTP (Nodemailer), 1-hour token
- **Storage meter** — visual progress bar + breakdown by file type in sidebar and settings
- **Settings page** — change display name, change password, storage breakdown
- **Responsive** — works from 320px mobile to 1440px+ desktop

## 🛠 Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- React Router v6
- TanStack Query (React Query) v5
- Axios
- Lucide React icons
- react-hot-toast

**Backend**
- Node.js + Express + TypeScript
- Prisma ORM + SQLite
- Multer (file uploads)
- JWT (jsonwebtoken) auth
- bcryptjs (passwords + folder locks)
- Nodemailer + Gmail SMTP
- Helmet + CORS + express-rate-limit

## 📁 Project Structure

```
clouddrive/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── api/            # Axios API functions
│       ├── components/     # Shared components + UI primitives
│       ├── contexts/       # Auth + Theme contexts
│       ├── lib/            # Utility functions
│       ├── pages/          # Route-level page components
│       └── types/          # TypeScript interfaces
├── server/                 # Express backend
│   └── src/
│       ├── middleware/     # auth.ts, upload.ts
│       ├── routes/         # auth, folders, files, storage
│       ├── services/       # email.ts (Nodemailer)
│       └── utils/          # helpers.ts
├── uploads/                # Stored files (gitignored)
└── package.json            # Root monorepo scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/clouddrive.git
cd clouddrive
```

### 2. Run setup (installs all deps + creates SQLite DB)

```bash
npm run setup
```

### 3. Configure environment variables

**Server** — edit `server/.env`:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-this"
GMAIL_APP_PASSWORD="your-gmail-app-password"
PORT=3001
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
```

**Client** — edit `client/.env`:
```env
VITE_API_URL=http://localhost:3001
```

> **Gmail setup**: Go to your Google Account → Security → 2-Step Verification → App passwords. Create an app password for "Mail" and paste it as `GMAIL_APP_PASSWORD`.

### 4. Start development servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

### 5. Build for production

```bash
npm run build
```

## 🔒 Security

- All file/folder queries include `userId` — no cross-user data access possible
- JWT Bearer token required on all drive routes
- Auth routes rate-limited: 10 requests / 15 minutes
- Folder passwords hashed with bcrypt (salt rounds: 10)
- Helmet middleware for security headers
- Allowed MIME types: images, PDF, Office docs, MP4/MP3, ZIP/RAR
- 100 MB file size limit enforced server-side

## 📧 Email

Password reset emails are sent from `redmotiontr@gmail.com` using Gmail SMTP. The reset link expires in 1 hour.

## 📄 License

MIT — see [LICENSE](LICENSE)
