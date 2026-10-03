import React from 'react';
import { Metadata } from 'next';
import AdminDashboard from '../../components/AdminDashboard';

export const metadata: Metadata = {
  title: 'Real-time Admin Dashboard — AniDub India',
  description: 'Live mobile-first real-time analytics powered by Firebase Cloud Firestore onSnapshot for AniDub India.',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
