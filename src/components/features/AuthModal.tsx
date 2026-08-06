import { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Loader2, Tv } from 'lucide-react';
import { authService, mapSupabaseUser } from '@/lib/authService';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import authBg from '@/assets/auth-bg.jpg';

interface Props {
  onClose: () => void;
}

type Step = 'entry' | 'otp' | 'setpass';
type Mode = 'login' | 'register';

export default function AuthModal({ onClose }: Props) {
  const { login } = useAuthStore();
  const [mode,     setMode]     = useState<Mode>('login');
  const [step,     setStep]     = useState<Step>('entry');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [username, setUsername] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      const user = await authService.signInWithPassword(email, password);
      login(mapSupabaseUser(user));
      onClose();
      toast.success(`Welcome back, ${user.user_metadata?.username || email.split('@')[0]}!`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Login failed');
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      await authService.sendOtp(email);
      setStep('otp');
      toast.success('Verification code sent to ' + email);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 4) { toast.error('Enter the 4-digit code'); return; }
    if (!password || password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const uname = username || email.split('@')[0];
      const user  = await authService.verifyOtpAndRegister(email, otp, password, uname);
      login(mapSupabaseUser(user));
      onClose();
      toast.success('Account created! Welcome to TikVTV 📺');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Verification failed');
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm bg-[#111] rounded-2xl overflow-hidden shadow-2xl">
          {/* Background art */}
          <div className="absolute inset-0 opacity-20">
            <img src={authBg} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#111]" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="relative z-10 p-7">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-3 shadow-lg">
                <Tv className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold">TikVTV</h2>
              <p className="text-white/40 text-sm mt-1">Watch live TV worldwide</p>
            </div>

            {/* Mode tabs */}
            {step === 'entry' && (
              <div className="flex bg-white/10 rounded-xl p-1 mb-6">
                {(['login', 'register'] as Mode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      mode === m ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>
            )}

            {/* ── Login form ── */}
            {mode === 'login' && step === 'entry' && (
              <div className="space-y-3">
                <InputField icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={setEmail} />
                <PasswordField value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(s => !s)} />
                <SubmitBtn loading={loading} label="Sign In" onClick={handleLogin} />
              </div>
            )}

            {/* ── Register step 1: Email ── */}
            {mode === 'register' && step === 'entry' && (
              <div className="space-y-3">
                <InputField icon={<User className="w-4 h-4" />} type="text" placeholder="Username (optional)" value={username} onChange={setUsername} />
                <InputField icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={setEmail} />
                <SubmitBtn loading={loading} label="Send Verification Code" onClick={handleSendOtp} />
              </div>
            )}

            {/* ── Register step 2: OTP + Password ── */}
            {mode === 'register' && step === 'otp' && (
              <div className="space-y-3">
                <p className="text-white/60 text-sm text-center mb-1">
                  Enter the 4-digit code sent to<br />
                  <span className="text-white font-medium">{email}</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-white/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/60"
                />
                <PasswordField value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(s => !s)} />
                <SubmitBtn loading={loading} label="Create Account" onClick={handleVerify} />
                <button onClick={() => setStep('entry')} className="w-full text-white/40 text-xs text-center hover:text-white/60 transition-colors py-1">
                  ← Back
                </button>
              </div>
            )}

            <p className="text-white/20 text-xs text-center mt-5">
              By continuing, you agree to our Terms & Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function InputField({ icon, type, placeholder, value, onChange }: {
  icon: React.ReactNode; type: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-primary/50">
      <div className="text-white/40">{icon}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
      />
    </div>
  );
}

function PasswordField({ value, onChange, show, onToggle }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-primary/50">
      <Lock className="w-4 h-4 text-white/40" />
      <input
        type={show ? 'text' : 'password'}
        placeholder="Password (min 6 chars)"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
      />
      <button type="button" onClick={onToggle} className="text-white/40 hover:text-white/70 transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function SubmitBtn({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full bg-gradient-to-r from-primary to-pink-500 text-white font-bold py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </button>
  );
}
