// Loaded ONLY in the test process. Any non-loopback network attempt fails closed.
const net = require('node:net');
const dns = require('node:dns');
const allowed = host => host === '127.0.0.1' || host === '::1' || host === 'localhost';
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0];
  const host = typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : 'localhost';
  if (!allowed(host || 'localhost')) throw new Error(`Non-loopback network blocked: ${host}`);
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (host, ...args) {
  if (!allowed(host)) throw new Error(`Non-loopback DNS blocked: ${host}`);
  return lookup.call(this, host, ...args);
};
