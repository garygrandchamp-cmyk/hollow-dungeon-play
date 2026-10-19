import {createPeerSession, MAX_CODE_LENGTH} from './peer-session.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

// Callbacks start gameplay only after the player explicitly chooses a play button.
// sessionFactory(peerOptions) may inject the application's message/authority hooks.
export function createStartScreen({onLocal = () => {}, onHost = () => {}, onJoin = () => {}, onOptions = () => {},onLab=null, onResume = () => {}, focusAfterHide = null, onLeave = null, sessionFactory = createPeerSession, peerOptions = {}, document: doc = globalThis.document} = {}) {
  if (!doc) throw new Error('Start screen requires a document.');
  const root = doc.createElement('div'); root.className = 'hollow-start'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Hollow main menu');
  const style = doc.createElement('style'); style.textContent = `
  .hollow-start{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at 50% 15%,#293030ed,#080b10fa 70%);color:#eee2c9;font:15px/1.5 Georgia,serif;overflow:auto;box-sizing:border-box}.hollow-start[hidden]{display:none}.hollow-start *{box-sizing:border-box}.hollow-start .hs-card{width:min(760px,100%);max-height:calc(100dvh - 40px);overflow:auto;padding:clamp(22px,4vw,42px);border:1px solid #71634a;background:#141719;box-shadow:0 24px 100px #0009}.hollow-start h1{font-size:clamp(38px,8vw,64px);letter-spacing:.18em;margin:0;color:#ead4a2}.hollow-start h2{font-size:25px;margin:12px 0}.hollow-start h3{margin:0 0 8px}.hollow-start p{color:#c2bdaf}.hollow-start .hs-kicker{color:#bba879;letter-spacing:.2em;font:11px/1.5 system-ui,sans-serif;text-transform:uppercase}.hollow-start button{font:inherit;color:#eee2c9;border:1px solid #6d624e;background:#24292a;padding:10px 16px;cursor:pointer}.hollow-start button:hover{background:#343c3b}.hollow-start button:focus-visible,.hollow-start textarea:focus-visible{outline:3px solid #e3bf72;outline-offset:3px}.hollow-start button:disabled{opacity:.45;cursor:wait}.hollow-start .hs-main{display:grid;gap:10px;margin-top:26px}.hollow-start .hs-primary{background:#6a512d;border-color:#bea16a}.hollow-start .hs-row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.hollow-start textarea{display:block;width:100%;min-height:86px;margin:6px 0 10px;padding:10px;color:#e7e3d8;background:#0c1012;border:1px solid #646456;resize:vertical;font:12px/1.4 monospace;word-break:break-all}.hollow-start label{display:block;margin-top:10px}.hollow-start fieldset{border:1px solid #514d40;margin:20px 0;padding:16px}.hollow-start legend{padding:0 8px;color:#e5cb97}.hollow-start .hs-status{min-height:1.5em;color:#e3c783}.hollow-start small{color:#aaa89e}.hollow-start [hidden]{display:none!important}`;
  style.textContent+=`
  .hollow-start .hs-choice{min-width:0;display:grid;gap:3px}
  .hollow-start .hs-choice button{width:100%;min-height:44px;text-align:left;white-space:normal;overflow-wrap:anywhere}
  .hollow-start .hs-choice small{display:block;font:11px/1.5 "Lucida Console",monospace;color:#b8b2a4}
  .hollow-start .hs-main h3{font:12px/1.5 "Lucida Console",monospace;color:#c7b17f;margin:10px 0 0;letter-spacing:1px}
  .hollow-start .hs-main{margin-top:12px}
  .hollow-start .hs-flow{font:11px/1.6 "Lucida Console",monospace;border-block:1px solid #514d40;padding-block:9px;margin:10px 0 0}
  .hollow-start .hs-status:empty{margin:0;min-height:0}
  .hollow-start .hs-tools{border-top:1px solid #514d40;padding-top:10px;margin-top:6px}
  `;
  root.append(style); const card = doc.createElement('section'); card.className = 'hs-card'; root.append(card);
  // live: the session handed to the running game (Open party setup / Enter party).
  let session = null, live = null, page = 'main', disposed = false, resume = false, previousFocus = null, generation = 0;
  const connected = new Set();
  const node = (tag, text, parent = card) => { const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; parent.append(el); return el; };
  const button = (text, action, parent = card) => { const el = node('button', text, parent); el.type = 'button'; el.addEventListener('click', () => action(el)); return el; };
  let statusNode;
  const setStatus = text => { if (statusNode) statusNode.textContent = String(text); };
  const errorText = error => error?.message || String(error);
  async function busy(el, action) { el.disabled = true; const version = generation; try { await action(() => !disposed && version === generation); } catch (error) { if (version === generation) setStatus(errorText(error)); } finally { if (!disposed && version === generation) el.disabled = false; } }
  // onLeave lets the game drop its network layer first, so a deliberate leave is not reported as a lost connection.
  function closeSession() { generation++; if (session && session === live && typeof onLeave === 'function') { try { onLeave(); } catch { /* Leaving still closes the session. */ } } session?.close(); session = null; live = null; connected.clear(); }
  // Leaving a running online party disconnects everyone, so ask first.
  function leaveOnline(next) {
    if (!live || live !== session) return next();
    heading('Leave the online party?', 'You are in an online party. Continuing ends this online session and disconnects every player.');
    button('Disconnect and continue', () => { closeSession(); return next(); }).className = 'hs-primary';
    // Back is the safe default: a double Enter or Escape must not disconnect the party.
    const back = button('Back', () => main(true)); card.scrollTop = 0; back.focus?.({preventScroll: true});
  }
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
    if (keepSession !== true) closeSession(); heading('The party awaits', 'Choose your role: explore as an adventurer or command the dungeon as its master.');
    const guide=node('details');guide.className='hs-flow';guide.id='hs-first-run';
    node('summary','First run: prepare → explore → escape',guide);
    node('p','Setup: choose loadouts. The DM builds within budget and validates the dungeon before Start expedition.',guide);
    node('p','Live: collect six relics across two floors, then escape. Walking is free; actions cost stamina. At zero stamina, you are exhausted: searching stops and the next damaging hit kills. You can still move and fight.',guide);
    node('p','Next run: survivors keep found loot. Death loses carried equipment; class starters remain. Exhausted survivors can still escape with their loot.',guide);
    const menu = node('div'); menu.className = 'hs-main';
    const choice=(id,label,description,action,parent=menu)=>{
      const row=node('div',undefined,parent);row.className='hs-choice';
      const actionButton=button(label,action,row),help=node('small',description,row);help.id='hs-mode-'+id;
      actionButton.setAttribute('aria-describedby',help.id);return actionButton;
    };
    if (resume) button('Resume game', () => invoke(onResume), menu).className = 'hs-primary';
    node('h3','Play on this device',menu);
    choice('adventurer','Solo adventurer','You explore. An AI dungeon master opposes you; two AI companions follow.',() => leaveOnline(() => { closeSession(); return invoke(onLocal,{mode:'adventurer'}); })).className='hs-primary';
    choice('dm','Solo dungeon master','You build and direct encounters against three bot adventurers.',() => leaveOnline(() => { closeSession(); return invoke(onLocal,{mode:'dm'}); }));
    choice('local','Local party · shared screen','Human-controlled DM and three adventurers share this device. Switch roles manually; no bots.',() => leaveOnline(() => { closeSession(); return invoke(onLocal); }));
    node('h3','Play online',menu);
    choice('host','Host online · dungeon master','Invite up to three remote adventurers by manually exchanging connection codes.',() => leaveOnline(host));
    choice('join','Join online · adventurer','Use an invite code from your dungeon master. No public matchmaking.',() => leaveOnline(join));
    button('Options', () => invoke(onOptions), menu);
    if(typeof onLab==='function'){
      const tools=node('div',undefined,menu);tools.className='hs-tools';
      choice('lab','Dungeon Lab · advanced editor','Generate, inspect and edit dungeon geometry. Separate from starting a game.',()=>invoke(onLab),tools);
    }
    focusFirst();
  }
  function invoke(callback, data = {}, onDone) { return Promise.resolve().then(() => callback({...data, screen: api})).then(result => { onDone?.(); return result; }, error => setStatus(errorText(error))); }
  function host() {
    heading('Host a party', 'You are the dungeon master. Create one invite per remote adventurer, then paste each answer into its matching slot. After connecting, prepare the dungeon before starting the expedition.');
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
    const play = button('Open party setup', () => { const handed = session; return invoke(onHost, {session: handed}, () => { if (session === handed) live = handed; }); }); play.dataset.hostPlay = ''; play.className = 'hs-primary';
    button('Back', main); networkNote(); updateConnections(); focusFirst();
  }
  function join() {
    heading('Join a party', 'You are an adventurer. Paste your dungeon master’s invite, create an answer, and send it back. Once connected, enter the party to choose your loadout and wait for the expedition.');
    try { newSession(); } catch (error) { setStatus(errorText(error)); }
    const offer = codeBox('Paste host invite', card), answer = codeBox('Your answer code', card, true);
    const actions = node('div'); actions.className = 'hs-row';
    button('Create answer', el => busy(el, async current => { if (!session) throw new Error('WebRTC is unavailable.'); const code = await session.joinInvite(offer.value); if (current()) answer.value = code; }), actions);
    copyButton(answer, actions);
    const play = button('Enter party', () => { const handed = session; return invoke(onJoin, {session: handed}, () => { if (session === handed) live = handed; }); }); play.dataset.guestPlay = ''; play.className = 'hs-primary';
    button('Try another invite', join); button('Back', main); networkNote(); updateConnections(); focusFirst();
  }
  function focusFirst() { if (root.hidden) return; card.scrollTop = 0; card.querySelector('button,textarea')?.focus({preventScroll: true}); }
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (page === 'Leave the online party?') main(true); else if (page !== 'The party awaits') main(); return; }
    if (event.key !== 'Tab') return;
    const items = [...card.querySelectorAll('button:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(el => !el.hidden);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const api = {
    element: root,
    get session() { return session; },
    get visible() { return !root.hidden; },
    show({canResume = resume} = {}) { if (disposed) return; previousFocus = doc.activeElement; resume = canResume; root.hidden = false; if (canResume || page === 'main' || page === 'The party awaits') main(true); else focusFirst(); },
    // Gameplay resumes on the canvas; returning focus to the menu button would let Space reopen the menu.
    hide() { root.hidden = true; if (typeof focusAfterHide === 'function') focusAfterHide(); else previousFocus?.focus?.({preventScroll: true}); },
    setStatus,
    // Leaving a lobby closes its connections. Hiding it for gameplay preserves them.
    reset() { main(); },
    destroy({close = true} = {}) { if (disposed) return; disposed = true; if (close) closeSession(); root.remove(); }
  };
  root.hidden = true; doc.body.append(root); main(); return api;
}
