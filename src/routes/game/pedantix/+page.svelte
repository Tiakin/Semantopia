<script lang="ts">
	import Header from '$lib/header.svelte';
	import OtherGames from '$lib/OtherGames.svelte';
	import { onMount } from 'svelte';
	import { triggerConfettiAnimation, GameInput, GameActions, GameStats, GameRules, LoadingState, GameMessage } from '$lib';
	import { sessionStore } from '$lib/store/sessionStore';
	import { emitGameEvent } from '$lib/store/gameEventStore';
	import type { GameEventData } from '$lib/models/achievements';
	import type { hints } from '$lib/models/hints';

	type MaskToken = number | string | { length: number; state: 'near'; score: number; word: string };

	let userGuess = '';
	let tabguess: string[] = [];
	let sessionId: string = '';
	let repbody: {
		sessionId: string;
		tabHiddenTitle: MaskToken[];
		tabHiddenContent: MaskToken[];
		hints: hints;
		isWordInGame: boolean;
	};

	let repbodyStats: {
		nbParties: number;
		nbEssaiMoyen: number;
		tauxReussite: number;
		serieActuelle: number;
	};
	let tabTitle: MaskToken[] = [];
	let tabTitleTemp: MaskToken[] = [];
	let tabContent: MaskToken[] = [];
	let tabContentTemp: MaskToken[] = [];
	let nbEssai: number = 0;

	let partiesJouees: number = 0;
	let tauxReussite: number = 0;
	let essaisMoyen: number = 0.0;
	let serieActuelle: number = 0;

	let isLoading = true;
	let isVictory = false;

	let isSurrender = false;

	const session = sessionStore.get();
	const idUser: number | null = session ? session.id : 0;

	let hintsGame: hints;
	let revealedIndice = [false, false, false];

	let isWordInGame: boolean = true;

	let wordIsInTabGuess: boolean = false;

	function toggleReveal(index: number) {
		revealedIndice[index] = !revealedIndice[index];
	}
	function resetIndices() {
		revealedIndice = [false, false, false];
	}

	async function newGame() {
		resetIndices();
		isSurrender = false;
		tabguess = [];
		isLoading = true;
		isVictory = false;
		wordIsInTabGuess = false;
		nbEssai = 0;
		userGuess = '';
		tabTitle = [];
		tabContent = [];
		tabTitleTemp = [];
		tabContentTemp = [];
		if (idUser === null) {
			console.error('idUser est null');
			return;
		}
		const url = `/game/pedantix?userId=${encodeURIComponent(idUser)}`;
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			repbody = await response.json();
			if (response.status == 201) {
				sessionId = repbody.sessionId;
				tabTitle = repbody.tabHiddenTitle;
				tabContent = repbody.tabHiddenContent;
				hintsGame = repbody.hints;
			}
		} catch (error) {
			console.error('Erreur de chargement:', error);
		} finally {
			isLoading = false;
		}
	}

	async function sendGuess() {
		if (tabguess.includes(userGuess)){
			wordIsInTabGuess = true;
			userGuess = '';
			return null;
		}
		wordIsInTabGuess = false;
		isWordInGame = true;
		
		
		const response = await fetch('/game/pedantix/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userGuess,
				sessionId
			})
		});
		repbody = await response.json();
		if (response.status == 201) {
			tabTitleTemp = [...tabTitle];
			tabContentTemp = [...tabContent];
			tabTitle = repbody.tabHiddenTitle;
			tabContent = repbody.tabHiddenContent;
			isWordInGame = repbody.isWordInGame;
		}
		isWordInGame = repbody.isWordInGame;
		if (isWordInGame){
			nbEssai++;
			tabguess.push(userGuess);
			tabguess = tabguess;
		}
		if (tabTitle.every((item) => typeof item === 'string')) {
			triggerVictory();
		}
		userGuess = '';
	}

	function isNewlyFoundTitle(index: number): boolean {
		const previous = tabTitleTemp[index];
		const current = tabTitle[index];
		return typeof previous !== 'string' && typeof current === 'string' && !isPunctuation(current);
	}
	function isNewlyFoundContent(index: number): boolean {
		const previous = tabContentTemp[index];
		const current = tabContent[index];
		return typeof previous !== 'string' && typeof current === 'string' && !isPunctuation(current);
	}

	const isPunctuation = (token: MaskToken) =>
		typeof token === 'string' && /^[.,!?;:()\[\]{}"'«»\-–—]$/.test(token);
	const isNearMatch = (
		token: MaskToken
	): token is { length: number; state: 'near'; score: number; word: string } =>
		typeof token === 'object' && token !== null && 'state' in token && token.state === 'near';

	const maskedSquares = (length: number) => '■'.repeat(length);

	const needsSpaceBefore = (token: MaskToken, index: number, array: MaskToken[]) => {
	if (index === 0) return false;
	
	const prevToken = array[index - 1];
	
	if (isPunctuation(token)) return false;
	
	if (typeof prevToken === 'string' && /^[\-–—]$/.test(prevToken)) return false;
	
	return true;
};

	const nearTextColor = (score?: number) => {
		const safe = Math.min(Math.max(score ?? 0, 0), 1);
		const hue = 50 - safe * 50; 
		const lightness = 65 + safe * 10; 
		return `hsl(${hue} 85% ${lightness}%)`;
	};

	const tooltipLabel = (len: number) => `${len} caractères`;

	async function triggerVictory() {
		isVictory = true;
		isSurrender = false;
		try {
			const response = await fetch('/game/pedantix', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nbEssai,
					isVictory,
					idUser,
					sessionId
				})
			});
			const data = await response.json();
			if (data.revealContent) {
				tabContent = data.revealContent;
			}
		} catch (error) {
			console.error('Erreur Server:', error);
			throw error;
		}
		triggerConfettiAnimation();

		
		const eventData: GameEventData = {
			userId: idUser ?? 0,
			type: 'pedantix',
			won: true,
			attempts: nbEssai
		};
		emitGameEvent(eventData);
	}

	async function surrenderGame() {
		isSurrender = true;
		isVictory = false;
		try {
			const response = await fetch('/game/pedantix', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nbEssai,
					isVictory,
					idUser,
					sessionId
				})
			});
			const data = await response.json();
			if (data.revealWord) {
				const titleWords = data.revealWord
					.split(/(\s+|[.,!?;:()[\]{}"'«»])/g)
					.filter((s: string) => s.trim() !== '');
				tabTitle = titleWords.map((word: string) => {
					return /^[.,!?;:()[\]{}"'«»\-–—]$/.test(word) ? word : word;
				});
			}
			if (data.revealContent) {
				tabContent = data.revealContent;
			}
		} catch (error) {
			console.error('Erreur Server:', error);
			throw error;
		}
	}
	async function getStatistics() {
		try {
			const responseStats: Response = await fetch('/api/statistiques', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: idUser,
					gameType: 'pedantix'
				})
			});
			repbodyStats = await responseStats.json();
			partiesJouees = repbodyStats.nbParties ?? 0;
			tauxReussite = repbodyStats.tauxReussite ?? 0;
			essaisMoyen = repbodyStats.nbEssaiMoyen ?? 0;
			serieActuelle = repbodyStats.serieActuelle ?? 0;
		} catch (error) {
			console.error('Erreur Server:', error);
			throw error;
		}
	}
	onMount(() => {
		newGame();
		if (idUser) {
			getStatistics();
		}
	});
