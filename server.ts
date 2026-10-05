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
import { GoogleGenAI } from '@google/genai';

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
const processedMessageIds = new Map<string, number>();

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

const handleUpdateBot = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { name, role, username } = req.body || {};
  const bot = activeBots.find((b) => b.id === id);
  if (!bot) {
    res.status(404).json({ error: 'Bot não encontrado.' });
    return;
  }

  if (name && typeof name === 'string' && name.trim()) {
    bot.name = name.trim();
  }
  if (role !== undefined && typeof role === 'string') {
    bot.role = role.trim();
  }
  if (username && typeof username === 'string' && username.trim()) {
    bot.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  saveBots(activeBots);

  broadcastToUI({
    type: 'bot.list',
    bots: getBotsResponse(),
  });

  res.json({
    ...bot,
    is_online: isBotOnline(bot.id),
  });
};

app.patch('/api/bots/:id', handleUpdateBot);
app.put('/api/bots/:id', handleUpdateBot);

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

// AI Voice Helper (Gemini Speech-To-Text & TTS)
const getAiClient = () => {
  return new GoogleGenAI({});
};

function generatePhoneticVisemes(text: string, durationSeconds: number) {
  const visemes: Array<{ time: number; shape: string; weight: number }> = [];
  if (!text || durationSeconds <= 0) return visemes;

  const clean = text.toLowerCase();
  const step = Math.max(0.08, durationSeconds / Math.max(1, clean.length));
  let curTime = 0.0;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    let shape: string | null = null;
    let weight = 0.8;

    if (char === 'a' || char === 'á' || char === 'ã' || char === 'à') {
      shape = 'aa';
      weight = 0.9;
    } else if (char === 'e' || char === 'é' || char === 'ê') {
      shape = 'ee';
      weight = 0.75;
    } else if (char === 'i' || char === 'í' || char === 'y') {
      shape = 'ih';
      weight = 0.7;
    } else if (char === 'o' || char === 'ó' || char === 'ô' || char === 'õ') {
      shape = 'oh';
      weight = 0.85;
    } else if (char === 'u' || char === 'ú') {
      shape = 'ou';
      weight = 0.8;
    }

    if (shape) {
      visemes.push({
        time: parseFloat(curTime.toFixed(3)),
        shape,
        weight,
      });
    }

    curTime += step;
    if (curTime >= durationSeconds) break;
  }

  return visemes;
}

// STT Endpoint (gemini-3.5-transcribe)
app.post('/api/voice/transcribe', async (req, res) => {
  try {
    const { data, format } = req.body || {};
    if (!data) {
      res.status(400).json({ error: 'Campo data (base64) é obrigatório.' });
      return;
    }

    const ai = getAiClient();
    const mimeType = format === 'wav' ? 'audio/wav' : 'audio/webm';

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data, mimeType } },
            {
              text: 'Transcreva com fidelidade absoluta o áudio gravado. Retorne somente o texto transcrito, sem introduções ou aspas adicionais.',
            },
          ],
        },
      ],
    });

    const transcribedText = (response.text || '').trim();
    res.json({ success: true, text: transcribedText });
  } catch (err: any) {
    console.error('[Voice STT] Erro ao transcrever áudio:', err);
    res.status(500).json({ error: err?.message || 'Falha ao transcrever áudio.' });
  }
});

// TTS Endpoint (gemini-3.8-flash-lite-tts with visemes)
app.post('/api/voice/tts', async (req, res) => {
  try {
    const { text, voice } = req.body || {};
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Campo text é obrigatório.' });
      return;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || 'Puck',
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);

    if (audioPart && audioPart.inlineData?.data) {
      const audioBase64 = audioPart.inlineData.data;
      const estimatedDuration = Math.max(1.0, text.split(' ').length / 2.5);
      const visemes = generatePhoneticVisemes(text, estimatedDuration);

      res.json({
        success: true,
        format: 'mp3',
        data: audioBase64,
        visemes,
        duration: estimatedDuration,
      });
    } else {
      res.status(502).json({ error: 'Nenhum áudio retornado pelo modelo TTS.' });
    }
  } catch (err: any) {
    console.error('[Voice TTS] Erro ao gerar áudio:', err);
    res.status(500).json({ error: err?.message || 'Falha ao sintetizar áudio.' });
  }
});

