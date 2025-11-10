# Authentication Setup Guide

## Overview

This application now uses NextAuth.js with email magic link authentication for secure access to all API endpoints.

## Security Features Implemented

### 1. Authentication
- **NextAuth.js** with email magic link provider
- Database session strategy (sessions stored in database)
- Admin role support for privileged operations

### 2. Protected Endpoints
All API endpoints are now protected:

- `POST /api/firms` - Create firm (requires auth)
- `GET /api/firms` - List firms (requires auth)
- `GET /api/firms/[id]` - Get firm details (requires auth)
- `PUT /api/firms/[id]` - Update firm (requires auth)
- `DELETE /api/firms/[id]` - Delete firm (requires auth)
- `POST /api/migrate` - Run migrations (requires admin role)

### 3. Rate Limiting
- General API endpoints: 100 requests/minute per IP
- Admin endpoints: 20 requests/minute per IP
- Returns 429 status with Retry-After header when exceeded

## Setup Instructions

### 1. Database Migration

Run the database push to create auth tables:

```bash
npm run db:push
```

This creates the following tables:
- `users` - User accounts
- `accounts` - OAuth provider linkages
- `sessions` - Active user sessions
- `verification_tokens` - Email magic link tokens

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required variables:**

```env
# Database (already configured)
DATABASE_URL=your-neon-database-url

# NextAuth Secret (generate a random string)
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000  # Change for production

# Email Configuration (for magic links)
EMAIL_SERVER_HOST=smtp.example.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@example.com
EMAIL_SERVER_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.com
```

### 3. Email Provider Setup

You need an SMTP email service for magic links. Options:

**Option A: Gmail** (for development)
```env
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-gmail@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password  # Create app password in Google Account
EMAIL_FROM=your-gmail@gmail.com
```

**Option B: SendGrid** (recommended for production)
```env
EMAIL_SERVER_HOST=smtp.sendgrid.net
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=apikey
EMAIL_SERVER_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=verified-sender@yourdomain.com
```

**Option C: Resend** (modern alternative)
- Sign up at https://resend.com
- Install: `npm install resend`
- Update `src/lib/auth.ts` to use Resend provider

### 4. Create First Admin User

After running migrations, manually set a user as admin:

```sql
-- Connect to your Neon database
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Or use this script:

```bash
node scripts/create-admin.js your-email@example.com
```

### 5. Test Authentication

1. Start the dev server: `npm run dev`
2. Try accessing `/api/firms` - should return 401 Unauthorized
3. Sign in via NextAuth (you'll need to implement a sign-in page)
4. Access `/api/firms` again - should work

## Development Notes

### Creating a Sign-In Page

Create `src/app/auth/signin/page.tsx`:

```tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SignIn() {
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn('email', { email, callbackUrl: '/builder' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your-email@example.com"
          className="w-full rounded border px-4 py-2"
          required
        />
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Send magic link
        </button>
      </form>
    </div>
  );
}
```

### Protecting Client-Side Routes

Add session provider in `src/app/layout.tsx`:

```tsx
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

Use in components:

```tsx
'use client';

import { useSession } from 'next-auth/react';

export default function ProtectedComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return <div>Access denied</div>;

  return <div>Welcome {session.user?.email}</div>;
}
```

## Production Deployment

### Environment Variables (Vercel/Production)

Set these in your deployment platform:

```bash
DATABASE_URL=<production-neon-url>
NEXTAUTH_SECRET=<strong-random-secret>
NEXTAUTH_URL=https://yourdomain.com
EMAIL_SERVER_HOST=smtp.sendgrid.net
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=apikey
EMAIL_SERVER_PASSWORD=<sendgrid-api-key>
EMAIL_FROM=noreply@yourdomain.com
```

### Security Checklist

- [ ] Strong `NEXTAUTH_SECRET` generated
- [ ] Email provider configured and tested
- [ ] Admin user created
- [ ] Database migrations run
- [ ] HTTPS enabled in production
- [ ] CORS configured appropriately
- [ ] Rate limiting tested
- [ ] Session timeout configured (default: 30 days)

## Troubleshooting

### "Missing NEXTAUTH_SECRET"
- Generate: `openssl rand -base64 32`
- Add to `.env`

### Email not sending
- Check SMTP credentials
- Verify firewall allows SMTP port
- Check email provider logs
- Test with a simple SMTP tool

### 401 Unauthorized on all requests
- Check if session exists
- Verify cookies are being set
- Check NEXTAUTH_URL matches your domain

### Rate limit errors
- Increase limits in `src/lib/rate-limit.ts`
- Or wait for the window to reset

## Future Enhancements

- [ ] OAuth providers (Google, Microsoft)
- [ ] Two-factor authentication
- [ ] User management UI
- [ ] API key authentication for integrations
- [ ] Row-level security (users can only access their own firms)
- [ ] Audit logging
- [ ] Redis-based rate limiting for production
