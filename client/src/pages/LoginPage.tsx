import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import axios from 'axios';

interface LoginForm {
  email:    string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (values: LoginForm) => {
    setIsLoading(true);
    try {
      const loggedInUser = await login(values.email, values.password);
      if (loggedInUser.role === 'client') {
        navigate('/portal', { replace: true });
      } else {
        navigate('/pipeline', { replace: true });
      }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Login failed'
        : 'Network error';
      toastError('Sign in failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Brand */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center shadow-glow-brand">
            <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" aria-hidden="true">
              <path d="M6 26 L16 6 L26 26" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 20 L22 20"      stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-slate-400 text-sm mt-1">Sign in to your LeadFlow account</p>
          </div>
        </div>

        {/* Form card */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@brokerage.com"
              autoComplete="email"
              required
              {...register('email', { required: 'Email is required' })}
              error={errors.email?.message}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              {...register('password', { required: 'Password is required' })}
              error={errors.password?.message}
            />
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>
        </div>


      </div>
    </div>
  );
}
