import pool from '$lib/server/db';
import { type RequestEvent } from '@sveltejs/kit';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';

export async function POST({ request }: RequestEvent) {
	try {
		const data = await request.formData();
		const userId = Number(data.get('userId'));
		const file = data.get('file') as File;
		const newFileName = data.get('fileName') as string;
		if (!newFileName || typeof newFileName !== 'string') {
			return new Response(JSON.stringify({ message: 'Chemin de fichier manquant ou invalide.' }), {
				status: 400
			});
		}
		const uploadDir = path.join(process.cwd(), 'static','uploads', 'photo_profil');
		await mkdir(uploadDir, { recursive: true });

		const newFilePath = path.join(uploadDir, newFileName);

		const [rowsUser] = (await pool.query('SELECT AVATAR FROM USERS WHERE ID = ?', [userId])) as [
			Array<{ AVATAR: string }>,
			unknown
		];
		const oldAvatarUrl: string = rowsUser[0].AVATAR; 
		const oldFileName = path.basename(oldAvatarUrl);
		const oldFilePath = path.join(process.cwd(), 'static','uploads', 'photo_profil', oldFileName);

		if (existsSync(oldFilePath)) {
			await unlink(oldFilePath);
		}
		const avatarPath = `/uploads/photo_profil/${newFileName}`;
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		await writeFile(newFilePath, buffer);
		await pool.query('UPDATE USERS SET AVATAR = ? WHERE ID = ?', [avatarPath, userId]);

		return new Response(JSON.stringify(null), { status: 200 });
	} catch (error) {
		console.error('Erreur serveur complète :', error);
		return new Response(
			JSON.stringify({ message: 'Erreur serveur : ' + (error as Error).message }),
			{ status: 500 }
		);
	}
}
