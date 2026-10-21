'use strict';
// Isolated preparatory domain. No Firebase, DOM, timers or side effects.
function assertPaymentLinks(state, p) {
  if (!p || p.status !== 'active') throw Error('unresolved or reversed payment');
  const money = v=>Number.isSafeInteger(v) && v >= 0;
  if (!Array.isArray(p.lines) || !p.lines.length || !Array.isArray(p.upah_ids) ||
      new Set(p.upah_ids).size !== p.upah_ids.length || p.lines.length !== p.upah_ids.length ||
      new Set(p.lines.map(l=>l.upah_id)).size !== p.lines.length) throw Error('payment line conflict');
  let gross=0, deduction=0, net=0;
  for (const line of p.lines) {
    if (!p.upah_ids.includes(line.upah_id) || !money(line.gross) || !money(line.deduction) ||
        !money(line.net) || line.gross !== line.deduction + line.net || !Array.isArray(line.allocations)) throw Error('payment amount conflict');
    const wage = state.upah.find(u=>u.id === line.upah_id);
    if (!wage || wage.fund !== p.fund || wage.pelapor !== line.pelapor || wage.status !== 'lunas' || wage.payment_id !== p.payment_id) throw Error('wage link conflict');
    let allocated=0;
    for (const a of line.allocations) {
      if (!money(a.jumlah) || a.jumlah === 0) throw Error('allocation amount conflict');
      const k = state.kasbon.find(k=>k.id === a.kasbon_id);
      const traces = k && k.potongan.filter(d=>d.payment_id === p.payment_id && d.upah_id === line.upah_id && d.status === 'active');
      if (!k || k.fund !== p.fund || k.pelapor !== line.pelapor || !money(k.terpotong) || k.terpotong < a.jumlah ||
          traces.length !== 1 || traces[0].jumlah !== a.jumlah) throw Error('advance link conflict');
      allocated += a.jumlah;
    }
    if (!Number.isSafeInteger(allocated) || allocated !== line.deduction) throw Error('allocation total conflict');
    gross+=line.gross; deduction+=line.deduction; net+=line.net;
  }
  if (!money(gross) || !money(deduction) || !money(net) || p.gross !== gross || p.deduction !== deduction || p.net !== net) throw Error('payment total conflict');
  const cash = state.cashbook.filter(c=>c.payment_id === p.payment_id);
  if (cash.length !== 1 || cash[0].fund !== p.fund || cash[0].status !== 'active' ||
      cash[0].keluar !== net || cash[0].keluar_bruto !== gross || cash[0].potong_kasbon !== deduction ||
      cash[0].masuk !== 0 || JSON.stringify(cash[0].upah_ids) !== JSON.stringify(p.upah_ids)) throw Error('cash link conflict');
}
function transition(state, command) {
  if (!command || !['pay','reverse'].includes(command.kind)) throw Error('unknown command');
  for (const key of ['command_id','payment_id','actor','at',...(command.kind === 'pay' ? ['source'] : ['reason'])]) {
    if (typeof command[key] !== 'string' || !command[key].trim()) throw Error('missing '+key);
  }
  if (!['K1-3','K4'].includes(command.fund)) throw Error('unscoped fund');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(command.date) || !Number.isFinite(Date.parse(command.date)) ||
      new Date(command.date).toISOString().slice(0,10) !== command.date) throw Error('invalid date');
  if (command.kind === 'pay' && typeof command.apply_kasbon !== 'boolean') throw Error('deduction choice required');
  if (command.kind === 'pay' && (!Array.isArray(command.upah_ids) || !command.upah_ids.length ||
      command.upah_ids.some(id=>typeof id !== 'string' || !id) ||
      new Set(command.upah_ids).size !== command.upah_ids.length)) throw Error('invalid wage ids');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || state.revision === Number.MAX_SAFE_INTEGER) throw Error('invalid revision');
  for (const collection of ['upah','kasbon','cashbook','payments','events','commands']) {
    if (!Array.isArray(state[collection])) throw Error('missing '+collection);
  }
  if (new Set(state.upah.map(u=>u.id)).size !== state.upah.length) throw Error('duplicate wage identity');
  for (const [collection,key] of [['kasbon','id'],['payments','payment_id'],['cashbook','id'],['commands','command_id']]) {
    if (new Set(state[collection].map(row=>row[key])).size !== state[collection].length) throw Error('duplicate '+collection+' identity');
  }
  const previous = state.commands.find(c => c.command_id === command.command_id);
  if (previous) {
    if (JSON.stringify(previous.command) !== JSON.stringify(command)) throw Error('idempotency conflict');
    return structuredClone(state);
  }
  if (command.kind === 'reverse') {
    const next = structuredClone(state);
    const p = next.payments.find(p=>p.payment_id === command.payment_id);
    if (!p || p.fund !== command.fund) throw Error('unresolved payment');
    if (p.status !== 'active') throw Error('already reversed');
    assertPaymentLinks(next, p);
    for (const line of p.lines) {
      const u = next.upah.find(u=>u.id === line.upah_id);
      if (!u || u.status !== 'lunas' || u.payment_id !== p.payment_id) throw Error('wage link conflict');
      for (const allocation of line.allocations) {
        const k = next.kasbon.find(k=>k.id === allocation.kasbon_id);
        const traces = k && k.potongan.filter(d=>d.payment_id === p.payment_id && d.upah_id === line.upah_id && d.status === 'active');
        if (!k || k.fund !== p.fund || traces.length !== 1 || traces[0].jumlah !== allocation.jumlah || k.terpotong < allocation.jumlah) throw Error('advance link conflict');
        k.terpotong -= allocation.jumlah;
        Object.assign(traces[0], {status:'reversed', reversal_id:command.command_id});
        k.last_modified_at = command.at;
      }
      Object.assign(u, {status:'belum', last_modified_at:command.at});
      delete u.payment_id; delete u.bayar_tgl; delete u.bayar_source;
    }
    const cash = next.cashbook.filter(c=>c.payment_id === p.payment_id);
    if (cash.length !== 1 || cash[0].status !== 'active' || cash[0].keluar !== p.net) throw Error('cash link conflict');
    Object.assign(cash[0], {status:'reversed', reversal_id:command.command_id, last_modified_at:command.at});
    Object.assign(p, {status:'reversed', reversal_id:command.command_id});
    next.events.push({event_id:command.command_id, kind:'payment_reversal', payment_id:p.payment_id,
      actor:command.actor, at:command.at, reason:command.reason});
    next.commands.push({command_id:command.command_id, command:structuredClone(command)});
    next.revision++;
    return next;
  }
  if (state.payments.some(p => p.payment_id === command.payment_id)) throw Error('payment identity already used');
  if (state.cashbook.some(c => c.id === 'cash:'+command.payment_id)) throw Error('cash identity already used; reconcile legacy record');
  const next = structuredClone(state);
  const rows = command.upah_ids.map(id => next.upah.find(u => u.id === id));
  if (rows.some(u=>!u)) throw Error('missing wage');
  if (rows.some(u=>typeof u.pelapor !== 'string' || !u.pelapor)) throw Error('unscoped worker');
  if (rows.some(u => u.status !== 'belum' || u.payment_id)) throw Error('already paid');
  if (rows.some(u=>u.fund !== command.fund)) throw Error('mixed or unscoped fund');
  if (rows.some(u=>!Number.isSafeInteger(u.gross) || u.gross < 0)) throw Error('invalid gross');
  if (!Number.isSafeInteger(rows.reduce((sum,u)=>sum+u.gross,0))) throw Error('gross overflow');
  if (next.cashbook.some(c => c.status !== 'reversed' && command.upah_ids.some(id =>
      (c.upah_ids || (typeof c.ref === 'string' && c.ref.startsWith('upah_') ? c.ref.slice(5).split('·') : [])).includes(id)))) throw Error('unreconciled cash link');
  for (const k of next.kasbon.filter(k=>rows.some(u=>u.pelapor===k.pelapor))) {
    if (!['K1-3','K4'].includes(k.fund)) throw Error('unscoped advance');
    if (!Number.isSafeInteger(k.jumlah) || !Number.isSafeInteger(k.terpotong) || k.jumlah < 0 ||
        k.terpotong < 0 || k.terpotong > k.jumlah || !Array.isArray(k.potongan)) throw Error('invalid advance');
  }
  const lines = rows.map(u => ({upah_id:u.id, pelapor:u.pelapor, gross:u.gross, deduction:0, net:u.gross, allocations:[]}));
  if (command.apply_kasbon) {
    for (const line of lines) {
      const advances = next.kasbon.filter(k => k.pelapor === line.pelapor && k.fund === command.fund && !k.voided && k.tgl <= command.date)
        .sort((a,b) => a.tgl.localeCompare(b.tgl) || a.id.localeCompare(b.id));
      for (const k of advances) {
        const amount = Math.min(k.jumlah - k.terpotong, line.net);
        if (amount <= 0) continue;
        line.allocations.push({kasbon_id:k.id, jumlah:amount});
        line.deduction += amount; line.net -= amount; k.terpotong += amount;
        k.potongan.push({payment_id:command.payment_id, upah_id:line.upah_id, jumlah:amount,
          tgl:command.date, status:'active'});
        k.last_modified_at = command.at;
      }
    }
  }
  const gross = lines.reduce((sum, line) => sum + line.gross, 0);
  const deduction = lines.reduce((sum, line) => sum + line.deduction, 0);
  const payment = {payment_id:command.payment_id, upah_ids:rows.map(u=>u.id), fund:command.fund,
    date:command.date, source:command.source, gross, deduction, net:gross-deduction, lines, status:'active'};
  rows.forEach(u => Object.assign(u, {status:'lunas', payment_id:payment.payment_id, bayar_tgl:command.date,
    bayar_source:command.source, last_modified_at:command.at}));
  next.payments.push(payment);
  next.cashbook.push({id:'cash:'+payment.payment_id, payment_id:payment.payment_id, fund:payment.fund,
    ref:'upah_'+payment.upah_ids.join('·'), upah_ids:payment.upah_ids.slice(), tgl:command.date,
    masuk:0, keluar:payment.net, keluar_bruto:gross, potong_kasbon:deduction, status:'active', last_modified_at:command.at});
  next.events.push({event_id:command.command_id, kind:'payment', payment_id:payment.payment_id, actor:command.actor, at:command.at});
  next.commands.push({command_id:command.command_id, command:structuredClone(command)});
  next.revision++;
  return next;
}
function invoiceProjection(state, paymentId, ids) {
  const p = state.payments.find(p=>p.payment_id === paymentId);
  assertPaymentLinks(state, p);
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length ||
      ids.some(id=>!p.upah_ids.includes(id))) throw Error('invalid invoice subset');
  const lines = structuredClone(p.lines.filter(l=>ids.includes(l.upah_id)));
  return {payment_id:p.payment_id, fund:p.fund, date:p.date, upah_ids:lines.map(l=>l.upah_id), lines,
    gross:lines.reduce((s,l)=>s+l.gross,0), deduction:lines.reduce((s,l)=>s+l.deduction,0),
    net:lines.reduce((s,l)=>s+l.net,0)};
}
async function execute(store, command, expectedRevision) {
  return store.transaction(async tx => {
    const current = await tx.read();
    if (current.commands.some(c=>c.command_id === command.command_id)) return transition(current, command);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw Error('revision required');
    if (current.revision !== expectedRevision) throw Error('revision conflict');
    const next = transition(current, command);
    await tx.write(next);
    return next;
  });
}
module.exports = {transition, invoiceProjection, execute};
