<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClassementEntry, ClassementType } from '$lib/types/leaderboard';
	import { getClassement } from '$lib/utils/leaderboardLogic';
	const leaderboardTypes = [
		{ type: 'mostGamePlayed' as ClassementType, label: 'Parties jouées' },
		{ type: 'mostAchievements' as ClassementType, label: 'Succès obtenus' },
		{ type: 'mostVictory' as ClassementType, label: 'Victoires' }
	];

	let classement: ClassementEntry[] = [];
	let activeType: ClassementType = 'mostGamePlayed';
	async function loadLeaderboard(type: ClassementType) {
		try {
			activeType = type;
			classement = await getClassement(type);
		} catch (err) {
			console.error('Erreur chargement classement:', err);
			classement = [];
		}
	}
	onMount(() => {
		loadLeaderboard(activeType);
	});
	$: top3 = classement.slice(0, 3);
	$: others = classement.slice(3, 10);
</script>

<section class="mx-auto max-w-5xl px-4 py-6 sm:py-8">
	<div class="mb-12 flex flex-wrap justify-center gap-4">
		{#each leaderboardTypes as { type, label }}
			<button
				on:click={() => loadLeaderboard(type)}
				class="flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all duration-200 {activeType ===
				type
					? 'scale-105 bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg'
					: 'bg-white text-gray-700 shadow-md hover:bg-gray-50 hover:shadow-lg'}"
			>
				<span>{label}</span>
			</button>
		{/each}
	</div>
	<div class="mb-8">
		{#if top3.length > 0}
			<div class="mb-12 flex flex-col items-center justify-center gap-6 sm:hidden">
				{#if top3[0]}
					<div class="flex flex-col items-center">
						<div class="relative">
							<img
								src={top3[0].avatar}
								alt={top3[0].pseudo}
								class="h-20 w-20 rounded-full border-4 border-yellow-400 object-cover"
							/>

							<div
								class="absolute -bottom-2 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-yellow-400 font-bold text-white"
							>
								1
							</div>
						</div>
						<div
							class="mt-4 w-40 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 p-4 text-center shadow-lg"
						>
							<p class="truncate font-bold text-white">{top3[0].pseudo}</p>
							<div class="mt-1 flex items-center justify-center gap-1">
								<span class="text-lg font-bold text-white">{top3[0].points.toLocaleString()}</span>
							</div>
							<p class="mt-1 text-xs text-yellow-100">points</p>
						</div>
					</div>
				{/if}

				{#if top3[1]}
					<div class="flex flex-col items-center">
						<div class="relative">
							<img
								src={top3[1].avatar}
								alt={top3[1].pseudo}
								class="h-16 w-16 rounded-full border-4 border-gray-300 object-cover"
							/>

							<div
								class="absolute -bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-gray-700"
							>
								2
							</div>
						</div>
						<div class="mt-4 w-36 rounded-lg bg-white p-3 text-center shadow-md">
							<p class="truncate font-semibold text-gray-800">{top3[1].pseudo}</p>
							<div class="mt-1 flex items-center justify-center gap-1">
								<span class="font-medium text-gray-600">{top3[1].points.toLocaleString()}</span>
							</div>
							<p class="mt-1 text-xs text-gray-400">points</p>
						</div>
					</div>
				{/if}

				{#if top3[2]}
					<div class="flex flex-col items-center">
						<div class="relative">
							<img
								src={top3[2].avatar}
								alt={top3[2].pseudo}
								class="h-16 w-16 rounded-full border-4 border-orange-300 object-cover"
							/>

							<div
								class="absolute -bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-orange-300 text-sm font-bold text-white"
							>
								3
							</div>
						</div>
						<div class="mt-4 w-36 rounded-lg bg-white p-3 text-center shadow-md">
							<p class="truncate font-semibold text-gray-800">{top3[2].pseudo}</p>
							<div class="mt-1 flex items-center justify-center gap-1">
								<span class="font-medium text-gray-600">{top3[2].points.toLocaleString()}</span>
							</div>
							<p class="mt-1 text-xs text-gray-400">points</p>
						</div>
					</div>
				{/if}
			</div>
			<div class="mb-12 hidden items-end justify-center gap-4 sm:flex">
				{#if top3[1]}
					<div class="flex flex-col items-center">
						<div class="relative">
							<img
								src={top3[1].avatar}
								alt={top3[1].pseudo}
								class="h-20 w-20 rounded-full border-4 border-gray-300 object-cover"
							/>

							<div
								class="absolute -bottom-2 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-gray-700"
							>
								2
							</div>
						</div>
						<div class="mt-4 w-40 rounded-lg bg-white p-4 text-center shadow-md">
							<p class="truncate font-semibold text-gray-800">{top3[1].pseudo}</p>
							<div class="mt-1 flex items-center justify-center gap-1">
								<span class="font-medium text-gray-600">{top3[1].points.toLocaleString()}</span>
							</div>
							<p class="mt-1 text-xs text-gray-400">points</p>
						</div>
					</div>
				{/if}

				{#if top3[0]}
					<div class="-mt-8 flex flex-col items-center">
						<div class="relative">
							<img
								src={top3[0].avatar}
								alt={top3[0].pseudo}
								class="h-24 w-24 rounded-full border-4 border-yellow-400 object-cover"
							/>

							<div
								class="absolute -bottom-2 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-yellow-400 font-bold text-white"
							>
								1
							</div>
						</div>
						<div
							class="mt-4 w-44 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 p-4 text-center shadow-lg"
						>
							<p class="truncate font-bold text-white">{top3[0].pseudo}</p>
							<div class="mt-1 flex items-center justify-center gap-1">
								<span class="text-lg font-bold text-white">{top3[0].points.toLocaleString()}</span>
							</div>
							<p class="mt-1 text-xs text-yellow-100">points</p>
						</div>
					</div>
				{/if}

				{#if top3[2]}
					<div class="flex flex-col items-center">
						<div class="relative">
							<img
								src={top3[2].avatar}
								alt={top3[2].pseudo}
								class="h-20 w-20 rounded-full border-4 border-orange-300 object-cover"
							/>

							<div
								class="absolute -bottom-2 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-orange-300 text-sm font-bold text-white"
							>
								3
							</div>
						</div>
						<div class="mt-4 w-40 rounded-lg bg-white p-4 text-center shadow-md">
							<p class="truncate font-semibold text-gray-800">{top3[2].pseudo}</p>
							<div class="mt-1 flex items-center justify-center gap-1">
								<span class="font-medium text-gray-600">{top3[2].points.toLocaleString()}</span>
							</div>
							<p class="mt-1 text-xs text-gray-400">points</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
	{#if others.length > 0}
		<div class="overflow-hidden rounded-lg bg-white shadow-md">
			<div class="bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-3 sm:px-6 sm:py-4">
				<h2 class="text-base font-bold text-white sm:text-lg">Classement Complet</h2>
			</div>
			<div class="divide-y divide-gray-100">
				{#each others as player, index}
					<div
						class="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 sm:px-6 sm:py-4"
					>
						<div class="flex items-center gap-3 sm:gap-4">
							<span class="w-5 text-base font-semibold text-gray-400 sm:w-6 sm:text-lg">{index + 4}</span>

							<img
								src={player.avatar}
								alt={player.pseudo}
								class="h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12"
							/>

							<div>
								<p class="text-sm font-semibold text-gray-800 sm:text-base">{player.pseudo}</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-gray-700 sm:text-base">{player.points.toLocaleString()}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>
