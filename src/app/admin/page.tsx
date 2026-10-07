import React from 'react';
import { Metadata } from 'next';
import AdminDashboard from '../../components/AdminDashboard';

export const metadata: Metadata = {
  title: 'Real-time Admin Dashboard — AniDub India',
  description: 'Mobile-first analytics and moderation console with aggressive caching and optimized reads for AniDub India.',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
