import re

UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)
IP_PATTERN = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
HEX_PATTERN = re.compile(r"\b0x[0-9a-fA-F]+\b")
NUM_PATTERN = re.compile(r"\b\d+\b")

def normalize_stack_trace(message: str, stack_trace: str) -> str:
    """Limpa valores dinâmicos para que erros iguais gerem vetores quase idênticos."""
    combined = f"{message}\n{stack_trace}".strip()
    combined = UUID_PATTERN.sub("<UUID>", combined)
    combined = IP_PATTERN.sub("<IP>", combined)
    combined = HEX_PATTERN.sub("<HEX>", combined)
    combined = NUM_PATTERN.sub("<NUM>", combined)
    return combined