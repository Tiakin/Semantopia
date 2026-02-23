import pool from '$lib/server/db';
import { endGameSession } from '$lib/utils/gameSession';
import { checkWord, fetchRandomWord } from '$lib/utils/word2vec';
import type { RequestEvent } from '@sveltejs/kit';
const activeSessions: Map<
	string,
	{
		wordToFind: string;
		shuffleWordToFind: string;
	}
> = new Map();
export async function GET({ url }: RequestEvent) {
	const userId = Number(url.searchParams.get('userId'));
	try {
		const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const wordToFind: string = await randomWord();
		const shuffleWordFind: string = shuffleWord(wordToFind);
		activeSessions.set(sessionId, {
			wordToFind: wordToFind,
			shuffleWordToFind: shuffleWordFind
		});
		const date = new Date();
		if (userId !== 0) {
			await pool.query(
				'INSERT INTO GAME_SESSION(DATE_PARTIE,EN_COURS,NOMBRE_ESSAI,TYPE,WIN,USER_ID) VALUES(?,1,0,"lettix",0,?) ',
				[date, userId]
			);
		}
		return new Response(JSON.stringify({ wordShuffle: shuffleWordFind, sessionId }), {
			status: 200
		});
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}
export async function POST({ request }: RequestEvent) {
	const { userGuess, sessionId, action } = await request.json();
	const session = activeSessions.get(sessionId);
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	if (action === 'skipLetters') {
		const newWord: string = await randomWord();
		
		const newWordShuffle: string = shuffleWord(newWord);
		activeSessions.set(sessionId, {
			wordToFind: newWord,
			shuffleWordToFind: newWordShuffle
		});
		return new Response(JSON.stringify({ message: 'Anagrammme Changer', newWordShuffle }), {
			status: 200
		});
	}
	const { wordToFind } = session;
	let isWin: boolean = false;
	if (areAnagrams(wordToFind, userGuess)) {
		if ((await checkWord(userGuess)) == false) {
			return new Response(JSON.stringify({ message: 'Ce n est pas le bon mot', isWin }), {
				status: 200
			});
		}
		const newWord: string = await randomWord();
		const newWordShuffle: string = shuffleWord(newWord);
		activeSessions.set(sessionId, {
			wordToFind: newWord,
			shuffleWordToFind: newWordShuffle
		});
		isWin = true;
		return new Response(JSON.stringify({ message: 'C est le bon mot', newWordShuffle, isWin }), {
			status: 200
		});
	}
	return new Response(JSON.stringify({ message: 'Ce n est pas le bon mot', isWin }), {
		status: 200
	});
}

export async function PUT({ request }: RequestEvent) {
	const { idUser, score, sessionId } = await request.json();
	const session = activeSessions.get(sessionId);
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	try {
		const wordToFind = activeSessions.get(sessionId)?.wordToFind;
		if (idUser !== 0) {
			await endGameSession(idUser, 'lettix', 0, true, score);
		}

		return new Response(JSON.stringify({ wordToFind }), {
			status: 200
		});
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}
async function randomWord() {
	const wordToFind: string = await fetchRandomWord();
	if (
		wordToFind.length < 5 ||
		wordToFind.length > 10 ||
		wordToFind.match(/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/)
	) {
		return randomWord();
	}
	return wordToFind;
}
function shuffleWord(word: string): string {
	const lettres = word.split('');
	for (let i = lettres.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[lettres[i], lettres[j]] = [lettres[j], lettres[i]];
	}
	return lettres.join('');
}

function areAnagrams(word1: string, word2: string): boolean {
	const normalize = (str: string) =>
		str
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/\s+/g, '');

	const str1 = normalize(word1);
	const str2 = normalize(word2);

	if (str1.length !== str2.length) {
		return false;
	}

	const charCount: Record<string, number> = {};

	for (const char of str1) {
		charCount[char] = (charCount[char] || 0) + 1;
	}

	for (const char of str2) {
		if (!charCount[char]) {
			return false;
		}
		charCount[char]--;
	}

	return true;
}

