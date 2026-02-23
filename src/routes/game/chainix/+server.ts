import pool from '$lib/server/db';
import { endGameSession } from '$lib/utils/gameSession';
import { checkWord, fetchRandomWord } from '$lib/utils/word2vec';
import type { RequestEvent } from '@sveltejs/kit';

const activeSessions: Map<
	string,
	{
		startingWord: string;
	}
> = new Map();

export async function GET({ url }: RequestEvent) {
	const userId = Number(url.searchParams.get('userId'));
	try {
		const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const startingWord = await fetchRandomWord();
		activeSessions.set(sessionId, {
			startingWord: startingWord
		});
		const date = new Date();
		if (userId !== 0) {
			await pool.query(
				'INSERT INTO GAME_SESSION(DATE_PARTIE,EN_COURS,NOMBRE_ESSAI,TYPE,WIN,USER_ID) VALUES(?,1,0,"chainix",0,?) ',
				[date, userId]
			);
		}
		return new Response(JSON.stringify({ startingWord, sessionId }), {
			status: 200
		});
	} catch (error) {
		console.error('Erreur /game/chainix :', error);
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

export async function POST({ request }: RequestEvent) {
	const { userGuess, sessionId, action, currentLastWord } = await request.json();
	const session = activeSessions.get(sessionId);

	if (action === 'skipLetters') {
		const startingWord = await fetchRandomWord();
		activeSessions.set(sessionId, {
			startingWord: startingWord
		});
		return new Response(JSON.stringify({ message: 'Mot changer', startingWord }), {
			status: 200
		});
	}

	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}

	let isValid: boolean = false;
	let timeBonus: number = 0;

	const normalize = (word: string): string =>
		word
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase();

	const lastWord = normalize(currentLastWord);
	const guess = normalize(userGuess);

	// Autoriser un chainage sur les 2 ou 3 dernières lettres
	const suffixes: string[] = [];
	if (lastWord.length >= 2) suffixes.push(lastWord.slice(-2));
	if (lastWord.length >= 3) suffixes.push(lastWord.slice(-3));

	const matchesChain = suffixes.some((s) => guess.startsWith(s));

	if (matchesChain && (await checkWord(guess))) {
		isValid = true;
		// Bonus de temps en fonction de la longueur
		timeBonus = userGuess.length <= 5 ? 2 : userGuess.length <= 8 ? 3 : 4;
	}

	return new Response(
		JSON.stringify({ message: isValid ? 'Mot valide' : 'Mot invalide', isValid, timeBonus }),
		{ status: 200 }
	);
}

export async function PUT({ request }: RequestEvent) {
	const { sessionId, idUser, score } = await request.json();
	const session = activeSessions.get(sessionId);
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	try {
		await endGameSession(idUser, 'chainix', 0, true, score);
		activeSessions.delete(sessionId);
		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

