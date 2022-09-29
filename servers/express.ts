import Express, { Request, Response } from 'express';
export const app = Express();

app.get('/', (req: Request, res: Response) => {
	res.json({
		error: true,
		message: 'Please specify an API version',
		example: '/v1/server/example-server-id'
	});
});

// Middleware
import cookieParser from 'cookie-parser';
app.use(cookieParser(process.env.COOKIE_SECRET || 'hello world'));

import cors from 'cors';
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

import ratelimit from '../middleware/ratelimit';
app.use(ratelimit(200, '1m'));

// Routes
import { router as v1Router } from '../api/v1';
app.use('/v1', v1Router);
