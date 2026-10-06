import { serve } from 'inngest/next';
import { inngest } from '../../../lib/inngest';
import { processBulkUploadQueue } from '../../../inngest/functions/bulkUploadWorker';

// Inngest serverless endpoint for executing async background tasks
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processBulkUploadQueue,
  ],
});
