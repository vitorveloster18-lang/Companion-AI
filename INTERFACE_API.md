# Agent Runtime Interface - Especificação da API, Bots & Banco de Modelos 3D

A **Interface do Agent Runtime** funciona de forma análoga à API de Bots do Telegram com banco de dados persistente tanto para Bots quanto para Modelos 3D (.VRM).

---

## 1. Banco de Dados Persistente para Modelos 3D (.VRM)

Para garantir que seus avatares personalizados **nunca sumam ao recarregar a página ou reiniciar o servidor**, a aplicação implementa persistência dupla:

1. **Banco de Dados Local (IndexedDB)**: O arquivo binário do modelo `.vrm` é armazenado no banco de dados IndexedDB do navegador (`AgentAvatarVRM_DB`), com capacidade para múltiplos modelos de até 100MB+. Ao abrir a interface, o último modelo ativo é restaurado instantaneamente.
2. **Armazenamento no Servidor (`.data/models/`)**: O modelo também é salvo no disco do servidor persistente, com endpoints REST dedicados:
   - `GET /api/models`: Lista os modelos salvos.
   - `POST /api/models/upload`: Salva um novo modelo `.vrm`.
   - `GET /api/models/files/:filename`: Faz o streaming do arquivo 3D binário.
   - `DELETE /api/models/files/:filename`: Remove o modelo.

Você pode gerenciar, alternar e excluir seus modelos salvos diretamente na aba **Avatar 3D & Banco de Modelos** nas Configurações (⚙️).

---

## 2. Fluxo de Criação de Bot e Conexão (Estilo Telegram)

```
┌───────────────────────────────────────────────────────────┐
│                   INTERFACE WEB (3D)                      │
│  1. Abrir Configurações (⚙️) -> Bots & Tokens             │
│  2. Definir Nome e Função do Bot                          │
│  3. Copiar o BOT_TOKEN gerado (ex: bot_102938:AAHx9...)   │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              │ 4. Conectar WebSocket com o Token
                              ▼
┌───────────────────────────────────────────────────────────┐
│                PYTHON RUNTIME (chat.py)                   │
│                                                           │
│  INTERFACE_URL = "ws://localhost:3000/api/ws"             │
│  BOT_TOKEN = "bot_102938:AAHx9..."                        │
│                                                           │
│  ws://localhost:3000/api/ws?token=bot_102938:AAHx9...     │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Endpoints REST da API de Bots

- **`GET /api/bots`**: Lista todos os bots cadastrados com seus respectivos tokens e status em tempo real (`is_online: true/false`).
- **`POST /api/bots`**: Cria um novo bot e gera seu token exclusivo:
  ```json
  // Request
  {
    "name": "Meu Assistente Python",
    "role": "Analista de Dados e Automação",
    "username": "assistente_bot"
  }

  // Response (201 Created)
  {
    "id": "bot_849201",
    "name": "Meu Assistente Python",
    "username": "assistente_bot",
    "role": "Analista de Dados e Automação",
    "token": "bot_849201:AAH8xLmQ92kLqR4zW10...",
    "created_at": "2026-10-02T22:00:00.000Z",
    "is_online": false
  }
  ```
- **`DELETE /api/bots/:id`**: Remove um bot.
- **`POST /api/bots/:id/regenerate-token`**: Regenera o token de segurança do bot.

---

## 4. Conexão WebSocket no Python (`chat.py`)

```python
import asyncio
import json
import websockets

INTERFACE_URL = "ws://localhost:3000/api/ws"
BOT_TOKEN = "bot_849201:AAH8xLmQ92kLqR4zW10..."  # Token copiado da interface

async def run_bot():
    url = f"{INTERFACE_URL}?token={BOT_TOKEN}&type=runtime"
    
    async with websockets.connect(url) as ws:
        print("🤖 Bot conectado com sucesso à interface 3D!")
        
        async for raw_message in ws:
            data = json.loads(raw_message)
            msg_type = data.get("type")
            
            # 1. Mensagem recebida do usuário na interface
            if msg_type == "chat.message":
                user_text = data.get("text")
                msg_id = data.get("id")
                print(f"Mensagem recebida: {user_text}")
                
                # 2. Avisa à interface que o bot começou a responder
                await ws.send(json.dumps({
                    "type": "chat.started",
                    "id": msg_id
                }))
                
                # 3. Emite o streaming da resposta (chat.py)
                resposta = f"Olá! Recebi sua mensagem: '{user_text}'"
                for chunk in resposta.split():
                    await ws.send(json.dumps({
                        "type": "chat.delta",
                        "id": msg_id,
                        "text": chunk + " "
                    }))
                    await asyncio.sleep(0.08)
                
                # 4. Finaliza a resposta
                await ws.send(json.dumps({
                    "type": "chat.completed",
                    "id": msg_id
                }))

if __name__ == "__main__":
    asyncio.run(run_bot())
```
