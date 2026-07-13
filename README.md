# Selection Task for Full Stack Engineer - Appifylab

This repository contains the Full Stack Selection Task project, consisting of a modern **Next.js (App Router)** social media feed frontend and a robust **Express/TypeScript + Prisma** backend API.

---

## 📂 Project Structure

```bash
├── backend/          # Node.js + Express + TypeScript + Prisma API
└── frontend/         # Next.js + React + Tailwind CSS client
```

---

## 🛠️ Prerequisites

Before running the applications, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.x or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [PostgreSQL](https://www.postgresql.org/) (running locally or via Docker)

---

## 🚀 Getting Started

### 1. Database Setup
Make sure your PostgreSQL server is running. Create a new database for the application (e.g., `appifylab_feed`).

---

### 2. Backend Configuration & Launch

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the `backend/` directory (if not already present) and populate it with the appropriate values:
   ```env
   PORT=5050
   DATABASE_URL="postgresql://<username>:<password>@localhost:5432/appifylab_feed?schema=public"
   JWT_SECRET="your_jwt_super_secure_secret_key"
   FRONTEND_URL="http://localhost:3000"
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Run Prisma Migrations & Generate Client:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The backend API will run on **`http://localhost:5050`**.

---

### 3. Frontend Configuration & Launch

1. **Navigate to the frontend directory:**
   ```bash
   cd ../frontend
   ```

2. **Configure Environment Variables:**
   Create a `.env.local` file in the `frontend/` directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5050/api
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Start the Next.js Dev Server:**
   ```bash
   npm run dev
   ```
   The frontend application will be accessible at **`http://localhost:3000`**.

---

### 🐳 Running with Docker Compose (Recommended)

You can spin up both the **PostgreSQL Database** and the **Backend API** with a single command using Docker Compose:

1. **Start the database and backend container:**
   ```bash
   docker compose up --build
   ```

   This command will:
   - Run a PostgreSQL container configured on port `5434` (matching development specs).
   - Wait for the database to pass its health check.
   - Build the backend API image.
   - Run Prisma schema migrations (`npx prisma db push`) automatically.
   - Start the backend server on **`http://localhost:5050`**.

2. **Run the frontend locally:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 💡 Technical Architectures & Features

### Backend (Express + Prisma + Postgres)
- **Strategy Pattern for Payments**: Implements a flexible Strategy Pattern supporting payment integrations (e.g., Stripe, bKash) securely.
- **Relational Integrity**: Utilizes Prisma ORM with strict type-safety and relations mapping posts, comments, likes, and user profiles.
- **Authentication**: JWT-based secure user authentication (`/api/auth/register`, `/api/auth/login`).
- **Media Upload**: Integrated `multer` storage middleware to handle local media uploads (images).

### Frontend (Next.js App Router)
- **Dynamic Feed**: Pixel-perfect social feed page displaying user posts, image attachments, comment threads, replies, and like systems.
- **Hydration Mismatch Fixes**: Optimized for modern browser compatibility by handling Grammarly and password manager attribute-injection using `suppressHydrationWarning`.
- **CSS Layout**: Flex/Grid system using premium, fully responsive CSS layouts with dynamic navbar offsets (`_layout_inner_wrap`).
- **Authentication Context**: Custom React Context Provider managing user sessions, local storage cache tokens, and routing.

---

## 🔧 Troubleshooting

- **Connection Refused (`ERR_CONNECTION_REFUSED`)**: Ensure the backend is running on port `5050` and the frontend's environment variable `NEXT_PUBLIC_API_URL` is set to `http://localhost:5050/api`.
- **Next.js Hydration Mismatch**: Handled by adding `suppressHydrationWarning` on root `<html>` and `<body>` tags in `app/layout.tsx`.
- **Overlapping Content**: Resolved by applying the `_layout_inner_wrap` container class to body elements, which implements the correct fixed-header clearance padding (70px on desktop, 56px on mobile).
