/**
 * Cloudflare Pages Function: /api/anime
 * Catalog query with D1 SQL and pagination
 */

interface Env {
  DB: any; // Cloudflare D1Database binding
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '8');
    const offset = (page - 1) * limit;
    const genre = url.searchParams.get('genre');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const sort = url.searchParams.get('sort') || 'popularity';

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (genre && genre !== 'All') {
      whereClauses.push("genres LIKE ?");
      params.push(`%${genre}%`);
    }
    if (status && status !== 'All') {
      whereClauses.push("status = ?");
      params.push(status);
    }
    if (search) {
      whereClauses.push("(title LIKE ? OR synopsis LIKE ? OR genres LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    let orderSql = "ORDER BY popularity DESC";
    if (sort === 'rating') orderSql = "ORDER BY rating DESC";
    else if (sort === 'newest') orderSql = "ORDER BY year DESC, id DESC";
    else if (sort === 'title') orderSql = "ORDER BY title ASC";

    // Count query
    const countRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM anime ${whereSql}`).bind(...params).first();
    const total = countRes ? Number(countRes.total) : 0;

    // Data query
    const queryParams = [...params, limit, offset];
    const dataRes = await env.DB.prepare(`SELECT * FROM anime ${whereSql} ${orderSql} LIMIT ? OFFSET ?`).bind(...queryParams).all();

    return new Response(JSON.stringify({
      data: dataRes.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
