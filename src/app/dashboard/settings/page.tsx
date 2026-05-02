import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { 
  Settings, 
  CreditCard, 
  User, 
  MapPin, 
  Phone, 
  Save,
  Shield,
  Info
} from 'lucide-react';
import { getCurrentProfile } from '@/app/actions/auth';
import prisma from '@/lib/prisma';
import { updateInterpreterProfile } from '@/app/actions/profile';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  // We still need to fetch some info from the interpreter table via Prisma
  const db = prisma;
  const interpreter = profile.interpreter_id 
    ? await db.interpreter.findUnique({ 
        where: { id: profile.interpreter_id },
        select: {
          id: true,
          name: true,
          emailCorporativo: true,
          telefono: true,
          pais: true
        }
      })
    : null;

  if (!interpreter && profile.role === 'interpreter') {
    // If they should have an interpreter record but don't
    console.error('❌ SETTINGS: Interpreter record missing for user', profile.id);
  }

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="text-blue-400" />
          Profile Settings
        </h2>
        <p className="text-gray-400 mt-2">Manage your personal information and payment preferences.</p>
      </header>

      <form action={async (formData) => {
        'use server';
        const data = {
          phone: formData.get('phone') as string,
          country: formData.get('country') as string,
          bankName: formData.get('bankName') as string,
          bankAccount: formData.get('bankAccount') as string,
          bankAccountType: formData.get('bankAccountType') as string,
          bankCedula: formData.get('bankCedula') as string,
          notes: formData.get('notes') as string,
        };
        await updateInterpreterProfile(data);
      }} className="space-y-6">
        
        {/* Personal Info */}
        <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <User className="text-blue-400" size={20} />
            <h3 className="text-lg font-bold text-white">Personal Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                disabled 
                value={interpreter?.name || profile.display_name}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Corporate Email</label>
              <input 
                type="text" 
                disabled 
                value={interpreter?.emailCorporativo || profile.email || ''}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  name="phone"
                  type="text" 
                  defaultValue={interpreter?.telefono || ''}
                  placeholder="+1 234 567 890"
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-12 py-3 text-white focus:outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Country of Residence</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  name="country"
                  type="text" 
                  defaultValue={interpreter?.pais || ''}
                  placeholder="e.g. Dominican Republic"
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-12 py-3 text-white focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <CreditCard className="text-green-400" size={20} />
            <h3 className="text-lg font-bold text-white">Payment Preferences (RD Only)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Banco</label>
              <select 
                name="bankName"
                defaultValue={profile.bank_name || ''}
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all appearance-none"
              >
                <option value="" disabled>Seleccionar Banco</option>
                <option value="Banreservas">Banreservas</option>
                <option value="Banco Popular">Banco Popular</option>
                <option value="BHD">BHD</option>
                <option value="Scotiabank">Scotiabank</option>
                <option value="Banco Santa Cruz">Banco Santa Cruz</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo de Cuenta</label>
              <select 
                name="bankAccountType"
                defaultValue={profile.bank_account_type || ''}
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all appearance-none"
              >
                <option value="" disabled>Seleccionar Tipo</option>
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Número de Cuenta</label>
              <input 
                name="bankAccount"
                type="text" 
                defaultValue={profile.bank_account || ''}
                placeholder="Número de cuenta bancaria"
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cédula del Titular</label>
              <input 
                name="bankCedula"
                type="text" 
                defaultValue={profile.bank_cedula || ''}
                placeholder="XXX-XXXXXXX-X"
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex gap-4">
            <Info className="text-blue-400 shrink-0" size={20} />
            <p className="text-xs text-gray-400 leading-relaxed">
              Payments are processed every 15 days in Dominican Pesos (DOP). Ensure the Cédula matches the bank account holder's identity to avoid payment rejection.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button 
            type="submit"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all glow group"
          >
            <Save size={20} className="group-hover:scale-110 transition-transform" />
            Save Profile Changes
          </button>
        </div>
      </form>

      {/* Security Info */}
      <footer className="flex items-center justify-center gap-2 text-gray-600 text-xs py-8">
        <Shield size={14} />
        Your data is encrypted and managed according to GDPR and Dominican Banking standards.
      </footer>
    </div>
  );
}
