<script lang="ts">
	import Header from '$lib/header.svelte';
	import puzzle from '$lib/assets/puzzle.png'

	import { GAMES } from '$lib/gameConfig';
</script>

<Header />
<section class="bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 px-8 py-16">
	<div class="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
		<div class="text-white">
			<h2 class="mb-4 text-4xl font-bold">
				Bienvenue dans <span class="text-yellow-300">Sémantopia</span>
			</h2>
			<p class="mb-6 text-lg leading-relaxed">
				L'univers fascinant des jeux de mots vous attend ! Développer votre vocabulaire, stimuler
				votre esprit et défiez vos amis dans une aventure linguistique unique.
			</p>
		</div>
		<div
			class="bg-opacity-40 rounded-2xl bg-purple-700 p-8 text-center text-white backdrop-blur-sm"
		>
			<img
				src={puzzle}
				alt="Logo du site web"
				width="60"
				height="60"
				class="mx-auto mb-4"
			/>
			<h3 class="mb-3 text-2xl font-bold">Jeux intéractifs</h3>
			<p class="text-purple-100">
				Découvrer nos 8 jeux uniques conçus pour défier votre intelligence linguistique
			</p>
		</div>
	</div>
</section>

<section class="bg-gray-50 px-8 py-16">
	<h2 class="mb-2 text-center text-3xl font-bold">
		<i class="fa-solid fa-bullseye"></i> Choisisser votre défi
	</h2>
	<p class="mb-12 text-center text-gray-600">Huit jeux innovants pour tous les niveaux</p>

	<div class="mx-auto grid max-w-6xl gap-6 md:grid-cols-4">
		{#each GAMES as game (game.slug)}
			<a
				href="/game/{game.slug}"
				class="cursor-pointer rounded-xl bg-white p-6 text-center shadow-sm transition hover:shadow-md"
			>
				<div class="rounded-xl bg-white p-6 text-center shadow-sm transition hover:shadow-md">
					<div
						class={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${game.gradient} text-white`}
					>
						<i class={`fa-solid ${game.icon} text-2xl`} aria-hidden="true"></i>
					</div>
					<h4 class="mb-3 text-xl font-bold text-gray-800">{game.label}</h4>
					<p class="text-sm text-gray-600">
						{game.description}
					</p>
				</div>
			</a>
		{/each}
	</div>
</section>
<footer class="bg-gray-900 px-8 py-12 text-white">
	<div class="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
		<h3 class="text-2xl font-bold"><i class="fa-solid fa-house"></i> Sémantopia</h3>
		<p class="max-w-md text-gray-400">
			La plateforme de référence pour les jeux de mots et défis linguistiques en français.
		</p>
		<div class="my-4 h-px w-full bg-gray-700"></div>
		<p class="text-sm text-gray-500">
			© 2025 Sémantopia. Tous droits réservés. <i class="fa-solid fa-flag"></i> Fièrement français.
		</p>
	</div>
</footer>
