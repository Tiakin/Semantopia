<script lang="ts">
	import Header from '$lib/header.svelte';
	import OtherGames from '$lib/OtherGames.svelte';
	import { onMount } from 'svelte';
	import { triggerConfettiAnimation, GameInput, GameActions, GameStats, GameRules, LoadingState, GameMessage } from '$lib';
	import { sessionStore } from '$lib/store/sessionStore';
	import { emitGameEvent } from '$lib/store/gameEventStore';
	import type { GameEventData } from '$lib/models/achievements';
	import { writable } from 'svelte/store';

	let letters = 'AZERTYUIOPQSDFGHJKLMWXCVBN'.split('');
	$: letterColors =
		$tabGuesses.length > 0
			? letters.map((letter) => getKeyboardLetterColor(letter))
			: Array(letters.length).fill('bg-gray-300 text-black');
	const session = sessionStore.get();
	const userId: number | null = session ? session.id : null;
	let nbEssai = 0;
	let isLoading = true;
	let userGuess = '';
	let isDisabled = false;
	let isSurrender = false;
	let isLoose = false;
	let isWin = false;
	let isWordExist = true;
	let isWrongLength = false;
	let tabWordFind: string[] = [];
	let categorieWord: string = '';
	let similarWord: string = '';
	const tabGuesses = writable<string[][]>([]);

	let revealedIndice = [false, false, false];

	function toggleReveal(index: number) {
		revealedIndice[index] = !revealedIndice[index];
	}

	let nbParties: number = 0;
	let tauxReussite: number = 0;
	let nbEssaiMoyen: number = 0;
	let serieActuelle: number = 0;

	let repbodyStats: {
		nbParties: number;
		nbEssaiMoyen: number;
		tauxReussite: number;
		serieActuelle: number;
	};

	async function newGame() {
		revealedIndice = [false, false, false];
		tabGuesses.set([]);
		isDisabled = false;
		isWin = false;
		nbEssai = 0;
		isLoose = false;
		isLoading = true;
		const WordLength = Math.floor(Math.random() * (8 - 5) + 5);

		try {
			const response = await fetch('/game/motix', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sizeWord: WordLength,
					userId: userId
				})
			});
			const data = await response.json();

			tabWordFind = data.tabWord;
			categorieWord = data.findCategorie;
			similarWord = data.similarWord;
			isLoading = false;
			isSurrender = true;
			userGuess = '';
		} catch (error) {
			return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
				status: 500
			});
		}
	}

	async function sendGuess() {
		isWordExist = true;
		isWrongLength = false;
		
		// Validate word length
		const normalizedGuess = userGuess
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		
		if (normalizedGuess.length !== tabWordFind.length) {
			isWrongLength = true;
			return null;
		}
		
		try {
			const response = await fetch(`/game/motix?word=${encodeURIComponent(userGuess)}`);
			const data = await response.json();
			if (!data.exists) {
				isWordExist = false;
				return null;
			}
		} catch (error) {
			console.error('Erreur lors de la vérification du mot:', error);
			isWordExist = false;
			return null;
		}

		nbEssai++;
		tabGuesses.update((g) => [
			...g,
			userGuess
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase()
				.split('')
		]);
		letterColors = letters.map((letter) => getKeyboardLetterColor(letter));
		const cleanGuess = userGuess
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.split('');
		const isCorrect = cleanGuess.every((letter, i) => letter === tabWordFind[i]);
		if (isCorrect) {
			victoryGame();
			triggerConfettiAnimation();
			isDisabled = true;
			return null;
		}
		if (nbEssai == 5) {
			isLoose = true;
			isDisabled = true;
			return null;
		}

		userGuess = '';
	}
	function getLetterClass(letter: string, index: number, guess: string[]) {
		if (!tabWordFind || tabWordFind.length === 0) return 'bg-gray-500 text-white';

		if (!tabWordFind.includes(letter)) {
			return 'bg-gray-500 text-white';
		}

		if (tabWordFind[index] === letter) {
			return 'bg-green-500 text-white';
		}

		const countInWord = tabWordFind.filter((l) => l === letter).length;

		const countGreen = guess.filter((l, i) => l === letter && tabWordFind[i] === letter).length;

		const countYellowBefore = guess
			.slice(0, index)
			.filter((l, i) => l === letter && tabWordFind[i] !== letter).length;

		if (countGreen + countYellowBefore >= countInWord) {
			return 'bg-gray-500 text-white';
		}

		return 'bg-yellow-500 text-white';
	}

	async function surrenderGame() {
		isLoose = true;
		isSurrender = false;
		isDisabled = true;
		if (userId) {
			await fetch('/game/motix', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nbEssai: nbEssai,
					isVictory: isWin,
					idUser: userId
				})
			});
			getStats();
		}
	}
	async function victoryGame() {
		isSurrender = false;
		isWin = true;
		if (userId) {
			await fetch('/game/motix', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nbEssai: nbEssai,
					isVictory: isWin,
					idUser: userId
				})
			});
			getStats();

			const eventData: GameEventData = {
				userId: userId,
				type: 'motix',
				won: true,
				attempts: nbEssai
			};
			emitGameEvent(eventData);
		}
	}

	async function getStats() {
		if (userId) {
			const response = await fetch('/api/statistiques/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: userId,
					gameType: 'motix'
				})
			});
			repbodyStats = await response.json();
			nbParties = repbodyStats.nbParties ?? 0;
			tauxReussite = repbodyStats.tauxReussite ?? 0;
			nbEssaiMoyen = repbodyStats.nbEssaiMoyen ?? 0;
			serieActuelle = repbodyStats.serieActuelle ?? 0;
		}
	}

	function getKeyboardLetterColor(letter: string) {
		let bestColor = 'bg-gray-300 text-black';
		const normalizedLetter = letter.toLowerCase();
		$tabGuesses.forEach((guess) => {
			guess.forEach((guessLetter, index) => {
				if (guessLetter !== normalizedLetter) return;

				if (tabWordFind[index] === normalizedLetter) {
					bestColor = 'bg-green-500 text-white';
				} else if (tabWordFind.includes(normalizedLetter) && !bestColor.includes('bg-green-500')) {
					bestColor = 'bg-yellow-500 text-white';
				} else if (
					!tabWordFind.includes(normalizedLetter) &&
					bestColor === 'bg-gray-300 text-black'
				) {
					bestColor = 'bg-gray-500 text-white';
				}
			});
		});

		return bestColor;
	}

	onMount(() => {
		newGame();
		getStats();
	});
