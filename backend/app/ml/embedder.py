from sentence_transformers import SentenceTransformer

# Carrega o modelo uma única vez na inicialização do processo
_model = SentenceTransformer("all-MiniLM-L6-v2")

def get_embedding(text: str) -> list[float]:
    vector = _model.encode(text, normalize_embeddings=True)
    return vector.tolist()