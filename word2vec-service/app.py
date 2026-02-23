from pathlib import Path
import random
import re
import urllib.request
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
from gensim.models import KeyedVectors

HOST = "0.0.0.0"
PORT = 5000

app = Flask(__name__)
CORS(app)

# Emplacements et configuration du modèle FastText français
BASE_DIR = Path(__file__).resolve().parent
MODEL_FILENAME = "cc.fr.300.vec.gz"
MODEL_URL = "https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.fr.300.vec.gz"
MODEL_PATH = BASE_DIR / MODEL_FILENAME
MODEL_NOT_LOADED = "Modèle non chargé"
BANNED_WORDS_PATH = BASE_DIR / "banned_words.txt"

# Pré-charger le modèle à l'import du module
model = None
print("Initialisation du service FastText français...")
BANNED_WORDS = set()

# Groupes d'articles pour donner une similarité parfaite sur les déterminants
ARTICLE_GROUPS = [
    {"le", "la", "les", "l"},
    {"un", "une"},
    {"de", "du", "des", "d"},
    {"au", "aux"},
    {"ce", "ces"},
    {"cet", "cette"},
]


def download_model(url: str, destination: Path) -> bool:
    """Télécharge le modèle FastText si absent (avec progression console)."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"Téléchargement du modèle depuis {url}...")
    print("Cela peut prendre plusieurs minutes (~1.2 Go compressé)...")

    def show_progress(block_num: int, block_size: int, total_size: int) -> None:
        downloaded = block_num * block_size
        percent = min(100, downloaded * 100 / total_size) if total_size else 0
        downloaded_mb = downloaded / (1024 * 1024)
        total_mb = total_size / (1024 * 1024) if total_size else 0
        print(
            f"\rProgrès: {percent:5.1f}% ({downloaded_mb:8.1f} MB / {total_mb:8.1f} MB)",
            end="",
        )

    try:
        urllib.request.urlretrieve(url, destination, show_progress)
        print("\nTéléchargement terminé !")
        return True
    except Exception as exc:
        print(f"\nErreur lors du téléchargement: {exc}")
        return False


def ensure_model_available() -> Optional[Path]:
    """Garantit la présence locale du fichier de vecteurs, sinon le télécharge."""
    # Vérifier si le fichier existe
    if MODEL_PATH.exists():
        return MODEL_PATH

    # Télécharger le modèle
    if download_model(MODEL_URL, MODEL_PATH):
        return MODEL_PATH

    print(
        "Impossible de télécharger le modèle automatiquement. "
        "Téléchargez-le manuellement depuis https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.fr.300.vec.gz"
    )
    return None


def load_model() -> Optional[object]:
    """Charge le modèle FastText français (vecteurs Facebook format texte)."""
    model_path = ensure_model_available()
    if model_path is None:
        return None

    print(f"Chargement du modèle FastText depuis {model_path}...")
    print("Cela peut prendre plusieurs minutes...")
    return KeyedVectors.load_word2vec_format(str(model_path), binary=False)


def clean_word(raw: str) -> str:
    """Nettoie et normalise une chaîne en minuscule sans espaces superflus."""
    return (raw or "").strip().lower()


def load_banned_words(path: Path) -> set:
    """Charge les mots bannis depuis un fichier (un mot par ligne)."""
    if not path.exists():
        return set()
    banned = set()
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            entry = clean_word(line.split("#", 1)[0])
            if entry:
                banned.add(entry)
    except Exception as exc:
        print(f"Erreur lors du chargement des mots bannis: {exc}")
    return banned


try:
    model = load_model()
    if model is not None:
        print("Modèle FastText chargé avec succès !")
        print(f"Listening on {HOST}:{PORT}")
    else:
        print("Modèle FastText non chargé.")
except Exception as exc:
    print(f"Erreur lors du chargement du modèle FastText: {exc}")
    model = None

BANNED_WORDS = load_banned_words(BANNED_WORDS_PATH)
if BANNED_WORDS:
    print(f"Mots bannis chargés: {len(BANNED_WORDS)}")


def is_valid_word(word: str) -> bool:
    """Vérifie que le mot contient uniquement des lettres (a-z) et des accents."""
    if not word:
        return False
    return bool(re.fullmatch(r"[a-zA-Zàçéèêëïôùûü]+", word))


def is_banned_word(word: str) -> bool:
    """Indique si un mot est dans la liste des mots bannis."""
    if not word:
        return False
    return clean_word(word) in BANNED_WORDS


def same_article_group(w1: str, w2: str) -> bool:
    """Retourne True si deux mots appartiennent au même groupe d'articles."""
    nw1 = clean_word(w1)
    nw2 = clean_word(w2)
    if not nw1 or not nw2:
        return False
    return any(nw1 in group and nw2 in group for group in ARTICLE_GROUPS)


