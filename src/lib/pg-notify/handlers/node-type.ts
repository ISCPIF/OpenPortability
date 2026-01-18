import { redis } from '../../redis';
import { SSE_GRAPH_CHANNEL } from '../../sse/constants';

export async function handleNodeTypeChange(payload: any): Promise<void> {
  await redis.publish(SSE_GRAPH_CHANNEL, {
    type: 'nodeTypes',
    data: {
      changes: [
        {
          twitter_id: payload.twitter_id,
          node_type: payload.node_type,
        },
      ],
    },
    userId: null,
    timestamp: payload.timestamp || Date.now(),
  });
}
