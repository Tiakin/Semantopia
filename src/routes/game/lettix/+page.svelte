<script lang="ts">
	import Header from '$lib/header.svelte';
	import { onMount } from 'svelte';
	import { sessionStore } from '$lib/store/sessionStore';
	import { emitGameEvent } from '$lib/store/gameEventStore';
	import type { GameEventData } from '$lib/models/achievements';
	import OtherGames from '$lib/OtherGames.svelte';
	import { GameInput, GameActions, GameStats, GameRules, LoadingState, TimeAnimation, GameMessage } from '$lib';
	
	let nbAnagramsFind: number = 0;
	let isLoading: boolean = true;
	let userGuess: string = '';
	let isSurrender: boolean = false;
	const session = sessionStore.get();
	const idUser: number | null = session ? session.id : 0;
	let totalGamePlayed: number = 0;
	let findAnagramsAverage: number = 0;
	let findMaxAnagrams: number = 0;
	let wordShuffleFind: string = '';
	let count: number = 60;
	let sessionId: string = '';
	let findAnagrams: boolean;
	let tabAnagramsFind: string[] = [];
	let isGameOver: boolean = false;
	let wordToFind: string = '';
	let disabledButton: boolean = false;

	let interval: ReturnType<typeof setInterval> | null = null;

	let showTimeAnimation: boolean = false;
	let timeChangeValue: number = 0;

	async function newGame() {
		disabledButton = false;
		nbAnagramsFind = 0;
		count = 60;
		isLoading = true;
		isGameOver = false;
		tabAnagramsFind = [];
		showTimeAnimation = false;
		if (interval !== null) {
			clearInterval(interval);
		}
		if (idUser === null) {
			console.error('idUser est null');
			return;
		}
		const url = `/game/lettix?userId=${encodeURIComponent(idUser)}`;
		const response = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
		const data = await response.json();
		wordShuffleFind = data.wordShuffle;
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
	async function sendGuess() {
		const response = await fetch('/game/lettix', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userGuess,
				sessionId
			})
		});

		const data = await response.json();
		findAnagrams = data.isWin;
		if (findAnagrams == true) {
			nbAnagramsFind++;
			tabAnagramsFind = [...tabAnagramsFind, userGuess];
			wordShuffleFind = data.newWordShuffle;
			count += 15;
			triggerTimeAnimation(15);
		} else {
			count -= 5;
			triggerTimeAnimation(-5);
		}
		userGuess = '';
	}
	async function gameOver() {
		isGameOver = true;
		disabledButton = true;
		const response = await fetch('/game/lettix', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				idUser,
				score: nbAnagramsFind,
				sessionId
			})
		});
		const data = await response.json();
		wordToFind = data.wordToFind;
		const eventData: GameEventData = {
			userId: idUser ?? 0,
			type: 'lettix',
			attempts: nbAnagramsFind
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
					gameType: 'lettix'
				})
			});
			const data = await response.json();
			totalGamePlayed = data.nbParties ?? 0;
			findAnagramsAverage = data.scoreMoyen ?? 0;
			findMaxAnagrams = data.scoreMax ?? 0;
		}
	}
	async function skipLetters() {
		const response = await fetch('/game/lettix', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				action: 'skipLetters'
			})
		});
		const data = await response.json();
		wordShuffleFind = data.newWordShuffle;
		count -= 5;
		triggerTimeAnimation(-5);
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
						<i class="fa-solid fa-bolt mr-3 text-violet-600" aria-hidden="true"></i>
						Lettix
					</h1>
					<p class="mt-1 text-gray-600">Trouvez un maximum d'anagrammes en 60 secondes</p>
					<h2 class="text-1xl font-semibold">Mot à déchiffrer : {wordShuffleFind}</h2>
					{#if !isGameOver}
						<div class="flex items-center gap-4">
							<h2 class="text-1xl font-semibold">Temps restants : {count}</h2>
							<TimeAnimation show={showTimeAnimation} value={timeChangeValue} />
						</div>
					{/if}
				</div>
			</div>
			
			{#if isLoading}
				<LoadingState color="violet" />
			{/if}
			
			{#if isGameOver}
				<GameMessage message="Partie terminée, vous avez deviné {nbAnagramsFind} annagrammes. Le dernier mot était {wordToFind}." />
			{/if}
			
			<div class="row relative mb-6">
				<GameInput 
					bind:value={userGuess}
					disabled={isSurrender}
					gradient="from-violet-600 via-fuchsia-500 to-pink-300"
					onsubmit={sendGuess}
					oninput={(val) => userGuess = val}
				/>
			</div>

			{#if tabAnagramsFind.length > 0}
				<div class="mb-6 rounded-lg bg-white p-6 shadow-sm">
					<h4 class="mb-4 flex items-center text-lg font-semibold text-gray-900">
						✅ Anagrammes trouvés ({tabAnagramsFind.length})
					</h4>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{#each tabAnagramsFind as word, index}
							<div
								class="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2"
							>
								<span class="text-sm font-medium text-violet-700">#{index + 1}</span>
								<span class="font-semibold text-violet-900">{word}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<GameActions 
				isGameOver={isGameOver}
				gradient="from-violet-600 via-fuchsia-500 to-pink-300"
				onNewGame={newGame}
				onSurrender={() => {isSurrender = true; gameOver();}}
				surrenderDisabled={disabledButton}
				additionalButtons={[
					{
						label: '🔄 Changer d\'anagrammes',
						onClick: skipLetters,
						gradient: 'from-violet-600 via-fuchsia-500 to-pink-300',
						disabled: disabledButton
					}
				]}
			/>
		</div>
		<div class="w-full shrink-0 space-y-6 lg:w-80">
			<GameRules 
				rules={[
					'Trouver le mot en déchiffrant l\'annagramme',
					'Vous gagnez du temps ou en perdez en fonction de votre réponse'
				]}
			/>
			
			{#if idUser}
				<GameStats 
					stats={[
						{ label: 'Parties jouées', value: totalGamePlayed, color: 'text-purple-600' },
						{ label: 'Nombre d\'annagrammes trouvés en moyenne', value: Math.round(findAnagramsAverage * 100) / 100, color: 'text-blue-600' },
						{ label: 'Nombre d\'annagrammes trouvés le plus', value: findMaxAnagrams, color: 'text-blue-600' }
					]}
				/>
			{/if}

			<OtherGames exclude="lettix" />
		</div>
	</div>
</div>
