# Semantopia

Projet étudiant réalisé par **Milan Trzepalkowski** et **Killian Duboucher**.

Semantopia est une plateforme de jeux de mots en ligne disponible à l'adresse : [semantopia.tiakin.fr](https://semantopia.tiakin.fr)

> ⚠️ Le projet est encore en cours de développement.

## Les jeux

| Jeu | Description |
|---|---|
| **Cémantix** | Trouver le mot mystère grâce aux associations sémantiques |
| **Pédantix** | Découvrir l'article Wikipédia caché mot par mot |
| **Motix** | Deviner le mot mystère en construisant d'autres mots du même nombre de lettres |
| **Corrélix** | Trouver les mots liés par des corrélations surprenantes et logiques |
| **Lettix** | Trouver un maximum d'anagrammes en 60 secondes |
| **Mimix** | Trouver le plus de fois l'intrus parmi les 4 propositions |
| **Panix** | Créer un mot avec des lettres imposées et collées en 60 secondes |
| **Chainix** | Enchaîner des mots où chaque fin devient le début du suivant en 60 secondes |

## Architecture

Le projet se compose de deux parties distinctes :

### Site principal

Application web construite avec [SvelteKit](https://kit.svelte.dev/) et [Tailwind CSS](https://tailwindcss.com/), connectée à une base de données **MySQL**. Elle gère l'ensemble du frontend, l'authentification des utilisateurs, le classement (leaderboard) et le système d'achievements.

### Service word2vec

Microservice Python exposé via une API [Flask](https://flask.palletsprojects.com/), utilisé notamment par **Cémantix** pour calculer les similarités sémantiques entre les mots. Il repose sur le modèle **FastText français** (`cc.fr.300.vec`) fourni par Meta AI (~1,2 Go compressé), téléchargé automatiquement au premier démarrage.

## Installation & développement

### Prérequis

- Node.js 18 ou plus
- Python 3.10 ou plus

### Site principal

```sh
# Installer les dépendances
npm install

# Copier et remplir les variables d'environnement
cp .env.example .env

# Lancer le serveur de développement
npm run dev
```

### Service word2vec

```sh
# Installer les dépendances Python dans un environnement virtuel
npm run word2vec:install

# Démarrer le service (télécharge le modèle FastText si absent)
npm run word2vec
```

Le service démarre sur `http://localhost:5000`.

## Build de production

```sh
# Build du site principal
npm run build

# Prévisualiser le build
npm run preview
```

## Tests

```sh
# Tests unitaires
npm run test:unit

# Tests end-to-end (Playwright)
npm run test:e2e

# Tous les tests
npm run test
```
