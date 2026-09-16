import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverPartyAddresses, type NetworkInterfacesProvider } from '../apps/party-server/src/network-address';
const interfaces: NetworkInterfacesProvider = () => ({ en0: [{ address: '192.168.1.20', family: 'IPv4', internal: false } as any], en1: [{ address: '10.0.0.20', family: 'IPv4', internal: false } as any] });
test('advertised phone addresses respect the actual listening interface', () => {
  const addresses = (bound: string) => discoverPartyAddresses(4317, interfaces, undefined, undefined, bound).urls;
  assert.deepEqual(addresses('127.0.0.1'), []);
  assert.deepEqual(addresses('::1'), []);
  assert.deepEqual(addresses('192.168.1.20'), ['http://192.168.1.20:4317']);
  assert.equal(addresses('0.0.0.0').length, 2);
  assert.equal(addresses('::').length, 2);
});