// Vision Analysis Endpoint (gemini-3.8-flash Multimodal)
app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { data, format } = req.body || {};
    if (!data) {
      res.status(400).json({ error: 'Campo data (base64) é obrigatório.' });
      return;
    }

    const ai = getAiClient();
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

    const prompt = `Analise esta imagem da câmara do utilizador para um assistente avatar 3D.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "description": "Uma breve observação amigável e direta em português (ex: Vejo que estás a sorrir hoje)",
  "emotion_detected": "happy",
  "reaction_expression": "happy",
  "reaction_animation": "nod"
}
Valores permitidos para emotion_detected: "happy", "neutral", "sad", "surprised", "angry".
Valores permitidos para reaction_expression: "happy", "neutral", "sad", "surprised".
Valores permitidos para reaction_animation: "nod", "wave", "cheer", "talk", "idle".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data, mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawJson = (response.text || '{}').trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = {
        description: 'Imagem recebida e analisada pela câmara.',
        emotion_detected: 'neutral',
        reaction_expression: 'neutral',
        reaction_animation: 'nod',
      };
    }

    res.json({
      success: true,
      ...parsed,
    });
  } catch (err: any) {
    console.error('[Vision Analysis] Erro ao analisar frame:', err);
    res.status(500).json({ error: err?.message || 'Falha ao processar visão multimodal.' });
  }
});

// AI Studio Direct Chat Endpoint (Mode AI Studio Test)
app.post('/api/ai-studio/chat', async (req, res) => {
  try {
    const { message, history, apiKey, model } = req.body || {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Campo message é obrigatório.' });
      return;
    }

    // In AI Studio development, GoogleGenAI uses native environment credentials automatically when no custom key is provided
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI(keyToUse ? { apiKey: keyToUse } : {});

    // Primary and fallback candidate models
    const requestedModel = (model || 'gemini-3.5-flash-lite').trim();
    const candidateModels = [
      requestedModel === 'gemini-3.5-flash-lite' ? 'gemini-3.1-flash-lite' : requestedModel,
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ];

    // Deduplicate candidate models
    const uniqueCandidates = Array.from(new Set(candidateModels));

    // Build chat contents from history
    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (h.role === 'user' && h.content) {
          contents.push({ role: 'user', parts: [{ text: h.content }] });
        } else if (h.role === 'agent' && h.content) {
          contents.push({ role: 'model', parts: [{ text: h.content }] });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const systemInstruction = `Sou um CDI de teste. Respondo de forma curta e natural.
Incluo no meu JSON de resposta o estado emocional:
{
  "text": "resposta aqui",
  "affect": "happy",
  "animation": "nod"
}

