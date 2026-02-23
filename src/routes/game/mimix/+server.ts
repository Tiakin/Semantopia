import type { RequestEvent } from '@sveltejs/kit';
import { checkWord, fetchMostSimilar, fetchRandomWord, fetchSimilarityPercent } from '$lib/utils/word2vec';
import { error } from 'console';
import pool from '$lib/server/db';
import { endGameSession } from '$lib/utils/gameSession';
const activeSessions: Map<
	string,
	{
		wordIntruder: string;
		wordBasic: string;
		wordCloseOne: string;
		wordCloseTwo: string;
		totalIntruderFound: number;
	}
> = new Map();

export async function GET({ url }: RequestEvent) {
	const userId = Number(url.searchParams.get('userId'));
	try {
		const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		let wordBasic: string = '';
		let wordIntruder: string = '';

		do {
			wordBasic = await randomWord();
			wordIntruder = await randomWord();
		} while ((await calculateSimilarity(wordBasic, wordIntruder)) > 20);

		let similarWords = await fetchMostSimilar(wordBasic, 10);
		let validPair = findValidPair(wordBasic, wordIntruder, similarWords);
		let attempts = 0;
		const MAX_ATTEMPTS = 100;

		while (!validPair && attempts < MAX_ATTEMPTS) {
			similarWords = await fetchMostSimilar(wordBasic, 20);
			validPair = findValidPair(wordBasic, wordIntruder, similarWords);
			attempts++;
		}

		if (!validPair) {
			throw new Error('Unable to find valid similar words');
		}

		activeSessions.set(sessionId, {
			wordBasic: wordBasic,
			wordIntruder: wordIntruder,
			wordCloseOne: validPair[0],
			wordCloseTwo: validPair[1],
			totalIntruderFound: 0
		});

		const tabShuffleWord: string[] = shuffleArray([
			wordBasic,
			wordIntruder,
			validPair[0],
			validPair[1]
		]);
		const date = new Date();
		if (userId !== 0) {
			await pool.query(
				'INSERT INTO GAME_SESSION(DATE_PARTIE,EN_COURS,NOMBRE_ESSAI,TYPE,WIN,USER_ID) VALUES(?,1,0,"mimix",0,?) ',
				[date, userId]
			);
		}

		return new Response(JSON.stringify({ tabShuffleWord, sessionId }), {
			status: 200
		});
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}
export async function POST({ request }: RequestEvent) {
	const { word, sessionId } = await request.json();
	const normalize = (w: string): string => {
		return w
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase();
	};
	const session = activeSessions.get(sessionId);
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	try {
		const { wordIntruder, totalIntruderFound } = session;
		let isWin: boolean = false;
		console.log(normalize(word), normalize(wordIntruder));
		if (normalize(word) === normalize(wordIntruder)) {
			isWin = true;
			const newWordBasic: string = await randomWord();
			let newWordIntruder: string = '';
			do {
				newWordIntruder = await randomWord();
			} while (
				(await calculateSimilarity(newWordBasic, newWordIntruder)) >
				Math.max(20 + totalIntruderFound, 80)
			);
			let newSimilarWords = await fetchMostSimilar(newWordBasic, 20);
			let newValidPair = findValidPair(newWordBasic, newWordIntruder, newSimilarWords);
			let attempts = 0;
			const MAX_ATTEMPTS = 100;
			while (!newValidPair && attempts < MAX_ATTEMPTS) {
				newSimilarWords = await fetchMostSimilar(newWordBasic, 20);
				newValidPair = findValidPair(newWordBasic, newWordIntruder, newSimilarWords);
				attempts++;
			}
			if (!newValidPair) {
				throw new Error('Unable to find valid similar words');
			}
			activeSessions.set(sessionId, {
				wordBasic: newWordBasic,
				wordIntruder: newWordIntruder,
				wordCloseOne: newValidPair[0],
				wordCloseTwo: newValidPair[1],
				totalIntruderFound: totalIntruderFound + 1
			});

			const newTabShuffleWord: string[] = shuffleArray([
				newWordBasic,
				newWordIntruder,
				newValidPair[0],
				newValidPair[1]
			]);

			return new Response(JSON.stringify({ newTabShuffleWord, isWin }), {
				status: 200
			});
		}
		return new Response(JSON.stringify({ message: 'Ce n est pas le bon mot', isWin }), {
			status: 200
		});
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

export async function PUT({ request }: RequestEvent) {
	const { idUser, score, sessionId } = await request.json();
	const session = activeSessions.get(sessionId);
	if (!session) {
		return new Response(JSON.stringify({ message: 'Session introuvable.' }), { status: 400 });
	}
	try {
		const wordIntruder = activeSessions.get(sessionId)?.wordIntruder;
		if (idUser !== 0) {
			await endGameSession(idUser, 'mimix', 0, true, score);
		}

		return new Response(JSON.stringify({ wordIntruder }), {
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
		wordToFind.length < 3 ||
		wordToFind.match(/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/)
	) {
		return randomWord();
	}
	if (!(await checkWord(wordToFind))) {
		return randomWord();
	}
	return wordToFind;
}

async function calculateSimilarity(wordBasic: string, wordCompare: string) {
	const similarityToPrevious = await fetchSimilarityPercent(wordBasic, wordCompare);
	if (similarityToPrevious.status === 'missing') {
		throw error("le mot n'existe pas");
	}

	if (similarityToPrevious.status === 'error') {
		throw error('erreur dans la comparaison');
	}

	return similarityToPrevious.similarity;
}
function shuffleArray(arr: string[]): string[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
function checkWordsValidity(
	wordBasic: string,
	wordIntruder: string,
	word1: string,
	word2: string
): boolean {
	const normalize = (word: string): string => {
		return word
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase()
			.replace(/s/g, '');
	};

	if (!word1 || !word2 || word1.length === 0 || word2.length === 0) {
		return false;
	}
	if (normalize(word1) === normalize(word2)) {
		return false;
	}

	if (normalize(word1) === normalize(wordBasic) || normalize(word2) === normalize(wordBasic)) {
		return false;
	}

	if (
		normalize(word1) === normalize(wordIntruder) ||
		normalize(word2) === normalize(wordIntruder)
	) {
		return false;
	}

	return true;
}

function findValidPair(
	wordBasic: string,
	wordIntruder: string,
	similarWords: string[]
): [string, string] | null {
	for (let i = 0; i < similarWords.length; i++) {
		for (let j = i + 1; j < similarWords.length; j++) {
			const w1 = similarWords[i];
			const w2 = similarWords[j];
			if (checkWordsValidity(wordBasic, wordIntruder, w1, w2)) {
				return [w1, w2];
			}
		}
	}
	return null;
}
