# Formations Editor & DB Seeding Specifications

## Overview
The formations editor provides a YAML-based aesthetic interface for Users to dictate Legion configurations seamlessly. However, the data will fundamentally persist cleanly mapped within a proper relational schema in the Drizzle-backed PostgreSQL database structure.

## Database Seeding
The backend maintains a conditional seed routine that ensures if zero formations exist upon initialization, two primary placeholders are generated:
1. `CS2 Default Local` (CS2 Schema Template)
2. `Minecraft Bedrock` (Minecraft Schema Template)

### Process:
- Query `formations` table.
- If `count === 0`, push insertion objects into `db.insert(formations)`.

## Editor Core Logic
The UI `app/formations/page.tsx` displays database elements converted to `YAML` visually via `react-simple-code-editor` and `prismjs`. 
- **Style Hook**: The editor uses `var(--bg-input)` and matching font-colors.
- **Conversion flow**: 
  - `GET /api/v1/formations` outputs JSON.
  - UI parses JSON matching standard structure into a YAML string.
  - User edits YAML in UI.
  - UI maps the YAML string back into strict JSON objects upon 'Save' trigger.
  - Extracted properties (`name`, `version`, `description`, `cpu`, `memory`, `tickrate`) update existing rows via `PUT /api/v1/formations/[id]`.

## Testability Standard
Every API wrapper touching `formations` must guarantee property extraction functions without defaulting into raw YAML blob storage. 
