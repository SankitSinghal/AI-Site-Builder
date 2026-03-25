import express, { Request, Response } from 'express';
import 'dotenv/config';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import prisma from './lib/prisma.js';
import morgan from 'morgan';
import userRouter from './routes/userRoutes.js';
import projectRouter from './routes/projectRoutes.js';
import { stripeWebhook } from './controllers/stripeWebhook.js';

const app = express();

const isProd = process.env.NODE_ENV === "production";

const corsOptions = {
  origin: isProd
    ? process.env.TRUSTED_ORIGINS?.split(',')
    : "*",
  credentials: true,
};

app.use(cors(corsOptions));

app.post(
  '/api/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

app.all('/api/auth/{*any}', toNodeHandler(auth));

app.use(express.json({ limit: '50mb' }));

if (!isProd) {
  app.use(morgan('dev'));
}

app.get('/', (req: Request, res: Response) => {
  res.send('Server is Live!');
});

app.use('/api/user', userRouter);
app.use('/api/project', projectRouter);

app.get("/check", async (req: Request, res: Response) => {
  try {
    await prisma.$connect();
    res.status(200).json({ message: "Database connected" });
  } catch (error) {
    res.status(500).json({ message: "Database not connected" });
  }
});


if (!isProd) {
  const port = 3000;
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

export default app;