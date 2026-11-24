import random
import time
import uuid
import urllib.request
import json

API_URL = "http://localhost:8000/api/v1/ingest"
API_KEY = "ls_live_4b279918fbf052f05cd7f18f66b7ea962c19a37eadbbbf57"  # Substitua pela sua chave se criou outra

ERROR_TEMPLATES = [
    {
        "message": lambda: f"PaymentGatewayTimeout: Stripe API did not respond after {random.randint(3000, 5000)}ms for order {random.randint(10000, 99999)}",
        "stack": lambda: (
            f"Traceback (most recent call last):\n"
            f"  File 'services/billing.py', line 142, in charge_customer\n"
            f"    res = stripe.Charge.create(idempotency_key='{uuid.uuid4()}')\n"
            f"TimeoutError: Connection timed out to 104.18.{random.randint(1, 254)}.{random.randint(1, 254)}"
        ),
    },
    {
        "message": lambda: f"JWTValidationError: Signature verification failed for session {uuid.uuid4()}",
        "stack": lambda: (
            f"Traceback (most recent call last):\n"
            f"  File 'middleware/auth.py', line 57, in verify_token\n"
            f"    payload = jwt.decode(token, algorithms=['RS256'])\n"
            f"InvalidSignatureError: Token expired at epoch {random.randint(1700000000, 1799999999)}"
        ),
    },
    {
        "message": lambda: f"RedisCacheMissSpike: Cluster node 10.0.{random.randint(1, 10)}.{random.randint(1, 254)} evicted key user_cart:{random.randint(100, 9999)}",
        "stack": lambda: (
            f"Traceback (most recent call last):\n"
            f"  File 'cache/session_store.py', line 89, in get_cart\n"
            f"    raise CacheMissException('Key not found in memory pool 0x{random.randint(1000, 9999):x}')\n"
            f"CacheMissException: Memory limit reached"
        ),
    },
    {
        "message": lambda: f"DatabaseConnectionError: Pool exhausted while querying user {random.randint(1, 50000)}",
        "stack": lambda: (
            f"Traceback (most recent call last):\n"
            f"  File 'db/session.py', line 42, in get_connection\n"
            f"    return self.pool.connect(timeout=5)\n"
            f"sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 20 reached"
        ),
    },
]


def send_random_error():
    template = random.choice(ERROR_TEMPLATES)
    payload = {
        "message": template["message"](),
        "stack_trace": template["stack"](),
        "environment": random.choice(["production", "production", "staging"]),
        "metadata": {
            "request_id": str(uuid.uuid4()),
            "region": random.choice(["sa-east-1", "us-east-1"]),
        },
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
        },
        method="POST",
    )

    with urllib.request.urlopen(req) as resp:
        print(f"[{resp.status}] Enviado: {payload['message'][:65]}...")


if __name__ == "__main__":
    total = 25
    print(f"🔥 Disparando {total} logs simulados com dados dinâmicos...")
    for i in range(total):
        send_random_error()
        time.sleep(0.25)
    print("✅ Simulação concluída! Atualize o dashboard no navegador.")