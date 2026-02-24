import type { RequestEvent } from '@sveltejs/kit';
import { createServerSessionStore } from '$lib/utils/serverSessionStore';
import {
	fetchMostSimilar,
	fetchRandomWord,
	fetchSimilarityPercent,
	type SimilarityPercentResult
} from '$lib/utils/word2vec';
import { endGameSession, startGameSession } from '$lib/utils/gameSession';

type CemantixState = {
	targetWord: string;
	guesses: { word: string; similarity: number | false; attemptNumber: number; rank?: number }[];
	attemptCounter: number;
	topWords: string[];
	active: boolean;
	userId?: number | null;
};

const sessions = createServerSessionStore<CemantixState>({
	ttlMs: 1000 * 60 * 60,
	prefix: 'cemantix'
});

export async function POST({ request }: RequestEvent) {
	const { userGuess, sessionId, userId } = await request.json();

	if (!sessionId) {
		return new Response(
			JSON.stringify({ message: 'Aucune partie active pour cette session. Relancez une partie.' }),
			{ status: 400 }
		);
	}

	const entry = sessions.get(sessionId);
	if (!entry || !entry.data.active) {
		return new Response(
			JSON.stringify({ message: 'Partie introuvable ou terminée. Relancez une partie.' }),
			{ status: 400 }
		);
	}

	const state = entry.data;

	try {
		const cleanedGuess = String(userGuess ?? '').trim();
		if (!cleanedGuess) {
			return new Response(JSON.stringify({ message: 'Aucune proposition fournie.' }), {
				status: 400
			});
		}

		const similarityResult = await calculateSimilarity(cleanedGuess, state.targetWord);
		const { similarity, rank } = evaluateSimilarity(cleanedGuess, state.topWords, similarityResult);

		if (similarity === false) {
			return new Response(
				JSON.stringify({
					similarity: false,
					isWinner: false,
					guesses: state.guesses,
					notInVocabulary: true,
					message: `Le mot "${cleanedGuess}" n'existe pas dans le vocabulaire`
				}),
				{ status: 201 }
			);
		}

		if (similarity === null) {
			return new Response(
				JSON.stringify({
					similarity: null,
					isWinner: false,
					guesses: state.guesses,
					error: true,
					message: 'Erreur lors du calcul de similarité'
				}),
				{ status: 201 }
			);
		}

		const isWinner = cleanedGuess.toLowerCase() === state.targetWord.toLowerCase();

		const nextState = { ...state };
		const existingGuess = nextState.guesses.find(
			(g) => g.word.toLowerCase() === cleanedGuess.toLowerCase()
		);
		if (!existingGuess) {
			nextState.attemptCounter += 1;
			nextState.guesses.push({
				word: cleanedGuess,
				similarity,
				attemptNumber: nextState.attemptCounter,
				rank
			});
			nextState.guesses.sort((a, b) => {
				const aVal = typeof a.similarity === 'number' ? a.similarity : -Infinity;
				const bVal = typeof b.similarity === 'number' ? b.similarity : -Infinity;
				return bVal - aVal;
			});
		}

		nextState.active = !isWinner;
		sessions.update(sessionId, nextState);
		if (isWinner) {
			const resolvedUserId = userId ?? nextState.userId;
			await endGameSession(resolvedUserId, 'cemantix', nextState.attemptCounter, true, null);
		}

		return new Response(
			JSON.stringify({
				similarity,
				isWinner,
				guesses: nextState.guesses,
				targetWord: isWinner ? nextState.targetWord : undefined,
				sessionId
			}),
			{ status: 201 }
		);
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur: ' + error }), {
			status: 500
		});
	}
}

export async function GET({ url }: RequestEvent) {
	try {
		const targetWord = await fetchRandomWord();
		const topWords = await fetchMostSimilar(targetWord, 1000);
		const rawUserId = url.searchParams.get('userId');
		const userId = rawUserId ? Number(rawUserId) : null;

		if (userId) {
			await startGameSession(userId, 'cemantix');
		}

		const { id: sessionId } = sessions.create({
			targetWord,
			guesses: [],
			attemptCounter: 0,
			topWords,
			active: true,
			userId
		});

		return new Response(
			JSON.stringify({
				message: 'Nouvelle partie créée',
				wordLength: targetWord.length,
				sessionId
			}),
			{ status: 201 }
		);
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur: ' + error }), {
			status: 500
		});
	}
}

function evaluateSimilarity(
	userGuess: string,
	topWords: string[],
	result: SimilarityPercentResult
): { similarity: number | false | null; rank?: number } {
	if (result.status === 'missing') {
		return { similarity: false };
	}

	if (result.status === 'error') {
		return { similarity: null };
	}

	const rankIndex = topWords.findIndex((w) => w.toLowerCase() === userGuess.toLowerCase());
	const rank = rankIndex !== -1 ? rankIndex + 1 : undefined;
	return { similarity: result.similarity, rank };
}

async function calculateSimilarity(word1: string, word2: string): Promise<SimilarityPercentResult> {
	if (word1.toLowerCase() === word2.toLowerCase()) {
		return { status: 'ok', similarity: 100 };
	}

	return fetchSimilarityPercent(word1, word2);
}
