// Manual, non-trickle WebRTC signaling. Game authority belongs to the caller.
export const PEER_VERSION = 1;
export const MAX_MESSAGE_BYTES = 32768;
export const MAX_CODE_LENGTH = 180000;
const CHANNEL = 'hollow-party-v1';
const encoder = new TextEncoder();
const bytes = value => encoder.encode(value).length;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function safeJSON(value, depth = 0, budget = {n: 0}) {
  if (++budget.n > 8192 || depth > 24) throw new Error('Message structure is too complex.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') throw new Error('Messages must contain JSON values only.');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('Invalid message object.');
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe message key.');
    safeJSON(value[key], depth + 1, budget);
  }
}
function validateMessage(message) {
  if (!record(message) || typeof message.type !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,63}$/.test(message.type) || !Object.hasOwn(message, 'payload') || Object.keys(message).some(k => !['type', 'payload'].includes(k))) throw new Error('Expected {type, payload}.');
  safeJSON(message);
  return message;
}
function encodeCode(value) {
  const data = encoder.encode(JSON.stringify(value));
  let binary = ''; for (const byte of data) binary += String.fromCharCode(byte);
  return 'HOLLOW1.' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeCode(code, kind) {
  if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) throw new Error('Connection code is too large.');
  code = code.trim();
  if (!/^HOLLOW1\.[A-Za-z0-9_-]+$/.test(code)) throw new Error('Paste a complete HOLLOW connection code.');
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(code.slice(8).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); }
  catch { throw new Error('Invalid connection code.'); }
  if (!record(data) || data.v !== PEER_VERSION || data.kind !== kind || !Number.isInteger(data.slot) || data.slot < 1 || data.slot > 3 || typeof data.session !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(data.session) || typeof data.sdp !== 'string' || !data.sdp.startsWith('v=0') || bytes(data.sdp) > 120000 || Object.keys(data).some(k => !['v','kind','slot','session','sdp'].includes(k))) throw new Error('Unsupported or malformed connection code.');
  return data;
}

