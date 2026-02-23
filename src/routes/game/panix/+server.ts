import pool from '$lib/server/db';
import { endGameSession } from '$lib/utils/gameSession';
import { checkWord } from '$lib/utils/word2vec';
import type { RequestEvent } from '@sveltejs/kit';
const activeSessions: Map<
	string,
	{
		imposedLetters: string;
	}
> = new Map();
const consonnes = ['b', 'c', 'd', 'f', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v'];
const voyelles = ['a', 'e', 'i', 'o', 'u'];
const syllabesInterdites = [
	'aa',
	'ee',
	'ii',
	'oo',
	'uu',

	'bc',
	'bf',
	'cd',
	'cf',
	'df',
	'dg',
	'gh',
	'hj',
	'kl',
	'mn',
	'pt',
	'vr',
	'zx',

	'bb',
	'cc',
	'dd',
	'ff',
	'gg',
	'll',
	'pp',
	'rr',
	'tt',
	'vv',

	'aq',
	'eo',
	'iu',
	'uo',
	'ue',
	'sss'
];
let poolSyllabes: string[] = [];

export async function GET({ url }: RequestEvent) {
	const userId = Number(url.searchParams.get('userId'));
	try {
		const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const imposedLetters = randomSyllabe();
		activeSessions.set(sessionId, {
			imposedLetters: imposedLetters
		});
		const date = new Date();
		if (userId !== 0) {
			await pool.query(
				'INSERT INTO GAME_SESSION(DATE_PARTIE,EN_COURS,NOMBRE_ESSAI,TYPE,WIN,USER_ID) VALUES(?,1,0,"panix",0,?) ',
				[date, userId]
			);
		}
		return new Response(JSON.stringify({ imposedLetters, sessionId }), {
			status: 200
		});
	} catch (error) {
		console.error('Erreur /game/panix :', error);
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

export async function POST({ request }: RequestEvent) {
	const { userGuess, sessionId, action } = await request.json();
	const session = activeSessions.get(sessionId);
	if (action === 'skipLetters') {
		const imposedLetters = randomSyllabe();
		activeSessions.set(sessionId, {
			imposedLetters: imposedLetters
		});
		return new Response(JSON.stringify({ message: 'Lettres changer', imposedLetters }), {
			status: 200
		});
	}
	let winTime: number = 0;
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	const { imposedLetters } = session;
	let isWin: boolean = false;
	if (await checkValidWord(userGuess, imposedLetters)) {
		isWin = true;
		winTime = userGuess.length <= 5 ? 5 : 8;
		const imposedLetters = randomSyllabe();
		activeSessions.set(sessionId, {
			imposedLetters: imposedLetters
		});
		return new Response(JSON.stringify({ message: 'Mot valide', imposedLetters, winTime, isWin }), {
			status: 200
		});
	}

	return new Response(JSON.stringify({ message: 'Mot invalide', isWin }), {
		status: 200
	});
}

export async function PUT({ request }: RequestEvent) {
	const { sessionId, idUser, score } = await request.json();
	const session = activeSessions.get(sessionId);
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	try {
		if (idUser !== 0) {
			await endGameSession(idUser, 'panix', 0, true, score);
		}

		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

function syllabesGenerate(): string[] {
	const resultat: string[] = [];

	while (resultat.length < 50) {
		const c = consonnes[Math.floor(Math.random() * consonnes.length)];
		const v = voyelles[Math.floor(Math.random() * voyelles.length)];
		const syllabe = Math.random() < 0.5 ? c + v : c + v + c;
		if (!syllabesInterdites.includes(syllabe) && !resultat.includes(syllabe)) {
			resultat.push(syllabe);
		}
	}

	return resultat;
}
function randomSyllabe(): string {
	if (poolSyllabes.length === 0) {
		poolSyllabes = syllabesGenerate();
	}

	const index = Math.floor(Math.random() * poolSyllabes.length);
	return poolSyllabes.splice(index, 1)[0];
}
async function checkValidWord(word: string, imposedLetters: string) {
	const normalize = (word: string): string => {
		return word
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase();
	};
	const normalizeWord = normalize(word);
	const normalizeLetters = normalize(imposedLetters);
	if (normalizeWord !== normalizeLetters) {
		if (normalizeWord.includes(normalizeLetters)) {
			if (await checkWord(normalizeWord)) {
				return true;
			}
		}
	}
	return false;
}