</script>

<Header />
<div class="min-h-screen bg-gray-50 px-4 py-6 sm:p-8">
	<div class="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row">
		<div class="max-w-3xl flex-1">
			<div class="mb-6">
				<div class="mb-8">
					<h1 class="mb-2 text-4xl font-bold text-gray-900">
						<i class="fa-solid fa-book-open mr-3 text-blue-700" aria-hidden="true"></i>
						Pédantix
					</h1>
					<p class="mt-1 text-gray-600">Découvrez l'article Wikipédia caché mot par mot</p>
					<p class="mt-2 text-sm text-gray-500">Essais : {nbEssai}</p>
				</div>
			</div>

			{#if isLoading}
				<div class="flex flex-col items-center justify-center py-12">
					<div
						class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"
					></div>
					<p class="font-medium text-gray-600">Chargement de la partie...</p>
				</div>
			{/if}
			{#if isSurrender}
				<div
					class="flex h-40 items-center justify-center rounded-lg border-2 border-red-500 bg-red-100 p-6"
				>
					<p class="text-3xl font-bold text-red-700">
						Perdu, le mot était {tabTitle.filter((item) => typeof item === 'string').join(' ')}
					</p>
				</div>
			{/if}
			{#if !isWordInGame}
				<div class="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-6">
					<svg
						class="h-6 w-6 flex-shrink-0 text-amber-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<div>
						<p class="font-semibold text-amber-900">Mot introuvable</p>
						<p class="text-sm text-amber-700">
							Ce mot n'existe pas dans notre vocabulaire ou n'est pas présent dans le jeu
						</p>
					</div>
				</div>
			{/if}
			{#if wordIsInTabGuess}
				<div
					class="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-6"
				>
					<p class="text-sm text-amber-700">
						Vous avez deja essayer ce mot !
					</p>
				</div>
			{/if}

			<div class="row relative mb-6">
				<GameInput
					bind:value={userGuess}
					placeholder="Tapez votre proposition..."
					disabled={isVictory || isSurrender}
					gradient="from-blue-700 via-blue-500 to-cyan-400"
					buttonText="Envoyer"
					onsubmit={sendGuess}
					oninput={(value) => (userGuess = value)}
				/>
			</div>
			<div class="mb-6 rounded-lg p-6">
				<p class="mb-4 flex flex-wrap items-baseline gap-y-2 text-base leading-7 text-gray-800">
					{#each tabTitle as item, i}
						{#if typeof item === 'string'}
							<span
								class="inline-block"
								class:ml-1={needsSpaceBefore(item, i,tabTitle)}
								class:text-green-600={isNewlyFoundTitle(i)}
								class:bg-green-100={isNewlyFoundTitle(i)}
								class:border-2={isNewlyFoundTitle(i)}
								class:border-green-500={isNewlyFoundTitle(i)}
								class:rounded={isNewlyFoundTitle(i)}
								class:px-1={isNewlyFoundTitle(i)}
							>
								{item}
							</span>
						{:else if isNearMatch(item)}
							<span
								class="group relative inline-flex items-center justify-center"
								class:ml-1={needsSpaceBefore(item, i,tabTitle)}
								title="Proche, mais pas révélé"
								style={`min-width: ${Math.max(item.length, item.word.length)}ch; min-height: 2.6em; padding-right: 0.1em;`}
							>
								<span
									class="inline-block font-mono tracking-tight text-black"
									style="font-size: 1.5em; line-height: 1.25;"
								>
									{maskedSquares(item.length)}
								</span>
								<span
									class="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-xs font-semibold sm:text-sm"
									style={`color:${nearTextColor(item.score)}; text-shadow: 0 0 6px rgba(0,0,0,0.4);`}
								>
									{item.word}
								</span>
								<span
									class="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									{tooltipLabel(item.length)}
								</span>
							</span>
						{:else}
							<span
								class="group relative inline-flex items-center justify-center"
								class:ml-1={needsSpaceBefore(item, i,tabTitle)}
								style="min-height: 2.6em; padding-right: 0.1em;"
							>
								<span
									class="inline-block font-mono tracking-tight text-black"
									style="font-size: 1.5em; line-height: 1.25;"
								>
									{maskedSquares(item as number)}
								</span>
								<span
									class="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									{tooltipLabel(item as number)}
								</span>
							</span>
						{/if}
					{/each}
				</p>
				<p class="flex flex-wrap items-baseline gap-y-2 text-base leading-7 text-gray-800">
					{#each tabContent as item, i}
						{#if typeof item === 'string'}
							<span
								class="inline-block"
								class:ml-1={needsSpaceBefore(item, i,tabContent)}
								class:text-green-600={isNewlyFoundContent(i)}
								class:bg-green-100={isNewlyFoundContent(i)}
								class:border-2={isNewlyFoundContent(i)}
								class:border-green-500={isNewlyFoundContent(i)}
								class:rounded={isNewlyFoundContent(i)}
								class:px-1={isNewlyFoundContent(i)}
							>
								{item}
							</span>
						{:else if isNearMatch(item)}
							<span
								class="group relative inline-flex items-center justify-center"
								class:ml-1={needsSpaceBefore(item, i,tabContent)}
								title="Proche, mais pas révélé"
								style={`min-width: ${Math.max(item.length, item.word.length)}ch; padding-right: 0.1em;`}
							>
								<span
									class="inline-block font-mono tracking-tight text-black"
									style="font-size: 1.5em; line-height: 1.25;"
								>
									{maskedSquares(item.length)}
								</span>
								<span
									class="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-xs font-semibold sm:text-sm"
									style={`color:${nearTextColor(item.score)}; text-shadow: 0 0 6px rgba(0,0,0,0.4);`}
								>
									{item.word}
								</span>
								<span
									class="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									{tooltipLabel(item.length)}
								</span>
							</span>
						{:else}
							<span
								class="group relative inline-flex items-center"
								class:ml-1={needsSpaceBefore(item, i,tabContent)}
							>
								<span
									class="inline-block font-mono tracking-tight text-black"
									style="font-size: 1.5em; padding-right: 0.1em;"
								>
									{maskedSquares(item as number)}
								</span>
								<span
									class="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									{tooltipLabel(item as number)}
								</span>
							</span>
						{/if}
					{/each}
				</p>
			</div>
			{#if tabguess.length > 0}
				<div
					class="mb-6 rounded-lg border-2 border-blue-400 bg-gradient-to-br from-purple-50 to-pink-50 p-6"
				>
					<div class="grid grid-cols-2 gap-x-8 gap-y-2">
						{#each tabguess as guess, index}
							<li class="text-gray-700">
								<span class="font-medium">{index + 1}.</span>
								{guess}
							</li>
						{/each}
					</div>
				</div>
			{/if}

			<GameActions
				isGameOver={isSurrender || isVictory}
				gradient="from-blue-700 via-blue-500 to-cyan-400"
				onNewGame={newGame}
				onSurrender={surrenderGame}
				surrenderDisabled={false}
			/>
		</div>
		<div class="w-full shrink-0 space-y-6 lg:w-80">
			<GameRules
				rules={[
					'Trouvez le mot mystère en vous aidant de la proximité sémantique',
					'Plus votre proposition est proche du mot, plus le pourcentage est élevé',
					'Chaque bonne proposition révèle des mots dans l\'extrait Wikipedia',
					'Utilisez les indices pour vous rapprocher du mot cible'
				]}
			/>

			<div class="flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
				<div class="w-full max-w-md">
					<div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
						<h2 class="mb-6 text-center text-2xl font-bold text-gray-800">Indices Mystère</h2>

						<div class="space-y-4">
							{#if !revealedIndice[0]}
								<button
									on:click={() => toggleReveal(0)}
									class="w-full rounded-lg border-2 border-black bg-white px-6 py-3 font-semibold text-black transition-all duration-200 hover:bg-gray-50 hover:shadow-md active:bg-gray-100"
								>
									Premier Indice
								</button>
							{:else}
								<div class="w-full rounded-lg border-2 border-black bg-gray-50 p-4">
									<h4>Catégorie de la page Wikipedia :</h4>
									<p class="text-gray-800">{hintsGame.categories[0]}</p>
								</div>
							{/if}
							{#if !revealedIndice[1]}
								<button
									on:click={() => toggleReveal(1)}
									class="w-full rounded-lg border-2 border-black bg-white px-6 py-3 font-semibold text-black transition-all duration-200 hover:bg-gray-50 hover:shadow-md active:bg-gray-100"
								>
									Deuxième Indice
								</button>
							{:else}
								<div class="w-full rounded-lg border-2 border-black bg-gray-50 p-4">
									<h4>Lien qui appartient a la page:</h4>
									<p class="text-gray-800">{hintsGame.links}</p>
								</div>
							{/if}
							{#if !revealedIndice[2]}
								<button
									on:click={() => toggleReveal(2)}
									class="w-full rounded-lg border-2 border-black bg-white px-6 py-3 font-semibold text-black transition-all duration-200 hover:bg-gray-50 hover:shadow-md active:bg-gray-100"
								>
									Troisième Indice
								</button>
							{:else}
								<div class="w-full rounded-lg border-2 border-black bg-gray-50 p-4">
									<h4>Intro sans le titre de la page :</h4>
									<p class="text-gray-800">{hintsGame.intro}</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
			{#if idUser}
				<GameStats
					stats={[
						{ label: 'Parties jouées', value: partiesJouees, color: 'text-blue-700' },
						{ label: 'Taux de réussite', value: `${Math.round(tauxReussite * 100)}%`, color: 'text-green-600' },
						{ label: 'Essais moyen', value: `${Math.round(essaisMoyen * 100) / 100}`, color: 'text-cyan-600' },
						{ label: 'Série actuelle', value: serieActuelle, color: 'text-blue-500' }
					]}
				/>
			{/if}
			<OtherGames exclude="pedantix" />
		</div>
	</div>
</div>
