export class MockRedis {
  private store: Map<string, string> = new Map();
  private expirations: Map<string, NodeJS.Timeout> = new Map();

  get = jest.fn(async (key: string): Promise<string | null> => {
    return this.store.get(key) || null;
  });

  set = jest.fn(async (key: string, value: string, ...args: any[]): Promise<'OK'> => {
    this.store.set(key, value);

    // Handle EX (expire in seconds)
    const exIndex = args.indexOf('EX');
    if (exIndex !== -1 && args[exIndex + 1]) {
      const seconds = parseInt(args[exIndex + 1]);
      this.setExpiration(key, seconds * 1000);
    }

    return 'OK';
  });

  setex = jest.fn(async (key: string, seconds: number, value: string): Promise<'OK'> => {
    this.store.set(key, value);
    this.setExpiration(key, seconds * 1000);
    return 'OK';
  });

  del = jest.fn(async (...keys: string[]): Promise<number> => {
    let deleted = 0;
    keys.forEach(key => {
      if (this.store.delete(key)) {
        deleted++;
        this.clearExpiration(key);
      }
    });
    return deleted;
  });

  exists = jest.fn(async (...keys: string[]): Promise<number> => {
    return keys.filter(key => this.store.has(key)).length;
  });

  keys = jest.fn(async (pattern: string): Promise<string[]> => {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  });

  flushall = jest.fn(async (): Promise<'OK'> => {
    this.store.clear();
    this.expirations.forEach(timeout => clearTimeout(timeout));
    this.expirations.clear();
    return 'OK';
  });

  ttl = jest.fn(async (key: string): Promise<number> => {
    if (!this.store.has(key)) return -2;
    if (!this.expirations.has(key)) return -1;
    return 100; // Mock TTL
  });

  ping = jest.fn(async (): Promise<'PONG'> => {
    return 'PONG';
  });

  quit = jest.fn(async (): Promise<'OK'> => {
    return 'OK';
  });

  disconnect = jest.fn(() => {
    this.store.clear();
    this.expirations.forEach(timeout => clearTimeout(timeout));
    this.expirations.clear();
  });

  // Set operations
  sadd = jest.fn(async (key: string, ...values: string[]): Promise<number> => {
    const existing = this.store.get(key);
    const set = existing ? new Set(JSON.parse(existing)) : new Set();
    values.forEach(v => set.add(v));
    this.store.set(key, JSON.stringify(Array.from(set)));
    return values.length;
  });

  srem = jest.fn(async (key: string, ...values: string[]): Promise<number> => {
    const existing = this.store.get(key);
    if (!existing) return 0;
    const set = new Set(JSON.parse(existing));
    let removed = 0;
    values.forEach(v => {
      if (set.delete(v)) removed++;
    });
    this.store.set(key, JSON.stringify(Array.from(set)));
    return removed;
  });

  smembers = jest.fn(async (key: string): Promise<string[]> => {
    const existing = this.store.get(key);
    return existing ? JSON.parse(existing) : [];
  });

  expire = jest.fn(async (key: string, seconds: number): Promise<number> => {
    if (!this.store.has(key)) return 0;
    this.setExpiration(key, seconds * 1000);
    return 1;
  });

  info = jest.fn(async (section?: string): Promise<string> => {
    return 'used_memory_human:1M\r\n';
  });

  // Helper methods
  private setExpiration(key: string, milliseconds: number) {
    this.clearExpiration(key);
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.expirations.delete(key);
    }, milliseconds);
    this.expirations.set(key, timeout);
  }

  private clearExpiration(key: string) {
    const timeout = this.expirations.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.expirations.delete(key);
    }
  }

  // Test helper to clear all mocks
  clearMocks() {
    this.store.clear();
    this.expirations.forEach(timeout => clearTimeout(timeout));
    this.expirations.clear();
    jest.clearAllMocks();
  }

  // Test helper to inspect store
  getStore() {
    return new Map(this.store);
  }
}

export const createMockRedis = (): MockRedis => {
  return new MockRedis();
};
