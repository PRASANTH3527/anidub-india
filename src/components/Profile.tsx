import React from 'react';
import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react';

export default function Profile() {
  const { user } = useUser();

  return (
    <div className="min-h-screen pt-24 px-4 pb-20 flex flex-col items-center justify-center">
      {/* Show ONLY the Login Box to guests */}
      <SignedOut>
        <div className="w-full max-w-md flex flex-col items-center justify-center">
          <SignIn routing="hash" />
        </div>
      </SignedOut>

      {/* Show the Profile UI ONLY to logged-in users */}
      <SignedIn>
        <div className="w-full max-w-md bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-8 text-center border border-gray-700 shadow-2xl mt-10">
          {user?.imageUrl && (
            <img 
              src={user.imageUrl} 
              className="w-28 h-28 rounded-2xl mx-auto mb-4 border-2 border-purple-500 shadow-lg object-cover" 
              alt="Profile Avatar" 
            />
          )}
          <h1 className="text-2xl font-bold text-white mb-1">
            {user?.fullName}
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
          
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-green-400 font-semibold text-sm">
              ✓ Active Verified Profile
            </p>
          </div>
        </div>
      </SignedIn>
    </div>
  );
}

export { Profile as ProfileView };
