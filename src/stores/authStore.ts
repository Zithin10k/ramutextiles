import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkAdminStatus: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAdmin: false,

  initialize: async () => {
    try {
      console.log('Initializing auth...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.email);
      
      set({ user, isLoading: false });
      
      if (user) {
        await get().checkAdminStatus();
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ isLoading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      set({ user: session?.user || null });
      
      if (session?.user) {
        await get().checkAdminStatus();
      } else {
        set({ isAdmin: false });
      }
    });
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.user) {
      set({ user: data.user });
      await get().checkAdminStatus();
    }
    
    return { error };
  },

  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (!error && data.user) {
      // Create user profile
      try {
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          email: data.user.email,
          is_admin: false,
        });
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
      }
      
      set({ user: data.user });
    }
    
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAdmin: false });
  },

  checkAdminStatus: async () => {
    const { user } = get();
    if (!user) {
      console.log('No user to check admin status');
      return;
    }
    
    try {
      console.log('Checking admin status for user:', user.email);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin status:', error);
        set({ isAdmin: false });
        return;
      }
      
      const isAdmin = data?.is_admin || false;
      console.log('User admin status:', isAdmin);
      set({ isAdmin });
    } catch (error) {
      console.error('Error in checkAdminStatus:', error);
      set({ isAdmin: false });
    }
  },
}));