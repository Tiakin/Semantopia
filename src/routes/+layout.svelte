<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { sessionStore } from '$lib/store/sessionStore';
	import { emitGameEvent, gameEventEmitter } from '$lib/store/gameEventStore';
	import { initKonamiCodeDetection } from '$lib/utils/achievement/konamiCode';
	import { createAccountAgeEvent } from '$lib/utils/achievement/accountAgeChecker';
	import type { GameEventData } from '$lib/models/achievements';
	import { checkAndUnlockAchievements } from '$lib/utils/achievement/achievementManager';
	import AchievementNotification from '$lib/components/AchievementNotification.svelte';

	let { children } = $props();
	let session = sessionStore.get();


	async function getUserAchievements(userId: number): Promise<number[]> {
		try {
			const response = await fetch('/achievements', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId })
			});
			const data = await response.json();
			return data.achievementsIds ?? [];
		} catch (error) {
			console.error('Erreur lors de la récupération des achievements:', error);
			return [];
		}
	}

	onMount(() => {
		let userAchievements: number[] = [];
		let achievementsLoaded = false;
		let achievementsInitPromise: Promise<void> | null = null;
		let lastEventTime = 0;

		// Initialiser la détection du code Konami
		const cleanupKonami = initKonamiCodeDetection(() => {
			const userId = session?.id ?? 0;
			if (userId) {
				const eventData: GameEventData = {
					userId,
					type: 'none',
					konamiCode: true
				};
				emitGameEvent(eventData);
			}
		});

		const checkAccountAge = async () => {
			const userId = session?.id ?? 0;
			if (userId) {
				const accountEvent = await createAccountAgeEvent(userId);
				if (accountEvent) {
					const eventData: GameEventData = {
						userId,
						type: 'none',
						won: true,
						accountAgeMs: accountEvent.accountAgeMs
					};
					emitGameEvent(eventData);
				}
			}
		};

		// Charger les achievements au démarrage
		const initializeAchievements = async () => {
			const userId = session?.id ?? 0;
			if (userId) {
				userAchievements = await getUserAchievements(userId);
				achievementsLoaded = true;
			}
		};

		const ensureAchievementsLoaded = async () => {
			if (achievementsLoaded) return;
			if (!achievementsInitPromise) {
				achievementsInitPromise = initializeAchievements().finally(() => {
					achievementsInitPromise = null;
				});
			}
			await achievementsInitPromise;
		};

		// Écouter les événements de jeu globalement
		const unsubscribeGameEvent = gameEventEmitter.subscribe(
			async (eventData: GameEventData | null) => {
				if (!eventData) return;

				const userId = session?.id ?? 0;
				if (!userId) return;

				await ensureAchievementsLoaded();

				// Éviter les appels trop rapides
				const now = Date.now();
				if (now - lastEventTime < 100) return;
				lastEventTime = now;

				// Vérifier et déverrouiller les achievements
				const previousCount = userAchievements.length;
				await checkAndUnlockAchievements(eventData, userAchievements);

				// Recharger la liste seulement si un achievement a été déverrouillé
				const updatedAchievements = await getUserAchievements(userId);
				if (updatedAchievements.length > previousCount) {
					userAchievements = updatedAchievements;
				}
			}
		);

		checkAccountAge();
		initializeAchievements();

		return () => {
			cleanupKonami();
			unsubscribeGameEvent();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<AchievementNotification />

{@render children?.()}
