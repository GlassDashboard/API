import { Request, Router } from 'express';
import { AuthenticatedRequest } from 'middleware/authentication';
import { Invite, InviteModel } from '../../../models/invite';
export const router = Router();

// Invite Specific
router.post('/', async (req: Request, res) => {
	const auth = req as AuthenticatedRequest;

	const uses = (req.query['uses'] as string) || '1';
	if (isNaN(uses as any)) return res.status(400).json({ error: true, message: 'Invalid uses.' });

	const invite = await Invite.create(auth.discord.id, parseInt(uses as string));

	res.json({
		error: false,
		message: '',
		invite: invite.toJson()
	});
});

router.delete('/:invite', async (req: Request, res) => {
	const invite = await InviteModel.findById(req.params.invite);
	if (!invite) return res.status(404).json({ error: true, message: 'Invite not found.' });

	await invite.delete();

	res.json({
		error: false,
		message: 'Invite deleted'
	});
});
