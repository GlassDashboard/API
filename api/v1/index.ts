import { Router } from 'express';
export const router = Router();

import { router as serverRouter } from './server';
router.use('/server', serverRouter);

import { router as discordRouter } from './discord';
router.use('/discord', discordRouter);

router.get('/ping', (req, res) => {
	res.json({ error: false, message: 'pong' });
});
