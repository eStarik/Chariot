import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedDatabase } from '@/lib/db/seed';
import { GET, POST } from '@/app/api/v1/formations/route';
import { PUT } from '@/app/api/v1/formations/[id]/route';

// Mock the database
const mockInsertValues = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockSelectFrom = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });
const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
  }
}));

vi.mock('@/lib/db/schema', () => ({
  formations: { id: 'formations_table' },
  settings: { id: 'settings_table' },
  users: { id: 'users_table' }
}));

describe('Formations Logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-setup the implementation chains since resetAllMocks clears them
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mockSelectFrom.mockResolvedValue([]);
    mockInsertValues.mockResolvedValue([]);
  });

  describe('Database Seeding', () => {
    it('should insert Minecraft and CS2 instances when formations are empty', async () => {
      mockSelectFrom.mockResolvedValueOnce([]); // Simulate empty DB
      await seedDatabase();
      
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'CS2 Default Local' }),
          expect.objectContaining({ name: 'Minecraft Bedrock' })
        ])
      );
    });

    it('should NOT insert anything if both formations and users already exist', async () => {
      mockSelectFrom.mockResolvedValueOnce([{ id: 'existing-formation' }]) // For formations check
                    .mockResolvedValueOnce([{ id: 'existing-admin' }]);    // For users check
      await seedDatabase();
      
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('API Endpoints', () => {
    it('GET /api/v1/formations should return array', async () => {
      // Use mockResolvedValue directly to avoid consumption mismatches
      mockSelectFrom.mockResolvedValueOnce([{ name: 'Test' }]);
      
      const res = await GET();
      const json = await res.json();
      
      expect(json.success).toBe(true);
      expect(json.formations).toBeDefined();
      expect(json.formations.length).toBeGreaterThan(0);
      expect(json.formations[0].name).toBe('Test');
    });

    it('POST /api/v1/formations should parse properties correctly', async () => {
      const payload = {
        name: 'New Form', version: '1.0', description: 'Test desc',
        cpu: '1', memory: '2Gi', tickrate: '30Hz', yaml_config: 'apiVersion: v1'
      };
      
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const res = await POST(req);
      const json = await res.json();
      
      expect(json.success).toBe(true);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Form',
          cpu: '1',
          yaml_config: 'apiVersion: v1'
        })
      );
    });

    it('PUT /api/v1/formations/[id] should parse and update', async () => {
      const payload = {
        name: 'Updated Form', version: '2.0', description: 'Test desc',
        cpu: '2', memory: '4Gi', tickrate: '60Hz', yaml_config: 'apiVersion: v2'
      };
      
      const req = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      const res = await PUT(req, { params: Promise.resolve({ id: 'some-id' }) });
      const json = await res.json();
      
      expect(json.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Form', tickrate: '60Hz', yaml_config: 'apiVersion: v2' }));
    });
  });
});
