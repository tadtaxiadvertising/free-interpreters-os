import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Free Interpreters OS',
  description: 'Secure login to the Free Interpreters enterprise platform',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    // Login has its own full-screen layout — no sidebar
    <>{children}</>
  );
}
