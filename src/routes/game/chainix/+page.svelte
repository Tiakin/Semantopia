<script lang="ts">
	import Header from '$lib/header.svelte';
	import OtherGames from '$lib/OtherGames.svelte';
	import { onMount } from 'svelte';
	import { sessionStore } from '$lib/store/sessionStore';
	import { emitGameEvent } from '$lib/store/gameEventStore';
	import type { GameEventData } from '$lib/models/achievements';
	import { GameInput, GameActions, GameStats, GameRules, LoadingState, TimeAnimation, GameMessage } from '$lib';

	let nbWordCreate: number = 0;
	let isLoading: boolean = true;
	let userGuess: string = '';
	let isSurrender: boolean = false;
	const session = sessionStore.get();
	const idUser: number | null = session ? session.id : 0;
	let sessionId: string = '';
	let isWordValid: boolean;
	let chainWords: string[] = [];
	let guessedWords: Set<string> = new Set();
	let isGameOver: boolean = false;
	let interval: ReturnType<typeof setInterval> | null = null;
	let showTimeAnimation: boolean = false;
	let timeChangeValue: number = 0;
	let count = 60;
	let startingWord: string = '';
	let totalGamePlayed: number = 0;
	let wordCreateAverage: number = 0;
	let wordCreateMax: number = 0;
	let disabledButton: boolean = false;

	async function newGame() {
		userGuess = '';
		nbWordCreate = 0;
		count = 60;
		isLoading = true;
		isGameOver = false;
		isSurrender = false;
		disabledButton = false;
		chainWords = [];
		guessedWords = new Set();
		showTimeAnimation = false;
		if (interval !== null) {
			clearInterval(interval);
		}
		if (idUser === null) {
			console.error('idUser est null');
			return;
		}
		const url = `/game/chainix?userId=${encodeURIComponent(idUser)}`;
		const response = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
		const data = await response.json();
		startingWord = data.startingWord;
		chainWords = [startingWord];
		sessionId = data.sessionId;
		isLoading = false;

		interval = setInterval(() => {
			count--;
			if (count <= 0) {
				if (interval !== null) {
					clearInterval(interval);
					interval = null;
				}
				gameOver();
			}
		}, 1000);
	}
	const normalizeWord = (word: string) =>
		word
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase();

	async function sendGuess() {
		const cleanGuess = userGuess.trim();
		if (!cleanGuess) return;

		const normalizedGuess = normalizeWord(cleanGuess);
		if (guessedWords.has(normalizedGuess)) {
			count -= 5;
			triggerTimeAnimation(-5);
			userGuess = '';
			return null;
		}
		const response = await fetch('/game/chainix', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userGuess: cleanGuess,
				sessionId,
				currentLastWord: chainWords[chainWords.length - 1]
			})
		});

		const data = await response.json();
		isWordValid = data.isValid;
		if (isWordValid) {
			nbWordCreate++;
			chainWords = [...chainWords, cleanGuess];
			guessedWords.add(normalizedGuess);
			let timeBonus = data.timeBonus;
			count += timeBonus;
			triggerTimeAnimation(timeBonus);
		} else {
			count -= 5;
			triggerTimeAnimation(-5);
		}
		userGuess = '';
	}
	async function gameOver() {
		isGameOver = true;
		isSurrender = true;
		disabledButton = true;
		await fetch('/game/chainix', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				idUser,
				score: chainWords.length - 1
			})
		});

		const eventData: GameEventData = {
			userId: idUser ?? 0,
			type: 'chainix',
			score: nbWordCreate
		};
		emitGameEvent(eventData);
	}

	function triggerTimeAnimation(value: number) {
		timeChangeValue = value;
		showTimeAnimation = true;
		setTimeout(() => {
			showTimeAnimation = false;
		}, 1000);
	}
	async function getStats() {
		if (idUser) {
			const response = await fetch('/api/statistiques/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: idUser,
					gameType: 'chainix'
				})
			});
			const data = await response.json();
			totalGamePlayed = data.nbParties ?? 0;
			wordCreateAverage = data.scoreMoyen ?? 0;
			wordCreateMax = data.scoreMax ?? 0;
		}
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
						<i class="fa-solid fa-link mr-3 text-teal-600" aria-hidden="true"></i>
						Chainix
					</h1>
					<p class="mt-1 text-gray-600">
						Créer la plus longue chaîne en 60 secondes. Chaque fin de mot devient le début du
						suivant.
					</p>
					<h2 class="text-1xl font-semibold">
						Mot actuel : <span class="text-purple-600">{chainWords[chainWords.length - 1]}</span>
					</h2>
					{#if !isGameOver}
						<div class="flex items-center gap-4">
							<h2 class="text-1xl font-semibold">Temps restants : {count}</h2>
							{#if showTimeAnimation}
								<span
									class="animate-bounce-up text-3xl font-bold {timeChangeValue > 0
										? 'text-green-600'
										: 'text-red-600'}"
								>
									{timeChangeValue > 0 ? '+' : ''}{timeChangeValue}s
								</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>
			{#if isLoading}
				<LoadingState color="teal" />
			{/if}
			{#if isGameOver}
				<GameMessage message="Partie terminée, chaîne de {chainWords.length - 1} mots." />
			{/if}
			<div class="row relative mb-6">
				<GameInput 
					bind:value={userGuess}
					disabled={isSurrender}
					gradient="from-teal-600 via-cyan-500 to-sky-400"
					onsubmit={sendGuess}
					oninput={(val) => userGuess = val}
				/>
			</div>

			<div>
				{#if chainWords.length > 1}
					<div class="mb-6 rounded-lg bg-white p-6 shadow-sm">
						<h4 class="mb-4 flex items-center text-lg font-semibold text-gray-900">
							✅ Chaîne de mots ({chainWords.length - 1})
						</h4>
						<div class="flex flex-wrap items-center gap-2">
							{#each chainWords as word, index}
								<div class="flex items-center gap-2">
									<div
										class="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 font-semibold text-teal-900"
									>
										{word}
									</div>
									{#if index < chainWords.length - 1}
										<span class="text-lg font-bold text-teal-600">→</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<GameActions 
				isGameOver={isGameOver}
				gradient="from-teal-600 via-cyan-500 to-sky-400"
				onNewGame={newGame}
				onSurrender={() => {isSurrender = true; gameOver();}}
				surrenderDisabled={disabledButton}
			/>
		</div>
		<div class="w-full shrink-0 space-y-6 lg:w-80">
<GameRules 
			rules={[
				'Créer la plus longue chaîne de mots en 60 secondes',
				'Chaque mot doit commencer par les 2 ou 3 dernières lettres du mot précédent',
				'Les mots doivent exister dans le dictionnaire',
				'Vous gagnez du temps (2-4s) pour chaque mot trouvé',
				'Vous perdez 5 secondes pour chaque mot invalide',
				'Vous ne pouvez pas utiliser deux fois le même mot',
				'Chaque partie démarre avec un nouveau mot de départ'
			]}
		/>

		{#if idUser}
			<GameStats 
				stats={[
					{ label: 'Parties jouées', value: totalGamePlayed, color: 'text-purple-600' },
					{ label: 'Longueur moyenne de la chaîne', value: Math.round(wordCreateAverage * 100) / 100, color: 'text-blue-600' },
					{ label: 'Longueur maximale d\'une chaîne créé', value: wordCreateMax, color: 'text-blue-600' }
				]}
			/>
			{/if}

			<OtherGames exclude="chainix" />
		</div>
	</div>
</div>

<style>
	@keyframes bounce-up {
		0% {
			opacity: 0;
			transform: translateY(0);
		}
		50% {
			opacity: 1;
			transform: translateY(-20px);
		}
		100% {
			opacity: 0;
			transform: translateY(-40px);
		}
	}

	.animate-bounce-up {
		animation: bounce-up 1s ease-out;
	}
</style>
