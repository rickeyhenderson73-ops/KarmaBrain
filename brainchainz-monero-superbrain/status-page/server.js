const http = require('http');
const fs = require('fs');
const path = require('path');

const MONEROD_HOST = process.env.MONEROD_HOST || 'monerod';
const MONEROD_RPC_PORT = parseInt(process.env.MONEROD_RPC_PORT || '18081');
const XMRIG_PROXY_HOST = process.env.XMRIG_PROXY_HOST || 'xmrig-proxy';
const XMRIG_PROXY_API_PORT = parseInt(process.env.XMRIG_PROXY_API_PORT || '8080');
const XMRIG_PROXY_TOKEN = process.env.XMRIG_PROXY_API_TOKEN || 'superbrain';
const P2POOL_CHAIN = process.env.P2POOL_CHAIN || '--mini';
const PORT = parseInt(process.env.DASHBOARD_PORT || '3000');

let cachedStatus = {
  node_height: 0,
  network_height: 0,
  node_synced: false,
  sync_pct: 0,
  eta: 'Calculating...',
  peers: 0,
  p2pool_running: false,
  p2pool_chain: P2POOL_CHAIN === '--mini' ? 'Mini' : 'Main',
  xmrig_hashrate: null,
};

// Track sync speed for ETA
let lastHeight = 0;
let lastHeightTime = Date.now();

function rpcCall(host, port, method, params, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: '0', method, params: params || {} });
    const options = {
      hostname: host,
      port,
      path: '/json_rpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      timeout: 5000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function httpGet(host, port, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host, port, path,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      timeout: 4000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function pollMonerod() {
  try {
    const res = await rpcCall(MONEROD_HOST, MONEROD_RPC_PORT, 'get_info', {});
    if (!res.result) return;
    const info = res.result;

    const nodeHeight = info.height || 0;
    const networkHeight = info.target_height > nodeHeight ? info.target_height : (info.height || 0);
    const synced = info.synchronized === true || info.target_height === 0;
    const pct = networkHeight > 0 ? Math.min((nodeHeight / networkHeight) * 100, 100) : 0;

    // ETA calculation
    let eta = 'Calculating...';
    const now = Date.now();
    if (lastHeight > 0 && nodeHeight > lastHeight) {
      const blocksPerMs = (nodeHeight - lastHeight) / (now - lastHeightTime);
      const blocksLeft = networkHeight - nodeHeight;
      if (blocksPerMs > 0 && blocksLeft > 0) {
        const msLeft = blocksLeft / blocksPerMs;
        const hours = Math.floor(msLeft / 3600000);
        const mins = Math.floor((msLeft % 3600000) / 60000);
        if (hours > 24) {
          eta = `~${Math.floor(hours/24)}d ${hours%24}h remaining`;
        } else if (hours > 0) {
          eta = `~${hours}h ${mins}m remaining`;
        } else {
          eta = `~${mins}m remaining`;
        }
      }
    }
    lastHeight = nodeHeight;
    lastHeightTime = now;

    cachedStatus = {
      ...cachedStatus,
      node_height: nodeHeight,
      network_height: networkHeight,
      node_synced: synced,
      sync_pct: pct,
      eta: synced ? 'Fully synced' : eta,
      peers: (info.incoming_connections_count || 0) + (info.outgoing_connections_count || 0),
    };
  } catch(e) {
    // monerod not ready yet — keep last values
  }
}

async function pollXmrigProxy() {
  try {
    const res = await httpGet(XMRIG_PROXY_HOST, XMRIG_PROXY_API_PORT, '/2/summary', XMRIG_PROXY_TOKEN);
    if (res && res.hashrate && res.hashrate.total) {
      const hr = res.hashrate.total[0] || 0;
      if (hr > 0) {
        cachedStatus.xmrig_hashrate = hr > 1000
          ? (hr / 1000).toFixed(2) + ' KH/s'
          : hr.toFixed(1) + ' H/s';
      } else {
        cachedStatus.xmrig_hashrate = null;
      }
      cachedStatus.p2pool_running = true;
    }
  } catch(e) {
    cachedStatus.xmrig_hashrate = null;
  }
}

// Poll every 10 seconds
async function poll() {
  await Promise.allSettled([pollMonerod(), pollXmrigProxy()]);
}
poll();
setInterval(poll, 10000);

// HTTP server
const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const server = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cachedStatus));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  console.log(`Monero Superbrain dashboard running on port ${PORT}`);
  console.log(`Polling monerod at ${MONEROD_HOST}:${MONEROD_RPC_PORT}`);
});
