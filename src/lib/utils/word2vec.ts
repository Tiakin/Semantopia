import type { SimilarityPercentResult } from '$lib/types/word2vec';

const DEFAULT_BASE_URL = 'http://localhost:5000';

export type { SimilarityPercentResult };

async function parseJsonSafe(response: Response) {
	try {
		return await response.json();
	} catch (error) {
		console.error('word2vec: unable to parse response json', error);
		return null;
	}
}

export async function fetchRandomWord(baseUrl: string = DEFAULT_BASE_URL): Promise<string> {
	const response = await fetch(`${baseUrl}/api/random-word`);
	if (!response.ok) {
		throw new Error('Impossible de récupérer un mot aléatoire depuis le modèle');
	}
	const data = await parseJsonSafe(response);
	if (!data?.word) {
		throw new Error('Réponse de modèle invalide: mot manquant');
	}
	return data.word;
}

export async function fetchMostSimilar(
	word: string,
	topn: number = 1000,
	baseUrl: string = DEFAULT_BASE_URL
): Promise<string[]> {
	try {
		const response = await fetch(`${baseUrl}/api/most-similar`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ word, topn })
		});

		if (!response.ok) {
			console.error('word2vec: échec de récupération des mots proches');
			return [];
		}

		const data = await parseJsonSafe(response);
		if (!data?.similar_words || !Array.isArray(data.similar_words)) {
			return [];
		}

		return data.similar_words
			.map((entry: unknown) =>
				typeof entry === 'object' && entry && 'word' in entry
					? (entry as { word: string }).word
					: null
			)
			.filter((wordCandidate: string | null): wordCandidate is string => Boolean(wordCandidate));
	} catch (error) {
		console.error('word2vec: erreur most-similar', error);
		return [];
	}
}

export async function fetchSimilarityPercent(
	word1: string,
	word2: string,
	baseUrl: string = DEFAULT_BASE_URL
): Promise<SimilarityPercentResult> {
	try {
		const response = await fetch(`${baseUrl}/api/similarity`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ word1, word2 })
		});

		if (!response.ok) {
			return { status: 'error' };
		}

		const data = await parseJsonSafe(response);
		if (!data) {
			return { status: 'error' };
		}

		if (data.code === 1) {
			return { status: 'missing' };
		}

		if (typeof data.similarity !== 'number') {
			return { status: 'error' };
		}

		return { status: 'ok', similarity: data.similarity * 100 };
	} catch (error) {
		console.error('word2vec: erreur similarity', error);
		return { status: 'error' };
	}
}

export async function checkWord(word: string, baseUrl: string = DEFAULT_BASE_URL): Promise<boolean> {
	try {
		const response = await fetch(`${baseUrl}/api/check-word`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ word })
		});

		if (!response.ok) {
			return false;
		}

		const data = await parseJsonSafe(response);
		return Boolean(data?.exists);
	} catch (error) {
		console.error('word2vec: erreur check-word', error);
		return false;
	}
}
