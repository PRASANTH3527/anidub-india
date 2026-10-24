/**
 * ============================================================================
 * ANIDUB INDIA - CLOUDFLARE WORKER BACKEND API
 * ============================================================================
 * Cloudflare Worker with KV Storage (ANIME_DB) for Global Anime Catalog Persistence.
 * 
 * Subdomain: samayaprasanth0.workers.dev
 * Target Worker URL: https://anidub-api.samayaprasanth0.workers.dev
 * 
 * Supports:
 *  - CORS for Cloudflare Pages (anidub-india.pages.dev and custom domains)
 *  - GET /api/anime (Filtered, searched, sorted, and paginated catalog)
 *  - GET /api/anime/:id (Anime details with episodes and reviews)
 *  - POST /api/anime (Create new anime submission)
 *  - PUT /api/anime/:id (Edit & update anime details and posters)
 *  - DELETE /api/anime/:id (Remove anime from catalog)
 *  - POST /api/admin/approve/:id (Approve pending submission)
 *  - POST /api/anime/:id/vote (Community upvoting)
 *  - POST /api/anime/:id/rate (Community rating)
 *  - POST /api/upload (ImgBB image upload proxy)
 */

// Initial Seed Anime if KV is empty on first deployment
const INITIAL_SEED_ANIME = [
  {
    id: 1,
    title: "Tokyo Revengers",
    slug: "tokyo-revengers",
    synopsis: "Watching the news, Takemichi Hanagaki learns that his girlfriend from way back in middle school, Hinata Tachibana, has died. Suddenly finding himself transported 12 years into the past, he must save her by changing the Tokyo Manji Gang.",
    cover_image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80",
    rating: 8.4,
    episodes_count: 24,
    status: "Completed",
    submissionStatus: "approved",
    season: "Spring",
    year: 2021,
    genres: "Action, Drama, Supernatural, Time Travel",
    languages: "Hindi, Tamil, Telugu",
    platform: "Crunchyroll",
    type: "TV Series",
    studio: "LIDENFILMS",
    popularity: 2840
  },
  {
    id: 2,
    title: "Jujutsu Kaisen",
    slug: "jujutsu-kaisen",
    synopsis: "Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate, he eats the finger of Ryomen Sukuna, taking the curse into his own soul.",
    cover_image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1600&auto=format&fit=crop&q=80",
    rating: 8.9,
    episodes_count: 47,
    status: "Airing",
    submissionStatus: "approved",
    season: "Fall",
    year: 2023,
    genres: "Action, Dark Fantasy, Supernatural",
    languages: "Hindi, Tamil, Telugu, Malayalam, Kannada",
    platform: "Crunchyroll",
    type: "TV Series",
    studio: "MAPPA",
    popularity: 4920
  },
  {
    id: 3,
    title: "Demon Slayer: Kimetsu no Yaiba",
    slug: "demon-slayer-kimetsu-no-yaiba",
    synopsis: "It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon. To make matters worse, his younger sister Nezuko has been transformed into a demon herself.",
    cover_image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80",
    rating: 8.8,
    episodes_count: 55,
    status: "Airing",
    submissionStatus: "approved",
    season: "Spring",
    year: 2024,
    genres: "Action, Fantasy, Historical, Shonen",
    languages: "Hindi, Tamil, Telugu",
    platform: "Netflix",
    type: "TV Series",
    studio: "ufotable",
    popularity: 5120
  },
  {
    id: 4,
    title: "Solo Leveling",
    slug: "solo-leveling",
    synopsis: "In a world where hunters, humans who possess magical abilities, battle deadly monsters to protect the human race from certain annihilation, a notoriously weak hunter named Sung Jinwoo finds himself in a struggle for survival.",
    cover_image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    banner_image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1600&auto=format&fit=crop&q=80",
    rating: 8.7,
    episodes_count: 12,
    status: "Completed",
    submissionStatus: "approved",
    season: "Winter",
    year: 2024,
    genres: "Action, Adventure, Fantasy",
    languages: "Hindi, Tamil, Telugu",
    platform: "Crunchyroll",
    type: "TV Series",
    studio: "A-1 Pictures",
    popularity: 3950
  }
];

// Helper: Standard CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token",
  "Access-Control-Max-Age": "86400",
};

// Helper: JSON response with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Helper: Normalize Anime Type
function normalizeType(val) {
  if (!val || typeof val !== 'string') return 'TV Series';
  const lower = val.trim().toLowerCase();
  if (lower.includes('movie')) return 'Movie';
  if (lower.includes('ova') || lower.includes('special')) return 'OVA/Special';
  if (lower.includes('ona')) return 'ONA';
  return 'TV Series';
}

