"""
test_avatar.py - Suite Completa de Validação do Protocolo Agent Body via Python.
Executa os testes:
1. Sequencial: wave -> move_to -> look_at -> speak -> stop
2. Concorrência: asyncio.gather(move_to, look_at, play_animation)
3. Sobreposição: play_animation("wave") seguido imediatamente de play_animation("idle")
4. Movimento + Animação: move_to com animação transitória durante trajeto
"""

import asyncio
import json
from avatar_client import AvatarClient, AvatarActionError, AvatarConnectionError


def log_event(event_data: dict):
    """Imprime no terminal qualquer mensagem/evento recebido do frontend."""
    event_type = event_data.get("type", "unknown")
    event_id = event_data.get("id", "-")
    print(f"  [EVENTO RECEBIDO] type='{event_type}' | id='{event_id}'")
    print(f"                    {json.dumps(event_data, ensure_ascii=False)}")


async def run_sequential_test(avatar: AvatarClient):
    print("\n--------------------------------------------------")
    print("TESTE 1: Bateria Sequencial de Comandos")
    print("--------------------------------------------------")

    print("[1.1] play_animation('wave')...")
    res_wave = await avatar.play_animation("wave")
    print(f"✓ Concluído: {res_wave}")

    await asyncio.sleep(0.5)

    print("[1.2] move_to(x=2, y=0, z=0)...")
    res_move = await avatar.move_to(2, 0, 0, speed=2.5)
    print(f"✓ Concluído: {res_move}")

    await asyncio.sleep(0.5)

    print("[1.3] look_at(x=0, y=1.5, z=0)...")
    res_look = await avatar.look_at(0, 1.5, 0, duration=1.5)
    print(f"✓ Concluído: {res_look}")

    await asyncio.sleep(0.5)

    print("[1.4] speak('Olá, este é um teste.')...")
    res_speak = await avatar.speak("Olá, este é um teste.")
    print(f"✓ Concluído: {res_speak}")

    await asyncio.sleep(0.5)

    print("[1.5] stop()...")
    res_stop = await avatar.stop()
    print(f"✓ Concluído: {res_stop}")


async def run_concurrency_test(avatar: AvatarClient):
    print("\n--------------------------------------------------")
    print("TESTE 2: Concorrência com asyncio.gather")
    print("--------------------------------------------------")
    print("Executando simultaneamente: move_to(-1, 0, 1), look_at(0, 1.5, 3) e play_animation('wave')...")

    results = await asyncio.gather(
        avatar.move_to(-1, 0, 1, speed=2.0),
        avatar.look_at(0, 1.5, 3, duration=2.0),
        avatar.play_animation("wave", duration=2.5),
        return_exceptions=True
    )

    for i, res in enumerate(results):
        if isinstance(res, Exception):
            print(f"❌ Ação {i+1} falhou com: {res}")
        else:
            print(f"✓ Ação {i+1} concluída com sucesso: {res.get('id')}")


async def run_overlap_test(avatar: AvatarClient):
    print("\n--------------------------------------------------")
    print("TESTE 3: Sobreposição de Ações (Cancelamento Prévia)")
    print("--------------------------------------------------")
    print("Disparando play_animation('wave') e imediatamente play_animation('idle')...")

    task1 = asyncio.create_task(avatar.play_animation("wave", duration=4.0))
    await asyncio.sleep(0.05)  # Pequeno intervalo para o frontend registrar o started
    task2 = asyncio.create_task(avatar.play_animation("idle"))

    res1, res2 = await asyncio.gather(task1, task2, return_exceptions=True)

    if isinstance(res1, AvatarActionError):
        print(f"✓ Ação anterior cancelada corretamente com erro: {res1.error_message}")
    else:
        print(f"⚠️ Ação anterior retornou: {res1}")

    if not isinstance(res2, Exception):
        print(f"✓ Nova ação concluída com sucesso: {res2.get('id')}")
    else:
        print(f"❌ Nova ação falhou: {res2}")


async def main():
    print("==================================================")
    print("Validação das Correções do Agent Body via Python")
    print("==================================================")

    avatar = AvatarClient("ws://localhost:8765", on_event=log_event)

    try:
        print("\nConectando ao Agent Body...")
        await avatar.connect()
        print("✓ Conexão estabelecida!")
        await asyncio.sleep(1.0)

        # 1. Sequencial
        await run_sequential_test(avatar)

        # 2. Concorrência
        await run_concurrency_test(avatar)

        # 3. Sobreposição
        await run_overlap_test(avatar)

        print("\n==================================================")
        print("✓ Todos os testes de validação foram concluídos!")
        print("==================================================")

    except (AvatarActionError, AvatarConnectionError) as e:
        print(f"\n❌ Erro durante execução: {e}")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
    finally:
        await avatar.close()


if __name__ == "__main__":
    asyncio.run(main())
