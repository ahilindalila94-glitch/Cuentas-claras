import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://exatizvvaynuhyxpvrik.supabase.co';
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Accept 'sb_publishable_' prefix or standard anonymous keys, but not default placeholder
const isValidKey = typeof rawKey === 'string' && (rawKey.startsWith('sb_publishable_') || rawKey.length > 5) && !rawUrl.includes('exatizvvaynuhyxpvrik.supabase.co');

export const isSupabaseConfigured = () => {
  return isValidKey;
};

export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  const msg = String(error.message || error || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network error') || msg.includes('networkerror');
};

// Use the configured key or a non-empty safe placeholder JWT to prevent startup crash
const finalKey = isValidKey ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key_to_prevent_startup_crash';

const realClient = createClient(rawUrl, finalKey);

// Maintain auth state change listeners for local fallback
const authListeners: Array<(event: string, session: any) => void> = [];

const triggerAuthListeners = (event: string, user: any) => {
  const session = user ? { user } : null;
  authListeners.forEach(callback => {
    try {
      callback(event, session);
    } catch (e) {
      console.error('Error triggering auth listener:', e);
    }
  });
};

// Unsynced extractos helper functions
export const getUnsyncedExtractos = () => {
  try {
    const data = localStorage.getItem('local_unsynced_extractos');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading unsynced extractos:', e);
    return [];
  }
};

export const clearUnsyncedExtractos = () => {
  try {
    localStorage.removeItem('local_unsynced_extractos');
  } catch (e) {
    console.error('Error clearing unsynced extractos:', e);
  }
};

export const syncExtractos = async (): Promise<{ success: number; failed: number; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { success: 0, failed: 0, error: 'Supabase no está configurado todavía.' };
  }
  
  const unsynced = getUnsyncedExtractos();
  if (unsynced.length === 0) {
    return { success: 0, failed: 0 };
  }
  
  let successCount = 0;
  let failedCount = 0;
  const remaining: any[] = [];
  
  for (const item of unsynced) {
    try {
      // Remove local metadata before uploading
      const { _local_id, _synced, _created_at, ...payload } = item;
      
      const { error } = await realClient.from('extractos').insert([payload]);
      if (error) {
        console.error('Error sincronizando registro individual:', error);
        failedCount++;
        remaining.push(item);
      } else {
        successCount++;
      }
    } catch (err) {
      console.error('Error de red al sincronizar registro individual:', err);
      failedCount++;
      remaining.push(item);
    }
  }
  
  if (remaining.length > 0) {
    localStorage.setItem('local_unsynced_extractos', JSON.stringify(remaining));
  } else {
    localStorage.removeItem('local_unsynced_extractos');
  }
  
  return { success: successCount, failed: failedCount };
};

