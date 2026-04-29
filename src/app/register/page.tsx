'use client';

import React, { useState, useTransition } from 'react';
import { Lock, Mail, User, AlertCircle, Loader2, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { signup } from '@/app/actions/auth';
import Link from 'next/link';

type LoginRole = 'interpreter' | 'admin';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState<LoginRole>('interpreter');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Registration failed');
      }
    });
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden px-6">
        <div className="relative z-10 w-full max-w-md text-center glass rounded-3xl p-10 border border-green-500/20">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Registration Successful!</h2>
          <p className="text-gray-400 mb-8">
            Your account has been created. Please check your email for a confirmation link (if enabled) or go to login.
          </p>
          <Link 
            href="/login" 
            className="block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-12">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Free Interpreters OS
          </h1>
          <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">Create New Account</p>
        </div>

        {/* Register Card */}
        <div className="glass rounded-3xl p-8 border border-white/10">
          
          {/* Role Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-8">
            <button
              onClick={() => setRole('interpreter')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                role === 'interpreter' 
                  ? 'bg-blue-500/20 text-blue-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <Users size={16} />
              Interpreter
            </button>
            <button
              onClick={() => setRole('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                role === 'admin' 
                  ? 'bg-purple-500/20 text-purple-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <ShieldAlert size={16} />
              Admin
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            <input type="hidden" name="role" value={role} />
            
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-400 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="user@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className={`w-full py-3 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 ${
                role === 'admin' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
