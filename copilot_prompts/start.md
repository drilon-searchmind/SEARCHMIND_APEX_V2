Below, I'll provide a comprehensive guide for restarting your project from scratch with a more optimized and structured folder structure. Since you specifically want to avoid server-side rendering (SSR), I'll focus on a pure client-side rendering (CSR) approach using Next.js with the App Router, but configured to disable SSR where possible (e.g., using "use client" directives and dynamic imports). This means:

All pages and components will be client-side rendered by default.
No server components or pre-rendering.
API routes will handle data fetching on the client side.
Static generation is avoided.
This structure emphasizes modularity, scalability, and separation of concerns. It builds on your existing project but streamlines it for better maintainability.

Key Principles for This Structure
Frontend-Backend Separation: Clear distinction between client-side code (pages, components) and server-side code (API routes).
Modular Components: Reusable, atomic components with clear responsibilities.
State Management: Centralized with React Context (e.g., for auth, themes).
Routing: Next.js App Router with protected routes handled via middleware and auth checks.
No SSR: All rendering happens on the client. Use dynamic exports with ssr: false for components that need it.
Environment Variables: Centralized in .env.local.
Testing: Structure ready for unit/integration tests (e.g., with Jest).
Performance: Lazy loading, code splitting, and optimized bundles.
Recommended Folder Structure
Here's a clean, scalable structure. Place this in your project root (e.g., tracking-tracker-v2/).

tracking-tracker-v2/
├── .next/                          # Build output (auto-generated)
├── node_modules/                   # Dependencies (auto-generated)
├── public/                         # Static assets (images, fonts, etc.)
│   ├── images/
│   │   ├── shape-dotted-light.svg
│   │   └── logo.png
│   └── favicon.ico
├── src/                            # Main source code (group frontend/backend here for clarity)
│   ├── app/                        # Next.js App Router (client-side pages and layouts)
│   │   ├── (auth)/                 # Auth-related pages (not protected)
│   │   │   ├── login/
│   │   │   │   └── page.jsx        # Login page (CSR)
│   │   │   └── layout.jsx          # Auth layout
│   │   ├── (protected)/            # Protected pages (middleware enforces auth)
│   │   │   ├── dashboard/
│   │   │   │   ├── [customerId]/
│   │   │   │   │   ├── page.jsx    # Overview dashboard (CSR)
│   │   │   │   │   ├── config/
│   │   │   │   │   │   └── page.jsx # Config page (CSR)
│   │   │   │   │   ├── tools/
│   │   │   │   │   │   ├── pnl/
│   │   │   │   │   │   │   ├── page.jsx # P&L page (CSR)
│   │   │   │   │   │   │   └── pnl-dashboard.jsx # Component
│   │   │   │   │   │   └── pace-report/
│   │   │   │   │   │       ├── page.jsx # Pace report page (CSR)
│   │   │   │   │   │       └── pace-report.jsx # Component
│   │   │   │   │   ├── performance-dashboard/
│   │   │   │   │   │   └── page.jsx # Performance dashboard (CSR)
│   │   │   │   │   └── service-dashboard/
│   │   │   │   │       ├── ppc/
│   │   │   │   │       │   └── page.jsx # PPC dashboard (CSR)
│   │   │   │   │       └── ps/
│   │   │   │   │           └── page.jsx # PS dashboard (CSR)
│   │   │   ├── admin/
│   │   │   │   └── page.jsx        # Admin page (CSR, protected)
│   │   │   ├── home/
│   │   │   │   └── page.jsx        # Home page (CSR, protected)
│   │   │   └── my-profile/
│   │   │       └── page.jsx        # Profile page (CSR, protected)
│   │   │   └── layout.jsx          # Protected layout (handles auth checks)
│   │   ├── api/                    # API routes (server-side, handles data)
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.jsx       # NextAuth API
│   │   │   ├── customers/
│   │   │   │   └── [customerId]/
│   │   │   │       └── route.js    # Customer CRUD
│   │   │   ├── dashboard-metrics/
│   │   │   │   └── [customerId]/
│   │   │   │       └── route.js    # Dashboard metrics API
│   │   │   ├── pnl-dashboard/
│   │   │   │   └── [customerId]/
│   │   │   │       └── route.js    # P&L data API
│   │   │   ├── config-static-expenses-v2/
│   │   │   │   └── [customerId]/
│   │   │   │       └── route.js    # Static expenses API
│   │   │   ├── users/
│   │   │   │   └── route.js        # User management
│   │   │   └── [id]/
│   │   │       └── route.js        # User by ID
│   │   ├── globals.css             # Global styles (Tailwind)
│   │   ├── layout.jsx              # Root layout (CSR, includes providers)
│   │   ├── page.jsx                # Landing page (redirects to home if logged in)
│   │   └── _not-found.jsx          # 404 page
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # Atomic UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── Subheading.jsx
│   │   ├── dashboard/              # Dashboard-specific components
│   │   │   ├── CustomerModal.jsx
│   │   │   ├── ConfigForm.jsx
│   │   │   ├── ConfigTable.jsx
│   │   │   └── StaticExpenses.jsx
│   │   ├── auth/                   # Auth components
│   │   │   ├── LoginButton.jsx
│   │   │   ├── LogoutButton.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   └── charts/                 # Chart components
│   │       └── ChartWrapper.jsx
│   ├── contexts/                   # React Contexts for global state
│   │   ├── AuthContext.jsx         # Auth state
│   │   ├── ThemeContext.jsx        # Theme (light/dark)
│   │   ├── ToastContext.jsx        # Notifications
│   │   └── ClickUpUsersContext.jsx # ClickUp integration
│   ├── hooks/                      # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useApi.js               # API fetching hook
│   │   └── useLocalStorage.js
│   ├── lib/                        # Utility libraries
│   │   ├── auth.js                 # NextAuth config
│   │   ├── dbConnect.js            # MongoDB connection
│   │   ├── shopifyApi.js           # Shopify integration
│   │   ├── bigQueryConnect.js      # BigQuery connection
│   │   ├── static-data/            # Static JSON data
│   │   │   └── currencyApiValues.json
│   │   └── utils.js                # Helper functions (e.g., formatDate, safeToLocaleString)
│   ├── models/                     # Mongoose models
│   │   ├── User.js
│   │   ├── Customer.js
│   │   ├── CustomerSettings.js
│   │   ├── StaticExpenses.js
│   │   ├── Campaign.js
│   │   ├── CampaignComment.js
│   │   ├── AssignedCampaignUsers.js
│   │   ├── ConfigRevenueBudget.js
│   │   └── Spendshare.js
│   ├── providers/                  # Context providers
│   │   ├── SessionProvider.jsx     # NextAuth session
│   │   └── ToastProvider.jsx
│   └── middleware.js               # Next.js middleware (auth checks, redirects)
├── .env.local                      # Environment variables
├── .gitignore
├── next.config.js                  # Next.js config (disable SSR, add optimizations)
├── package.json                    # Dependencies and scripts
├── tailwind.config.js              # Tailwind CSS config
└── README.md                       # Project docs

