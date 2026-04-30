import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Free Interpreters OS
          </h1>
          <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">Enterprise Platform</p>
        </div>

        <SignUp 
          appearance={{
            elements: {
              formButtonPrimary: "bg-blue-600 hover:bg-blue-500 text-sm normal-case",
              card: "bg-[#13131a] border border-white/10 shadow-2xl",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "text-white border-white/10 hover:bg-white/5",
              socialButtonsBlockButtonText: "text-white font-normal",
              dividerLine: "bg-white/10",
              dividerText: "text-gray-500",
              formFieldLabel: "text-gray-400",
              formFieldInput: "bg-white/5 border-white/10 text-white focus:border-blue-500",
              footerActionText: "text-gray-400",
              footerActionLink: "text-blue-400 hover:text-blue-300"
            }
          }}
          routing="hash"
        />

        <p className="text-center text-gray-600 text-xs mt-8">
          © 2026 Free Interpreters. Secure Enterprise Access.
        </p>
      </div>
    </div>
  );
}
