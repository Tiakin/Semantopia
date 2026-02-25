<script lang="ts">
	import { goto } from '$app/navigation';
	import { sessionStore } from './store/sessionStore';
	import logo from '$lib/assets/logo.png'
	let session = sessionStore.get();
	let pseudo: string | null = session ? session.pseudo : null;
	$: avatar = $sessionStore?.avatar || '/photo_profil/photo_default.png';
	let isMenuOpen = false;
	const toggleMenu = () => (isMenuOpen = !isMenuOpen);
	async function logout() {
		sessionStore.clear();
		await fetch('/api/logout', {
			method: 'DELETE'
		});
		window.setTimeout(() => {
			goto('/home');
		});
	}
</script>

<nav class="flex items-center justify-between bg-white px-4 py-4 shadow-sm sm:px-8">
	<div class="flex items-center gap-3">
		<a href="/home">
			<img src={logo} alt="Logo du site web" width="40" height="40" />
		</a>
		<a href="/home">
			<h3 class="text-xl font-bold text-gray-800">Sémantopia</h3>
		</a>
	</div>
	<button
		class="rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:hidden"
		aria-label="Ouvrir le menu"
		on:click={toggleMenu}
	>
		<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>
	<div class={`sm:static sm:block sm:w-auto ${isMenuOpen ? 'block' : 'hidden'}`}>
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/40 sm:hidden"
			aria-label="Fermer le menu"
			on:click={toggleMenu}
			on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMenu(); }}
			tabindex="0"
		></button>
		<div
			class={`fixed left-0 top-0 z-50 h-full w-72 transform bg-white p-6 shadow-xl transition-transform duration-300 sm:static sm:z-auto sm:h-auto sm:w-auto sm:translate-x-0 sm:bg-transparent sm:p-0 sm:shadow-none ${
				isMenuOpen ? 'translate-x-0' : '-translate-x-full'
			}`}
		>
			<div class="mb-6 flex items-center justify-between sm:hidden">
				<span class="text-lg font-semibold text-gray-800">Menu</span>
				<button
					class="rounded-lg p-2 text-gray-700 transition hover:bg-gray-100"
					aria-label="Fermer le menu"
					on:click={toggleMenu}
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<ul class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
			{#if pseudo}
				<li>
					<a href="/achievements" class="text-gray-600 transition hover:text-purple-600">Badges</a>
				</li>
				<li>
					<a href="/leaderboard" class="text-gray-600 transition hover:text-purple-600"
						>Classement</a
					>
				</li>
				<li><a href="/profil"><p>{pseudo}</p></a></li>
				<li class="flex flex-col gap-3 sm:flex-row sm:items-center">
					<img src={avatar} alt="photo_profil" class="rounded-lg" width="40" height="40" />
					<button
						class="w-full rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 sm:w-auto"
						on:click={logout}>Se deconnecter</button
					>
				</li>
			{:else}
				<li>
					<a href="/login" class="text-gray-600 transition hover:text-purple-600">Se connecter</a>
				</li>
				<li>
					<a
						class="block rounded-lg bg-purple-600 px-4 py-2 text-center text-white transition hover:bg-purple-700"
						href="/register">Créer un compte</a
					>
				</li>
			{/if}
			</ul>
		</div>
	</div>
</nav>
