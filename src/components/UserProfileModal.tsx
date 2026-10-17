import React, { useState, useEffect } from 'react';
import { X, Upload, User, Mail, Shield, CheckCircle2, Loader2, Sparkles, Cloud, ExternalLink } from 'lucide-react';
import { validateImageUpload } from '../utils/imgbb';

interface UserProfileModalProps {
  onClose: () => void;
  onProfileUpdated: (user: any) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ onClose, onProfileUpdated }) => {
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      setProfile(data);
      setUsername(data.username || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || 'https://i.ibb.co/vzS8G90/default-avatar.png');
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate using pure logic utility
    const validation = validateImageUpload(file.size, file.type);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file');
      return;
    }

    setUploadError('');
    setUploading(true);
    setSuccessMsg('');

    try {
      // Read file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Securely call backend Cloudflare Function for ImgBB upload
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            filename: file.name,
            type: 'user_avatar'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload to ImgBB');

        setAvatarUrl(data.url);
        setSuccessMsg(`Avatar uploaded to ImgBB! URL: ${data.url}`);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading to ImgBB');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setSaving(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          bio,
          avatar_url: avatarUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setSuccessMsg('Profile and ImgBB avatar successfully saved to Cloudflare D1!');
      onProfileUpdated({ ...profile, username, bio, avatar_url: avatarUrl });
    } catch (err: any) {
      setUploadError(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-xs font-semibold text-orange-400 mb-2">
          <Cloud className="w-4 h-4" />
          <span>Cloudflare D1 & ImgBB User Profile</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white font-['Space_Grotesk',sans-serif] mb-1">
          Edit Profile & Avatar
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Your profile picture is uploaded securely via ImgBB API backend and stored in Cloudflare D1.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border-2 border-orange-500/50 flex-shrink-0 shadow-lg">
                <img
                  src={avatarUrl}
                  alt={username}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ImgBB Profile Picture
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload New Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-500">Max 32MB (JPEG, PNG, WEBP)</span>
                </div>
                {avatarUrl && (
                  <div className="mt-2 text-[10px] text-slate-400 truncate max-w-xs font-mono">
                    <span className="text-orange-400">D1 Stored URL:</span> {avatarUrl}
                  </div>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {uploadError}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{successMsg}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-orange-400" />
                  <span>Display Username</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-400" />
                  <span>Email (D1 Bound)</span>
                </label>
                <input
                  type="email"
                  value={profile?.email || 'kaito@cloudflare-anime.dev'}
                  disabled
                  className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Bio / Watcher Status</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
                  placeholder="Tell other anime fans about your favorite genres..."
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Key secured server-side in Cloudflare Worker
              </span>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Save Profile to D1</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
