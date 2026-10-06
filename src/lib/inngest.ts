import { Inngest } from 'inngest';

// Create Inngest client for enterprise serverless event queueing
export const inngest = new Inngest({
  id: 'anidub-india',
  name: 'AniDub India Queue System',
});
