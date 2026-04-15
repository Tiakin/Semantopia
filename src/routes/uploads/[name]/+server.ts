import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';

const UPLOADS_DIR = resolve(process.cwd(), 'uploads');

const getContentType = (filename: string) => {
	const lower = filename.toLowerCase();

	if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || extname(lower) === '.gz') {
		return 'application/gzip';
	}

	if (extname(lower) === '.zip') {
		return 'application/zip';
	}

	if (extname(lower) === '.pdf') {
		return 'application/pdf';
	}

	if (extname(lower) === '.jpg' || extname(lower) === '.jpeg') {
		return 'image/jpeg';
	}

	if (extname(lower) === '.png') {
		return 'image/png';
	}

	if (extname(lower) === '.doc') {
		return 'application/msword';
	}

	if (extname(lower) === '.docx') {
		return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	}

	if (extname(lower) === '.csv') {
		return 'text/csv';
	}

	return 'application/octet-stream';
};

export const GET = async ({ params }) => {
	const rawName = params.name;

	if (!rawName) {
		throw error(400, 'Missing file name');
	}

	const safeName = basename(rawName);
	if (safeName !== rawName) {
		throw error(400, 'Invalid file name');
	}

	const filePath = join(UPLOADS_DIR, safeName);

	let fileStats;
	try {
		fileStats = await stat(filePath);
		if (!fileStats.isFile()) {
			throw error(404, 'File not found');
		}
	} catch {
		throw error(404, 'File not found');
	}

	const stream = createReadStream(filePath);

	return new Response(Readable.toWeb(stream) as ReadableStream, {
		headers: {
			'Content-Type': getContentType(safeName),
			'Content-Disposition': `inline; filename="${safeName}"`,
			'Content-Length': String(fileStats.size),
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
