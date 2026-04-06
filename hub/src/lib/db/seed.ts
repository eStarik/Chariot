import { db } from './index';
import { formations } from './schema';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  try {
    const existingFormations = await db.select().from(formations);
    
    if (existingFormations.length === 0) {
      console.log('[DB] First-run detected. Seeding CS2 and Minecraft GameServer templates...');
      
      const cs2 = {
        id: uuidv4(),
        name: 'CS2 Default Local',
        version: '1.0',
        description: 'Standard competitive CounterStrike 2 64-tick server container.',
        cpu: '2',
        memory: '2Gi',
        tickrate: '64Hz',
        yaml_config: `apiVersion: "agones.dev/v1"
kind: GameServer
metadata:
  name: cs2-local
  labels:
    version: "1.0"
  annotations:
    description: "Standard competitive CounterStrike 2 64-tick server container."
    tickrate: "64Hz"
spec:
  ports:
  - name: default
    containerPort: 27015
  template:
    spec:
      containers:
      - name: cs2
        image: "cm2network/csgo:latest"
        resources:
          requests:
            memory: "2Gi"
            cpu: "2"`
      };
      
      const mc = {
        id: uuidv4(),
        name: 'Minecraft Bedrock',
        version: '1.20',
        description: 'Minecraft Bedrock dedicated server running standard survival.',
        cpu: '1',
        memory: '4Gi',
        tickrate: '20Hz',
        yaml_config: `apiVersion: "agones.dev/v1"
kind: GameServer
metadata:
  name: mc-bedrock
  labels:
    version: "1.20"
  annotations:
    description: "Minecraft Bedrock dedicated server running standard survival."
    tickrate: "20Hz"
spec:
  ports:
  - name: default
    containerPort: 19132
  template:
    spec:
      containers:
      - name: minecraft
        image: "itzg/minecraft-bedrock-server"
        resources:
          requests:
            memory: "4Gi"
            cpu: "1"`
      };

      await db.insert(formations).values([cs2, mc]);
      console.log('[DB] Successfully seeded GameServer templates.');
    }
  } catch (error) {
    console.error('[DB] Error seeding:', error);
  }
}
