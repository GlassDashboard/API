import { Router } from 'express';
import { getCached, setCached } from '../../../middleware/cache';
import { ServerModel } from '../../../models/server';
import { UserModel } from '../../../models/user';
export const router = Router();

router.get('/', async (req, res) => {
	const cache = getCached('stats');
	if (cache != null) return res.json(cache);

	const users = await UserModel.countDocuments();
	const servers = await ServerModel.countDocuments();

	const response = {
		error: false,
		message: '',
		users,
		servers
	};

	setCached('stats', response);
	res.json(response);
});
