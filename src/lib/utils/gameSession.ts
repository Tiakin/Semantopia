import pool from '$lib/server/db';

export async function startGameSession(userId: number | null | undefined, type: string) {
	if (!userId) return;
	const date = new Date();
	await pool.query(
		'INSERT INTO GAME_SESSION(DATE_PARTIE,EN_COURS,NOMBRE_ESSAI,TYPE,WIN,USER_ID,SCORE) VALUES(?,1,0,?,0,?,null) ',
		[date, type, userId]
	);
}

export async function endGameSession(
	userId: number | null | undefined,
	type: string,
	nbEssai: number | null | undefined,
	isVictory: boolean,
	score: number | null | undefined
) {
	if (!userId) return;
	const [rows] = (await pool.query(
		'SELECT MAX(ID) AS ID FROM GAME_SESSION WHERE USER_ID = ? AND TYPE = ?',
		[userId, type]
	)) as [Array<{ ID: number | null }>, unknown];
	const idMax = rows[0]?.ID;
	if (!idMax) return;
	await pool.query(
		'UPDATE GAME_SESSION SET EN_COURS = 0, NOMBRE_ESSAI = ?, WIN = ?, SCORE = ? WHERE USER_ID = ? AND ID = ? AND TYPE = ? ',
		[nbEssai, isVictory ? 1 : 0, score, userId, idMax, type]
	);
}