export function createPeerSession({onPeer = () => {}, onMessage = () => {}, onStatus = () => {}, iceServers = [], RTCPeerConnection: Peer = globalThis.RTCPeerConnection, iceTimeout = 15000} = {}) {
  const peers = new Map(); let role = 'idle', closed = false;
  const status = (state, slot, message = '') => onStatus({state, slot, message});
  const alive = () => { if (closed) throw new Error('Session is closed.'); if (!Peer) throw new Error('WebRTC is unavailable in this browser.'); };
  function remove(entry) {
    if (peers.get(entry.slot) !== entry) return;
    peers.delete(entry.slot); entry.cancel?.();
    if (entry.channel) { entry.channel.onopen = entry.channel.onclose = entry.channel.onerror = entry.channel.onmessage = null; entry.channel.close(); }
    entry.pc.ondatachannel = entry.pc.onconnectionstatechange = null; entry.pc.close();
    onPeer({slot: entry.slot, connected: false, state: 'closed', role});
  }
  function attach(entry, channel) {
    if (entry.channel || channel.label !== CHANNEL) { channel.close(); return; }
    entry.channel = channel; channel.binaryType = 'arraybuffer';
    channel.onopen = () => { if (closed) return; onPeer({slot: entry.slot, connected: true, state: 'connected', role}); status('connected', entry.slot); };
    channel.onclose = () => { status('disconnected', entry.slot); remove(entry); };
    channel.onerror = () => status('error', entry.slot, 'Data channel error.');
    channel.onmessage = event => {
      try {
        if (typeof event.data !== 'string' || bytes(event.data) > MAX_MESSAGE_BYTES) throw new Error('Message is too large or is not text.');
        const envelope = JSON.parse(event.data);
        if (!record(envelope) || envelope.v !== PEER_VERSION || Object.keys(envelope).some(k => !['v','message'].includes(k))) throw new Error('Unsupported message version.');
        validateMessage(envelope.message);
        onMessage(envelope.message, entry.slot);
      } catch (error) { status('invalid-message', entry.slot, error.message); }
    };
  }
  function make(slot, session) {
    const pc = new Peer({iceServers});
    const entry = {slot, session, pc, channel: null, cancel: null}; peers.set(slot, entry);
    pc.ondatachannel = event => attach(entry, event.channel);
    pc.onconnectionstatechange = () => {
      status(pc.connectionState, slot);
      if (['failed', 'closed'].includes(pc.connectionState)) remove(entry);
      else if (pc.connectionState === 'disconnected') onPeer({slot, connected: false, state: 'disconnected', role});
      else if (pc.connectionState === 'connected' && entry.channel?.readyState === 'open') onPeer({slot, connected: true, state: 'connected', role});
    };
    return entry;
  }
  function gather(entry) {
    if (entry.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = error => { clearTimeout(timer); entry.pc.removeEventListener('icegatheringstatechange', changed); entry.cancel = null; error ? reject(error) : resolve(); };
      const changed = () => { if (entry.pc.iceGatheringState === 'complete') done(); };
      const timer = setTimeout(() => done(new Error('ICE gathering timed out. Retry or change network settings.')), iceTimeout);
      entry.cancel = () => done(new Error('Connection was closed.'));
      entry.pc.addEventListener('icegatheringstatechange', changed); changed();
    });
  }
  async function localCode(entry, kind) {
    await entry.pc.setLocalDescription(kind === 'offer' ? await entry.pc.createOffer() : await entry.pc.createAnswer());
    if (closed || peers.get(entry.slot) !== entry) throw new Error('Connection was closed.');
    await gather(entry);
    if (closed || peers.get(entry.slot) !== entry) throw new Error('Connection was closed.');
    const code = encodeCode({v: PEER_VERSION, kind, slot: entry.slot, session: entry.session, sdp: entry.pc.localDescription.sdp});
    if (code.length > MAX_CODE_LENGTH) throw new Error('Connection code exceeds the size limit.');
    status(kind === 'offer' ? 'invite-ready' : 'answer-ready', entry.slot); return code;
  }
  return {
    get role() { return role; },
    get connected() { return [...peers.values()].filter(e => e.channel?.readyState === 'open' && !['disconnected','failed','closed'].includes(e.pc.connectionState)).map(e => e.slot); },
    async createInvite(slot) {
      alive(); if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new Error('Choose peer slot 1, 2, or 3.');
      if (role === 'guest') throw new Error('A guest cannot host peers.');
      if (peers.has(slot)) throw new Error('Slot is already occupied. Disconnect it before creating another invite.');
      role = 'host'; const entry = make(slot, globalThis.crypto.randomUUID());
      try { attach(entry, entry.pc.createDataChannel(CHANNEL, {ordered: true})); return await localCode(entry, 'offer'); }
      catch (error) { remove(entry); throw error; }
    },
    async joinInvite(code) {
      alive(); if (role === 'host' || peers.size) throw new Error('Close the current session before joining another host.');
      const data = decodeCode(code, 'offer'); role = 'guest'; const entry = make(data.slot, data.session);
      try { await entry.pc.setRemoteDescription({type: 'offer', sdp: data.sdp}); return await localCode(entry, 'answer'); }
      catch (error) { remove(entry); throw error; }
    },
    async acceptAnswer(slot, code) {
      alive(); const entry = peers.get(slot), data = decodeCode(code, 'answer');
      if (role !== 'host' || !entry || entry.pc.signalingState !== 'have-local-offer' || data.slot !== slot || data.session !== entry.session) throw new Error('Answer does not match this pending invite.');
      await entry.pc.setRemoteDescription({type: 'answer', sdp: data.sdp}); status('connecting', slot);
    },
    send(slot, message) {
      if (role === 'guest' && message === undefined) { message = slot; slot = [...peers.keys()][0]; }
      validateMessage(message); const text = JSON.stringify({v: PEER_VERSION, message});
      if (bytes(text) > MAX_MESSAGE_BYTES) throw new Error('Message exceeds 32 KiB. Split large snapshots into chunks.');
      const channel = peers.get(slot)?.channel;
      if (closed || !channel || channel.readyState !== 'open' || channel.bufferedAmount > MAX_MESSAGE_BYTES * 8) return false;
      try { channel.send(text); return true; } catch { return false; }
    },
    broadcast(message) { validateMessage(message); let count = 0; for (const slot of peers.keys()) if (this.send(slot, message)) count++; return count; },
    disconnect(slot) { const entry = peers.get(slot); if (entry) remove(entry); },
    close() { if (closed) return; closed = true; for (const entry of [...peers.values()]) remove(entry); role = 'closed'; status('closed', null); }
  };
}
