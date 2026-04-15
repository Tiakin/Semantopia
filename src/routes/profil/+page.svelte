<script lang="ts">
	import { sessionStore } from '$lib/store/sessionStore';
	import Header from '$lib/header.svelte';
	import { onMount } from 'svelte';

	$: pseudoUser = $sessionStore?.pseudo ?? null;
	$: idUser = $sessionStore?.id ?? null;
	$: email = $sessionStore?.email ?? null;
	$: avatar = $sessionStore?.avatar || '/photo_profil/photo_default.png';
	$: date = $sessionStore?.dateCreation ?? null;

	let mdpUser: string = '';
	let dateFormat: string;
	let fileInput: HTMLInputElement;
	let showCropModal = false;
	let imageSrc: string = '';
	let cropCanvas: HTMLCanvasElement;
	let cropImage: HTMLImageElement;
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let offsetX = 0;
	let offsetY = 0;
	let scale = 1;

	type GameSession = {
		ID: number;
		TYPE: string;
		WIN: boolean;
		DATE_PARTIE: string;
	};
	let rows_histo: GameSession[] = [];
	$: if (date) {
		const newDate = new Date(date);
		dateFormat = newDate.toLocaleDateString('fr-FR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	let partiesJouees: number = 0;
	let tauxReussite: number = 0;

	let repbodyStats: {
		nbParties: number;
		nbEssaiMoyen: number;
		tauxReussite: number;
		serieActuelle: number;
	};

	async function getStats() {
		if (idUser === null) {
			console.error('idUser est null');
			return;
		}
		try {
			const url = `/api/statistiques?userId=${encodeURIComponent(idUser)}`;
			const responseStats: Response = await fetch(url, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			repbodyStats = await responseStats.json();
			partiesJouees = repbodyStats.nbParties ?? 0;
			tauxReussite = repbodyStats.tauxReussite * 100;
		} catch (error) {
			console.error('Erreur Server:', error);
			throw error;
		}
	}
	async function getHisto() {
		try {
			const response = await fetch('/api/statistiques', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: idUser
				})
			});
			const data = await response.json();
			rows_histo = data.rows_histo;
		} catch (error) {
			console.error('Erreur Server:', error);
			throw error;
		}
	}
	async function changeInfoUser() {
		try {
			await fetch('/profil', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: idUser,
					pseudo: pseudoUser,
					email: email,
					mdp: mdpUser
				})
			});
			if (pseudoUser && email) {
				sessionStore.updateUserInfo(pseudoUser, email);
			}
		} catch (error) {
			console.error('Erreur Server:', error);
			throw error;
		}
	}
	function openInput() {
		fileInput.click();
	}
	async function changeAvatar(event: Event) {
		const target = event.target as HTMLInputElement;
		const fichier = target.files?.[0];
		if (fichier && idUser) {
			const reader = new FileReader();
			reader.onload = (e) => {
				imageSrc = e.target?.result as string;
				showCropModal = true;
			};
			reader.readAsDataURL(fichier);
		}
	}

	function initCropCanvas(p0: HTMLImageElement) {
		cropImage = document.getElementById('cropImage') as HTMLImageElement;
		cropCanvas = document.getElementById('cropCanvas') as HTMLCanvasElement;
		if (cropImage && imageSrc) {
			cropImage.onload = () => {
				scale = 1;
				offsetX = 0;
				offsetY = 0;
				drawCropPreview();
			};
			cropImage.src = imageSrc;
		}
	}

	function drawCropPreview() {
		if (!cropCanvas || !cropImage) return;
		const ctx = cropCanvas.getContext('2d');
		if (!ctx) return;

		cropCanvas.width = 300;
		cropCanvas.height = 300;

		ctx.clearRect(0, 0, 300, 300);
		ctx.save();
		ctx.translate(150 + offsetX, 150 + offsetY);
		ctx.scale(scale, scale);
		ctx.drawImage(cropImage, -cropImage.width / 2, -cropImage.height / 2);
		ctx.restore();

	
		ctx.globalCompositeOperation = 'destination-in';
		ctx.beginPath();
		ctx.arc(150, 150, 120, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
	}

	function handleMouseDown(e: MouseEvent) {
		isDragging = true;
		startX = e.clientX - offsetX;
		startY = e.clientY - offsetY;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		offsetX = e.clientX - startX;
		offsetY = e.clientY - startY;
		drawCropPreview();
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.05 : 0.05;
		scale = Math.max(0.5, Math.min(3, scale + delta));
		drawCropPreview();
	}

	async function saveCroppedImage() {
		if (!cropCanvas || !idUser) return;

		cropCanvas.toBlob(async (blob) => {
			if (!blob) return;
			const formData = new FormData();
			const fileName = `avatar_${idUser}_${Date.now()}.png`;
			formData.append('userId', String(idUser));
			formData.append('file', blob, fileName);
			formData.append('fileName', fileName);

			await fetch('/api/profil/', {
				method: 'POST',
				body: formData
			});
			sessionStore.updateAvatar('/uploads/photo_profil/' + fileName);
			showCropModal = false;
		}, 'image/png');
	}

	function cancelCrop() {
		showCropModal = false;
		imageSrc = '';
		if (fileInput) fileInput.value = '';
	}
	onMount(() => {
		getStats();
		getHisto();
	});
</script>

<Header />
<div class="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
	<div class="mx-auto max-w-7xl px-4">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<aside class="lg:col-span-1">
				<div class="rounded-lg bg-white p-6 shadow-sm">
					<div class="flex flex-col items-center text-center">
						<button on:click={openInput}>
							{#key avatar}
								<img
									src={avatar}
									alt="photo_profil"
									class="mb-4 h-24 w-24 rounded-full object-cover"
								/>
							{/key}
						</button>
						<input
							bind:this={fileInput}
							type="file"
							accept="image/*"
							class="hidden"
							on:change={changeAvatar}
						/>
						<h3 class="mb-1 text-xl font-bold text-gray-900">{pseudoUser}</h3>
						<p class="mb-6 text-sm text-gray-500">Membre depuis le {dateFormat}</p>
					</div>
				</div>
			</aside>

			<section class="lg:col-span-2">
				<div class="space-y-6">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="rounded-lg bg-white p-6 shadow-sm">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-gray-500">Parties jouées</p>
									<h3 class="mt-2 text-3xl font-bold text-gray-900">{partiesJouees}</h3>
								</div>
								<div class="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
									<svg
										class="h-6 w-6 text-blue-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</div>
							</div>
						</div>

						<div class="rounded-lg bg-white p-6 shadow-sm">
							<div class="mb-4 flex items-center justify-between">
								<div class="flex-1">
									<p class="text-sm font-medium text-gray-500">Taux de réussite</p>
									<h3 class="mt-2 text-3xl font-bold text-gray-900">
										{Math.round(tauxReussite * 100) / 100}%
									</h3>
								</div>
								<div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
									<svg
										class="h-6 w-6 text-green-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</div>
							</div>
							<div class="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
								<div
									class="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
									style="width: {tauxReussite}%"
								></div>
							</div>
						</div>
					</div>

					<div class="rounded-lg bg-white p-6 shadow-sm">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="text-lg font-semibold text-gray-900">Historique des parties</h3>
						</div>

						{#if rows_histo.length === 0}
							<p class="text-center text-gray-500">Aucune partie trouvée.</p>
						{:else}
							<ul class="space-y-4">
								{#each rows_histo as partie}
									<li>
										<div
											class={`flex items-center justify-between rounded-lg p-4
           									 ${partie.WIN ? 'bg-green-100' : 'bg-red-100'}`}
										>
											<div>
												<p
													class={`flex items-center gap-2 text-lg font-semibold
                									${partie.WIN ? 'text-green-700' : 'text-red-700'}`}
												>
													{partie.TYPE.replace(/^./, (c) => c.toUpperCase())}
												</p>
												<p class="text-sm text-gray-500">
													{new Date(partie.DATE_PARTIE).toLocaleDateString('fr-FR', {
														day: '2-digit',
														month: 'long',
														year: 'numeric'
													})}
												</p>
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<div class="rounded-lg bg-white p-6 shadow-sm">
						<h3 class="mb-6 text-lg font-semibold text-gray-900">Paramètres du compte</h3>
						<form class="space-y-5" on:submit|preventDefault={changeInfoUser}>
							<div>
								<label for="pseudo" class="mb-2 block text-sm font-medium text-gray-700">
									Pseudonyme
								</label>
								<input
									id="pseudo"
									type="text"
									bind:value={pseudoUser}
									placeholder="Votre pseudo"
									class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="email" class="mb-2 block text-sm font-medium text-gray-700">
									Adresse email
								</label>
								<input
									id="email"
									type="email"
									bind:value={email}
									placeholder="votre@email.com"
									class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="mdp" class="mb-2 block text-sm font-medium text-gray-700">
									Mot De Passe
								</label>
								<input
									id="mdp"
									type="password"
									bind:value={mdpUser}
									placeholder="••••••••"
									class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<button
								type="submit"
								class="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
							>
								Sauvegarder les modifications
							</button>
						</form>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

{#if showCropModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
			<h3 class="mb-4 text-center text-xl font-bold text-gray-800">Recadrer votre photo</h3>
			
			<div class="mb-4 flex justify-center">
				<div class="relative h-[300px] w-[300px] overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100">
					<img
						id="cropImage"
						bind:this={cropImage}
						src={imageSrc}
						alt="Preview"
						class="hidden"
						on:load={drawCropPreview}
						use:initCropCanvas
					/>
					<canvas
						id="cropCanvas"
						bind:this={cropCanvas}
						class="cursor-move"
						on:mousedown={handleMouseDown}
						on:mousemove={handleMouseMove}
						on:mouseup={handleMouseUp}
						on:mouseleave={handleMouseUp}
						on:wheel={handleWheel}
					></canvas>
				</div>
			</div>

			<p class="mb-4 text-center text-sm text-gray-600">
				Glissez pour déplacer • Molette pour zoomer
			</p>

			<div class="flex gap-3">
				<button
					on:click={cancelCrop}
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
				>
					Annuler
				</button>
				<button
					on:click={saveCroppedImage}
					class="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
				>
					Valider
				</button>
			</div>
		</div>
	</div>
{/if}
