import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="p-6 rounded-full bg-red-500/10 border border-red-500/20">
            <ShieldAlert size={64} className="text-red-500 animate-pulse" />
          </div>
        </div>

        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">
          Access Denied
        </h1>
        
        <p className="text-slate-400 text-lg mb-10 leading-relaxed">
          You don't have the required permissions to access this page. 
          If you believe this is an error, please contact your administrator.
        </p>

        <div className="space-y-4">
          <Link 
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold border border-white/5 transition-all"
          >
            <Home size={20} />
            Go to Dashboard
          </Link>
          
          <Link 
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-4 text-slate-400 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft size={18} />
            Back to Login
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5">
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">
            Error Code: 403_UNAUTHORIZED_ACCESS
          </p>
        </div>
      </div>
    </div>
  );
}
