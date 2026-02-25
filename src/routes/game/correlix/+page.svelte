<script lang="ts">
	import Header from '$lib/header.svelte';
	import OtherGames from '$lib/OtherGames.svelte';
	import { triggerConfettiAnimation, GameInput, GameActions, GameStats, GameRules, LoadingState, GameMessage } from '$lib';
	import { emitGameEvent } from '$lib/store/gameEventStore';
	import type { GameEventData } from '$lib/models/achievements';
	import { sessionStore } from '$lib/store/sessionStore';
	import { onMount } from 'svelte';

	let repbodyStats: {
		nbParties: number;
		nbEssaiMoyen: number;
		tauxReussite: number;
		serieActuelle: number;
	};
	const session = sessionStore.get();
	const idUser: number | null = session ? session.id : 0;

	let partiesJouees: number = 0;
	let tauxReussite: number = 0;
	let essaisMoyen: number = 0.0;
	let serieActuelle: number = 0;

	type Step = {
		word: string;
		similarityToTarget: number;
		similarityFromPrevious: number | null;
		deltaToTarget: number | null;
	};

	type GraphNode = {
		index: number;
		label: string;
		similarityToTarget: number;
		reached: boolean;
		isTarget: boolean;
		isGhostTarget: boolean;
		xPercent: number;
		y: number;
	};

	type GraphEdge = {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		similarity: number | null;
		isGhost: boolean;
		labelX: number;
		labelY: number;
	};

	let startWord = '';
	let targetWord = '';
	let path: Step[] = [];
	let minSimilarity = 25;
	let userWord = '';
	let message = '';
	let gameWon = false;
	let attempts = 0;
	let isLoading = false;
	let initializing = true;
	let errorType: string | null = null;
	let graphNodes: GraphNode[] = [];
	let graphEdges: GraphEdge[] = [];
	let activeIndex = 0;
	let canSubmit = false;
	let sessionId = '';
	let gameSurrendered = false;

	const GRAPH_TOP = 10;
	const GRAPH_BOTTOM = 50;

	$: graphNodes = buildGraphNodes();
	$: graphEdges = buildGraphEdges(graphNodes);
	$: canSubmit =
		Boolean(userWord.trim()) && !gameWon && !isLoading && !initializing && path.length > 0;
	$: {
		if (!path.length && activeIndex !== 0) {
			activeIndex = 0;
		} else if (path.length > 0 && activeIndex > path.length - 1) {
			activeIndex = path.length - 1;
		}
	}
	async function getStatistics() {
		try {
			const responseStats: Response = await fetch('/api/statistiques', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: idUser,
					gameType: 'correlix'
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

	async function newGame() {
		initializing = true;
		isLoading = false;
		gameWon = false;
		gameSurrendered = false;
		errorType = null;
		userWord = '';
		message = '';
		sessionId = '';

		try {
			const response = await fetch('/game/correlix/?userId=' + idUser, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			const data = await response.json();

			if (response.ok) {
				startWord = data.startWord;
				targetWord = data.targetWord;
				path = data.path ?? [];
				minSimilarity = data.minSimilarity;
				sessionId = data.sessionId ?? '';
				attempts = Math.max(path.length - 1, 0);
				activeIndex = Math.max(path.length - 1, 0);
				message =
					data.message ??
					"Reliez des concepts assez proches pour avancer, sans pouvoir atteindre directement l'objectif.";
			} else {
				message = data.message ?? 'Impossible de lancer une nouvelle partie.';
			}
		} catch (error) {
			console.error('Erreur newGame Correlix:', error);
			message = 'Erreur de communication avec le serveur.';
		} finally {
			initializing = false;
		}
	}

	async function surrenderGame() {
		gameSurrendered = true;
		gameWon = false;
		message = `Partie abandonnée. Le chemin était: ${path.map((p) => p.word).join(' → ')}`;
	}

	async function sendGuess() {
		const trimmedGuess = userWord.trim();
		if (!trimmedGuess) {
			return;
		}

		if (selectStepByWord(trimmedGuess)) {
			userWord = '';
			return;
		}

		if (gameWon || isLoading || initializing || !path.length || gameSurrendered) {
			return;
		}

		if (!sessionId) {
			message = 'Aucune partie active. Relancez une partie pour continuer.';
			errorType = 'no_session';
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/game/correlix/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userWord: trimmedGuess,
					anchorWord: path[activeIndex]?.word ?? null,
					sessionId
				})
			});

			const data = await response.json();

			if (response.status === 400) {
				message = data.message ?? 'Aucune partie active. Relancez une partie.';
				errorType = data.error ?? 'no_game';
				return;
			}

			if (!response.ok) {
				message = data.message ?? 'Erreur serveur.';
				errorType = data.error ?? 'server_error';
				return;
			}

			if (!data.success) {
				message = data.message ?? 'Proposition invalide.';
				errorType = data.error ?? 'invalid';
				userWord = '';
				return;
			}

			path = data.path ?? path;
			attempts = Math.max(path.length - 1, 0);
			message = data.message ?? '';
			errorType = null;
			userWord = '';
			activeIndex = Math.max(path.length - 1, 0);

			if (data.isWinner) {
				gameWon = true;
				triggerConfettiAnimation();

				
				const eventData: GameEventData = {
					userId: $sessionStore?.id ?? 0,
					type: 'correlix',
					won: true,
					attempts: attempts
				};
				emitGameEvent(eventData);
			}
		} catch (error) {
			console.error('Erreur sendGuess Correlix:', error);
			message = 'Erreur de communication avec le serveur.';
			errorType = 'network';
		} finally {
			isLoading = false;
		}
	}

	function selectStep(index: number, userInitiated = false) {
		if (!path.length) {
			activeIndex = 0;
			return;
		}

		const maxIndex = path.length - 1;
		const nextIndex = Math.min(Math.max(index, 0), maxIndex);

		if (userInitiated) {
			userWord = '';
			if (nextIndex === activeIndex) {
				if (activeIndex !== maxIndex) {
					activeIndex = maxIndex;
					message = `Retour à l'étape finale "${path[maxIndex].word}".`;
				}
				errorType = null;
				return;
			}
		}

		activeIndex = nextIndex;
		if (userInitiated) {
			message = `Étape ${nextIndex} sélectionnée. Continuez depuis "${path[nextIndex].word}".`;
			errorType = null;
		}
	}

	function selectStepByWord(word: string): boolean {
		if (!word || !path.length) {
			return false;
		}
		const normalized = word.trim().toLowerCase();
		const matchIndex = path.findIndex((step) => step.word.toLowerCase() === normalized);
		if (matchIndex !== -1) {
			selectStep(matchIndex, true);
			return true;
		}
		return false;
	}

	function getMessageStyle() {
		if (gameWon) {
			return 'border-green-400 bg-green-50 text-green-800';
		}
		if (errorType) {
			return 'border-amber-400 bg-amber-50 text-amber-800';
		}
		return 'border-blue-300 bg-blue-50 text-blue-800';
	}

	function formatPercent(value: number | null): string {
		if (value === null || Number.isNaN(value)) {
			return '--';
		}
		return `${value.toFixed(1)}%`;
	}

	function formatDelta(delta: number | null): string {
		if (delta === null || Number.isNaN(delta)) {
			return '';
		}
		const sign = delta > 0 ? '+' : '';
		return `${sign}${delta.toFixed(1)} pts`;
	}

	function getDeltaColor(delta: number | null): string {
		if (delta === null) {
			return 'text-gray-500';
		}
		if (delta > 0) {
			return 'text-green-600';
		}
		return 'text-rose-600';
	}

	function getSimilarityBadge(value: number): string {
		if (value == 100) {
			return 'border-green-500 bg-green-50 text-green-700';
		}
		if (value >= 25) {
			return 'border-orange-500 bg-orange-50 text-orange-700';
		}
		return 'border-gray-400 bg-gray-50 text-gray-700';
	}

	function clampPercent(value: number | null | undefined): number {
		if (value === null || value === undefined || Number.isNaN(value)) {
			return 0;
		}
		return Math.min(100, Math.max(0, value));
	}

	function mapSimilarityToY(value: number | null | undefined): number {
		const percent = clampPercent(value);
		const ratio = percent / 100;
		return GRAPH_BOTTOM - ratio * (GRAPH_BOTTOM - GRAPH_TOP);
	}

	function sameWord(a?: string, b?: string): boolean {
		if (!a || !b) {
			return false;
		}
		return a.trim().toLowerCase() === b.trim().toLowerCase();
	}

	function buildGraphNodes(): GraphNode[] {
		if (!path.length) {
			if (!startWord) {
				return [];
			}
			return [
				{
					index: 0,
					label: startWord,
					similarityToTarget: 0,
					reached: true,
					isTarget: false,
					isGhostTarget: false,
					xPercent: 50,
					y: GRAPH_BOTTOM
				}
			];
		}

		const nodes = path.map((step, index) => ({
			index,
			label: step.word,
			similarityToTarget: clampPercent(step.similarityToTarget),
			reached: true,
			isTarget: false,
			isGhostTarget: false,
			xPercent: 0,
			y: 0
		}));

		const lastNode = nodes.at(-1);
		const reachedTarget = lastNode && sameWord(lastNode.label, targetWord);
		if (reachedTarget && lastNode) {
			lastNode.isTarget = true;
			lastNode.similarityToTarget = 100;
		} else if (targetWord) {
			nodes.push({
				index: nodes.length,
				label: targetWord,
				similarityToTarget: 100,
				reached: false,
				isTarget: true,
				isGhostTarget: true,
				xPercent: 0,
				y: 0
			});
		}

		const total = nodes.length;
		return nodes.map((node, index) => ({
			...node,
			index,
			xPercent: total > 1 ? (index / (total - 1)) * 100 : 50,
			y: mapSimilarityToY(node.similarityToTarget)
		}));
	}

	function buildGraphEdges(nodes: GraphNode[]): GraphEdge[] {
		if (nodes.length < 2) {
			return [];
		}
		return nodes.slice(1).map((node, idx) => {
			const previous = nodes[idx];
			const pathIndex = idx + 1;
			const pathStep = path[pathIndex];
			const isGhost = pathIndex >= path.length;
			const similarity = pathStep
				? pathStep.similarityFromPrevious
				: (path.at(-1)?.similarityToTarget ?? null);
			return {
				x1: previous.xPercent,
				y1: previous.y,
				x2: node.xPercent,
				y2: node.y,
				similarity: similarity !== null ? clampPercent(similarity) : null,
				isGhost,
				labelX: (previous.xPercent + node.xPercent) / 2,
				labelY: Math.min(previous.y, node.y) - 3
			};
		});
	}

	function getNodeFill(node: GraphNode, index: number): string {
		if (node.isTarget) {
			return node.reached ? '#059669' : '#0ea5e9';
		}
		if (index === activeIndex) {
			return '#f97316';
		}
		if (index === 0) {
			return '#10b981';
		}
		return '#1d4ed8';
	}

	function getNodeStroke(node: GraphNode, index: number): string {
		if (node.isTarget && !node.reached) {
			return '#38bdf8';
		}
		if (index === activeIndex) {
			return '#fb923c';
		}
		return '#0f172a';
	}