def is_integer_string(value: str) -> bool:
    """Indique si la chaîne est un entier positif."""
    return bool(re.fullmatch(r"\d+", value))


def number_similarity(s1: str, s2: str) -> float:
    """Renvoie une similarité simple pour deux entiers de même longueur."""
    if not (is_integer_string(s1) and is_integer_string(s2)):
        return 0.0
    if len(s1) != len(s2):
        return 0.0
    try:
        a = int(s1)
        b = int(s2)
    except Exception:
        return 0.0

    if a == 0 and b == 0:
        return 1.0

    mn = min(a, b)
    mx = max(a, b)
    if mx == 0:
        return 0.0
    base_ratio = float(mn) / float(mx)
    return 0.5 + 0.5 * base_ratio


@app.route("/api/similarity", methods=["POST"])
def calculate_similarity():
    try:
        data = request.get_json(force=True)
        word1 = clean_word(data.get("word1", ""))
        word2 = clean_word(data.get("word2", ""))

        if not word1 or not word2:
            return jsonify({"error": "Les deux mots sont requis"}), 400

        if is_banned_word(word1) or is_banned_word(word2):
            return jsonify({"error": "Mot interdit"}), 400

        if is_integer_string(word1) and is_integer_string(word2):
            sim = number_similarity(word1, word2)
            print(f'Numeric similarity between "{word1}" and "{word2}": {sim}')
            return jsonify({"similarity": float(sim), "word1": word1, "word2": word2})

        if same_article_group(word1, word2):
            sim = 1.0
            print(f'Article group match between "{word1}" and "{word2}": {sim}')
            return jsonify({"similarity": sim, "word1": word1, "word2": word2})

        if model is None:
            return jsonify({"error": MODEL_NOT_LOADED}), 500

        if word1 not in model or word2 not in model:
            missing = word1 if word1 not in model else word2
            return jsonify({"code": 1, "error": f'"{missing}" n\'est pas dans le vocabulaire'}), 200

        similarity = float(model.similarity(word1, word2))
        print(f'Similarité entre "{word1}" et "{word2}": {similarity}')

        return jsonify({"similarity": similarity, "word1": word1, "word2": word2})

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/random-word", methods=["GET"])
def get_random_word():
    try:
        if model is None:
            return jsonify({"error": MODEL_NOT_LOADED}), 500

        candidates = [
            word
            for word in model.index_to_key[:10000]
            if is_valid_word(word) and len(word) >= 4 and not is_banned_word(word)
        ]

        if not candidates:
            return jsonify({"error": "Aucun mot trouvé"}), 500

        random_word = random.choice(candidates)
        return jsonify({"word": random_word})

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/most-similar", methods=["POST"])
def get_most_similar():
    try:
        data = request.get_json(force=True)
        word = clean_word(data.get("word", ""))
        topn = int(data.get("topn", 100))

        if not word:
            return jsonify({"error": "Le mot est requis"}), 400

        if is_banned_word(word):
            return jsonify({"error": "Mot interdit"}), 400

        if model is None:
            return jsonify({"error": MODEL_NOT_LOADED}), 500

        if word not in model:
            return jsonify({"code": 1, "error": f'"{word}" n\'est pas dans le vocabulaire'}), 200

        similar_words = model.most_similar(word, topn=topn * 2)

        seen_words = {word}
        result = []

        for candidate, score in similar_words:
            if candidate in seen_words or not is_valid_word(candidate):
                continue
            seen_words.add(candidate)
            result.append({"word": candidate, "similarity": float(score) * 100})
            if len(result) >= topn:
                break

        return jsonify({"word": word, "similar_words": result})

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/check-word", methods=["POST"])
def check_word():
    try:
        data = request.get_json(force=True)
        word = clean_word(data.get("word", ""))

        if not word:
            return jsonify({"error": "Le mot est requis"}), 400

        if is_banned_word(word):
            return jsonify({"error": "Mot interdit"}), 400

        if model is None:
            return jsonify({"error": MODEL_NOT_LOADED}), 500

        exists = word in model
        return jsonify({"word": word, "exists": exists})

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": model is not None,
            "vocab_size": len(model) if model else 0,
        }
    )

if __name__ == "__main__":
    app.run(debug=False, host=HOST, port=PORT, use_reloader=False)
