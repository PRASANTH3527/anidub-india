importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded');
  
  const { registerRoute } = workbox.routing;
  const { BackgroundSyncPlugin } = workbox.backgroundSync;
  const { NetworkOnly } = workbox.strategies;
  
  // Create a Background Sync Queue
  const bgSyncPlugin = new BackgroundSyncPlugin('watchlistQueue', {
    maxRetentionTime: 24 * 60, // Retry for up to 24 hours
  });
  
  // Register the route for 'Add to Watchlist' POST requests
  // This will queue requests when offline and replay them when online
  registerRoute(
    /\/api\/watchlist/,
    new NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'POST'
  );
  
  // Add a listener for the sync event to manually handle or log replays
  self.addEventListener('sync', (event) => {
    if (event.tag === 'workbox-background-sync:watchlistQueue') {
      console.log('Background Sync: Replaying queued watchlist requests...');
    }
  });

  // Default fetch handler for other requests
  self.addEventListener('fetch', (event) => {
    // Standard fetch behavior
  });
}