</script>

<Header />
<div class="min-h-screen bg-gray-50 px-4 py-6 sm:p-8">
	<div class="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row">
		<!-- Contenu principal -->
		<div class="max-w-3xl flex-1">
			<div class="mb-8">
				<h1 class="mb-2 text-4xl font-bold text-gray-900">
					<i class="fa-solid fa-project-diagram mr-3 text-orange-600" aria-hidden="true"></i>
					Corrélix
				</h1>
				<p class="text-gray-600">
					Reliez progressivement <span class="font-semibold text-orange-600"
						>{startWord || '...'}</span
					>
					à <span class="font-semibold text-amber-600">{targetWord || '...'}</span> avec des mots suffisamment
					proches et de plus en plus corrélés.
				</p>
			</div>

			<div class="mb-8 grid gap-4 md:grid-cols-3">
				<div class="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
					<p class="text-sm tracking-wide text-gray-500 uppercase">Mot de départ</p>
					<p class="mt-2 text-3xl font-bold text-orange-600">{startWord || '...'}</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
					<p class="text-sm tracking-wide text-gray-500 uppercase">Mot objectif</p>
					<p class="mt-2 text-3xl font-bold text-amber-600">{targetWord || '...'}</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
					<p class="text-sm tracking-wide text-gray-500 uppercase">Étapes</p>
					<p class="mt-2 text-3xl font-bold text-gray-800">{attempts}</p>
					<p class="text-xs text-gray-500">Lien minimal {minSimilarity}%</p>
				</div>
			</div>

			{#if initializing}
				<LoadingState color="orange" message="Lancement du pont lexical..." />
			{:else}
				<div class="mb-8">
					<GameInput
						bind:value={userWord}
						placeholder={`Proposez un mot (>= ${minSimilarity}% avec le précédent)`}
						disabled={gameWon || gameSurrendered || isLoading || initializing}
						gradient="from-orange-600 via-amber-500 to-yellow-400"
						onsubmit={sendGuess}
					oninput={(value) => (userWord = value)}
				/>
			</div>

			{#if path.length > 0}
				<div class="mb-10 space-y-4">
					{#each path as step, index}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
								class={`cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition ${
									index === activeIndex
										? 'border-orange-400 ring-2 ring-orange-100'
										: 'border-gray-200 hover:border-gray-300'
								}`}
								role="button"
								tabindex="0"
								on:click={() => selectStep(index, true)}
							>
								<div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
									<div>
										<p class="text-xs tracking-wide text-gray-500 uppercase">
											Étape {index}
										</p>
										<p class="mt-1 text-2xl font-semibold text-gray-900 capitalize">{step.word}</p>
									</div>
									<div class="flex flex-wrap gap-3 text-sm">
										<div
											class={`rounded-full border px-4 py-2 font-semibold ${getSimilarityBadge(step.similarityToTarget)}`}
										>
											Vers objectif {formatPercent(step.similarityToTarget)}
										</div>
										{#if step.similarityFromPrevious !== null}
											<div
												class="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 font-medium text-gray-700"
											>
												Lien avec le mot précédent {formatPercent(step.similarityFromPrevious)}
											</div>
										{/if}
										{#if index > 0}
											<div
												class={`rounded-full bg-white px-4 py-2 font-semibold ${getDeltaColor(step.deltaToTarget)}`}
											>
												{formatDelta(step.deltaToTarget)}
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if graphNodes.length > 0}
					<div class="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Pont lexical</h3>
						<svg class="h-48 w-full" viewBox="0 0 100 60" preserveAspectRatio="none">
							<defs>
								<linearGradient id="bridge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
									<stop offset="0%" stop-color="#ea580c" />
									<stop offset="50%" stop-color="#f59e0b" />
									<stop offset="100%" stop-color="#fbbf24" />
								</linearGradient>
							</defs>
							{#each graphEdges as edge}
								<line
									x1={edge.x1}
									y1={edge.y1}
									x2={edge.x2}
									y2={edge.y2}
									stroke={edge.isGhost ? '#fed7aa' : 'url(#bridge-gradient)'}
									stroke-width="1.8"
									stroke-dasharray={edge.isGhost ? '5 3' : null}
									stroke-linecap="round"
								/>
								{#if edge.similarity !== null}
									<text
										x={edge.labelX}
										y={Math.max(edge.labelY, GRAPH_TOP + 2)}
										text-anchor="middle"
										class="fill-gray-500"
										style="font-size:2.8px;font-weight:500;"
									>
										{formatPercent(edge.similarity)}
									</text>
								{/if}
							{/each}
							{#each graphNodes as node, index}
								<circle
									cx={node.xPercent}
									cy={node.y}
									r="3.5"
									fill={getNodeFill(node, index)}
									stroke={getNodeStroke(node, index)}
									stroke-width={node.isTarget ? 1.6 : 1.2}
								/>
								<text
									x={node.xPercent}
									y={node.y - 5}
									text-anchor="middle"
									class="fill-gray-500"
									style="font-size:2.6px;font-weight:600;"
								>
									{formatPercent(node.similarityToTarget)}
								</text>
								<text
									x={node.xPercent}
									y={GRAPH_BOTTOM + 8}
									text-anchor="middle"
									class={node.isTarget ? 'fill-amber-700' : 'fill-gray-700'}
									style="font-size:3.2px;font-weight:600;"
								>
									{node.label}
								</text>
							{/each}
						</svg>
						<p class="mt-3 text-xs text-gray-500">
							Hauteur proportionnelle à la proximité avec le mot objectif. La portion en pointillés
							représente le reste du pont jusqu'au but.
						</p>
					</div>
				{/if}

				{#if message}
					<GameMessage type="info" message={message} />
				{/if}
			{/if}

			<GameActions
				isGameOver={gameWon || gameSurrendered}
				gradient="from-orange-600 via-amber-500 to-yellow-400"
				onNewGame={newGame}
				onSurrender={surrenderGame}
				surrenderDisabled={false}
			/>
		</div>

		<!-- Sidebar droite -->
		<div class="w-full shrink-0 space-y-6 lg:w-80">
			<!-- Règles -->
			<GameRules
				rules={[
					`Chaque nouveau mot doit être à au moins ${minSimilarity}% du précédent.`,
					'Vous pouvez cliquer sur n\'importe quelle étape pour repartir de là.',
					'Les mots inconnus du modèle ne sont pas acceptés.',
					'Atteignez le mot objectif pour compléter le pont lexical.'
				]}
			/>
			{#if idUser}
				<GameStats
					stats={[
						{ label: 'Parties jouées', value: partiesJouees, color: 'text-blue-700' },
						{ label: 'Taux de réussite', value: `${Math.round(tauxReussite * 100)}%`, color: 'text-green-600' },
						{ label: 'Étapes moyennes', value: `${Math.round(essaisMoyen * 100) / 100}`, color: 'text-cyan-600' },
						{ label: 'Série actuelle', value: serieActuelle, color: 'text-blue-500' }
					]}
				/>
			{/if}
			<OtherGames exclude="correlix" />
		</div>
	</div>
</div>
