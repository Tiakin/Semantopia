import type { hints } from '$lib/models/hints';
import { endGameSession, startGameSession } from '$lib/utils/gameSession';
import { checkWord, fetchSimilarityPercent } from '$lib/utils/word2vec';
import type { RequestEvent } from '@sveltejs/kit';

type MaskToken = number | string | { length: number; state: 'near'; score: number; word: string };

const activeSessions: Map<
	string,
	{
		titleWikiPage: string;
		titleWikiPageSplit: string[];
		contentsplice: string[];
		tabHiddenTitle: MaskToken[];
		tabHiddenContent: MaskToken[];
	}
> = new Map();

export async function POST({ request }: RequestEvent) {
	const { userGuess, sessionId } = await request.json();
	const session = activeSessions.get(sessionId);

	if (!session) {
		return new Response(JSON.stringify({ message: 'Session non trouvée', isWordInGame: false }), {
			status: 400
		});
	}

	const { titleWikiPageSplit, contentsplice, tabHiddenTitle, tabHiddenContent } = session;

	try {
		const normalizedGuess = userGuess.toLowerCase().trim();

		const hasExactInTitle = titleWikiPageSplit.some(
			(word) => word.toLowerCase() === normalizedGuess
		);
		const hasExactInContent = contentsplice.some((word) => word.toLowerCase() === normalizedGuess);

		const checkAndMark = async (word: string, index: number, target: MaskToken[]) => {
			const current = target[index];
			if (typeof current === 'string') return;

			const similarity = await checkSimilarity(word.toLowerCase(), normalizedGuess);
			if (similarity >= 0.9) {
				target[index] = word;
				return;
			}
			if (similarity >= 0.6) {
				const newNear = {
					length: word.length,
					state: 'near' as const,
					score: similarity,
					word: normalizedGuess
				};
				if (typeof current === 'number') {
					target[index] = newNear;
					return;
				}
				if (typeof current === 'object' && current !== null && 'score' in current) {
					target[index] = similarity > (current as { score: number }).score ? newNear : current;
				}
			}
		};

		if (hasExactInTitle || hasExactInContent) {
			await Promise.all([
				...contentsplice.map((word, index) => checkAndMark(word, index, tabHiddenContent)),
				...titleWikiPageSplit.map((word, index) => checkAndMark(word, index, tabHiddenTitle))
			]);

			session.tabHiddenTitle = tabHiddenTitle;
			session.tabHiddenContent = tabHiddenContent;

			return new Response(
				JSON.stringify({
					tabHiddenTitle,
					tabHiddenContent,
					isWordInGame: true
				}),
				{ status: 201 }
			);
		}

		const isWordInGame = await checkWord(userGuess);

		if (!isWordInGame) {
			return new Response(
				JSON.stringify({
					message: 'Le mot n existe pas ou n est pas présent dans le titre ou le contenu',
					isWordInGame: false
				}),
				{
					status: 200
				}
			);
		}
		await Promise.all([
			...contentsplice.map((word, index) => checkAndMark(word, index, tabHiddenContent)),
			...titleWikiPageSplit.map((word, index) => checkAndMark(word, index, tabHiddenTitle))
		]);

		session.tabHiddenTitle = tabHiddenTitle;
		session.tabHiddenContent = tabHiddenContent;

		return new Response(
			JSON.stringify({
				tabHiddenTitle,
				tabHiddenContent,
				isWordInGame: true
			}),
			{ status: 201 }
		);
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

export async function GET({ url }: RequestEvent) {
	const userId = Number(url.searchParams.get('userId'));
	const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	let hints: hints;
	let titleWikiPage: string;
	let titleWikiPageSplit: string[];
	let contentsplice: string[];

	do {
		titleWikiPage = await getRandomTitlePage();
		hints = await getHints(titleWikiPage);
		titleWikiPageSplit = titleWikiPage
			.split(/(\s+|[.,!?;:()[\]{}"'«»\-–—])/g)
			.filter((s) => s.trim() !== '');
		contentsplice = await getContentPage(titleWikiPage);
	} while (contentsplice.length == 0);

	const tabHiddenTitle = titleWikiPageSplit.map((str) =>
		/^[.,!?;:()[\]{}"'«»\-–—]$/.test(str) ? str : str.length
	);

	const tabHiddenContent = contentsplice.map((str) =>
		/^[.,!?;:()[\]{}"'«»\-–—]$/.test(str) ? str : str.length
	);
	console.log(titleWikiPage)

	activeSessions.set(sessionId, {
		titleWikiPage,
		titleWikiPageSplit,
		contentsplice,
		tabHiddenTitle,
		tabHiddenContent
	});

	if (userId !== 0) {
		await startGameSession(userId, 'pedantix');
	}

	try {
		return new Response(
			JSON.stringify({
				sessionId,
				tabHiddenTitle,
				tabHiddenContent,
				hints
			}),
			{ status: 201 }
		);
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}

async function getRandomTitlePage(lang: string = 'fr'): Promise<string> {
	const randomUrl = `https://${lang}.wikipedia.org/w/api.php`;
	const randomParams = new URLSearchParams({
		action: 'query',
		generator: 'random',
		grnnamespace: '0',
		grnlimit: '5',
		prop: 'extracts|info',
		exintro: 'false',
		explaintext: 'true',
		exchars: '2000',
		format: 'json',
		origin: '*'
	});
	try {
		const randomResponse = await fetch(`${randomUrl}?${randomParams}`);
		const randomData = await randomResponse.json();
		const pages = randomData.query.pages;
		for (const pageId in pages) {
			const page = pages[pageId];

			if (page.length && page.length > 70000) {
				continue;
			}

			if (!isValideTitle(page.title)) {
				continue;
			}
			return page.title;
		}
		return await getRandomTitlePage();
	} catch (error) {
		console.error('Erreur lors de la récupération du titre aléatoire:', error);
		throw error;
	}
}

async function getContentPage(
	titlePage: string,
	lang: string = 'fr',
	numLines: number = 30
): Promise<string[]> {
	const url = `https://${lang}.wikipedia.org/w/api.php`;
	const params = new URLSearchParams({
		action: 'query',
		titles: titlePage,
		prop: 'extracts',
		exintro: 'false',
		explaintext: 'true',
		format: 'json',
		origin: '*'
	});

	const response = await fetch(`${url}?${params}`);
	const data = await response.json();

	const pages = data.query.pages;
	const pageId = Object.keys(pages)[0];
	const page = pages[pageId];

	const lines = page.extract.split('\n').filter((line: string) => line.trim() !== '');
	const firstLines = lines.slice(0, numLines);

	const text = firstLines.join(' ');
	const words = text
		.replace(/([.,!?;:()[\]{}"'«»\-–—])/g, ' $1 ')
		.split(/\s+/)
		.filter((word: string) => word !== '');

	return words;
}

function isValideTitle(title: string): boolean {
	const forbiddenWords = [
		'Liste',
		'Catégorie',
		'Utilisateur',
		'Discussion',
		'Membres',
		'ordre',
		'alphabétique',
		'Communauté',
		'gens',
		'.'
	];
	const lowerTitle = title.toLowerCase();
	for (const word of forbiddenWords) {
		if (lowerTitle.includes(word.toLowerCase())) {
			return false;
		}
	}
	if (
		lowerTitle.match(/\d/) ||
		lowerTitle.match(/^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/)
	) {
		return false;
	}
	return true;
}

async function checkSimilarity(wordTab: string, wordGuess: string): Promise<number> {
	const newWord = wordGuess.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	const newWordTab = wordTab.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

	if (newWord.toLowerCase() === newWordTab.toLowerCase()) {
		return 1;
	}

	try {
		const result = await fetchSimilarityPercent(newWord, newWordTab);
		return result.status === 'ok' ? result.similarity / 100 : 0;
	} catch (error) {
		console.error('Erreur lors de la vérification de similarité:', error);
		return newWord.toLowerCase() === newWordTab.toLowerCase() ? 1 : 0;
	}
}

export async function PUT({ request }: RequestEvent) {
	const { nbEssai, isVictory, idUser, sessionId } = await request.json();

	try {
		await endGameSession(idUser, 'pedantix', nbEssai, isVictory, null);

		const revealWord = activeSessions.get(sessionId)?.titleWikiPage;
		const revealContent = activeSessions.get(sessionId)?.contentsplice;
		return new Response(JSON.stringify({ revealWord, revealContent }), {
			status: 200
		});
	} catch (error) {
		console.error('Erreur Server:', error);
		throw error;
	}
}
function normalize(str: string): string {
	return str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\b(es|s)\b/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

async function getHints(title: string, lang: string = 'fr'): Promise<hints> {
	const base = `https://${lang}.wikipedia.org/w/api.php`;

	const makeUrl = (extra: Record<string, string>) =>
		base +
		'?' +
		new URLSearchParams({
			format: 'json',
			origin: '*',
			action: 'query',
			titles: title,
			...extra
		});

	const [catRes, introRes, linksRes] = await Promise.all([
		fetch(makeUrl({ prop: 'categories', cllimit: '50' })),
		fetch(makeUrl({ prop: 'extracts', exintro: 'true', explaintext: 'true' })),
		fetch(makeUrl({ prop: 'links', pllimit: '10' }))
	]);

	const irrelevantPatterns = [
		/^Catégorie:Article/,
		/^Catégorie:Bon/i,
		/^Catégorie:Page/i,
		/^Catégorie:Portail:/,
		/^Catégorie:Catégorie Commons/,
		/^Catégorie:Projet:/,
		/^Catégorie:Wikipédia:/,
		/géolocalisé/i,
		/Wikidata/i,
		/Infobox/i
	];

	const catData = (await catRes.json()) as {
		query: { pages: Record<string, { categories?: { title: string }[] }> };
	};
	const introData = (await introRes.json()) as {
		query: { pages: Record<string, { extract?: string }> };
	};

	const linksData = (await linksRes.json()) as {
		query: { pages: Record<string, { links?: { title: string }[] }> };
	};

	const pageId = Object.keys(catData.query.pages)[0];

	if (pageId === '-1') {
		return {
			categories: [],
			intro: '',
			links: []
		};
	}

	const rawIntro = introData.query.pages[pageId]?.extract ?? '';

	const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const titleRegex = new RegExp(escapedTitle, 'gi');
	let censoredIntro = rawIntro.replace(titleRegex, '…');

	const titleWords = title.split(/\s+/).filter((w) => w.length > 3);
	titleWords.forEach((word) => {
		const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
		censoredIntro = censoredIntro.replace(wordRegex, '…');
	});
	censoredIntro = censoredIntro.replace(/…+/g, '…').trim();

	const shortIntro =
		censoredIntro.length > 50 ? censoredIntro.slice(0, 50).trim() + '…' : censoredIntro;

	const allLinks = linksData.query.pages[pageId]?.links ?? [];
	const filteredLinks = allLinks
		.filter((link) => {
			const linkLower = link.title.toLowerCase();
			const titleLower = title.toLowerCase();
			return !linkLower.includes(titleLower) && !titleLower.includes(linkLower);
		})
		.slice(0, 3)
		.map((l) => l.title);

	const allCategories = catData.query.pages[pageId]?.categories?.map((c) => c.title) ?? [];
	const normalizedTitle = normalize(title);

	const relevantCategories = allCategories
		.filter((catTitle) => !irrelevantPatterns.some((pattern) => pattern.test(catTitle)))
		.map((cat) => cat.replace(/^Catégorie:/, ''))
		.filter((cat) => {
			const normalizedCat = normalize(cat);
			return normalizedCat !== normalizedTitle;
		});

	return {
		categories: relevantCategories,
		intro: shortIntro,
		links: filteredLinks
	};
}

