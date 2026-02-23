<script lang="ts">
	import { goto } from '$app/navigation';
	import { sessionStore } from './store/sessionStore';
	import logo from '$lib/assets/logo.png'
	let session = sessionStore.get();
	let pseudo: string | null = session ? session.pseudo : null;
	$: avatar = $sessionStore?.avatar || '/photo_profil/photo_default.png';
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

<nav class="flex items-center justify-between bg-white px-8 py-4 shadow-sm">
	<div class="flex items-center gap-3">
		<a href="/home">
			<img src={logo} alt="Logo du site web" width="40" height="40" />
		</a>
		<a href="/home">
			<h3 class="text-xl font-bold text-gray-800">Sémantopia</h3>
		</a>
	</div>
	<div>
		<ul class="flex items-center gap-6">
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
				<img src={avatar} alt="photo_profil" class="rounded-lg" width="40" height="40" />
				<button
					class="rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
					on:click={logout}>Se deconnecter</button
				>
			{:else}
				<li>
					<button class="text-gray-600 transition hover:text-purple-600"
						><a href="/login">Se connecter</a></button
					>
				</li>
				<li>
					<button
						class="rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
						><a href="/register">Créer un compte</a></button
					>
				</li>
			{/if}
		</ul>
	</div>
</nav>