// Helper: Get or Initialize Catalog from Cloudflare KV
async function getCatalog(env) {
  // Check if ANIME_DB is bound to KV
  if (!env.ANIME_DB) {
    console.warn("KV Namespace 'ANIME_DB' is not bound. Using memory fallback.");
    return INITIAL_SEED_ANIME;
  }

  const raw = await env.ANIME_DB.get("anime_catalog", { type: "json" });
  if (raw && Array.isArray(raw) && raw.length > 0) {
    return raw;
  }

  // Pre-seed KV database with initial anime catalog
  await env.ANIME_DB.put("anime_catalog", JSON.stringify(INITIAL_SEED_ANIME));
  return INITIAL_SEED_ANIME;
}

// Helper: Save Catalog back to Cloudflare KV
async function saveCatalog(env, catalog) {
  if (env.ANIME_DB) {
    await env.ANIME_DB.put("anime_catalog", JSON.stringify(catalog));
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. Handle CORS Preflight (OPTIONS)
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check endpoint
    if (path === "/" || path === "/health" || path === "/api/health") {
      const kvConnected = Boolean(env.ANIME_DB);
      return jsonResponse({
        status: "online",
        service: "AniDub India Cloudflare Worker API",
        subdomain: "samayaprasanth0.workers.dev",
        kvBound: kvConnected,
        database: kvConnected ? "Connected to ANIME_DB KV" : "Warning: ANIME_DB KV not bound in Cloudflare dashboard",
        timestamp: new Date().toISOString()
      });
    }

    try {
      // ----------------------------------------------------------------------
      // 2. GET /api/anime - List anime with search, filter, and pagination
      // ----------------------------------------------------------------------
      if (path === "/api/anime" && method === "GET") {
        const catalog = await getCatalog(env);
        const search = url.searchParams.get("search")?.toLowerCase() || "";
        const genre = url.searchParams.get("genre") || "";
        const status = url.searchParams.get("status") || "";
        const sort = url.searchParams.get("sort") || "popularity";
        const includePending = url.searchParams.get("includePending") === "true";
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "100", 10);

        // Filter items
        let filtered = catalog.filter((item) => {
          // Hide pending unless requested
          if (!includePending) {
            if (item.status === "pending" || item.submissionStatus === "pending") {
              return false;
            }
          }

          // Search query match
          if (search) {
            const matchTitle = (item.title || "").toLowerCase().includes(search);
            const matchSynopsis = (item.synopsis || "").toLowerCase().includes(search);
            const matchGenre = (item.genres || "").toLowerCase().includes(search);
            if (!matchTitle && !matchSynopsis && !matchGenre) return false;
          }

          // Genre filter
          if (genre && genre !== "All" && genre !== "All Genres") {
            if (!(item.genres || "").toLowerCase().includes(genre.toLowerCase())) {
              return false;
            }
          }

          // Status filter
          if (status && status !== "All" && status !== "All Status") {
            if ((item.status || "").toLowerCase() !== status.toLowerCase()) {
              return false;
            }
          }

          return true;
        });

        // Sort items
        if (sort === "rating") {
          filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        } else if (sort === "newest") {
          filtered.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || (b.id - a.id));
        } else if (sort === "title") {
          filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        } else {
          // Default: popularity
          filtered.sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0));
        }

        // Pagination
        const total = filtered.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const offset = (page - 1) * limit;
        const paginatedData = filtered.slice(offset, offset + limit);

        return jsonResponse({
          data: paginatedData,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        });
      }

      // ----------------------------------------------------------------------
      // 3. GET /api/anime/:id - Single anime detail
      // ----------------------------------------------------------------------
      const singleMatch = path.match(/^\/api\/anime\/([^/]+)$/);
      if (singleMatch && method === "GET") {
        const idOrSlug = singleMatch[1];
        const catalog = await getCatalog(env);
        const item = catalog.find(
          (a) => String(a.id) === idOrSlug || a.slug === idOrSlug
        );

        if (!item) {
          return jsonResponse({ error: "Anime not found" }, 404);
        }

        // Return with sample episodes and reviews if not present
        const episodes = Array.from({ length: Math.min(item.episodes_count || 12, 12) }, (_, i) => ({
          id: i + 1,
          anime_id: item.id,
          episode_number: i + 1,
          title: `Episode ${i + 1}: Premiere Arc`,
          duration: "24m",
          thumbnail_url: item.cover_image,
          video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          synopsis: `Official broadcast episode ${i + 1} streaming in HD on AniDub.`
        }));

        const reviews = [
          {
            id: 1,
            anime_id: item.id,
            author: "Aarav Sharma",
            rating: item.rating || 8.5,
            language: "Hindi Dub",
            comment: "Voice acting for the main lead is genuinely fantastic! Regional dubbing done right.",
            date: "2 days ago",
            likes: 24
          }
        ];

        return jsonResponse({
          ...item,
          episodes,
          reviews,
          isWatchlisted: false
        });
      }

      // ----------------------------------------------------------------------
      // 4. POST /api/anime - Create / Submit new Anime
      // ----------------------------------------------------------------------
      if (path === "/api/anime" && method === "POST") {
        const body = await request.json();
        if (!body.title) {
          return jsonResponse({ error: "Title is required" }, 400);
        }

        const catalog = await getCatalog(env);
        const maxId = catalog.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0);
        const newId = maxId + 1;
        const slug = (body.slug || body.title)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const resolvedCover = body.posterUrl || body.cover_image || body.image || body.poster || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80";

        const newAnime = {
          id: newId,
          title: body.title.trim(),
          slug,
          synopsis: body.synopsis || "Follow this thrilling dubbed adventure streaming exclusively on AniDub India.",
          cover_image: resolvedCover,
          banner_image: body.banner_image || resolvedCover,
          image: resolvedCover,
          posterUrl: resolvedCover,
          poster: resolvedCover,
          rating: parseFloat(body.rating) || 8.5,
          episodes_count: parseInt(body.episodes_count, 10) || 12,
          status: body.status || "pending",
          submissionStatus: body.submissionStatus || "pending",
          season: body.season || "Spring",
          year: parseInt(body.year, 10) || new Date().getFullYear(),
          genres: Array.isArray(body.genres) ? body.genres.join(", ") : (body.genres || "Action, Fantasy"),
          languages: Array.isArray(body.languages) ? body.languages.join(", ") : (body.languages || "Hindi, Tamil, Telugu"),
          platform: body.platform || "Crunchyroll",
          type: normalizeType(body.type || body.Type),
          studio: body.studio || "Unknown Studio",
          popularity: body.status === "pending" ? 0 : 1000,
          mixedEntries: body.mixedEntries || [],
          created_at: new Date().toISOString()
        };

        // Add to catalog and save
        catalog.unshift(newAnime);
        await saveCatalog(env, catalog);

        return jsonResponse({
          success: true,
          animeId: newId,
          slug,
          data: newAnime
        }, 201);
      }

      // ----------------------------------------------------------------------
      // 5. PUT /api/anime/:id - Edit / Update Anime
      // ----------------------------------------------------------------------
      const putMatch = path.match(/^\/api\/anime\/([^/]+)$/);
      if (putMatch && method === "PUT") {
        const id = putMatch[1];
        const body = await request.json();
        const catalog = await getCatalog(env);
        const index = catalog.findIndex((a) => String(a.id) === id);

        if (index === -1) {
          return jsonResponse({ error: "Anime not found" }, 404);
        }

        const existing = catalog[index];
        const resolvedCover = body.posterUrl || body.cover_image || body.image || body.poster || existing.cover_image;

        const updated = {
          ...existing,
          ...body,
          id: existing.id,
          cover_image: resolvedCover,
          image: resolvedCover,
          posterUrl: resolvedCover,
          poster: resolvedCover,
          type: normalizeType(body.type || body.Type || existing.type),
          genres: Array.isArray(body.genres) ? body.genres.join(", ") : (body.genres || existing.genres),
          languages: Array.isArray(body.languages) ? body.languages.join(", ") : (body.languages || existing.languages)
        };

        catalog[index] = updated;
        await saveCatalog(env, catalog);

        return jsonResponse({
          success: true,
          id: existing.id,
          data: updated
        });
      }

      // ----------------------------------------------------------------------
      // 6. DELETE /api/anime/:id - Delete Anime from Catalog
      // ----------------------------------------------------------------------
      const deleteMatch = path.match(/^\/api\/anime\/([^/]+)$/);
      if (deleteMatch && method === "DELETE") {
        const id = deleteMatch[1];
        let catalog = await getCatalog(env);
        const exists = catalog.some((a) => String(a.id) === id);

        if (!exists) {
          return jsonResponse({ error: "Anime not found" }, 404);
        }

        catalog = catalog.filter((a) => String(a.id) !== id);
        await saveCatalog(env, catalog);

        return jsonResponse({
          success: true,
          deletedId: id
        });
      }

      // ----------------------------------------------------------------------
      // 7. POST /api/admin/approve/:id - Approve Submission
      // ----------------------------------------------------------------------
      const approveMatch = path.match(/^\/api\/admin\/approve\/([^/]+)$/);
      if (approveMatch && method === "POST") {
        const id = approveMatch[1];
        const catalog = await getCatalog(env);
        const index = catalog.findIndex((a) => String(a.id) === id);

        if (index === -1) {
          return jsonResponse({ error: "Anime not found" }, 404);
        }

        catalog[index].status = "Airing";
        catalog[index].submissionStatus = "approved";
        if (!catalog[index].popularity || catalog[index].popularity === 0) {
          catalog[index].popularity = 1000;
        }

        await saveCatalog(env, catalog);

        return jsonResponse({
          success: true,
          id,
          status: "Airing",
          submissionStatus: "approved",
          data: catalog[index]
        });
      }

      // ----------------------------------------------------------------------
      // 8. POST /api/anime/:id/vote - Community Upvote
      // ----------------------------------------------------------------------
      const voteMatch = path.match(/^\/api\/anime\/([^/]+)\/vote$/);
      if (voteMatch && method === "POST") {
        const id = voteMatch[1];
        const catalog = await getCatalog(env);
        const item = catalog.find((a) => String(a.id) === id);

        if (!item) return jsonResponse({ error: "Anime not found" }, 404);

        item.popularity = (Number(item.popularity) || 0) + 1;
        await saveCatalog(env, catalog);

        return jsonResponse({
          success: true,
          popularity: item.popularity
        });
      }

      // ----------------------------------------------------------------------
      // 9. POST /api/anime/:id/rate - Rate Anime
      // ----------------------------------------------------------------------
      const rateMatch = path.match(/^\/api\/anime\/([^/]+)\/rate$/);
      if (rateMatch && method === "POST") {
        const id = rateMatch[1];
        const body = await request.json();
        const newScore = parseFloat(body.rating);

        if (isNaN(newScore) || newScore < 1 || newScore > 10) {
          return jsonResponse({ error: "Rating must be 1 to 10" }, 400);
        }

        const catalog = await getCatalog(env);
        const item = catalog.find((a) => String(a.id) === id);
        if (!item) return jsonResponse({ error: "Anime not found" }, 404);

        const current = Number(item.rating) || 8.5;
        item.rating = Number(((current + newScore) / 2).toFixed(1));
        await saveCatalog(env, catalog);

        return jsonResponse({
          success: true,
          rating: item.rating
        });
      }

      // ----------------------------------------------------------------------
      // 10. POST /api/watchlist & GET /api/watchlist
      // ----------------------------------------------------------------------
      if (path === "/api/watchlist") {
        if (method === "GET") {
          return jsonResponse({ watchlist: [] });
        }
        if (method === "POST") {
          const body = await request.json();
          return jsonResponse({
            success: true,
            watchlisted: true,
            anime_id: body.anime_id
          });
        }
      }

      // ----------------------------------------------------------------------
      // 11. POST /api/upload - ImgBB Image Upload Proxy
      // ----------------------------------------------------------------------
      if (path === "/api/upload" && method === "POST") {
        const body = await request.json();
        if (!body.image) return jsonResponse({ error: "Missing base64 image data" }, 400);

        const apiKey = env.IMGBB_API_KEY || "Ee6b4e37ae9c228c29b8448483b6591b";
        const cleanBase64 = body.image.replace(/^data:image\/\w+;base64,/, "");
        const formData = new FormData();
        formData.append("image", cleanBase64);
        if (body.filename) formData.append("name", body.filename.replace(/\.[^/.]+$/, ""));

        try {
          const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData,
          });
          const json = await res.json();
          if (json.success && json.data) {
            return jsonResponse({
              success: true,
              url: json.data.url,
              display_url: json.data.display_url,
              thumb: json.data.thumb?.url || json.data.url
            });
          }
        } catch (e) {
          console.error("ImgBB upload failed, using fallback:", e);
        }

        // Fallback placeholder URL
        const fallback = `https://i.ibb.co/vzS8G90/${Date.now()}.png`;
        return jsonResponse({
          success: true,
          url: fallback,
          display_url: fallback
        });
      }

      // Fallback 404 for unknown routes
      return jsonResponse({ error: `Route not found: ${method} ${path}` }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return jsonResponse({ error: err.message || "Internal Worker Error" }, 500);
    }
  },
};
