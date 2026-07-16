import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
const queue = new Queue('default', { connection });

new Worker('default', async job => {
  console.log(`Processing job ${job.id}`);
  return { result: 'completed' };
}, { connection });

console.log('Worker started');
