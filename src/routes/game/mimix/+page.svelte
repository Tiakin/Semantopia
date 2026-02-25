<script lang="ts">
	import Header from '$lib/header.svelte';
	import OtherGames from '$lib/OtherGames.svelte';
	import { onMount } from 'svelte';
	import { sessionStore } from '$lib/store/sessionStore';
	import { emitGameEvent } from '$lib/store/gameEventStore';
	import type { GameEventData } from '$lib/models/achievements';
	import { GameActions, GameStats, GameRules, LoadingState, GameMessage } from '$lib';
	let nbIntruderFind: number = 0;
	let isLoading: boolean = true;
	const session = sessionStore.get();
	const idUser: number | null = session ? session.id : 0;
	let sessionId: string = '';
	let isGameOver: boolean = false;
	let tabShuffleWord: string[] = [];
	let wordIntruder: string = '';
	let foundIntruder: boolean;
	let totalGamePlayed: number = 0;
	let averageWordFind: number = 0;
	let maxWordFind: number = 0;
	let disabledButton: boolean = true;
	let isGuessing: boolean = false;

	async function newGame() {
		isLoading = true;
		isGameOver = false;
		disabledButton = true;
		nbIntruderFind = 0;
		if (idUser === null) {
			console.error('idUser est null');
			return;
		}
		const url = `/game/mimix?userId=${encodeURIComponent(idUser)}`;
		const response = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
		const data = await response.json();
		sessionId = data.sessionId;
		tabShuffleWord = data.tabShuffleWord;
		isLoading = false;
	}
	async function sendGuess(word: string) {
		if (isGuessing) return;
		isGuessing = true;
		try {
			const response = await fetch('/game/mimix', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					word,
					sessionId
				})
			});

			const data = await response.json();
			foundIntruder = data.isWin;
			if (foundIntruder) {
				nbIntruderFind++;
				tabShuffleWord = data.newTabShuffleWord;
			} else {
				gameOver();
			}
		} finally {
			isGuessing = false;
		}
	}
	async function gameOver() {
		isGameOver = true;
		disabledButton = false;
		const response = await fetch('/game/mimix', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				idUser,
				score: nbIntruderFind,
				sessionId
			})
		});
		const data = await response.json();
		wordIntruder = data.wordIntruder;

		const eventData: GameEventData = {
			userId: idUser ?? 0,
			type: 'mimix',
			score: nbIntruderFind
		};
		emitGameEvent(eventData);
	}

	async function surrenderGame() {
		await gameOver();
	}

	async function getStats() {
		if (idUser) {
			const response = await fetch('/api/statistiques/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: idUser,
					gameType: 'mimix'
				})
			});
			const data = await response.json();
			totalGamePlayed = data.nbParties ?? 0;
			averageWordFind = data.scoreMoyen ?? 0;
			maxWordFind = data.scoreMax ?? 0;
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
						<i class="fa-solid fa-question mr-3 text-rose-700" aria-hidden="true"></i>
						Mimix
					</h1>
					<p class="mt-1 text-gray-600">
						Trouvez le plus de fois l'intrus parmi les 4 propositions
					</p>
					<p>Nombre d'intrus trouvés : {nbIntruderFind}</p>
				</div>
			</div>
			{#if isLoading}
				<LoadingState color="rose" />
			{/if}
			{#if isGameOver}
				<GameMessage message="Partie terminée, vous avez deviné {nbIntruderFind} intrus. Le dernier intrus était {wordIntruder}." />
			{/if}

			<div class="mb-8">
				{#if tabShuffleWord.length > 0}
					<div class="mx-auto grid max-w-2xl grid-cols-2 gap-4">
						{#if !isLoading}
							{#each tabShuffleWord as word}
								<button
									onclick={() => sendGuess(word)}
									class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-700 via-red-500 to-orange-300 p-6 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isGameOver || isGuessing}
								>
									<div
										class="absolute inset-0 bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-10"
									></div>
									<span class="relative text-2xl font-bold tracking-wide">{word}</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			<GameActions 
				isGameOver={isGameOver}
				gradient="from-rose-700 via-red-500 to-orange-300"
				onNewGame={newGame}
				onSurrender={surrenderGame}
				surrenderDisabled={false}
			/>
		</div>

		<div class="w-full shrink-0 space-y-6 lg:w-80">
			<GameRules 
				rules={[
					'Trouvez le plus de fois l\'intrus parmi les 4 propositions',
					'Au fur et à mesure les mots sont de moins en moins proches'
				]}
			/>
			{#if idUser}
				<GameStats 
					stats={[
						{ label: 'Parties jouées', value: totalGamePlayed, color: 'text-purple-600' },
						{ label: 'Nombre de mots créés en moyenne', value: Math.round(averageWordFind * 100) / 100, color: 'text-blue-600' },
						{ label: 'Nombre de mots créés le plus', value: maxWordFind, color: 'text-blue-600' }
					]}
				/>
			{/if}

			<OtherGames exclude="mimix" />
		</div>
	</div>
</div>
