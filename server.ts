/**
 * Agent Runtime Interface Service Gateway
 * Bot creation API, Telegram-style Bot Tokens, real-time message routing,
 * and Persistent 3D Avatar Model Storage (.VRM database).
 * Zero manual secrets or env variables required.
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Persistent Directories
const DATA_DIR = path.join(__dirname, '.data');
const MODELS_DIR = path.join(DATA_DIR, 'models');
const BOTS_FILE = path.join(DATA_DIR, 'bots.json');
const MODELS_META_FILE = path.join(MODELS_DIR, 'metadata.json');

// Ensure data & model directories exist
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('[Gateway] Erro ao criar diretório .data:', err);
  }
}

if (!fs.existsSync(MODELS_DIR)) {
  try {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  } catch (err) {
    console.error('[Gateway] Erro ao criar diretório .data/models:', err);
  }
}

// Bot Data Structure
export interface BotRecord {
  id: string;
  name: string;
  username: string;
  role: string;
  token: string;
  created_at: string;
}

export interface ModelMetadata {
  id: string;
  name: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

function generateBotToken(botId: string): string {
  // Telegram-style token: <bot_id>:<alphanumeric_secret>
  const secret = crypto.randomBytes(24).toString('base64url');
  return `${botId}:${secret}`;
}

function loadBots(): BotRecord[] {
  if (fs.existsSync(BOTS_FILE)) {
    try {
      const content = fs.readFileSync(BOTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('[Bots Manager] Erro ao ler bots.json, reinicializando...', err);
    }
  }

  // Initial default Bot ready to use out-of-the-box
  const defaultBotId = 'bot_01';
  const defaultBot: BotRecord = {
    id: defaultBotId,
    name: 'Assistente Python',
    username: 'assistente_bot',
    role: 'Agente Conectado via chat.py',
    token: generateBotToken(defaultBotId),
    created_at: new Date().toISOString(),
  };

  saveBots([defaultBot]);
  return [defaultBot];
}

function saveBots(bots: BotRecord[]): void {
  try {
    fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch (err) {
    console.error('[Bots Manager] Falha ao salvar bots.json:', err);
  }
}

let activeBots = loadBots();

// Model Metadata Helpers
function loadModelMetadata(): ModelMetadata[] {
  if (fs.existsSync(MODELS_META_FILE)) {
    try {
      const content = fs.readFileSync(MODELS_META_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      console.warn('[Models Manager] Erro ao ler metadata.json:', err);
    }
  }
  return [];
}

function saveModelMetadata(meta: ModelMetadata[]): void {
  try {
    fs.writeFileSync(MODELS_META_FILE, JSON.stringify(meta, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch (err) {
    console.error('[Models Manager] Falha ao salvar metadata.json:', err);
  }
}

let activeModels = loadModelMetadata();

// Setup Express with 100mb payload limit for VRM 3D files
const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Sockets Registry
interface SocketClient {
  ws: WebSocket;
  type: 'runtime' | 'ui';
  id: string;
  botId?: string;
  authenticated: boolean;
  connectedAt: number;
}

const activeSockets = new Map<WebSocket, SocketClient>();

function isBotOnline(botId: string): boolean {
  for (const client of activeSockets.values()) {
    if (client.type === 'runtime' && client.botId === botId && client.ws.readyState === WebSocket.OPEN) {
      return true;
    }
  }
  return false;
}

function getOnlineRuntimeCount(): number {
  return Array.from(activeSockets.values()).filter((c) => c.type === 'runtime').length;
}

function getBotsResponse() {
  return activeBots.map((bot) => ({
    ...bot,
    is_online: isBotOnline(bot.id),
  }));
}

function broadcastToUI(payload: object) {
  const raw = JSON.stringify(payload);
  for (const [ws, client] of activeSockets.entries()) {
    if (client.type === 'ui' && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function broadcastRuntimeStatus() {
  const isRuntimeConnected = getOnlineRuntimeCount() > 0;
  broadcastToUI({
    type: 'runtime.status',
    connected: isRuntimeConnected,
    gateway_status: 'ready',
    timestamp: Date.now(),
  });
}

// REST Endpoints for Bot Creation & Management
app.get('/api/bots', (req, res) => {
  res.json(getBotsResponse());
});

app.post('/api/bots', (req, res) => {
  const { name, role, username } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'O nome do bot é obrigatório.' });
    return;
  }

  const cleanName = name.trim();
  const botId = `bot_${Date.now().toString().slice(-6)}`;
  const cleanUsername = (username && typeof username === 'string' && username.trim())
    ? username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    : cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_bot';

  const newBot: BotRecord = {
    id: botId,
    name: cleanName,
    username: cleanUsername,
    role: (role && typeof role === 'string') ? role.trim() : 'Agente Python',
    token: generateBotToken(botId),
    created_at: new Date().toISOString(),
  };

  activeBots.push(newBot);
  saveBots(activeBots);

  // Notify connected UI clients
  broadcastToUI({
    type: 'bot.list',
    bots: getBotsResponse(),
  });

  res.status(201).json({
    ...newBot,
    is_online: false,
  });
});

app.delete('/api/bots/:id', (req, res) => {
  const { id } = req.params;
  activeBots = activeBots.filter((b) => b.id !== id);
  saveBots(activeBots);

  broadcastToUI({
    type: 'bot.list',
    bots: getBotsResponse(),
  });

  res.json({ success: true, deleted_id: id });
});

app.post('/api/bots/:id/regenerate-token', (req, res) => {
  const { id } = req.params;
  const bot = activeBots.find((b) => b.id === id);
  if (!bot) {
    res.status(404).json({ error: 'Bot não encontrado.' });
    return;
  }

  bot.token = generateBotToken(bot.id);
  saveBots(activeBots);

  broadcastToUI({
    type: 'bot.list',
    bots: getBotsResponse(),
  });

  res.json({
    ...bot,
    is_online: isBotOnline(bot.id),
  });
});

// ==========================================
// REST Endpoints for VRM Model Storage
// ==========================================
app.get('/api/models', (req, res) => {
  res.json(activeModels);
});

app.post('/api/models/upload', (req, res) => {
  try {
    const { name, base64Data } = req.body || {};
    if (!name || !base64Data) {
      res.status(400).json({ error: 'Parâmetros name e base64Data são obrigatórios.' });
      return;
    }

    const cleanName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const modelId = `vrm_${Date.now()}`;
    const filename = `${modelId}_${cleanName.endsWith('.vrm') ? cleanName : cleanName + '.vrm'}`;
    const filePath = path.join(MODELS_DIR, filename);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const newModel: ModelMetadata = {
      id: modelId,
      name: cleanName.replace(/\.vrm$/i, ''),
      filename,
      size: buffer.length,
      uploaded_at: new Date().toISOString(),
    };

    activeModels = [newModel, ...activeModels.filter((m) => m.name !== newModel.name)];
    saveModelMetadata(activeModels);

    res.status(201).json({
      success: true,
      model: newModel,
      url: `/api/models/files/${filename}`,
    });
  } catch (err) {
    console.error('[Models Storage] Erro ao salvar arquivo VRM:', err);
    res.status(500).json({ error: 'Falha ao gravar arquivo VRM no disco.' });
  }
});

app.get('/api/models/files/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(MODELS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Arquivo do modelo não encontrado.' });
    return;
  }

  res.setHeader('Content-Type', 'model/gltf-binary');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
});

app.delete('/api/models/files/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(MODELS_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  activeModels = activeModels.filter((m) => m.filename !== safeFilename);
  saveModelMetadata(activeModels);

  res.json({ success: true, deleted: safeFilename });
});

// Health & Info Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    gateway_status: 'ready',
    api_available: true,
    total_bots: activeBots.length,
    online_bots: activeBots.filter((b) => isBotOnline(b.id)).length,
    runtime_connected: getOnlineRuntimeCount() > 0,
    total_models: activeModels.length,
    timestamp: Date.now(),
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Agent Runtime Interface Gateway',
    version: '2.0.0',
    websocket_endpoint: '/api/ws',
    protocol: 'Telegram-style Bot Tokens & Persistent VRM Storage',
  });
});

// Set up HTTP Server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/api/ws' || pathname === '/' || pathname === '/ws') {
    const clientType = (url.searchParams.get('type') || 'runtime') as 'runtime' | 'ui';
    const token =
      url.searchParams.get('token') ||
      request.headers['x-auth-token'] ||
      (request.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

    let authenticatedBot: BotRecord | null = null;
    let isValid = false;

    if (clientType === 'ui') {
      isValid = true;
    } else {
      // Validate token against registered Bots
      authenticatedBot = activeBots.find((b) => b.token === token) || null;
      if (authenticatedBot) {
        isValid = true;
      }
    }

    if (clientType === 'runtime' && !isValid) {
      console.warn(`[Gateway] Conexão rejeitada: token de bot inválido (${token ? 'fornecido incorreto' : 'não fornecido'}).`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, {
        type: clientType,
        token: token || '',
        bot: authenticatedBot,
        authenticated: isValid,
      });
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage, meta?: any) => {
  const clientType: 'runtime' | 'ui' = meta?.type || 'runtime';
  const clientId = `client-${Math.random().toString(36).substring(2, 9)}`;
  const bot: BotRecord | null = meta?.bot || null;

  activeSockets.set(ws, {
    ws,
    type: clientType,
    id: clientId,
    botId: bot ? bot.id : undefined,
    authenticated: meta?.authenticated ?? true,
    connectedAt: Date.now(),
  });

  // Acknowledge connection
  ws.send(
    JSON.stringify({
      type: 'system.connected',
      client_id: clientId,
      role: clientType,
      bot_id: bot ? bot.id : undefined,
      bot_name: bot ? bot.name : undefined,
      auth: meta?.authenticated ?? true,
      timestamp: Date.now(),
    })
  );

  // If UI connected, immediately send bots list and runtime status
  if (clientType === 'ui') {
    ws.send(
      JSON.stringify({
        type: 'bot.list',
        bots: getBotsResponse(),
      })
    );
    ws.send(
      JSON.stringify({
        type: 'runtime.status',
        connected: getOnlineRuntimeCount() > 0,
        gateway_status: 'ready',
        timestamp: Date.now(),
      })
    );
  }

  // If Python Runtime connected as a Bot
  if (clientType === 'runtime') {
    if (bot) {
      console.log(`[Gateway] Python Runtime conectado com sucesso para o Bot: "${bot.name}" (${bot.id})!`);
      broadcastToUI({
        type: 'bot.status',
        bot_id: bot.id,
        is_online: true,
      });
      broadcastToUI({
        type: 'agent.status',
        agent_id: bot.id,
        status: 'online',
      });
    }
    broadcastRuntimeStatus();
  }

  // Forwarding logic between UI <-> Runtime
  ws.on('message', (data: Buffer | string) => {
    const raw = data.toString();
    try {
      const parsed = JSON.parse(raw);
      const sender = activeSockets.get(ws);
      if (!sender) return;

      if (sender.type === 'ui') {
        const targetBotId = parsed.agent_id;

        let sent = false;
        for (const [targetWs, targetClient] of activeSockets.entries()) {
          if (targetClient.type === 'runtime' && targetWs.readyState === WebSocket.OPEN) {
            if (!targetClient.botId || !targetBotId || targetClient.botId === targetBotId) {
              targetWs.send(raw);
              sent = true;
            }
          }
        }

        if (!sent) {
          console.log(`[Gateway] Mensagem recebida para ${targetBotId || 'agente'}, aguardando conexão do runtime desse bot...`);
        }
      } else {
        if (sender.botId && !parsed.agent_id) {
          parsed.agent_id = sender.botId;
        }

        const enrichedRaw = JSON.stringify(parsed);
        for (const [targetWs, targetClient] of activeSockets.entries()) {
          if (targetClient.type === 'ui' && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(enrichedRaw);
          }
        }
      }
    } catch (err) {
      console.error('[Gateway] Erro no processamento de mensagem WebSocket:', err);
    }
  });

  ws.on('close', () => {
    const sender = activeSockets.get(ws);
    const wasRuntime = sender?.type === 'runtime';
    const closedBotId = sender?.botId;

    activeSockets.delete(ws);

    if (wasRuntime) {
      if (closedBotId && !isBotOnline(closedBotId)) {
        console.log(`[Gateway] Python Runtime desconectado do Bot: (${closedBotId})`);
        broadcastToUI({
          type: 'bot.status',
          bot_id: closedBotId,
          is_online: false,
        });
        broadcastToUI({
          type: 'agent.status',
          agent_id: closedBotId,
          status: 'idle',
        });
      }
      broadcastRuntimeStatus();
    }
  });

  ws.on('error', (err) => {
    console.error(`[Gateway] Erro no socket ${clientId}:`, err);
  });
});

// Mount Vite or Static Frontend
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        if (vite) vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  AGENT RUNTIME INTERFACE - GATEWAY & VRM DATABASE`);
    console.log(`  HTTP/UI : http://localhost:${PORT}`);
    console.log(`  WebSocket Endpoint : ws://localhost:${PORT}/api/ws`);
    console.log(`  Bots Ativos: ${activeBots.length}`);
    activeBots.forEach((b) => {
      console.log(`    🤖 Bot: ${b.name} (${b.id}) | Token: ${b.token}`);
    });
    console.log(`  Modelos VRM Salvos: ${activeModels.length}`);
    console.log(`======================================================\n`);
  });
}

startServer();