// Supabase Proxy Client with automatic local fallbacks
export const supabase = {
  auth: {
    getSession: async () => {
      if (!isSupabaseConfigured()) {
        const localUserStr = localStorage.getItem('local_supabase_session');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          return { data: { session: { user: localUser } }, error: null };
        }
        return { data: { session: null }, error: null };
      }
      try {
        const { data, error } = await realClient.auth.getSession();
        if (error) {
          if (isNetworkError(error)) {
            throw error;
          }
          return { data, error };
        }
        
        // If real client session is active, keep it. Otherwise, look for local persistent session.
        if (data?.session?.user) {
          return { data, error: null };
        }
        
        const localUserStr = localStorage.getItem('local_supabase_session');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          return { data: { session: { user: localUser } }, error: null };
        }
        
        return { data: { session: null }, error: null };
      } catch (err: any) {
        console.warn('Fallo getSession debido a error de red. Intentando recuperar sesión local:', err);
        const localUserStr = localStorage.getItem('local_supabase_session');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          return { data: { session: { user: localUser } }, error: null };
        }
        return { data: { session: null }, error: null };
      }
    },
    
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      authListeners.push(callback);
      
      // Let's also register it with real Supabase
      let realUnsubscribe = () => {};
      try {
        const { data: { subscription } } = realClient.auth.onAuthStateChange((event, session) => {
          const localUserStr = localStorage.getItem('local_supabase_session');
          if (localUserStr && !session?.user) {
            const localUser = JSON.parse(localUserStr);
            callback('SIGNED_IN', { user: localUser });
          } else {
            callback(event, session);
          }
        });
        realUnsubscribe = () => subscription.unsubscribe();
      } catch (e) {
        console.warn('onAuthStateChange no se pudo registrar en cliente real (offline):', e);
      }
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const index = authListeners.indexOf(callback);
              if (index !== -1) {
                authListeners.splice(index, 1);
              }
              realUnsubscribe();
            }
          }
        }
      };
    },
    
    signUp: async ({ email, password, options }: any) => {
      if (!isSupabaseConfigured()) {
        const localUser = {
          id: 'local-user-' + btoa(email),
          email,
          isLocalSession: true,
          created_at: new Date().toISOString(),
          user_metadata: options?.data || {}
        };
        localStorage.setItem('local_supabase_session', JSON.stringify(localUser));
        triggerAuthListeners('SIGNED_IN', localUser);
        return { data: { user: localUser, session: { user: localUser } }, error: null, isLocalSession: true };
      }
      try {
        const { data, error } = await realClient.auth.signUp({ email, password, options });
        if (error) {
          if (isNetworkError(error)) {
            throw error;
          }
          return { data, error };
        }
        return { data, error: null };
      } catch (err: any) {
        console.warn('Fallo signUp por red. Activando sesión persistente local automáticamente:', err);
        const localUser = {
          id: 'local-user-' + btoa(email),
          email,
          isLocalSession: true,
          created_at: new Date().toISOString(),
          user_metadata: options?.data || {}
        };
        localStorage.setItem('local_supabase_session', JSON.stringify(localUser));
        triggerAuthListeners('SIGNED_IN', localUser);
        return { data: { user: localUser, session: { user: localUser } }, error: null, isLocalSession: true };
      }
    },
    
    signInWithPassword: async ({ email, password }: any) => {
      if (!isSupabaseConfigured()) {
        const userMetaStr = localStorage.getItem(`meta_${email}`);
        const userMeta = userMetaStr ? JSON.parse(userMetaStr) : {};
        const localUser = {
          id: 'local-user-' + btoa(email),
          email,
          isLocalSession: true,
          created_at: new Date().toISOString(),
          user_metadata: userMeta
        };
        localStorage.setItem('local_supabase_session', JSON.stringify(localUser));
        triggerAuthListeners('SIGNED_IN', localUser);
        return { data: { user: localUser, session: { user: localUser } }, error: null, isLocalSession: true };
      }
      try {
        const { data, error } = await realClient.auth.signInWithPassword({ email, password });
        if (error) {
          if (isNetworkError(error)) {
            throw error;
          }
          return { data, error };
        }
        return { data, error: null };
      } catch (err: any) {
        console.warn('Fallo signInWithPassword por red. Activando sesión persistente local automáticamente:', err);
        // Determine role from localStorage metadata or email
        const userMetaStr = localStorage.getItem(`meta_${email}`);
        const userMeta = userMetaStr ? JSON.parse(userMetaStr) : {};
        const localUser = {
          id: 'local-user-' + btoa(email),
          email,
          isLocalSession: true,
          created_at: new Date().toISOString(),
          user_metadata: userMeta
        };
        localStorage.setItem('local_supabase_session', JSON.stringify(localUser));
        triggerAuthListeners('SIGNED_IN', localUser);
        return { data: { user: localUser, session: { user: localUser } }, error: null, isLocalSession: true };
      }
    },
    
    signOut: async () => {
      localStorage.removeItem('local_supabase_session');
      triggerAuthListeners('SIGNED_OUT', null);
      try {
        await realClient.auth.signOut();
      } catch (e) {
        console.warn('Error al llamar signOut en cliente real:', e);
      }
      return { error: null };
    }
  },
  
  from: (table: string) => {
    let queryType = 'select'; // 'insert', 'update', 'select', 'delete'
    let insertData: any = null;
    let updateValues: any = null;
    const filters: Array<{ col: string; val: any }> = [];
    let orderCol: string | null = null;
    let orderDesc = false;

    const builder: any = {
      insert: (data: any) => {
        queryType = 'insert';
        insertData = data;
        return builder;
      },
      update: (values: any) => {
        queryType = 'update';
        updateValues = values;
        return builder;
      },
      delete: () => {
        queryType = 'delete';
        return builder;
      },
      select: (cols = '*') => {
        queryType = 'select';
        return builder;
      },
      eq: (col: string, val: any) => {
        filters.push({ col, val });
        return builder;
      },
      order: (col: string, options: any = {}) => {
        orderCol = col;
        orderDesc = options.ascending === false;
        return builder;
      },
      then: async (onfulfilled?: any, onrejected?: any) => {
        try {
          if (isSupabaseConfigured()) {
            try {
              let realQuery: any = realClient.from(table);
              if (queryType === 'insert') {
                realQuery = realQuery.insert(insertData);
              } else if (queryType === 'update') {
                realQuery = realQuery.update(updateValues);
              } else if (queryType === 'delete') {
                realQuery = realQuery.delete();
              } else if (queryType === 'select') {
                realQuery = realQuery.select('*');
              }

              for (const f of filters) {
                realQuery = realQuery.eq(f.col, f.val);
              }

              if (orderCol) {
                realQuery = realQuery.order(orderCol, { ascending: !orderDesc });
              }

              const { data: resData, error: resError } = await realQuery;
              if (resError) {
                if (isNetworkError(resError)) {
                  throw resError;
                }
                if (onfulfilled) return onfulfilled({ data: resData, error: resError });
                return { data: resData, error: resError };
              }
              if (onfulfilled) return onfulfilled({ data: resData, error: null });
              return { data: resData, error: null };
            } catch (err: any) {
              if (!isNetworkError(err)) {
                throw err;
              }
              console.warn(`[Supabase Offline Fallback] Fallo por red en tabla "${table}". Usando base local.`);
            }
          }

          // Fallback Database logic (localStorage)
          const unsyncedStr = localStorage.getItem('local_unsynced_extractos') || '[]';
          let unsynced = JSON.parse(unsyncedStr);

          if (queryType === 'insert') {
            const itemsToSave = Array.isArray(insertData) ? insertData : [insertData];
            const enrichedItems = itemsToSave.map(item => ({
              id: item.id || 'local_ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              ...item,
              _local_id: 'local_ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              _synced: false,
              _created_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              facturado: item.facturado || false
            }));
            
            unsynced.push(...enrichedItems);
            localStorage.setItem('local_unsynced_extractos', JSON.stringify(unsynced));
            
            const result = { data: enrichedItems, error: null, isOfflineSave: true };
            if (onfulfilled) return onfulfilled(result);
            return result;
          } 
          
          if (queryType === 'update') {
            let updatedCount = 0;
            unsynced = unsynced.map((item: any) => {
              const matches = filters.every(f => {
                const itemVal = item[f.col];
                return itemVal === f.val || (f.col === 'id' && item._local_id === f.val);
              });
              if (matches) {
                updatedCount++;
                return { ...item, ...updateValues };
              }
              return item;
            });
            localStorage.setItem('local_unsynced_extractos', JSON.stringify(unsynced));
            const result = { data: null, error: null, count: updatedCount };
            if (onfulfilled) return onfulfilled(result);
            return result;
          }

          if (queryType === 'delete') {
            let deletedCount = 0;
            unsynced = unsynced.filter((item: any) => {
              const matches = filters.every(f => {
                const itemVal = item[f.col];
                return itemVal === f.val || (f.col === 'id' && (item.id === f.val || item._local_id === f.val));
              });
              if (matches) {
                deletedCount++;
                return false;
              }
              return true;
            });
            localStorage.setItem('local_unsynced_extractos', JSON.stringify(unsynced));

            // Also remove from global history
            try {
              const savedStr = localStorage.getItem('asistente_contable_historial_v1') || '[]';
              let saved = JSON.parse(savedStr);
              saved = saved.filter((item: any) => {
                const matches = filters.every(f => {
                  const itemVal = item[f.col];
                  return itemVal === f.val || (f.col === 'id' && item.id === f.val);
                });
                return !matches;
              });
              localStorage.setItem('asistente_contable_historial_v1', JSON.stringify(saved));
            } catch (e) {
              console.error('Error deleting from global history fallback:', e);
            }

            const result = { data: null, error: null, count: deletedCount };
            if (onfulfilled) return onfulfilled(result);
            return result;
          }

          if (queryType === 'select') {
            let filtered = unsynced;
            for (const f of filters) {
              filtered = filtered.filter((item: any) => {
                const itemVal = item[f.col];
                return itemVal === f.val;
              });
            }
            if (orderCol) {
              filtered.sort((a: any, b: any) => {
                const valA = a[orderCol!] || '';
                const valB = b[orderCol!] || '';
                if (valA < valB) return orderDesc ? 1 : -1;
                if (valA > valB) return orderDesc ? -1 : 1;
                return 0;
              });
            }
            const result = { data: filtered, error: null };
            if (onfulfilled) return onfulfilled(result);
            return result;
          }

          const fallbackResult = { data: [], error: null };
          if (onfulfilled) return onfulfilled(fallbackResult);
          return fallbackResult;
        } catch (error: any) {
          if (onrejected) return onrejected(error);
          return { data: null, error };
        }
      }
    };

    return builder;
  }
} as any;
