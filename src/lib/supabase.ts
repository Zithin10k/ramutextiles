import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

// Product analytics helper with error handling
export const trackProductInteraction = async (
  productId: string,
  metric: 'views' | 'likes' | 'saves' | 'shares' | 'cart_adds' | 'purchases'
) => {
  try {
    const { error } = await supabase.rpc('update_product_analytics', {
      p_product_id: productId,
      p_metric: metric,
      p_increment: 1
    });
    
    if (error) {
      console.error('Error tracking product interaction:', error);
    }
  } catch (error) {
    // Silently handle analytics errors to not break user experience
    console.error('Failed to track product interaction:', error);
  }
};