Opções para affect: "wondering", "happy", "calm", "grieving", "tense", "longing", "playful".
Opções para animation: "nod", "thinking", "cheer", "wave", "talk", "idle".`;

    let response: any = null;
    let successfulModel = requestedModel;

    // Try candidate models with graceful fallback
    for (const mod of uniqueCandidates) {
      try {
        response = await ai.models.generateContent({
          model: mod,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });
        if (response) {
          successfulModel = mod;
          break;
        }
      } catch (genErr: any) {
        console.warn(`[AI Studio Chat] Tentativa com modelo "${mod}" falhou (${genErr?.message}). Tentando próximo...`);
      }
    }

    if (!response) {
      throw new Error('Não foi possível gerar resposta com os modelos disponíveis.');
    }

    const rawOutput = (response.text || '').trim();
    let parsedJson: { text?: string; affect?: string; animation?: string } = {};

    try {
      parsedJson = JSON.parse(rawOutput);
    } catch {
      const cleaned = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsedJson = JSON.parse(cleaned);
      } catch {
        parsedJson = { text: rawOutput, affect: 'happy', animation: 'talk' };
      }
    }

    const replyText = parsedJson.text || 'Entendido. Processando estímulo.';
    const replyAffect = parsedJson.affect || 'happy';
    const replyAnimation = parsedJson.animation || 'talk';

    res.json({
      success: true,
      text: replyText,
      affect: replyAffect,
      animation: replyAnimation,
      model: successfulModel,
      nativeStudioAuth: !apiKey,
    });
  } catch (err: any) {
    console.error('[AI Studio Chat] Erro ao gerar resposta:', err);
    res.status(500).json({ error: err?.message || 'Falha ao gerar resposta com o Gemini.' });
  }
});

// Set up HTTP Server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 50 * 1024 * 1024 });

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

        // 1. Detailed log when UI sends chat.message
        if (parsed.type === 'chat.message') {
          const onlineRuntimes = Array.from(activeSockets.values())
            .filter((c) => c.type === 'runtime' && c.ws.readyState === WebSocket.OPEN);

          console.log(`\n======================================================`);
          console.log(`[Gateway] 📨 [CHAT.MESSAGE] Recebido da UI:`);
          console.log(`  - Message ID: "${parsed.id}"`);
          console.log(`  - Target agent_id: "${parsed.agent_id}"`);
          console.log(`  - Texto: "${parsed.text}"`);
          console.log(`  - Runtimes Python Ativos (${onlineRuntimes.length}): ${onlineRuntimes.map((c) => `botId="${c.botId || 'none'}", id="${c.id}"`).join(' | ') || 'NENHUM'}`);
          console.log(`======================================================\n`);
        }

        // 2. Deduplication check: Confirm only ONE instance processes each message
        if (parsed.id) {
          const now = Date.now();
          const prevTime = processedMessageIds.get(parsed.id);
          if (prevTime && now - prevTime < 30000) {
            console.warn(`[Gateway] ⚠️ Mensagem duplicada ignorada (id="${parsed.id}" recebida há ${now - prevTime}ms)`);
            return;
          }
          processedMessageIds.set(parsed.id, now);

          // Purge old IDs if cache exceeds 500
          if (processedMessageIds.size > 500) {
            const cutoff = now - 30000;
            for (const [mid, time] of processedMessageIds.entries()) {
              if (time < cutoff) processedMessageIds.delete(mid);
            }
          }
        }

        // 3. Find candidate runtimes
        const candidateRuntimes = Array.from(activeSockets.entries())
          .filter(([targetWs, targetClient]) => targetClient.type === 'runtime' && targetWs.readyState === WebSocket.OPEN);

        // Find best match:
        // a) Exact botId match
        // b) Alias match: 'kairos' or 'bot_01'
        // c) If only 1 runtime is connected, route to it
        let selectedCandidate = candidateRuntimes.find(
          ([_, c]) => c.botId && targetBotId && c.botId === targetBotId
        );

        if (!selectedCandidate && targetBotId) {
          // Check alias
          if (targetBotId === 'kairos' || targetBotId === 'bot_01') {
            selectedCandidate = candidateRuntimes.find(
              ([_, c]) => c.botId === 'bot_01' || c.botId === 'kairos'
            );
          }
        }

        if (!selectedCandidate && candidateRuntimes.length === 1) {
          selectedCandidate = candidateRuntimes[0];
        } else if (!selectedCandidate && candidateRuntimes.length > 1) {
          // If no specific match, pick the most recently connected runtime
          selectedCandidate = candidateRuntimes.sort((a, b) => b[1].connectedAt - a[1].connectedAt)[0];
        }

        // Send to EXACTLY ONE runtime instance
        if (selectedCandidate) {
          const [targetWs, targetClient] = selectedCandidate;

          // Normalize agent_id so Python avatar_handler receives the exact botId it expects (e.g. 'bot_01')
          const originalAgentId = parsed.agent_id;
          if (targetClient.botId) {
            parsed.agent_id = targetClient.botId;
          } else if (!parsed.agent_id) {
            parsed.agent_id = 'bot_01';
          }

          const payload = JSON.stringify(parsed);
          targetWs.send(payload);

          if (parsed.type === 'chat.message') {
            console.log(
              `[Gateway] ✅ [CHAT.MESSAGE] Encaminhado para o runtime Python: botId="${targetClient.botId}", socketId="${targetClient.id}", agent_id_enviado="${parsed.agent_id}" (original: "${originalAgentId}")`
            );
          }
        } else {
          console.warn(
            `[Gateway] ⚠️ Mensagem recebida para "${targetBotId || 'agente'}", mas nenhum runtime correspondente está conectado no momento.`
          );
        }
      } else {
        // Message from Python Runtime -> UI
        if (sender.botId && !parsed.agent_id) {
          parsed.agent_id = sender.botId;
        }

        if (parsed.type === 'chat.started' || parsed.type === 'chat.completed') {
          console.log(`[Gateway] 🤖 [${parsed.type.toUpperCase()}] Recebido do Runtime (botId="${sender.botId}"): id="${parsed.id}"`);
        } else if (parsed.type === 'action') {
          console.log(`[Gateway] 🎬 [ACTION] Recebido do Runtime (botId="${sender.botId}"): action="${parsed.action}", anim="${parsed.animation || ''}", expr="${parsed.expression || ''}"`);
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
