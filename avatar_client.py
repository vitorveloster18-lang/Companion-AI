"""
AvatarClient - WebSocket Client & Server module for Agent Body Engine.
Supports Python 3 with asyncio and the `websockets` library.
"""

import asyncio
import json
import uuid
from typing import Any, Callable, Dict, Optional
import websockets
from websockets.exceptions import ConnectionClosed


class AvatarConnectionError(Exception):
    """Exception raised when the WebSocket connection to the Agent Body is lost or fails."""
    pass


class AvatarActionError(Exception):
    """Exception raised when an action fails on the Agent Body frontend."""

    def __init__(self, action_id: str, error_message: str):
        self.action_id = action_id
        self.error_message = error_message
        super().__init__(f"Action '{action_id}' failed: {error_message}")


class AvatarClient:
    """WebSocket Client/Controller for Agent Body Frontend.

    Usage:
        avatar = AvatarClient("ws://localhost:8765")
        await avatar.connect()
        await avatar.play_animation("wave")
        await avatar.move_to(2, 0, 0)
        await avatar.look_at(0, 1.5, 0)
        await avatar.speak("Olá, este é um teste.")
        await avatar.stop()
    """

    def __init__(
        self,
        url: str = "ws://localhost:8765",
        on_event: Optional[Callable[[Dict[str, Any]], None]] = None,
        as_server_fallback: bool = True,
    ):
        self.url = url
        self.on_event = on_event
        self.as_server_fallback = as_server_fallback

        self.ws = None
        self._server = None
        self._connected_clients = set()
        self._listen_task: Optional[asyncio.Task] = None
        self._is_running = False

        # Futures tracking for pending actions: id -> asyncio.Future
        self._pending_actions: Dict[str, asyncio.Future] = {}

    def _fail_all_pending(self, error_message: str = "Conexão com o Agent Body perdida") -> None:
        """Rejects and clears all pending action futures immediately on connection drop."""
        for action_id, fut in list(self._pending_actions.items()):
            if not fut.done():
                fut.set_exception(AvatarConnectionError(f"{error_message} (ação pendente '{action_id}')"))
        self._pending_actions.clear()

    async def connect(self, timeout: float = 10.0) -> None:
        """Connects to the WebSocket server or hosts the server if acting as host."""
        self._is_running = True

        # Extract port if present
        parsed_port = 8765
        if ":" in self.url:
            try:
                parsed_port = int(self.url.split(":")[-1].split("/")[0])
            except ValueError:
                parsed_port = 8765

        # Try connecting as client first
        try:
            self.ws = await asyncio.wait_for(websockets.connect(self.url), timeout=2.0)
            self._listen_task = asyncio.create_task(self._listen_loop_client())
            print(f"[AvatarClient] Conectado como cliente em {self.url}")
            return
        except Exception:
            if not self.as_server_fallback:
                raise

        # If connecting as client fails and server fallback is enabled, host WebSocket server on the port
        try:
            print(f"[AvatarClient] Iniciando servidor WebSocket em ws://localhost:{parsed_port} para o frontend...")
            self._server = await websockets.serve(self._handle_client_connection, "0.0.0.0", parsed_port)
            print(f"[AvatarClient] Servidor ativo em ws://localhost:{parsed_port}. Aguardando conexão do frontend...")

            # Wait for at least one frontend client to connect
            start_time = asyncio.get_event_loop().time()
            while not self._connected_clients and (asyncio.get_event_loop().time() - start_time < timeout):
                await asyncio.sleep(0.2)

            if not self._connected_clients:
                print("[AvatarClient] Aviso: Nenhum frontend conectado ainda. Os comandos serão enviados assim que o frontend conectar.")
            else:
                print(f"[AvatarClient] Frontend conectado com sucesso!")
        except Exception as e:
            # Fallback to continuous client reconnection loop
            print(f"[AvatarClient] Tentando conexão contínua com {self.url}...")
            self._listen_task = asyncio.create_task(self._reconnect_loop())

    async def _handle_client_connection(self, websocket):
        """Handles incoming browser frontend WebSocket connections."""
        self._connected_clients.add(websocket)
        print(f"[AvatarClient] Novo frontend conectado: {websocket.remote_address}")
        try:
            async for message in websocket:
                await self._process_incoming_message(message)
        except ConnectionClosed:
            pass
        finally:
            if websocket in self._connected_clients:
                self._connected_clients.remove(websocket)
            print("[AvatarClient] Frontend desconectado.")
            self._fail_all_pending("Conexão com o frontend do Agent Body foi desconectada.")

    async def _reconnect_loop(self):
        """Automatic client reconnection loop."""
        while self._is_running:
            try:
                async with websockets.connect(self.url) as ws:
                    self.ws = ws
                    print(f"[AvatarClient] Conectado a {self.url}")
                    async for message in ws:
                        await self._process_incoming_message(message)
            except Exception:
                self.ws = None
                self._fail_all_pending("Conexão perdida com o servidor.")
                await asyncio.sleep(2.0)

    async def _listen_loop_client(self):
        """Listen loop when connected as a WebSocket client."""
        try:
            async for message in self.ws:
                await self._process_incoming_message(message)
        except ConnectionClosed:
            print("[AvatarClient] Conexão fechada.")
            self._fail_all_pending("Conexão WebSocket fechada.")
        except Exception as e:
            print(f"[AvatarClient] Erro no listener: {e}")
            self._fail_all_pending(f"Erro no canal WebSocket: {e}")

    async def _process_incoming_message(self, raw_message: str):
        """Processes incoming protocol messages from the Agent Body frontend."""
        try:
            data = json.loads(raw_message)
        except Exception:
            return

        msg_type = data.get("type")
        action_id = data.get("id")

        if self.on_event:
            try:
                self.on_event(data)
            except Exception as e:
                print(f"[AvatarClient] Erro no callback on_event: {e}")

        # Handle Action lifecycle responses
        if msg_type == "action.started":
            # Action started execution on the frontend
            pass

        elif msg_type == "action.completed":
            if action_id and action_id in self._pending_actions:
                fut = self._pending_actions.pop(action_id)
                if not fut.done():
                    fut.set_result(data)

        elif msg_type == "action.failed":
            error_msg = data.get("error", "Erro desconhecido")
            if action_id and action_id in self._pending_actions:
                fut = self._pending_actions.pop(action_id)
                if not fut.done():
                    fut.set_exception(AvatarActionError(action_id, error_msg))

    async def _send_action(self, payload: Dict[str, Any], timeout: Optional[float] = 30.0) -> Dict[str, Any]:
        """Sends an action payload over WebSocket and awaits completion."""
        action_id = payload.get("id") or uuid.uuid4().hex[:8]
        payload["id"] = action_id
        raw = json.dumps(payload)

        # Create future to wait for action.completed / action.failed
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self._pending_actions[action_id] = fut

        # Send over client socket or all connected server sockets
        sent = False
        if self.ws:
            try:
                await self.ws.send(raw)
                sent = True
            except Exception as e:
                print(f"[AvatarClient] Erro ao enviar pelo cliente ws: {e}")

        if self._connected_clients:
            for client in list(self._connected_clients):
                try:
                    await client.send(raw)
                    sent = True
                except Exception:
                    pass

        if not sent:
            # If not yet connected, wait briefly for connection
            for _ in range(25):
                if self.ws or self._connected_clients:
                    return await self._send_action(payload, timeout)
                await asyncio.sleep(0.2)
            self._pending_actions.pop(action_id, None)
            raise AvatarConnectionError("Nenhum frontend conectado para receber a ação.")

        # Await completion
        try:
            if timeout:
                return await asyncio.wait_for(fut, timeout=timeout)
            return await fut
        except asyncio.TimeoutError:
            self._pending_actions.pop(action_id, None)
            raise TimeoutError(f"Tempo limite ({timeout}s) excedido aguardando ação '{action_id}'.")

    # ==========================================
    # High-level Protocol Methods
    # ==========================================

    async def play_animation(self, animation: str, duration: Optional[float] = None) -> Dict[str, Any]:
        """Plays an animation ('wave', 'talk', 'walk', 'idle')."""
        payload: Dict[str, Any] = {
            "type": "action",
            "id": f"anim-{uuid.uuid4().hex[:6]}",
            "action": "play_animation",
            "animation": animation,
        }
        if duration is not None:
            payload["duration"] = duration
        return await self._send_action(payload, timeout=duration + 5.0 if duration else 15.0)

    async def move_to(self, x: float, y: float = 0.0, z: float = 0.0, speed: float = 2.0) -> Dict[str, Any]:
        """Moves avatar to target 3D coordinates smoothly."""
        payload = {
            "type": "action",
            "id": f"move-{uuid.uuid4().hex[:6]}",
            "action": "move_to",
            "target": {
                "x": float(x),
                "y": float(y),
                "z": float(z),
            },
            "speed": float(speed),
        }
        return await self._send_action(payload, timeout=60.0)

    async def rotate(self, y: float, speed: Optional[float] = None) -> Dict[str, Any]:
        """Rotates avatar yaw angle in radians."""
        payload: Dict[str, Any] = {
            "type": "action",
            "id": f"rot-{uuid.uuid4().hex[:6]}",
            "action": "rotate",
            "target": {
                "y": float(y),
            },
        }
        if speed is not None:
            payload["speed"] = float(speed)
        return await self._send_action(payload)

    async def look_at(self, x: float, y: float = 1.5, z: float = 0.0, duration: float = 1.0) -> Dict[str, Any]:
        """Points head/gaze towards 3D coordinate."""
        payload = {
            "type": "action",
            "id": f"look-{uuid.uuid4().hex[:6]}",
            "action": "look_at",
            "target": {
                "x": float(x),
                "y": float(y),
                "z": float(z),
            },
            "duration": float(duration),
        }
        return await self._send_action(payload, timeout=duration + 5.0)

    async def set_expression(self, expression: str, intensity: float = 1.0) -> Dict[str, Any]:
        """Sets facial expression ('happy', 'sad', 'angry', 'surprised', 'neutral', 'relaxed')."""
        payload = {
            "type": "action",
            "id": f"expr-{uuid.uuid4().hex[:6]}",
            "action": "set_expression",
            "expression": expression,
            "intensity": float(intensity),
        }
        return await self._send_action(payload)

    async def speak(self, text: str, duration: Optional[float] = None) -> Dict[str, Any]:
        """Displays speech bubble and animates mouth visemes."""
        payload: Dict[str, Any] = {
            "type": "action",
            "id": f"speak-{uuid.uuid4().hex[:6]}",
            "action": "speak",
            "text": str(text),
        }
        if duration is not None:
            payload["duration"] = float(duration)
        calculated_timeout = (duration or max(3.0, len(text) * 0.1)) + 5.0
        return await self._send_action(payload, timeout=calculated_timeout)

    async def stop(self) -> Dict[str, Any]:
        """Stops all active movements, animations and speech immediately."""
        payload = {
            "type": "action",
            "id": f"stop-{uuid.uuid4().hex[:6]}",
            "action": "stop",
        }
        return await self._send_action(payload)

    async def close(self) -> None:
        """Closes all connections and stops server/client tasks."""
        self._is_running = False
        self._fail_all_pending("Cliente encerrado")
        if self._listen_task:
            self._listen_task.cancel()
        if self.ws:
            await self.ws.close()
            self.ws = None
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self._server = None
        for client in list(self._connected_clients):
            await client.close()
        self._connected_clients.clear()