</script>

<Header />

<div class="min-h-screen bg-gray-50 px-4 py-6 sm:p-8">
	<div class="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row">
		<div class="max-w-3xl flex-1">
			<div class="mb-6">
				<div class="mb-8">
					<h1 class="mb-2 text-4xl font-bold text-gray-900">
						<i class="fa-solid fa-keyboard mr-3 text-emerald-600" aria-hidden="true"></i>
						Motix
					</h1>
					<p class="mt-1 text-gray-600">
						En cinq essais maximum, trouver le mot grâce à la position des lettres des mots proposés
					</p>
					<p class="mt-2 text-sm text-gray-500">Essais : {nbEssai}</p>
					<p>Le mot contient {tabWordFind.length} lettres</p>
				</div>
			</div>
			{#if isLoading}
				<LoadingState color="emerald" />
			{/if}
			{#if isLoose}
				<GameMessage message="Perdu, le mot était {tabWordFind.join('')}" type="defeat" />
			{/if}
			{#if isWin}
				<GameMessage message="Félicitations vous avez gagner en {nbEssai} essais" type="victory" />
			{/if}
	{#if isWrongLength}
		<div class="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-6">
			<svg
				class="h-6 w-6 flex-shrink-0 text-red-600"
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
				<p class="font-semibold text-red-900">Longueur incorrecte</p>
				<p class="text-sm text-red-700">Le mot doit contenir exactement {tabWordFind.length} lettres</p>
			</div>
		</div>
	{/if}
	{#if !isWordExist}
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
				<p class="text-sm text-amber-700">Ce mot n'existe pas dans notre vocabulaire</p>
			</div>
		</div>
	{/if}			<div class="row relative mb-6">
				<GameInput
					bind:value={userGuess}
					gradient="from-emerald-700 via-green-500 to-lime-400"
					disabled={isDisabled}
					onsubmit={sendGuess}
					oninput={(value) => (userGuess = value)}
					maxlength={tabWordFind.length}
					minlength={tabWordFind.length}
				/>
			</div>
			<div class="mb-6 rounded-lg p-6">
				<div class="space-y-2">
					{#each $tabGuesses as guess}
						<div class="flex space-x-1">
							{#each guess as letter, i}
								<div
									class={`flex h-9 w-9 items-center justify-center rounded text-lg font-bold sm:h-10 sm:w-10 sm:text-xl ${getLetterClass(letter, i, guess)}`}
								>
									{letter.toUpperCase()}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
			<div class="mx-auto mt-10 mb-10 flex max-w-2xl flex-wrap justify-center gap-2 sm:mt-16 sm:mb-12">
				{#each letters as letter, i}
					<div
						class="flex h-10 w-10 cursor-pointer items-center justify-center rounded select-none sm:h-12 sm:w-12 {letterColors[
							i
						]}"
					>
						{letter}
					</div>
				{/each}
			</div>
			<GameActions
				gradient="from-emerald-700 via-green-500 to-lime-400"
				isGameOver={isDisabled}
				onNewGame={newGame}
				onSurrender={surrenderGame}
				surrenderDisabled={isDisabled}
				onShare={() => {}}
			/>
		</div>
		<div class="w-full shrink-0 space-y-6 lg:w-80">
			<GameRules
				rules={[
					'Trouver le mot mystère dont la longuer est de 5 à 8 lettres en un minimum d\'essais.',
					'À chaque essai, tu proposes un mot de la même longueur',
					'Les lettres bien placées apparaissent en rouge. Les lettres présentes mais mal placées apparaissent en jaune. Les lettres absentes restent grises.',
					'Tu gagnes si tu trouves le mot avant d\'avoir épuisé 5 essais'
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
									<h4>Catégorie du mot :</h4>
									<p class="text-gray-800">{categorieWord}</p>
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
									<h4>Premier lettre du mot :</h4>
									<p class="text-gray-800">{tabWordFind[0]}</p>
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
									<h4>Mot similaire</h4>
									<p class="text-gray-800">{similarWord}</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
			{#if userId}
				<GameStats
					stats={[
						{ label: 'Parties jouées', value: nbParties, color: 'text-emerald-600' },
						{ label: 'Taux de réussite', value: `${Math.round(tauxReussite * 100)}%`, color: 'text-green-600' },
						{ label: 'Essais moyen', value: Math.round(nbEssaiMoyen * 100) / 100, color: 'text-lime-600' },
						{ label: 'Série actuelle', value: serieActuelle, color: 'text-green-500' }
					]}
				/>
			{/if}

			<OtherGames exclude="motix" />
		</div>
	</div>
</div>
