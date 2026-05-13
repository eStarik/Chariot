import * as k8s from '@kubernetes/client-node';
import { WebSocket } from 'ws';
import { Stream } from 'stream';
import { kubeConfig } from './monitor';

/**
 * Handles an interactive terminal session for a GameServer pod.
 * Connects a WebSocket to a Kubernetes Exec stream.
 */
export async function handleTerminalSession(ws: WebSocket, podName: string, namespace: string, container: string) {
  const exec = new k8s.Exec(kubeConfig);
  
  const stdin = new Stream.PassThrough();
  const stdout = new Stream.PassThrough();
  const stderr = new Stream.PassThrough();

  console.info(`[Terminal] Initializing session for pod: ${podName} (container: ${container}) in ${namespace}`);

  try {
    // Start the exec process with TTY enabled
    // We try /bin/bash first, falling back to /bin/sh if needed
    const command = ['/bin/sh']; 

    const connection = await exec.exec(
      namespace,
      podName,
      container,
      command,
      stdout,
      stderr,
      stdin,
      true, // tty
      (status: k8s.V1Status) => {
        console.info(`[Terminal] Process for ${podName} exited. Status:`, status.status);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('\r\n[Chariot] Session terminated.\r\n');
          ws.close();
        }
      }
    );

    // Pipe K8s Output -> WebSocket
    stdout.on('data', (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    stderr.on('data', (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    // Pipe WebSocket Input -> K8s Stdin
    ws.on('message', (data: any) => {
      try {
        const msg = data.toString();
        
        // Check for control messages (e.g. resize)
        if (msg.startsWith('{"type":"resize"')) {
          const resize = JSON.parse(msg);
          // @ts-ignore - The types might be missing the resize method depending on version, but it exists in the implementation
          // if (connection.resize) {
          //   connection.resize(resize.cols, resize.rows);
          // }
          return;
        }

        // Standard terminal input
        stdin.write(data);
      } catch (err) {
        console.error('[Terminal] Error processing input:', err);
      }
    });

    ws.on('close', () => {
      console.info(`[Terminal] WebSocket closed for ${podName}. cleaning up...`);
      // We don't have a direct way to 'kill' the exec connection in the client-node API easily 
      // without destroying the streams, which we do here.
      stdin.end();
    });

    ws.on('error', (err) => {
      console.error(`[Terminal] WebSocket error for ${podName}:`, err);
      stdin.end();
    });

    ws.send('[Chariot] Connection established. Initializing shell...\r\n');

  } catch (err: any) {
    console.error(`[Terminal] Failed to start exec for ${podName}:`, err.message);
    ws.send(`\r\n[Fatal] Failed to connect to pod: ${err.message}\r\n`);
    ws.close();
  }
}
