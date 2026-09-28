import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { addMedia } from '../../../db/client';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';
    const category = ((formData.get('category') as string) || 'gallery') as any;

    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'No valid file uploaded' }), { status: 400 });
    }

    // Prepare upload directory in public/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Sanitize file name
    const ext = path.extname(file.name) || '.jpg';
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = `${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(uploadsDir, safeFileName);

    // Save buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${safeFileName}`;

    // Record in DB
    const mediaRecord = await addMedia({
      file_name: safeFileName,
      file_url: publicUrl,
      file_size: buffer.length,
      mime_type: file.type || 'image/jpeg',
      title: title || file.name,
      category,
    });

    return new Response(JSON.stringify({ success: true, media: mediaRecord }), { status: 201 });
  } catch (err: any) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: err.message || 'File upload failed' }), { status: 500 });
  }
};
