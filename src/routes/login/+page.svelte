<script lang="ts">
	import logo from '$lib/assets/logo.png'
	import { goto } from '$app/navigation';
	import { sessionStore } from '$lib/store/sessionStore';
	import type { sessionData } from '$lib/store/sessionStore';
	import { onMount } from 'svelte';
	let email: string = '';
	let mdp: string = '';
	let errors: { [key: string]: string } = {};
	let seSouvenir: boolean = false;
	let rep: number = -1;
	let repbody: {
		message: string;
		userId: number;
		pseudo: string;
		avatar: string;
		email: string;
		date: Date;
		isAdmin: boolean;
	};

	async function sendForm() {
		const response = await fetch('/login/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email,
				mdp,
				seSouvenir
			})
		});
		repbody = await response.json();
		if (response.status === 201) {
			rep = 0;
			const id = repbody.userId;
			const pseudo = repbody.pseudo;
			const avatar = repbody.avatar;
			const email = repbody.email;
			const date = repbody.date;
			const isAdmin = repbody.isAdmin;
			const userInfo: sessionData = { id, pseudo, avatar, email, dateCreation: date, isAdmin };
			sessionStore.set(userInfo);
			window.setTimeout(() => {
				goto('/home');
			});
		} else {
			rep = 1;
		}
	}
	onMount(async () => {
		const res = await fetch('/api/loginChecked');
		const data = await res.json();

		if (data.user) {
			goto('/home');
		}
	});
</script>

<div
	style="background: linear-gradient(135deg, #6B7FED 0%, #8B7BC7 100%); min-height: 100vh;"
	class="flex items-center justify-center p-4"
>
	<div
		class="flex flex-col items-center rounded-2xl bg-white p-10 shadow-2xl"
		style="width: 450px; height: 653px;"
	>
		<div class="mb-6 rounded-full bg-indigo-500 p-4">
			<img src={logo} alt="Logo du site web" width="40" height="40" />
		</div>

		<h2 class="mb-2 text-center text-2xl font-bold text-gray-800">Connexion à Sémantopia</h2>

		{#if rep === 0}
			<p class="mb-4 rounded bg-green-500 px-4 py-2 text-center text-white">
				{repbody.message}
			</p>
		{:else if rep === 1}
			<p class="mb-4 rounded bg-red-500 px-4 py-2 text-center text-white">
				{repbody.message}
			</p>
		{/if}

		<form on:submit|preventDefault={sendForm} class="w-full">
			<div class="mb-5">
				<label for="email" class="mb-2 block text-sm font-medium text-gray-700">
					Adresse email
				</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="votre@email.com"
					class="w-full rounded-lg border border-gray-300 px-4 py-3 transition outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
				/>
				{#if errors.email}
					<p class="mt-1 text-sm text-red-500">{errors.email}</p>
				{/if}
			</div>
			<div class="mb-5">
				<label for="mdp" class="mb-2 block text-sm font-medium text-gray-700"> Mot de passe </label>
				<div class="relative">
					<input
						id="mdp"
						type="password"
						bind:value={mdp}
						placeholder="••••••••"
						class="w-full rounded-lg border border-gray-300 px-4 py-3 pr-10 transition outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
					/>
					{#if errors.mdp}
						<p class="mt-1 text-sm text-red-500">{errors.mdp}</p>
					{/if}
				</div>
			</div>
			<div class="mb-6">
				<label class="flex cursor-pointer items-center">
					<input
						type="checkbox"
						bind:checked={seSouvenir}
						class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
					/>
					<span class="ml-2 text-sm text-gray-700"> Se souvenir de moi </span>
				</label>
			</div>
			<button
				type="submit"
				class="mb-6 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700"
			>
				Se connecter
			</button>
		</form>
		<p class="mt-auto text-center text-sm text-gray-600">
			Vous n'avez pas de compte ?
			<a href="/register" class="font-semibold text-indigo-600 hover:underline">
				Créer un compte
			</a>
		</p>
	</div>
</div>
