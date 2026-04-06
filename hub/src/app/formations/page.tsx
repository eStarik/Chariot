'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTelemetry } from '@/components/TelemetryContext';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism-tomorrow.css';
import YAML from 'yaml';

// --- Agones YAML Validation ---
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateAgonesYaml(yamlStr: string): ValidationResult {
  const errors: string[] = [];

  let parsed: any;
  try {
    parsed = YAML.parse(yamlStr);
  } catch (e: any) {
    return { valid: false, errors: [`YAML syntax error: ${e.message}`] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['YAML must parse to a valid object.'] };
  }

  // apiVersion check
  if (!parsed.apiVersion) {
    errors.push('Missing required field: apiVersion');
  } else if (!String(parsed.apiVersion).startsWith('agones.dev/')) {
    errors.push(`apiVersion must start with "agones.dev/", got: "${parsed.apiVersion}"`);
  }

  // kind check
  if (!parsed.kind) {
    errors.push('Missing required field: kind');
  } else if (parsed.kind !== 'GameServer' && parsed.kind !== 'Fleet') {
    errors.push(`kind must be "GameServer" or "Fleet", got: "${parsed.kind}"`);
  }

  // metadata.name check
  if (!parsed.metadata?.name) {
    errors.push('Missing required field: metadata.name');
  }

  // Spec structure depends on kind
  const isFleet = parsed.kind === 'Fleet';
  const gsSpec = isFleet ? parsed.spec?.template?.spec : parsed.spec;

  // ports check
  if (!gsSpec?.ports || !Array.isArray(gsSpec.ports) || gsSpec.ports.length === 0) {
    errors.push('spec.ports must be a non-empty array defining at least one port.');
  }

  // containers check
  const containers = gsSpec?.template?.spec?.containers;
  if (!containers || !Array.isArray(containers) || containers.length === 0) {
    errors.push('spec.template.spec.containers must be a non-empty array with at least one container.');
  } else {
    containers.forEach((c: any, i: number) => {
      if (!c.image) {
        errors.push(`Container [${i}] is missing required field: image`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// --- Extract summary metadata from parsed YAML ---
function extractMetadata(yamlStr: string) {
  try {
    const parsed = YAML.parse(yamlStr);
    const isFleet = parsed?.kind === 'Fleet';
    const gsSpec = isFleet ? parsed?.spec?.template?.spec : parsed?.spec;
    const podSpec = gsSpec?.template?.spec;
    const container = podSpec?.containers?.[0];
    const annotations = parsed?.metadata?.annotations ||
      (isFleet ? parsed?.spec?.template?.metadata?.annotations : {}) || {};

    return {
      name: parsed?.metadata?.name || 'Unknown',
      version: parsed?.metadata?.labels?.version || '1.0',
      description: annotations?.description || '',
      cpu: container?.resources?.requests?.cpu || '1',
      memory: container?.resources?.requests?.memory || '1Gi',
      tickrate: annotations?.tickrate || '60Hz',
    };
  } catch {
    return { name: 'Unknown', version: '1.0', description: '', cpu: '1', memory: '1Gi', tickrate: '60Hz' };
  }
}

// --- Default GameServer YAML Template ---
const DEFAULT_GAMESERVER_YAML = `apiVersion: "agones.dev/v1"
kind: GameServer
metadata:
  name: new-server
  labels:
    version: "1.0"
  annotations:
    description: "New tactical variant"
    tickrate: "60Hz"
spec:
  ports:
  - name: default
    containerPort: 7777
  template:
    spec:
      containers:
      - name: server
        image: "your-image:latest"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"`;

// --- Formation Card Component ---
const FormationCard = ({ formation, onEdit }: {
  formation: any; onEdit: (f: any) => void
}) => {
  return (
    <div className="formation-card flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-1">
          <h4 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{formation.name}</h4>
          <span className="text-bronze" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{formation.version}</span>
        </div>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
          {formation.description}
        </p>
        <div className="flex gap-4 mb-6" style={{ fontSize: '0.8rem', color: 'var(--accent-bronze-dark)', fontWeight: 'bold' }}>
          <span>CPU: {formation.cpu}</span>
          <span>RAM: {formation.memory}</span>
          <span>TICK: {formation.tickrate}</span>
        </div>
    </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onEdit(formation)}
          className="deploy-btn"
          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--accent-bronze-dark)', width: 'auto', padding: '0.65rem 2rem' }}
        >
          Edit
        </button>
      </div>
    </div>
  );
};

// --- Formations Page ---
export default function FormationsPage() {
  const { agents, activeAgentId, setActiveAgentId } = useTelemetry();
  const [formations, setFormations] = useState<any[]>([]);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // YAML editor state
  const [yamlConfig, setYamlConfig] = useState(DEFAULT_GAMESERVER_YAML);
  const [draftYaml, setDraftYaml] = useState<string | null>(null); // persisted draft for "add new"
  const [errorMsg, setErrorMsg] = useState('');
  const [liveValidation, setLiveValidation] = useState<ValidationResult>({ valid: true, errors: [] });

  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch formations from API
  const fetchFormations = async () => {
    try {
      const res = await fetch('/api/v1/formations');
      const data = await res.json();
      if (data.success) setFormations(data.formations);
    } catch (e) { /* silently fail */ }
  };

  useEffect(() => {
    fetchFormations();
  }, []);

  // Live validation as user types
  useEffect(() => {
    if (panelOpen) {
      setLiveValidation(validateAgonesYaml(yamlConfig));
    }
  }, [yamlConfig, panelOpen]);

  // --- Panel handlers ---
  const handleEditOpen = useCallback((f: any) => {
    setEditingId(f.id);
    setYamlConfig(f.yaml_config || DEFAULT_GAMESERVER_YAML);
    setErrorMsg('');
    setPanelOpen(true);
  }, []);

  const handleAddOpen = useCallback(() => {
    setEditingId(null);
    // If we have a preserved draft, reopen it; otherwise use the default template
    setYamlConfig(draftYaml ?? DEFAULT_GAMESERVER_YAML);
    setErrorMsg('');
    setPanelOpen(true);
  }, [draftYaml]);

  const handleClose = useCallback(() => {
    if (!editingId) {
      // "Add new" mode: persist draft in state
      setDraftYaml(yamlConfig);
    }
    // "Edit" mode: discard changes (DB state untouched)
    setPanelOpen(false);
    setErrorMsg('');
  }, [editingId, yamlConfig]);

  const handleOverlayClick = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleSave = async () => {
    const validation = validateAgonesYaml(yamlConfig);
    if (!validation.valid) {
      setErrorMsg(validation.errors.join('\n'));
      return;
    }

    const meta = extractMetadata(yamlConfig);
    const payload = {
      ...meta,
      yaml_config: yamlConfig,
    };

    try {
      const method = editingId ? 'PUT' : 'POST';
      const endpoint = editingId ? `/api/v1/formations/${editingId}` : '/api/v1/formations';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPanelOpen(false);
        setDraftYaml(null); // Clear draft on successful save
        setErrorMsg('');
        fetchFormations();
      } else {
        setErrorMsg('Failed to persist formation to Hub database.');
      }
    } catch (e: any) {
      setErrorMsg(`Network error: ${e.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="flex items-center gap-4">
          <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Target Legion:
          </label>
          <select
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--accent-bronze)', border: '1px solid var(--accent-bronze-dark)', padding: '0.5rem 1rem', fontFamily: 'Georgia, serif', fontSize: '1rem', textTransform: 'uppercase', outline: 'none', cursor: 'pointer' }}
            value={activeAgentId || ''}
            onChange={(e) => setActiveAgentId(e.target.value)}
          >
            {Object.values(agents).length === 0 ? (
              <option disabled>No Legions Discovered</option>
            ) : (
              Object.values(agents).map(a => (
                <option key={a.agent_id} value={a.agent_id}>
                  {a.metadata.clusterName || a.agent_id}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          onClick={handleAddOpen}
          style={{ backgroundColor: 'var(--accent-red)', color: 'white', border: 'none', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
        >
          Enroll New Formation
        </button>
      </div>

      {/* Main Content: Cards only */}
      <div className="content-body">
        <div className="section-header">
          <h2>Formations Catalog (SuperAdmin)</h2>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>Deployable tactical server variants fetched from Hub database.</span>
        </div>

        <div className="formations-grid">
          {formations.map(f => (
            <FormationCard
              key={f.id}
              formation={f}
              onEdit={handleEditOpen}
            />
          ))}
        </div>
      </div>

      {/* ===== Slide-in Editor Panel ===== */}
      {/* Overlay backdrop */}
      <div
        className={`editor-overlay ${panelOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`editor-panel ${panelOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="editor-panel-header">
          <h3>{editingId ? 'Edit Tactical Variant' : 'Enroll New Tactical Variant'}</h3>
          <button className="editor-close-btn" onClick={handleClose}>✕</button>
        </div>

        {/* Live validation status bar */}
        <div className={`validation-bar ${liveValidation.valid ? 'valid' : 'invalid'}`}>
          <span className={`validation-dot ${liveValidation.valid ? 'valid' : 'invalid'}`} />
          {liveValidation.valid
            ? 'Valid Agones GameServer manifest'
            : `${liveValidation.errors.length} validation error${liveValidation.errors.length > 1 ? 's' : ''}`
          }
        </div>

        {/* Editor body */}
        <div className="editor-panel-body">
          <div className="editor-wrapper">
            <Editor
              value={yamlConfig}
              onValueChange={setYamlConfig}
              highlight={code => Prism.highlight(code, Prism.languages.yaml, 'yaml')}
              padding={20}
              style={{
                fontFamily: '"Fira Code", "Fira Mono", monospace',
                fontSize: 14,
                color: 'var(--text-bronze)',
                outline: 'none',
                minHeight: '100%',
                lineHeight: '1.6',
              }}
            />
          </div>
        </div>

        {/* Footer with errors + action buttons */}
        <div className="editor-panel-footer" style={{ flexDirection: 'column' }}>
          {errorMsg && (
            <pre className="error-msg" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{errorMsg}</pre>
          )}
          <div className="flex gap-4">
            <button onClick={handleSave} className="deploy-btn" style={{ flex: 1 }}>
              Commit Variant to Registry
            </button>
            <button
              onClick={handleClose}
              className="deploy-btn"
              style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
