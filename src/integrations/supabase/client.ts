// Local stub for Supabase client to support a static/local-only site.
// This replaces the real Supabase connection so the app does not talk to a DB.
// Behavior:
// - signUp / signInWithPassword create a local session stored in localStorage
// - from('user_roles').insert(...) stores roles in localStorage under 'lifelink_roles'
// - from('user_roles').select(...).eq('user_id', id) returns stored role for that id
// - auth.onAuthStateChange allows listeners and notifies them on sign in/up

type Listener = (event: string, session: any) => void;

const listeners: Listener[] = [];

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem("lifelink_users") || "{}");
  } catch (e) {
    return {};
  }
}

function setStoredUsers(users: Record<string, any>) {
  localStorage.setItem("lifelink_users", JSON.stringify(users));
}

function getStoredRoles() {
  try {
    return JSON.parse(localStorage.getItem("lifelink_roles") || "{}");
  } catch (e) {
    return {};
  }
}

function setStoredRoles(roles: Record<string, string>) {
  localStorage.setItem("lifelink_roles", JSON.stringify(roles));
}

function getStoredProfiles() {
  try {
    return JSON.parse(localStorage.getItem("lifelink_profiles") || "{}");
  } catch (e) {
    return {};
  }
}

function setStoredProfiles(profiles: Record<string, any>) {
  localStorage.setItem("lifelink_profiles", JSON.stringify(profiles));
}

function getStoredData(table: string) {
  try {
    return JSON.parse(localStorage.getItem(`lifelink_${table}`) || "[]");
  } catch (e) {
    return [];
  }
}

function setStoredData(table: string, data: any[]) {
  localStorage.setItem(`lifelink_${table}`, JSON.stringify(data));
}

function notifyListeners(event: string, session: any) {
  listeners.forEach((l) => {
    try {
      l(event, session);
    } catch (e) {
      // ignore
    }
  });
}

