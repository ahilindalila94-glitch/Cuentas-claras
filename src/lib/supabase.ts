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
      
      // Instantly trigger for local session if it exists to avoid waiting
      const localUserStr = localStorage.getItem('local_supabase_session');
      if (localUserStr) {
        try {
          const localUser = JSON.parse(localUserStr);
          setTimeout(() => callback('SIGNED_IN', { user: localUser }), 0);
        } catch (e) {}
      } else {
        setTimeout(() => callback('SIGNED_OUT', null), 0);
      }

      if (!isSupabaseConfigured()) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const index = authListeners.indexOf(callback);
                if (index !== -1) {
                  authListeners.splice(index, 1);
                }
              }
            }
          }
        };
      }
      
      // Let's also register it with real Supabase only when configured
      let realUnsubscribe = () => {};
      try {
        const { data: { subscription } } = realClient.auth.onAuthStateChange((event, session) => {
          const innerLocalStr = localStorage.getItem('local_supabase_session');
          if (innerLocalStr && !session?.user) {
            const localUser = JSON.parse(innerLocalStr);
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
      if (isSupabaseConfigured()) {
        try {
          await realClient.auth.signOut();
        } catch (e) {
          console.warn('Error al llamar signOut en cliente real:', e);
        }
      }
      return { error: null };
    }
  },
  
  rpc: async (fnName: string, args: any = {}) => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await realClient.rpc(fnName, args);
        if (!error) return { data, error: null };
      } catch (e) {
        console.warn(`Error llamando rpc ${fnName}:`, e);
      }
    }
    // Fallback: return unsynced records
    const unsyncedStr = localStorage.getItem('local_unsynced_extractos') || '[]';
    try {
      const unsynced = JSON.parse(unsyncedStr);
      return { data: unsynced, error: null };
    } catch {
      return { data: [], error: null };
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
      or: (clause: string) => {
        // Parse simple OR clauses like "user_id.eq.val1,user_email.eq.val2"
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

// Helper to register / sync clients across Server and Supabase
export const recordRegisteredClient = async (clientData: {
  email: string;
  role?: string;
  id?: string;
  nombre_comercio?: string;
  cuit?: string;
}) => {
  const cleanEmail = clientData.email.trim().toLowerCase();
  const payload = {
    ...clientData,
    email: cleanEmail,
    last_active: new Date().toISOString(),
  };

  // 1. Sync to local storage registry
  try {
    const localStr = localStorage.getItem('local_registered_clients') || '[]';
    const localList = JSON.parse(localStr);
    const existingIndex = localList.findIndex((c: any) => c.email.toLowerCase() === cleanEmail);
    if (existingIndex >= 0) {
      localList[existingIndex] = { ...localList[existingIndex], ...payload };
    } else {
      localList.push({ ...payload, created_at: new Date().toISOString() });
    }
    localStorage.setItem('local_registered_clients', JSON.stringify(localList));
  } catch (e) {
    console.warn('Error saving local registered clients:', e);
  }

  // 2. Sync to Backend API
  try {
    fetch('/api/clients/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => console.warn('API client register note:', err));
  } catch (e) {
    // Non-blocking
  }

  // 3. Sync to Supabase tables if configured
  try {
    if (isSupabaseConfigured()) {
      try {
        await (realClient
          .from('clients')
          .upsert(
            {
              email: cleanEmail,
              role: payload.role || (cleanEmail === 'ahilindalila94@gmail.com' ? 'admin_contadora' : 'cliente'),
              nombre_comercio: payload.nombre_comercio || null,
              cuit: payload.cuit || null,
              last_active: payload.last_active,
            },
            { onConflict: 'email' }
          ) as any);
      } catch (e) {}

      try {
        await (realClient
          .from('profiles')
          .upsert(
            {
              email: cleanEmail,
              role: payload.role || (cleanEmail === 'ahilindalila94@gmail.com' ? 'admin_contadora' : 'cliente'),
              nombre_comercio: payload.nombre_comercio || null,
              cuit: payload.cuit || null,
              last_active: payload.last_active,
            },
            { onConflict: 'email' }
          ) as any);
      } catch (e) {}
    }
  } catch (e) {
    // Non-blocking
  }
};

// Helper to fetch all registered clients
export const fetchRegisteredClients = async (): Promise<any[]> => {
  const clientsMap = new Map<string, any>();

  // 1. Fetch from backend API
  try {
    const res = await fetch('/api/clients');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.clients)) {
        data.clients.forEach((c: any) => {
          if (c.email) clientsMap.set(c.email.toLowerCase().trim(), c);
        });
      }
    }
  } catch (e) {
    console.warn('Aviso consultando /api/clients:', e);
  }

  // 2. Fetch from Supabase tables
  if (isSupabaseConfigured()) {
    try {
      const { data: dbClients } = await realClient.from('clients').select('*');
      if (Array.isArray(dbClients)) {
        dbClients.forEach((c: any) => {
          if (c.email) {
            const key = c.email.toLowerCase().trim();
            clientsMap.set(key, { ...clientsMap.get(key), ...c });
          }
        });
      }
    } catch (e) {
      // Non-blocking
    }

    try {
      const { data: dbProfiles } = await realClient.from('profiles').select('*');
      if (Array.isArray(dbProfiles)) {
        dbProfiles.forEach((p: any) => {
          if (p.email) {
            const key = p.email.toLowerCase().trim();
            clientsMap.set(key, { ...clientsMap.get(key), ...p });
          }
        });
      }
    } catch (e) {
      // Non-blocking
    }
  }

  // 3. Fetch from local storage fallback
  try {
    const localStr = localStorage.getItem('local_registered_clients') || '[]';
    const localList = JSON.parse(localStr);
    if (Array.isArray(localList)) {
      localList.forEach((c: any) => {
        if (c.email) {
          const key = c.email.toLowerCase().trim();
          if (!clientsMap.has(key)) {
            clientsMap.set(key, c);
          }
        }
      });
    }
  } catch (e) {
    // Non-blocking
  }

  return Array.from(clientsMap.values());
};

