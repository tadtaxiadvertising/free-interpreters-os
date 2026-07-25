# 📧 SMTP Configuration — Free Interpreters OS

## Password Recovery Email

The password recovery flow uses **Supabase's built-in email service**.

### How it works

1. User requests password reset via the `/forgot-password` page
2. The server action `requestPasswordReset()` calls:
   ```
   supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, redirectTo })
   ```
3. **Supabase Auth** handles sending the recovery email to the user
4. User clicks the link → redirected to `/auth/callback?next=/reset-password`

### Configuring Custom SMTP in Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/YOUR_PROJECT_ID)
2. Navigate → **Authentication** → **Settings** → **SMTP Settings**
3. Enable Custom SMTP
4. Enter your provider (SendGrid, Brevo, Gmail, etc.):

   | Field | Value |
   |---|---|
   | SMTP Host | `smtp-relay.brevo.com` (or your provider) |
   | SMTP Port | `587` (STARTTLS) |
   | Username | Your SMTP login email |
   | Password | Your SMTP password or API key |
   | Sender Email | `no-reply@freeinterpreters.com` |
   | Sender Name | `Free Interpreters OS` |

5. Save → Supabase will send all auth emails through your custom SMTP

### Without Custom SMTP

If SMTP is not configured, Supabase uses its **default email service** (limited quota, not recommended for production). The app will still work — recovery links are sent, but they come from Supabase's default sender.

### Current State

- Password reset **flow is implemented** in `src/app/actions/auth.ts` (line 612-657)
- Reset password page: `src/app/reset-password/page.tsx`
- Email sending is **handled by Supabase**, not by the app code
- **No custom SMTP is configured** in the app (uses Supabase's built-in system)
- To configure custom SMTP → do it in **Supabase Dashboard**, not in code

---

## Transactional Emails (Future)

For custom transactional emails (welcome emails, payout confirmations, QA alerts):

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

Then add a `src/lib/email.ts` service:

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'Free Interpreters OS <no-reply@freeinterpreters.com>',
    to,
    subject,
    html,
  });
}
```

Add to `.env.example`:
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Free Interpreters OS <no-reply@freeinterpreters.com>
```