const auth = {
  onAuthStateChange(cb: Listener) {
    listeners.push(cb);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
          },
        },
      },
    };
  },
  async getSession() {
    const session = JSON.parse(localStorage.getItem("lifelink_session") || "null");
    return { data: { session } };
  },
  async getUser() {
    const user = JSON.parse(localStorage.getItem("lifelink_user") || "null");
    return { data: { user } };
  },
  async signUp({ email, password, options }: any) {
    const users = getStoredUsers();
    const id = `local_${Date.now()}`;
    const user = { id, email, password, full_name: options?.data?.full_name ?? "" };
    users[email] = user;
    setStoredUsers(users);

    // Create profile
    const profiles = getStoredProfiles();
    profiles[id] = {
      id,
      email,
      full_name: options?.data?.full_name ?? "User",
      phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStoredProfiles(profiles);

    // Persist session and user
    const session = { user: { id, email } };
    localStorage.setItem("lifelink_session", JSON.stringify(session));
    localStorage.setItem("lifelink_user", JSON.stringify({ id, email }));

    // Store role if provided via insert to user_roles (caller may also insert separately)
    if (options?.data?.role) {
      const roles = getStoredRoles();
      roles[id] = options.data.role;
      setStoredRoles(roles);
    }

    notifyListeners("SIGNED_IN", session);
    return { data: { user }, error: null };
  },
  async signInWithPassword({ email, password }: any) {
    const users = getStoredUsers();
    let user = users[email];
    if (!user) {
      const id = `local_${Date.now()}`;
      user = { id, email, password, full_name: "" };
      users[email] = user;
      setStoredUsers(users);

      // Create default profile if doesn't exist
      const profiles = getStoredProfiles();
      if (!profiles[user.id]) {
        profiles[user.id] = {
          id: user.id,
          email,
          full_name: email.split("@")[0],
          phone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setStoredProfiles(profiles);
      }
    }

    const session = { user: { id: user.id, email } };
    localStorage.setItem("lifelink_session", JSON.stringify(session));
    localStorage.setItem("lifelink_user", JSON.stringify({ id: user.id, email }));

    notifyListeners("SIGNED_IN", session);
    return { data: { user }, error: null };
  },
  async signOut() {
    localStorage.removeItem("lifelink_session");
    localStorage.removeItem("lifelink_user");
    notifyListeners("SIGNED_OUT", null);
    return { data: null, error: null };
  }
};

function from(table: string) {
  const builder: any = {
    _table: table,
    _operation: 'select',
    _updates: null,
    _select(cols: string) {
      this._cols = cols;
      return this;
    },
    _where: [] as Array<{ col: string; val: any }>,
    select(cols: string) { 
      this._cols = cols;
      this._operation = 'select';
      return this;
    },
    eq(col: string, val: any) {
      this._where.push({ col, val });
      return this;
    },
    async single() {
      const self = this;
      return new Promise((resolve) => {
        self.then((result: any) => {
          if (result.data && result.data.length > 0) {
            resolve({ data: result.data[0], error: null });
          } else {
            resolve({ data: null, error: { message: "No rows returned" } });
          }
        });
      });
    },
    async order(col: string, options?: { ascending?: boolean }) {
      // Apply ordering after getting data
      this._orderBy = { col, ascending: options?.ascending !== false };
      return this;
    },
    async limit(count: number) {
      this._limit = count;
      return this;
    },
    async then(resolve: any) {
      // Handle update operation
      if (this._operation === 'update' && this._updates) {
        if (table === "profiles") {
          const profiles = getStoredProfiles();
          this._where.forEach(({ col, val }: any) => {
            if (col === "id" && profiles[val]) {
              profiles[val] = {
                ...profiles[val],
                ...this._updates,
                updated_at: new Date().toISOString(),
              };
            }
          });
          setStoredProfiles(profiles);
          return resolve({ data: null, error: null });
        } else {
          const data = getStoredData(table);
          this._where.forEach(({ col, val }: any) => {
            const index = data.findIndex((item: any) => item[col] === val);
            if (index !== -1) {
              data[index] = {
                ...data[index],
                ...this._updates,
                updated_at: new Date().toISOString(),
              };
            }
          });
          setStoredData(table, data);
          return resolve({ data: null, error: null });
        }
      }

      // Handle select operation
      let data: any[] = [];

      // Handle profiles table
      if (table === "profiles") {
        const profiles = getStoredProfiles();
        data = Object.values(profiles);
        
        // Apply filters
        this._where.forEach(({ col, val }: any) => {
          if (col === "id") {
            data = data.filter((p: any) => p.id === val);
          }
        });
      }
      // Handle user_roles table
      else if (table === "user_roles") {
        const roles = getStoredRoles();
        this._where.forEach(({ col, val }: any) => {
          if (col === "user_id") {
            const role = roles[val];
            if (role) {
              data = [{ user_id: val, role, id: val }];
            }
          }
        });
      }
      // Handle other tables (donor_profiles, blood_requests, donations, etc.)
      else {
        data = getStoredData(table);
        
        // Apply filters
        this._where.forEach(({ col, val }: any) => {
          data = data.filter((item: any) => item[col] === val);
        });
      }

      // Apply ordering
      if (this._orderBy) {
        data.sort((a: any, b: any) => {
          const aVal = a[this._orderBy.col];
          const bVal = b[this._orderBy.col];
          if (this._orderBy.ascending) {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
          }
        });
      }

      // Apply limit
      if (this._limit) {
        data = data.slice(0, this._limit);
      }

      return resolve({ data, error: null });
    },
    async insert(rows: any[]) {
      if (table === "user_roles") {
        const roles = getStoredRoles();
        rows.forEach((r) => {
          if (r.user_id && r.role) {
            roles[r.user_id] = r.role;
          }
        });
        setStoredRoles(roles);
        return { data: rows, error: null };
      } else if (table === "profiles") {
        const profiles = getStoredProfiles();
        rows.forEach((r) => {
          if (r.id) {
            profiles[r.id] = {
              ...r,
              created_at: r.created_at || new Date().toISOString(),
              updated_at: r.updated_at || new Date().toISOString(),
            };
          }
        });
        setStoredProfiles(profiles);
        return { data: rows, error: null };
      } else {
        // Store in table-specific storage
        const existing = getStoredData(table);
        const newRows = rows.map((r) => ({
          ...r,
          id: r.id || `local_${Date.now()}_${Math.random()}`,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));
        setStoredData(table, [...existing, ...newRows]);
        return { data: newRows, error: null };
      }
    },
    async upsert(rows: any[], options?: any) {
      // For simplicity, treat upsert as insert (in a real implementation, would check for existing records)
      return this.insert(rows);
    },
    update(updates: any) {
      this._updates = updates;
      this._operation = 'update';
      return this;
    },
    async delete() {
      if (table === "profiles") {
        const profiles = getStoredProfiles();
        this._where.forEach(({ col, val }: any) => {
          if (col === "id") {
            delete profiles[val];
          }
        });
        setStoredProfiles(profiles);
        return { data: null, error: null };
      } else {
        let data = getStoredData(table);
        this._where.forEach(({ col, val }: any) => {
          data = data.filter((item: any) => item[col] !== val);
        });
        setStoredData(table, data);
        return { data: null, error: null };
      }
    }
  };

  return builder;
}

export const supabase = {
  auth,
  from,
};