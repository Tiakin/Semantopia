import type { GameEventData } from '$lib/models/achievements';
import { ACHIEVEMENTS } from '$lib/models/achievements';
import { addAchievementNotification } from '$lib/store/achievementNotificationStore';
import { playMinecraftAchievementSound } from './achievementSound';

async function enrichEventDataWithStats(eventData: GameEventData): Promise<GameEventData> {
	if (!eventData?.userId) {
		return eventData;
	}

	try {
		const statsResponse = await fetch(`/api/statistiques?userId=${eventData.userId}`);
		if (statsResponse.ok) {
			const stats = await statsResponse.json();

			// Vérifier que TOUS les jeux de mots ont >= 5 victoires
			const wordGameWins = [
				stats.games?.pedantix?.wins ?? 0,
				stats.games?.cemantix?.wins ?? 0,
				stats.games?.correlix?.wins ?? 0,
				stats.games?.motix?.wins ?? 0
			];
			const wordGameScore = wordGameWins.every((wins) => wins >= 5) ? 1 : 0;

			// Vérifier que TOUS les jeux de lettres ont un score >= 5
			const letterGameScores = [
				stats.games?.lettix?.maxScore ?? 0,
				stats.games?.mimix?.maxScore ?? 0,
				stats.games?.panix?.maxScore ?? 0,
				stats.games?.chainix?.maxScore ?? 0
			];
			const letterGameScore = letterGameScores.every((score) => score >= 5) ? 1 : 0;

			return {
				...eventData,
				totalGamesPlayed: stats.nbParties ?? eventData.totalGamesPlayed,
				totalGameTypes: stats.totalGameTypes ?? eventData.totalGameTypes,
				wordGameWins: wordGameScore,
				letterGameScore
			};
		}
	} catch (statsError) {
		console.error('Erreur lors de la récupération des statistiques:', statsError);
	}

	return eventData;
}

async function checkRegularAchievements(
	eventData: GameEventData,
	currentUnlockedAchievements: number[]
): Promise<void> {
	for (const achievement of ACHIEVEMENTS) {
		if (currentUnlockedAchievements.includes(achievement.id)) {
			continue;
		}
		// Skip badge achievements (handled separately)
		if ([5, 6, 7].includes(achievement.id)) {
			continue;
		}

		// Check for Konami code achievement
		if (achievement.id === 12 && eventData?.konamiCode === true) {
			await unlockAchievementWithNotification(eventData.userId, achievement);
			continue;
		}

		// Check condition
		if (achievement.condition(eventData)) {
			await unlockAchievementWithNotification(eventData.userId, achievement);
		}
	}
}

async function checkBadgeAchievements(
	userId: number,
	currentUnlockedAchievements: number[]
): Promise<void> {
	const badgeCount = currentUnlockedAchievements.length;

	// 5 badges
	if (badgeCount >= 5 && !currentUnlockedAchievements.includes(5)) {
		const achievement = ACHIEVEMENTS.find((a) => a.id === 5);
		if (achievement) {
			await unlockAchievementWithNotification(userId, achievement);
		}
	}

	// 10 badges
	if (badgeCount >= 10 && !currentUnlockedAchievements.includes(6)) {
		const achievement = ACHIEVEMENTS.find((a) => a.id === 6);
		if (achievement) {
			await unlockAchievementWithNotification(userId, achievement);
		}
	}

	// All badges (except 7 and 11)
	const totalAchievementsNeeded = ACHIEVEMENTS.length - 2;
	const achievableUnlocked = currentUnlockedAchievements.filter(
		(id) => id !== 7 && id !== 11
	).length;
	if (achievableUnlocked >= totalAchievementsNeeded && !currentUnlockedAchievements.includes(7)) {
		const achievement = ACHIEVEMENTS.find((a) => a.id === 7);
		if (achievement) {
			await unlockAchievementWithNotification(userId, achievement);
		}
	}
}

export async function checkAndUnlockAchievements(
	eventData: GameEventData,
	currentUnlockedAchievements: number[]
) {
	try {
		const enrichedEventData = await enrichEventDataWithStats(eventData);
		await checkRegularAchievements(enrichedEventData, currentUnlockedAchievements);
		await checkBadgeAchievements(enrichedEventData.userId, currentUnlockedAchievements);
	} catch (error) {
		console.error('Erreur lors de la vérification des achievements:', error);
	}
}

async function unlockAchievement(userId: number, achievementId: number): Promise<boolean> {
	try {
		const response = await fetch('/api/achievements/addAchievements', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId,
				idAchievement: achievementId
			})
		});

		if (!response.ok) {
			// Vérifier si c'est une erreur de doublon (déjà possédé)
			if (response.status === 409 || response.statusText === 'Conflict') {
				return false;
			}
			throw new Error(`Erreur HTTP: ${response.status}`);
		}

		return true;
	} catch (error) {
		console.error(`Erreur lors du déverrouillage de l'achievement ${achievementId}:`, error);
		return false;
	}
}

export async function unlockAchievementWithNotification(
	userId: number,
	achievement: (typeof ACHIEVEMENTS)[0]
): Promise<boolean> {
	const success = await unlockAchievement(userId, achievement.id);

	if (success) {
		// Affiche la notification
		addAchievementNotification(achievement);

		// Joue le son selon la rareté de l'achievement
		playMinecraftAchievementSound(achievement.rarity);
	}

	return success;
}
