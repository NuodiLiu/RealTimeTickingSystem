/**
 * SignalR message contract test.
 *
 * Validates that `SignalRClient` produces server-to-device envelopes byte-for-byte
 * equal to the canonical fixtures in `contracts/signalr/`. The iPad app validates
 * the *same* fixtures from the consumer side
 * (KioskApp/KioskAppTests/GatewayCenterTests.swift), so a field renamed on either
 * side breaks that side's contract test.
 */
import fs from 'fs';
import path from 'path';

// Stub the Azure SignalR transport so no real connection is attempted; we only
// care about the message object handed to it.
jest.mock('../../src/signalr/config', () => ({
  signalRConfig: {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToDashboard: jest.fn().mockResolvedValue(undefined),
  },
}));

import { signalRConfig } from '../../src/signalr/config';
import { SignalRClient } from '../../src/signalr/client';

const FIXTURE_DIR = path.join(__dirname, '../../..', 'contracts/signalr/server-to-device');

const KNOWN_SERVER_TO_DEVICE = [
  'SHOW_FEEDBACK',
  'DISMISS',
  'MODE_CHANGED',
  'UNPAIRED',
  'LOCK_ASSIGNED',
  'PING',
];

function loadFixture(name: string): any {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

const sendToUser = signalRConfig.sendToUser as jest.Mock;

describe('SignalR contract — server-to-device fixtures are well-formed', () => {
  const names = ['show-feedback', 'dismiss', 'mode-changed', 'unpaired', 'lock-assigned', 'ping'];

  it.each(names)('%s.json is valid JSON with a known message type', (name) => {
    const fixture = loadFixture(name);
    expect(typeof fixture.type).toBe('string');
    expect(KNOWN_SERVER_TO_DEVICE).toContain(fixture.type);
  });
});

describe('SignalR contract — SignalRClient produces the contract envelopes', () => {
  const DEVICE = 'device-under-test';

  it('SHOW_FEEDBACK', async () => {
    const fixture = loadFixture('show-feedback');
    await new SignalRClient().showFeedback(DEVICE, fixture.payload);
    expect(sendToUser).toHaveBeenCalledWith(DEVICE, fixture);
  });

  it('DISMISS', async () => {
    const fixture = loadFixture('dismiss');
    await new SignalRClient().dismissDevice(DEVICE);
    expect(sendToUser).toHaveBeenCalledWith(DEVICE, fixture);
  });

  it('MODE_CHANGED', async () => {
    const fixture = loadFixture('mode-changed');
    await new SignalRClient().modeChanged(DEVICE, fixture.payload.mode);
    expect(sendToUser).toHaveBeenCalledWith(DEVICE, fixture);
  });

  it('UNPAIRED', async () => {
    const fixture = loadFixture('unpaired');
    await new SignalRClient().unpaired(DEVICE);
    expect(sendToUser).toHaveBeenCalledWith(DEVICE, fixture);
  });

  it('LOCK_ASSIGNED', async () => {
    const fixture = loadFixture('lock-assigned');
    await new SignalRClient().lockAssigned(DEVICE, fixture.payload);
    expect(sendToUser).toHaveBeenCalledWith(DEVICE, fixture);
  });

  // PING has no SignalRClient producer (it originates from the heartbeat layer),
  // so it is only checked structurally above and consumed iPad-side.
});
