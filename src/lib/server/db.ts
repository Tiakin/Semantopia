import mysql from 'mysql2/promise';
import { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } from '$env/static/private';

const pool = mysql.createPool({
	host: MYSQL_HOST,
	user: MYSQL_USER,
	password: MYSQL_PASSWORD,
	database: MYSQL_DATABASE,
	connectionLimit: 10
});

let initPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		const connection = await pool.getConnection();

		try {
			await connection.query(`
				CREATE TABLE IF NOT EXISTS USERS (
					ID INT(11) NOT NULL AUTO_INCREMENT,
					PSEUDO VARCHAR(45) NOT NULL,
					EMAIL VARCHAR(45) NOT NULL,
					PASSWORD VARCHAR(70) NOT NULL,
					CREATION_DATE DATE NOT NULL,
					AVATAR VARCHAR(350) NOT NULL,
					ISADMIN TINYINT(4) NOT NULL DEFAULT 0,
					PRIMARY KEY (ID)
				) 
			`);

			await connection.query(`
				CREATE TABLE IF NOT EXISTS GAME_SESSION (
					ID INT(11) NOT NULL AUTO_INCREMENT,
					USER_ID INT(11) NOT NULL,
					TYPE VARCHAR(55) NOT NULL,
					DATE_PARTIE DATE NOT NULL,
					EN_COURS TINYINT(1) NOT NULL,
					NOMBRE_ESSAI INT(11) DEFAULT NULL,
					WIN TINYINT(1) NOT NULL,
					SCORE INT(3) DEFAULT 0,
					PRIMARY KEY (ID)
				) 
			`);

			await connection.query(`
				CREATE TABLE IF NOT EXISTS STATISTICS (
					ID INT(11) NOT NULL AUTO_INCREMENT,
					USER_ID INT(11) NOT NULL,
					NB_CHALLENGE INT(11) NOT NULL,
					COMPLETEDTODAYCHALLENGE TINYINT(4) NOT NULL,
					PRIMARY KEY (ID)
				) 
			`);

			await connection.query(`
				CREATE TABLE IF NOT EXISTS ACHIEVEMENTS (
					ID INT(11) NOT NULL AUTO_INCREMENT,
					USER_ID INT(11) NOT NULL,
					UNLOCK_DATE DATE NOT NULL,
					ID_ACHIEVEMENT INT(3) NOT NULL,
					PRIMARY KEY (ID)
				) 
			`);

			console.log("Database initialized successfully.");
		} catch (error) {
			initPromise = null;
			throw error;
		} finally {
			connection.release();
		}
	})();

	return initPromise;
}

export default pool;
