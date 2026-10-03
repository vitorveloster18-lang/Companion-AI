# Agent Runtime Interface - Plano de Evolução e Arquitetura (Revisado)

Este documento estabelece a especificação da evolução do frontend para se tornar a **Interface Principal do Agent Runtime**, com separação arquitetural estrita entre a camada de **Ações do Avatar (`action.*`)** e a camada de **Conversação (`chat.*`)**.

---

## 1. Separação Arquitetural Estrita

O sistema mantém duas esteiras independentes comunicando-se pelo mesmo canal WebSocket (`AgentConnection`), sem acoplamento direto entre `ConversationManager` e `AvatarController`:

```
                             PYTHON RUNTIME
                                   │
                  ┌────────────────┴────────────────┐
                  │                                 │
                  ▼                                 ▼
             CHAT API                           AVATAR API
              chat.*                             action.*
       (chat_client.py)                     (avatar_client.py)
                  │                                 │
                  └────────────────┬────────────────┘
                                   │
                                WebSocket
                                (Port 8765)
                                   │
                                   ▼
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                             AGENT FRONTEND                                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            AgentConnection                            │  │
│  │                 (Despachante WebSocket Centralizado)                  │  │
│  └───────────┬───────────────────────────┬───────────────────────────────┘  │
│              │ (action.*)                │ (chat.*, agent.*)                │
│              ▼                           ▼                                  │
│  ┌───────────────────────┐   ┌───────────────────────────────────────────┐  │
│  │    ActionExecutor     │   │            ConversationManager            │  │
│  │ (Cinemática & Ações)  │   │      (Histórico, Streaming, Mensagens)    │  │
│  └───────────┬───────────┘   └─────────────────────┬─────────────────────┘  │
│              │                                     │                        │
│              ▼                                     ▼                        │
│  ┌───────────────────────┐   ┌───────────────────────────────────────────┐  │
│  │   AvatarController    │   │               AgentManager                │  │
│  │   (Three.js & VRM)    │   │        (Lista de Agentes & Status)        │  │
│  └───────────┬───────────┘   └─────────────────────┬─────────────────────┘  │
│              │                                     │                        │
│              ▼                                     ▼                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                              UI LAYER                                 │  │
│  │  ┌────────────────┐ ┌──────────────────────────────────────────────┐  │  │
│  │  │ AgentSelector  │ │             Header & AgentStatus             │  │  │
│  │  │ (Lista Lateral)│ ├───────────────────────┬──────────────────────┤  │  │
│  │  │                │ │     SceneViewport     │  ConversationPanel   │  │  │
│  │  │   ● Alpha      │ │      (Avatar 3D)      │ (Chat Stream & Msg)  │  │  │
│  │  │   ○ Beta       │ ├───────────────────────┴──────────────────────┤  │  │
│  │  │   ○ Gamma      │ │                 MessageInput                 │  │  │
│  │  └────────────────┘ └──────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Princípios de Desacoplamento

1. **`avatar_client.py` Permanece Intacto**:
   - Continua cuidando **exclusivamente** do protocolo de ações motoras: `move_to`, `rotate`, `look_at`, `play_animation`, `set_expression`, `speak`, `stop`.
   - Nenhuma lógica de `chat.*` será colocada dentro de `avatar_client.py`.
2. **Camada de Conversa Separada no Frontend**:
   - `src/conversation/ConversationTypes.ts`: Tipos puros de dados de chat (`Message`, `chat.message`, `chat.started`, `chat.delta`, `chat.completed`, `chat.failed`).
   - `src/conversation/MessageStore.ts`: Gerenciamento de histórico por `agentId` e atualização reativa de deltas em streaming.
   - `src/conversation/ConversationManager.ts`: Despacha `chat.message` pelo `AgentConnection` e escuta `chat.*`.
3. **Desacoplamento Avatar ↔ Conversa**:
   - O `ConversationManager` **NÃO** chama métodos do `AvatarController`.
   - Se o agente em Python quiser que o avatar fale ou se expresse enquanto responde, o Python enviará simultaneamente comandos explícitos de ação (`speak`, `set_expression`, etc.) através da esteira `action.*`.
4. **Camada de Agentes Separada**:
   - `src/agents/AgentTypes.ts` & `src/agents/AgentManager.ts`: Gerenciam a lista de agentes disponíveis (`agent.list`), seleção do agente ativo e sincronização de status (`agent.status`).

---

## 3. Estrutura de Arquivos

```
src/
├── core/
│   ├── AgentConnection.ts    # WebSocket centralizado
│   ├── ActionExecutor.ts     # Executor das ações do avatar (action.*)
│   ├── AvatarController.ts   # Three.js, VRM e Manequim Fallback
│   └── WorldState.ts         # Estado espacial do avatar
│
├── conversation/
│   ├── ConversationTypes.ts  # Tipos de chat, mensagens e streaming
│   ├── MessageStore.ts       # Armazenamento e buffering de deltas
│   └── ConversationManager.ts# Envio e recebimento do protocolo chat.*
│
├── agents/
│   ├── AgentTypes.ts         # Tipos de agente e status
│   └── AgentManager.ts       # Lista e seleção de agentes
│
├── components/
│   ├── SceneViewport.tsx     # Viewport 3D do Avatar
│   ├── ConversationPanel.tsx # Painel de conversa integrado
│   ├── MessageList.tsx       # Lista de mensagens com streaming
│   ├── MessageInput.tsx      # Input de texto + botão Mic (mock)
│   ├── AgentSelector.tsx     # Lista lateral de agentes
│   ├── AgentStatusBadge.tsx  # Status do agente em tempo real
│   ├── HeaderOverlay.tsx     # Barra superior minimalista
│   └── DebugPanel.tsx        # Painel retrátil de teste e logs
│
└── App.tsx                   # Composição responsiva da aplicação
```

---

## 4. Especificação dos Protocolos

### A. Protocolo de Ações do Avatar (`action.*` - Preservado Integralmente)
- `move_to`, `rotate`, `look_at`, `play_animation`, `set_expression`, `speak`, `stop`
- Respostas: `action.started`, `action.completed`, `action.failed`

### B. Protocolo de Conversação (`chat.*` - Novo e Isolado)
- `chat.message` (Frontend $\rightarrow$ Python): Envia mensagem digitada pelo usuário.
- `chat.started` (Python $\rightarrow$ Frontend): Notifica início do processamento.
- `chat.delta` (Python $\rightarrow$ Frontend): Entrega pedaços parciais de texto (streaming).
- `chat.completed` (Python $\rightarrow$ Frontend): Notifica conclusão da resposta.
- `chat.failed` (Python $\rightarrow$ Frontend): Notifica erro no processamento.

### C. Protocolo de Agentes (`agent.*` - Novo e Isolado)
- `agent.list` (Python $\rightarrow$ Frontend): Atualiza lista de agentes disponíveis no runtime.
- `agent.status` (Python $\rightarrow$ Frontend): Atualiza estado (`online`, `thinking`, `speaking`, `working`, `idle`, `offline`, `error`).
- `agent.select` (Frontend $\rightarrow$ Python): Notifica troca de agente ativo pelo usuário.

---

## 5. Design & Experiência de Usuário

- **Desktop**: Layout split elegante com barra lateral recolhível de agentes, 3D Avatar ocupando a área central de destaque com iluminação suave, e painel de conversa integrado com streaming fluido e rolagem automática.
- **Mobile / Compact**: Visão empilhada com Avatar no topo e conversa abaixo com caixa de mensagem fixa.
- **Painel de Teste / Debug**: Permanece disponível e retrátil, com abas para Ações 3D, Conversação e Logs.
