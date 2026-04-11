import { describe, it, expect, vi, beforeEach } from 'vitest';
import middleware from '../src/middleware';

// Mock auth-config so we can call middleware(req) without NextAuth environment errors
vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn((handler) => (req: any) => handler(req))
}));

// Mock Next server response logic
const mockNextResponse = {
  next: vi.fn().mockImplementation(() => undefined),
  redirect: vi.fn().mockImplementation((url: URL) => ({
    status: 307,
    headers: {
      get: (key: string) => key === 'location' ? url.toString() : null
    }
  })),
  json: vi.fn().mockImplementation((data, init) => ({
    status: init?.status || 200,
    json: async () => data,
    headers: { get: () => null }
  }))
};

vi.mock('next/server', () => ({
  NextResponse: mockNextResponse,
  NextRequest: class {}
}));

describe('System Gateway (Middleware)', () => {
  const createMockRequest = (pathname: string, user: any = null) => {
    return {
      auth: user ? { user } : null,
      nextUrl: new URL(`http://localhost:3000${pathname}`),
      url: `http://localhost:3000${pathname}`
    } as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow public access to registration handshake', async () => {
    const req = createMockRequest('/api/v1/register/handshake');
    const result = await middleware(req);
    // Returning undefined/void from middleware is interpreted as NextResponse.next()
    expect(result).toBeUndefined();
  });

  it('should allow public access to health checks', async () => {
    const req = createMockRequest('/api/health');
    const result = await middleware(req);
    expect(result).toBeUndefined();
  });

  it('should redirect unauthenticated users to /login for dashboard routes', async () => {
    const req = createMockRequest('/legions'); // Private route
    const result = await middleware(req);

    expect(result).toBeDefined();
    expect((result as any).headers.get('location')).toContain('/login');
  });

  it('should block unauthenticated API calls with 401', async () => {
    const req = createMockRequest('/api/v1/registry'); // Private API
    const result = await middleware(req);

    expect(result).toBeDefined();
    expect((result as any).status).toBe(401);
  });

  it('should allow authenticated users to traverse the dashboard', async () => {
    const req = createMockRequest('/legions', { name: 'Imperial Commander' });
    const result = await middleware(req);
    expect(result).toBeUndefined();
  });
});
