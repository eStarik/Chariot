'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalConsoleProps {
  agentUrl: string;
  podName: string;
  namespace: string;
  onClose?: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ agentUrl, podName, namespace, onClose }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize Xterm
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#f8f8f8',
        selectionBackground: '#5da5d5',
        black: '#1e1e1e',
        red: '#e15a60',
        green: '#99cc99',
        yellow: '#f99157',
        blue: '#6699cc',
        magenta: '#cc99cc',
        cyan: '#66cccc',
        white: '#cccccc',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    // Construct WebSocket URL
    // Handle the case where agentUrl might be relative or full
    let baseWsUrl = agentUrl.replace(/^http/, 'ws');
    if (baseWsUrl === '/') {
        // Fallback to current host if relative (default behavior for some proxies)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        baseWsUrl = `${protocol}//${window.location.host}`;
    }
    
    const wsUrl = `${baseWsUrl}/terminal?pod=${podName}&ns=${namespace}`;
    console.log(`[Terminal] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      term.write('\x1b[1;36m[Chariot]\x1b[0m Connected to tactical unit shell.\r\n');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        // Handle binary data (Buffer)
        const reader = new FileReader();
        reader.onload = () => {
          term.write(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.readAsArrayBuffer(event.data);
      }
    };

    ws.onclose = () => {
      setStatus('closed');
      term.write('\r\n\x1b[1;31m[System] Connection closed.\x1b[0m\r\n');
    };

    ws.onerror = (err) => {
      setStatus('error');
      console.error('[Terminal] WebSocket Error:', err);
      term.write('\r\n\x1b[1;31m[Error] Failed to connect to agent console.\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial resize trigger
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      term.dispose();
    };
  }, [agentUrl, podName, namespace]);

  return (
    <div className="flex flex-col h-full bg-[#0c0c0c] rounded-b-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-500 animate-pulse' : 
            status === 'connecting' ? 'bg-amber-500 animate-pulse' : 
            'bg-rose-500'
          }`} />
          <span className="text-xs font-medium text-white/60 tracking-wider uppercase">
            {podName} @ {namespace}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-grow relative">
        <div ref={terminalRef} className="absolute inset-0 p-2" />
      </div>
    </div>
  );
};
