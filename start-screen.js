import {createPeerSession, MAX_CODE_LENGTH} from './peer-session.js?v=80eddf4efeb73b0f3ae528a5ccc41ada14f30f7a';

// Callbacks start gameplay only after the player explicitly chooses a play button.
// sessionFactory(peerOptions) may inject the application's message/authority hooks.
export function createStartScreen({onLocal = () => {}, onHost = () => {}, onJoin = () => {}, onOptions = () => {},onLab=null, onResume = () => {}, sessionFactory = createPeerSession, peerOptions = {}, document: doc = globalThis.document} = {}) {
  if (!doc) throw new Error('Start screen requires a document.');
  const root = doc.createElement('div'); root.className = 'hollow-start'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Hollow main menu');
  const style = doc.createElement('style'); style.textContent = `
  .hollow-start{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at 50% 15%,#293030ed,#080b10fa 70%);color:#eee2c9;font:15px/1.5 Georgia,serif;overflow:auto;box-sizing:border-box}.hollow-start[hidden]{display:none}.hollow-start *{box-sizing:border-box}.hollow-start .hs-card{width:min(760px,100%);max-height:calc(100dvh - 40px);overflow:auto;padding:clamp(22px,4vw,42px);border:1px solid #71634a;background:#141719;box-shadow:0 24px 100px #0009}.hollow-start h1{font-size:clamp(38px,8vw,64px);letter-spacing:.18em;margin:0;color:#ead4a2}.hollow-start h2{font-size:25px;margin:12px 0}.hollow-start h3{margin:0 0 8px}.hollow-start p{color:#c2bdaf}.hollow-start .hs-kicker{color:#bba879;letter-spacing:.2em;font:11px/1.5 system-ui,sans-serif;text-transform:uppercase}.hollow-start button{font:inherit;color:#eee2c9;border:1px solid #6d624e;background:#24292a;padding:10px 16px;cursor:pointer}.hollow-start button:hover{background:#343c3b}.hollow-start button:focus-visible,.hollow-start textarea:focus-visible{outline:3px solid #e3bf72;outline-offset:3px}.hollow-start button:disabled{opacity:.45;cursor:wait}.hollow-start .hs-main{display:grid;gap:10px;margin-top:26px}.hollow-start .hs-primary{background:#6a512d;border-color:#bea16a}.hollow-start .hs-row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.hollow-start textarea{display:block;width:100%;min-height:86px;margin:6px 0 10px;padding:10px;color:#e7e3d8;background:#0c1012;border:1px solid #646456;resize:vertical;font:12px/1.4 monospace;word-break:break-all}.hollow-start label{display:block;margin-top:10px}.hollow-start fieldset{border:1px solid #514d40;margin:20px 0;padding:16px}.hollow-start legend{padding:0 8px;color:#e5cb97}.hollow-start .hs-status{min-height:1.5em;color:#e3c783}.hollow-start small{color:#aaa89e}.hollow-start [hidden]{display:none!important}`;
  root.append(style); const card = doc.createElement('section'); card.className = 'hs-card'; root.append(card);
  let session = null, page = 'main', disposed = false, resume = false, previousFocus = null, generation = 0;
  const connected = new Set();
  const node = (tag, text, parent = card) => { const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; parent.append(el); return el; };
  const button = (text, action, parent = card) => { const el = node('button', text, parent); el.type = 'button'; el.addEventListener('click', () => action(el)); return el; };
  let statusNode;
  const setStatus = text => { if (statusNode) statusNode.textContent = String(text); };
  const errorText = error => error?.message || String(error);
  async function busy(el, action) { el.disabled = true; const version = generation; try { await action(() => !disposed && version === generation); } catch (error) { if (version === generation) setStatus(errorText(error)); } finally { if (!disposed && version === generation) el.disabled = false; } }
  function closeSession() { generation++; session?.close(); session = null; connected.clear(); }
  function newSession() {
    closeSession();
    session = sessionFactory({...peerOptions,
      onStatus: event => { peerOptions.onStatus?.(event); setStatus(event.message || `Peer ${event.slot ?? ''}: ${event.state}`); },
      onPeer: event => { peerOptions.onPeer?.(event); event.connected ? connected.add(event.slot) : connected.delete(event.slot); updateConnections(); }
    }); return session;
  }
  function updateConnections() {
    for (const el of card.querySelectorAll('[data-peer-state]')) el.textContent = connected.has(Number(el.dataset.peerState)) ? 'Connected' : 'Waiting for connection';
    const guestPlay = card.querySelector('[data-guest-play]'); if (guestPlay) guestPlay.disabled = !connected.size;
    const hostPlay = card.querySelector('[data-host-play]'); if (hostPlay) hostPlay.disabled = !connected.size;
  }
  function heading(title, description) {
    generation++; page = title; card.replaceChildren(); node('div', 'A descent into the forgotten', card).className = 'hs-kicker';
    node('h1', 'HOLLOW'); node('h2', title); node('p', description);
    statusNode = node('p', ''); statusNode.className = 'hs-status'; statusNode.setAttribute('role', 'status'); statusNode.setAttribute('aria-live', 'polite');
  }
  function codeBox(label, parent, readonly = false) {
    const wrap = node('label', label, parent), area = node('textarea', undefined, wrap); area.readOnly = readonly; area.maxLength = MAX_CODE_LENGTH; area.spellcheck = false; area.autocomplete = 'off'; area.setAttribute('aria-label', label); return area;
  }
  function copyButton(area, parent) {
    button('Copy code', el => busy(el, async current => {
      if (!area.value) throw new Error('Create a code first.');
      if (globalThis.navigator?.clipboard?.writeText) { await globalThis.navigator.clipboard.writeText(area.value); if (current()) setStatus('Code copied. Share it privately with your player.'); }
      else { area.focus(); area.select(); setStatus('Code selected. Use your keyboard copy command.'); }
    }), parent);
  }
  function networkNote() { node('small', 'Manual connection: exchange codes privately. Codes include network addresses. STUN can help discover a route; some networks require a TURN relay and will not connect with this setup.'); }
  function main(keepSession = false) {
    if (keepSession !== true) closeSession(); heading('The party awaits', 'Play locally, host a dungeon for up to three remote adventurers, or join a host.');
    const menu = node('div'); menu.className = 'hs-main';
    if (resume) button('Resume game', () => invoke(onResume), menu).className = 'hs-primary';
    button('Play locally', () => { closeSession(); return invoke(onLocal); }, menu).className = 'hs-primary';
    button('Solo adventurer · AI DM + companions', () => { closeSession(); return invoke(onLocal,{mode:'adventurer'}); }, menu);
    button('Solo DM · three bot adventurers', () => { closeSession(); return invoke(onLocal,{mode:'dm'}); }, menu);
    if(typeof onLab==='function')button('Dungeon Lab · build & edit',()=>invoke(onLab),menu);
    button('Host a party', host, menu); button('Join a party', join, menu); button('Options', () => invoke(onOptions), menu);
    focusFirst();
  }
  function invoke(callback, data = {}) { return Promise.resolve().then(() => callback({...data, screen: api})).catch(error => setStatus(errorText(error))); }
  function host() {
    heading('Host a party', 'Create one invite per adventurer. Give each player their invite, then paste their answer into the matching slot.');
    try { newSession(); } catch (error) { setStatus(errorText(error)); }
    for (let slot = 1; slot <= 3; slot++) {
      const group = node('fieldset'); node('legend', `Adventurer ${slot}`, group);
      const state = node('span', 'Waiting for connection', group); state.dataset.peerState = String(slot);
      const offer = codeBox(`Invite code · adventurer ${slot}`, group, true);
      const actions = node('div', undefined, group); actions.className = 'hs-row';
      button('Create invite', el => busy(el, async current => { if (!session) throw new Error('WebRTC is unavailable.'); const code = await session.createInvite(slot); if (current()) offer.value = code; }), actions);
      copyButton(offer, actions);
      const answer = codeBox(`Paste answer · adventurer ${slot}`, group);
      button('Accept answer', el => busy(el, async current => { if (!session) throw new Error('Create an invite first.'); await session.acceptAnswer(slot, answer.value); if (current()) setStatus(`Connecting adventurer ${slot}…`); }), group);
      button('Reset slot', () => { session?.disconnect(slot); offer.value = ''; answer.value = ''; connected.delete(slot); updateConnections(); setStatus(`Slot ${slot} cleared. Create a new invite.`); }, group);
    }
    const play = button('Start hosted game', () => invoke(onHost, {session})); play.dataset.hostPlay = ''; play.className = 'hs-primary';
    button('Back', main); networkNote(); updateConnections(); focusFirst();
  }
  function join() {
    heading('Join a party', 'Paste your host’s invite, create an answer, and send that answer back to the host. Wait for the connection before continuing.');
    try { newSession(); } catch (error) { setStatus(errorText(error)); }
    const offer = codeBox('Paste host invite', card), answer = codeBox('Your answer code', card, true);
    const actions = node('div'); actions.className = 'hs-row';
    button('Create answer', el => busy(el, async current => { if (!session) throw new Error('WebRTC is unavailable.'); const code = await session.joinInvite(offer.value); if (current()) answer.value = code; }), actions);
    copyButton(answer, actions);
    const play = button('Enter party', () => invoke(onJoin, {session})); play.dataset.guestPlay = ''; play.className = 'hs-primary';
    button('Try another invite', join); button('Back', main); networkNote(); updateConnections(); focusFirst();
  }
  function focusFirst() { if (!root.hidden) card.querySelector('button,textarea')?.focus(); }
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (page !== 'The party awaits') main(); return; }
    if (event.key !== 'Tab') return;
    const items = [...card.querySelectorAll('button:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => !el.hidden);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const api = {
    element: root,
    get session() { return session; },
    get visible() { return !root.hidden; },
    show({canResume = resume} = {}) { if (disposed) return; previousFocus = doc.activeElement; resume = canResume; root.hidden = false; if (canResume || page === 'main' || page === 'The party awaits') main(true); else focusFirst(); },
    hide() { root.hidden = true; previousFocus?.focus?.(); },
    setStatus,
    // Leaving a lobby closes its connections. Hiding it for gameplay preserves them.
    reset() { main(); },
    destroy({close = true} = {}) { if (disposed) return; disposed = true; if (close) closeSession(); root.remove(); }
  };
  root.hidden = true; doc.body.append(root); main(); return api;
}
