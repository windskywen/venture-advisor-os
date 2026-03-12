import { randomInt } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const SAFE_PORT_MIN = 49152;
const SAFE_PORT_MAX = 65535;
const MAX_BIND_ATTEMPTS = 25;

export async function listenOnSafePort(server: Server): Promise<string> {
  for (let attempt = 0; attempt < MAX_BIND_ATTEMPTS; attempt += 1) {
    const port = randomInt(SAFE_PORT_MIN, SAFE_PORT_MAX + 1);

    try {
      return await listenOnce(server, port);
    } catch (error) {
      if (isAddressInUseError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to bind a local test server to a safe high port.');
}

function listenOnce(server: Server, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected server to listen on a numeric localhost port.'));
        return;
      }

      resolve(formatBaseUrl(address));
    };
    const cleanup = () => {
      server.off('error', onError);
      server.off('listening', onListening);
    };

    server.on('error', onError);
    server.on('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

function formatBaseUrl(address: AddressInfo): string {
  return `http://127.0.0.1:${address.port}`;
}

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  );
}
