import { Router } from 'express';
export const router = Router();

import { router as inviteRouter } from './invite';
router.use('/invite', inviteRouter);
