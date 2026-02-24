import bcrypt from 'bcrypt';
import pool from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';
import type { RequestEvent } from './$types';

export async function POST({ request }: RequestEvent) {
	const now = new Date();
	const userDate = now.toISOString().slice(0, 19).replace('T', ' ');
	const { email, mdp, pseudo } = await request.json();
	try {
		const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM USERS WHERE EMAIL = ?', [
			email
		]);
		if (rows.length > 0) {
			return new Response(JSON.stringify({ message: 'Cet email est déjà utilisé.' }), {
				status: 400
			});
		}

		const [existingPseudo] = await pool.query<RowDataPacket[]>(
			'SELECT PSEUDO FROM USERS WHERE LOWER(PSEUDO) = LOWER(?)',
			[pseudo]
		);

		if (existingPseudo.length > 0) {
			return new Response(JSON.stringify({ message: 'Pseudo already exists' }), { status: 400 });
		}

		const hashedPassword = await bcrypt.hash(mdp, 10);

		await pool.query(
			'INSERT INTO USERS (EMAIL, PASSWORD, PSEUDO,CREATION_DATE,AVATAR) VALUES (?, ?, ?, ?, ?)',
			[email, hashedPassword, pseudo, userDate, '/photo_profil/photo_default.png']
		);

		const [rows_id] = (await pool.query(
			'SELECT ID,PSEUDO,AVATAR, CREATION_DATE, ISADMIN FROM USERS WHERE EMAIL = ? ',
			[email]
		)) as [
			Array<{ ID: number; PSEUDO: string; AVATAR: string; CREATION_DATE: Date; ISADMIN: boolean }>,
			unknown
		];

		const userId = rows_id[0].ID;
		const pseudoUser = rows_id[0].PSEUDO;
		const avatar = rows_id[0].AVATAR;
		const date = rows_id[0].CREATION_DATE;
		const isAdmin = rows_id[0].ISADMIN;

		return new Response(
			JSON.stringify({
				message: 'Utilisateur créé avec succès. Redirection...',
				userId,
				pseudoUser,
				avatar,
				email,
				date,
				isAdmin
			}),
			{ status: 201 }
		);
	} catch (error) {
		return new Response(JSON.stringify({ message: 'Erreur serveur.' + error }), {
			status: 500
		});
	}
}
