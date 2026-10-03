// Next.js App Router Route Handler: app/api/submissions/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 3600;
export const fetchCache = 'auto';

export { GET, POST, PUT, PATCH, DELETE, OPTIONS } from '../../../../api/submissions';
