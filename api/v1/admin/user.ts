import { UserModel } from '../../../models/user';

import { Router } from 'express';
import { ServerModel } from '../../../models/server';
import { InviteModel } from '../../../models/invite';
export const router = Router();

router.get('/:user', async (req, res) => {
	const user = req.params.user;
	const data = await UserModel.findById(user);

	if (data == null) return res.status(404).json({ error: true, message: 'User not found.' });

	const servers = await ServerModel.find({
		$or: [
			{
				owner: data._id
			},
			{
				members: {
					$in: [data._id]
				}
			}
		]
	});

	return res.json({
		error: false,
		message: '',
		user: data.toJson(),
		servers: servers.map((s) => s.toJson())
	});
});

router.post('/:user/suspend', async (req, res) => {
	const user = req.params.user;
	const data = await UserModel.findById(user);

	const reason = req.body['reason'] || 'No reason provided';

	if (data == null) return res.status(404).json({ error: true, message: 'User not found.' });

	data.suspended = reason;
	await data.save();

	return res.json({
		error: false,
		message: 'User suspended.'
	});
});

router.post('/:user/unsuspend', async (req, res) => {
	const user = req.params.user;
	const data = await UserModel.findById(user);

	if (data == null) return res.status(404).json({ error: true, message: 'User not found.' });

	data.suspended = undefined;
	await data.save();

	return res.json({
		error: false,
		message: 'User unsuspended.'
	});
});

router.delete('/:user', async (req, res) => {
	const user = req.params.user;
	const data = await UserModel.findById(user);

	if (data == null) return res.status(404).json({ error: true, message: 'User not found.' });

	await data.delete();

	return res.json({
		error: false,
		message: 'User deleted.'
	});
});

router.post('/:user/invalidate_invites', async (req, res) => {
	const user = req.params.user;
	const data = await UserModel.findById(user);

	if (data == null) return res.status(404).json({ error: true, message: 'User not found.' });

	await InviteModel.deleteMany({
		inviter: data._id
	});

	return res.json({
		error: false,
		message: 'User invites invalidated.'
	});
});