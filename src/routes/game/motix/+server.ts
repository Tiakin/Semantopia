import type { RequestEvent } from '@sveltejs/kit';
import { endGameSession, startGameSession } from '$lib/utils/gameSession';
import { checkWord, fetchMostSimilar } from '$lib/utils/word2vec';

export async function GET({ url }: RequestEvent) {
	const word = url.searchParams.get('word');
	if (!word) {
		return new Response(JSON.stringify({ exists: false, error: 'Mot manquant' }), { 
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const exists = await checkWord(word);
		return new Response(JSON.stringify({ exists }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ exists: false, error: 'Erreur serveur' + error }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function POST({ request }: RequestEvent) {
	const { sizeWord, userId} = await request.json();
	try {
		const data = await getRandomWord(sizeWord);
		const findWord = data.name;
		const findCategorie = data.categorie;
		const similarWord = await getSimilarWord(findWord);
	
		const tabWord = findWord
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.split('');
		await startGameSession(userId, 'motix');

		return new Response(
			JSON.stringify({
				tabWord,
				findCategorie,
				similarWord
			}),
			{ status: 200 }
		);
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

export async function PUT({ request }: RequestEvent) {
	const { nbEssai, isVictory, idUser } = await request.json();
	try {
		await endGameSession(idUser, 'motix', nbEssai, Boolean(isVictory), null);
		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Erreur Server:', error);
		throw error;
	}
}

async function getRandomWord(sizeWord: number): Promise<{ name: string; categorie: string }> {
	const response = await fetch('https://trouve-mot.fr/api/size/' + sizeWord);
	if (!response.ok) {
		throw new Error('Erreur lors de la récupération du mot');
	}
	const data = await response.json();
	return data[0];
}
async function getSimilarWord(word: string) {
	const similarWords = await fetchMostSimilar(word, 100);
	if (similarWords.length === 0) {
		return word;
	}
	for (const candidat of similarWords) {
		const normCandidat = normalize(candidat);
		if (!normCandidat.includes(normalize(word)) && (await checkWord(normCandidat))) {
			return candidat;
		}
	}
	return similarWords[0];
}


function normalize(str: string): string {
	return str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/(s|x|z|à)$/g, '')
		.trim()
		
}
