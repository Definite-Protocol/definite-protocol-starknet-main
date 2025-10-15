import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://your-project.supabase.co' && 
         supabaseAnonKey !== 'your-anon-key' &&
         supabaseUrl.includes('supabase.co');
};

// Create a mock client for when Supabase is not configured
const createMockClient = () => ({
  from: (table: string) => {
    const mockQueryBuilder = {
      select: (columns?: string) => mockQueryBuilder,
      insert: (values: any) => mockQueryBuilder,
      update: (values: any) => mockQueryBuilder,
      delete: () => mockQueryBuilder,
      eq: (column: string, value: any) => mockQueryBuilder,
      gte: (column: string, value: any) => mockQueryBuilder,
      lte: (column: string, value: any) => mockQueryBuilder,
      gt: (column: string, value: any) => mockQueryBuilder,
      lt: (column: string, value: any) => mockQueryBuilder,
      order: (column: string, options?: any) => mockQueryBuilder,
      limit: (count: number) => mockQueryBuilder,
      single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      then: (onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled)
    };
    return mockQueryBuilder;
  },
  rpc: (fnName: string, params?: any) => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
  channel: (name: string) => ({
    on: (event: string, config: any, callback: Function) => ({
      subscribe: () => ({ unsubscribe: () => {} })
    }),
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => {}
  }),
  auth: {
    signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ 
      data: { 
        subscription: { 
          unsubscribe: () => {} 
        } 
      } 
    })
  }
});

export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : createMockClient() as any;

// Auth helpers
export const signUp = async (email: string, password: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
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

export const subscribeToAuthChanges = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};