// ==========================================
// FACTURAS ARCA (AFIP) PERSISTENCE HELPERS
// ==========================================

export const fetchFacturasArca = async (clientEmail?: string): Promise<any[]> => {
  const facturasMap = new Map<string, any>();
  const cleanEmail = clientEmail?.toLowerCase().trim();

  // 1. Fetch from server API
  try {
    const url = cleanEmail ? `/api/facturas-arca?email=${encodeURIComponent(cleanEmail)}` : '/api/facturas-arca';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.facturas)) {
        data.facturas.forEach((f: any) => {
          if (f.id) facturasMap.set(f.id, f);
        });
      }
    }
  } catch (e) {
    console.warn('Aviso consultando /api/facturas-arca:', e);
  }

  // 2. Fetch from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      let query = realClient.from('facturas_arca').select('*');
      if (cleanEmail) {
        query = query.eq('client_email', cleanEmail);
      }
      const { data: dbFacturas } = await query;
      if (Array.isArray(dbFacturas)) {
        dbFacturas.forEach((f: any) => {
          if (f.id) facturasMap.set(f.id, { ...facturasMap.get(f.id), ...f });
        });
      }
    } catch (e) {
      // Non-blocking
    }
  }

  // 3. Fallback from localStorage
  try {
    const localStr = localStorage.getItem('local_facturas_arca') || '[]';
    const localList = JSON.parse(localStr);
    if (Array.isArray(localList)) {
      localList.forEach((f: any) => {
        if (!f.id) return;
        if (cleanEmail && f.client_email?.toLowerCase().trim() !== cleanEmail) return;
        if (!facturasMap.has(f.id)) {
          facturasMap.set(f.id, f);
        }
      });
    }
  } catch (e) {
    // Non-blocking
  }

  return Array.from(facturasMap.values()).sort(
    (a, b) => new Date(b.created_at || b.fecha_emision).getTime() - new Date(a.created_at || a.fecha_emision).getTime()
  );
};

export const saveFacturaArca = async (facturaData: any): Promise<any> => {
  const cleanEmail = facturaData.client_email?.toLowerCase().trim();
  const id = facturaData.id || `arca-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const itemToSave = {
    ...facturaData,
    id,
    client_email: cleanEmail,
    created_at: facturaData.created_at || new Date().toISOString(),
  };

  // 1. Save to local storage
  try {
    const localStr = localStorage.getItem('local_facturas_arca') || '[]';
    const localList = JSON.parse(localStr);
    const updated = [itemToSave, ...localList.filter((f: any) => f.id !== id)];
    localStorage.setItem('local_facturas_arca', JSON.stringify(updated));
  } catch (e) {}

  // 2. Post to server
  try {
    await fetch('/api/facturas-arca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemToSave),
    });
  } catch (e) {
    console.warn('Aviso guardando en /api/facturas-arca:', e);
  }

  // 3. Sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      await (realClient.from('facturas_arca').upsert(itemToSave) as any);
    } catch (e) {
      // Non-blocking
    }
  }

  return itemToSave;
};

export const deleteFacturaArca = async (id: string): Promise<boolean> => {
  // 1. Remove from local storage
  try {
    const localStr = localStorage.getItem('local_facturas_arca') || '[]';
    const localList = JSON.parse(localStr);
    const updated = localList.filter((f: any) => f.id !== id);
    localStorage.setItem('local_facturas_arca', JSON.stringify(updated));
  } catch (e) {}

  // 2. Delete from server
  try {
    await fetch(`/api/facturas-arca/${id}`, { method: 'DELETE' });
  } catch (e) {}

  // 3. Delete from Supabase
  if (isSupabaseConfigured()) {
    try {
      await (realClient.from('facturas_arca').delete().eq('id', id) as any);
    } catch (e) {}
  }

  return true;
};

