import { supabase } from './supabase';
import type { AuthUser } from '@/types';
import type { User } from '@supabase/supabase-js';

export function mapSupabaseUser(user: User): AuthUser {
  return {
    id:       user.id,
    email:    user.email!,
    username: user.user_metadata?.username
      || user.user_metadata?.full_name
      || user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url,
  };
}

export const authService = {
  async sendOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  },

  async verifyOtpAndRegister(email: string, token: string, password: string, username: string) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (verifyError) throw verifyError;

    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: { username },
    });
    if (updateError) throw updateError;
    return data.user!;
  },

  async signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
