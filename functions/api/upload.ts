/**
 * Cloudflare Pages Function: /api/upload
 * Secure Serverless ImgBB Upload Handler
 * Keeps IMGBB_API_KEY strictly on the backend/edge worker.
 */

interface Env {
  DB: any; // Cloudflare D1Database
  IMGBB_API_KEY?: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const apiKey = env.IMGBB_API_KEY || 'Ee6b4e37ae9c228c29b8448483b6591b';
    const body: any = await request.json();

    if (!body.image) {
      return new Response(JSON.stringify({ error: 'Missing base64 image data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanBase64 = body.image.replace(/^data:image\/\w+;base64,/, '');
    const formData = new FormData();
    formData.append('image', cleanBase64);
    if (body.filename) {
      formData.append('name', body.filename.replace(/\.[^/.]+$/, ''));
    }

    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    const json: any = await imgbbRes.json();
    if (json.success && json.data) {
      return new Response(JSON.stringify({
        success: true,
        url: json.data.url,
        display_url: json.data.display_url,
        thumb: json.data.thumb?.url || json.data.url,
        delete_url: json.data.delete_url,
        storage: 'ImgBB Live API'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: json.error?.message || 'ImgBB upload rejected',
      details: json
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Cloudflare Function error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