Key Notes on Structure
App Router Groups: (auth) and (protected) are route groups for organization. Middleware enforces protection.
CSR Emphasis: All pages use "use client" at the top. API routes remain server-side for data handling.
Modularity: Components are split by feature (e.g., dashboard/, auth/). Contexts centralize state.
Scalability: Add new features in dedicated folders (e.g., components/new-feature/).
Testing: Add a tests/ folder under src/ for Jest/Vitest files.
Routing and Protected Routes
Public Routes: /login, / (landing).
Protected Routes: Everything under (protected). Use middleware to check auth and redirect.
Middleware (middleware.js): Checks JWT tokens, redirects unauthenticated users to /login.
Dynamic Routes: [customerId] for customer-specific pages.
Packages and Dependencies
Based on your current project, here's a complete list. Install with npm install or yarn add. Grouped by category.

Core Framework & Runtime
next: ^14.x (App Router, CSR-focused)
react: ^18.x
react-dom: ^18.x
Authentication
next-auth: ^4.x (with credentials provider)
bcryptjs: ^2.x (password hashing)
Database & ORM
mongoose: ^8.x (MongoDB ODM)
mongodb: ^6.x (MongoDB driver, for NextAuth adapter)
UI & Styling
tailwindcss: ^3.x
@tailwindcss/typography: ^0.5.x
react-icons: ^5.x (icons)
react-tooltip: ^5.x (tooltips)
react-select: ^5.x (dropdowns)
Charts & Data Visualization
chart.js: ^4.x
react-chartjs-2: ^5.x
HTTP & API
axios: ^1.x (alternative to fetch for API calls)
Utilities
date-fns: ^3.x (date manipulation)
lodash: ^4.x (utility functions)
uuid: ^9.x (unique IDs)
Development & Build
eslint: ^8.x
prettier: ^3.x
@next/eslint-config-next: ^14.x
postcss: ^8.x
autoprefixer: ^10.x
Testing (Optional but Recommended)
jest: ^29.x
@testing-library/react: ^14.x
@testing-library/jest-dom: ^6.x
Other Integrations (from your project)
@next/third-parties/google: ^0.x (Google Tag Manager)
client-promise: (for MongoDB, via NextAuth)
DevDependencies
typescript: ^5.x (if you want TS support later)
concurrently: ^8.x (run multiple scripts)
Models (Mongoose Schemas)
Keep these in src/models/. They define your database structure.

User.js: User accounts (email, password, role, etc.)
Customer.js: Customer data (name, settings, etc.)
CustomerSettings.js: Per-customer configs (currency, etc.)
StaticExpenses.js: Expense configurations.
Campaign.js: Marketing campaigns.
CampaignComment.js: Comments on campaigns.
AssignedCampaignUsers.js: User-campaign assignments.
ConfigRevenueBudget.js: Revenue budgets.
Spendshare.js: Spend sharing data.
Authentication Setup
Use NextAuth with JWT strategy.
Providers: Credentials (email/password).
Middleware: Protect routes, redirect on auth failure.
Context: AuthContext.jsx for client-side auth state.
Environment Variables (.env.local)

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
MONGODB_URI=mongodb://localhost:27017/your-db
GOOGLE_TAG_MANAGER_ID=your-gtm-id
SHOPIFY_API_KEY=your-shopify-key
BIGQUERY_PROJECT_ID=your-project-id
# Add others as needed (Facebook Ads, Google Ads keys)

Next.js Config (next.config.js)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Disable SSR for all pages (force CSR)
  experimental: {
    appDir: true,
  },
  // Optimize images and bundles
  images: {
    domains: ['your-cdn.com'],
  },
  // Add any rewrites or redirects
};

module.exports = nextConfig;
Getting Started
Initialize: npx create-next-app@latest . --app (in your project folder).
Install Packages: npm install with the list above.
Set Up DB: Configure MongoDB, run migrations for models.
Run Dev: npm run dev (should start on http://localhost:3000).
Add Auth: Implement NextAuth in auth.js.
Build Components: Start with layouts and basic pages, then add features incrementally.
This structure is optimized for CSR, maintainability, and growth. If you need code snippets for specific files (e.g., middleware, auth setup), let me know!