import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Extract query parameters with fallbacks
    const title = searchParams.get('title') || 'AniDub India';
    const poster = searchParams.get('poster') || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80';
    const rawDubs = searchParams.get('dubs') || 'Tamil,Telugu';
    const studio = searchParams.get('studio') || 'Japanese Animation';
    const rating = searchParams.get('rating') || '8.8';
    const type = searchParams.get('type') || 'TV Series';

    // Parse dub languages
    const dubList = rawDubs
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    const hasTamil = dubList.some((d) => d.toLowerCase() === 'tamil');
    const hasTelugu = dubList.some((d) => d.toLowerCase() === 'telugu');
    const hasHindi = dubList.some((d) => d.toLowerCase() === 'hindi');
    const hasMalayalam = dubList.some((d) => d.toLowerCase() === 'malayalam');
    const hasKannada = dubList.some((d) => d.toLowerCase() === 'kannada');

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0b0f17',
            backgroundImage:
              'radial-gradient(circle at 25% 20%, rgba(147, 51, 234, 0.28) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.22) 0%, transparent 45%)',
            padding: '48px 60px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Left Column: Poster Image with neon shadow */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: '320px',
              height: '460px',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(147, 51, 234, 0.45)',
              border: '2px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt={title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Right Column: Title, Badges, Studio, and Platform Branding */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: '680px',
              height: '460px',
              paddingLeft: '32px',
            }}
          >
            {/* Brand Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(147, 51, 234, 0.18)',
                  border: '1px solid rgba(147, 51, 234, 0.45)',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                }}
              >
                <span
                  style={{
                    color: '#c084fc',
                    fontSize: '15px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  ⚡ AniDub India • Official Dubs
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  color: '#fbbf24',
                  fontSize: '17px',
                  fontWeight: 900,
                }}
              >
                ★ {rating}
              </div>
            </div>

            {/* Anime Title & Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
              <div
                style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  marginBottom: '12px',
                  maxHeight: '110px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: '#94a3b8',
                  fontSize: '17px',
                  fontWeight: 600,
                  gap: '12px',
                }}
              >
                <span>{studio}</span>
                <span>•</span>
                <span>{type}</span>
                <span>•</span>
                <span>Regional Audio Directory</span>
              </div>
            </div>

            {/* Dynamic Regional Dub Availability Badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <div style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Dub Availability:
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {hasTamil && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(245, 158, 11, 0.22)',
                      border: '1.5px solid rgba(245, 158, 11, 0.65)',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      color: '#fef3c7',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    🔥 Tamil Dub Available
                  </div>
                )}

                {hasTelugu && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(14, 165, 233, 0.22)',
                      border: '1.5px solid rgba(14, 165, 233, 0.65)',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      color: '#e0f2fe',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    ✨ Telugu Dub Available
                  </div>
                )}

                {hasHindi && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(16, 185, 129, 0.22)',
                      border: '1.5px solid rgba(16, 185, 129, 0.65)',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      color: '#d1fae5',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    ⚡ Hindi Dub Available
                  </div>
                )}

                {hasMalayalam && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(168, 85, 247, 0.22)',
                      border: '1.5px solid rgba(168, 85, 247, 0.65)',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      color: '#f3e8ff',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    🎙️ Malayalam Dub
                  </div>
                )}

                {hasKannada && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(99, 102, 241, 0.22)',
                      border: '1.5px solid rgba(99, 102, 241, 0.65)',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      color: '#e0e7ff',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    🎧 Kannada Dub
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Callout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <span>Legal Streaming: Crunchyroll • Netflix • JioCinema</span>
              <span style={{ color: '#c084fc', fontWeight: 800 }}>anidub.in</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate OG image: ${e.message}`, { status: 500 });
  }
}
