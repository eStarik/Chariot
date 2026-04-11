import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authOptions } from '../src/lib/auth-config';
import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

// Deep mock database and bcrypt
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn()
        }))
      }))
    }))
  }
}));

vi.mock('@/lib/db/schema', () => ({
  users: { email: 'users.email' }
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn()
  }
}));

// Mock NextAuth and its providers to prevent illegal imports during tests
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn()
  }))
}));
vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn((config) => config)
}));
vi.mock('next-auth/providers/github', () => ({
  default: vi.fn()
}));
vi.mock('next-auth/providers/google', () => ({
  default: vi.fn()
}));
vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: vi.fn()
}));

describe('Auth System - Credentials Provider', () => {
  // Extract the authorize function from our config
  const credentialsProvider = authOptions.providers.find((p: any) => p.name === 'Chariot Native') as any;
  const authorize = credentialsProvider?.authorize;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate a valid user with correct password', async () => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@chariot.hub',
      password: 'hashed-password',
      name: 'Imperial Commander'
    };

    // Setup DB mock for this specific call
    const mockLimit = vi.fn().mockResolvedValue([mockUser]);
    (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: mockLimit }) }) });
    
    (bcrypt.compare as any).mockResolvedValue(true);

    const result = await authorize({
      email: 'admin@chariot.hub',
      password: 'correct-password'
    });

    expect(result).toEqual({
      id: 'admin-1',
      name: 'Imperial Commander',
      email: 'admin@chariot.hub'
    });
  });

  it('should fail authentication for wrong password', async () => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@chariot.hub',
      password: 'hashed-password'
    };

    const mockLimit = vi.fn().mockResolvedValue([mockUser]);
    (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: mockLimit }) }) });
    
    (bcrypt.compare as any).mockResolvedValue(false);

    const result = await authorize({
      email: 'admin@chariot.hub',
      password: 'wrong-password'
    });

    expect(result).toBeNull();
  });

  it('should return null if user is not found', async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: mockLimit }) }) });

    const result = await authorize({
      email: 'ghost@chariot.hub',
      password: 'any'
    });

    expect(result).toBeNull();
  });
});
