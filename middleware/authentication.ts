import { Request } from 'express';
import { Server, ServerModel } from '../models/server';
import { unsign } from 'cookie-signature';
import { getCached, setCached } from './cache';
import fetch from 'node-fetch';
import { UserModel } from '../models/user';

export async function loggedIn(req, res, next) {
	// Get authorization header
	const authorization = req.headers.authorization;
	if (!authorization) return res.status(401).json({ error: true, message: 'No authorization header provided!' });

	const authData = authorization.split(' ').map((s) => {
		return decodeURIComponent(s);
	});
	if (authData.length !== 2 || authData[0] !== 'Bearer') return res.status(401).json({ error: true, message: 'Invalid authorization header provided!' });

	const token = unsign(authData[1], process.env.COOKIE_SECRET || 'hello world');
	if (!token) return res.status(401).json({ error: true, message: 'You are not logged in to discord!' });

	const cache = getCached(token);
	if (cache) {
		(req as AuthenticatedRequest).discord = cache;
		return next();
	}

	// Get user data from discord
	const data: DiscordData = await fetch(`https://discordapp.com/api/users/@me`, {
		headers: {
			Authorization: `Bearer ${token}`
		}
	}).then((res) => res.json());

	if (data.error || data.code === 0) return res.status(401).json({ error: true, message: 'You are not logged in to discord!' });
	if (!data.verified) return res.status(401).json({ error: true, message: 'Verify your email on discord!' });

	// Attach data
	setCached(token, data, 600);
	(req as AuthenticatedRequest).discord = data;

	next();
}

export function requiresPermission(permission) {
	return async (req, res, next) => {
		const server = req.params.server;
		if (!server) return req.status(400).json({ error: true, message: 'No server specified.' });
		loggedIn(req, res, async () => {
			const data = await ServerModel.findById(server);
			if (!data) return res.status(404).json({ error: true, message: 'The server specified was not found.' });
			if (!data.hasPermission(req.discord.id, permission)) return res.status(403).json({ error: true, message: 'You do not have permission to do that.' });
			(req as ServerRequest).server = data;
			next();
		});
	};
}

export function adminEndpoint(req, res, next) {
	loggedIn(req, res, async () => {
		const auth = req as AuthenticatedRequest;
		const data = await UserModel.findById(auth.discord.id);
		if (!data) return res.status(404).json({ error: true, message: 'You are not authenticated!' });

		if (!data.admin) return res.status(403).json({ error: true, message: 'You do not have permission to do that.' });

		next();
	});
}

export async function getServers(account) {
	return await ServerModel.find({
		$or: [{ owner: account }, { users: { $elemMatch: { _id: account } } }]
	});
}

export interface AuthenticatedRequest extends Request {
	token: string;
	discord: DiscordData;
}

export interface ServerRequest extends AuthenticatedRequest {
	server: Server;
}

export interface DiscordData {
	accent_color: string;
	avatar: string;
	avatar_decoration: string;
	banner: string;
	banner_color: string;
	discriminator: string;
	email: string;
	flags: number;
	id: string;
	locale: string;
	mfa_enabled: boolean;
	public_flags: number;
	username: string;
	verified: boolean;

	error?: boolean;
	code?: number;
	message?: string;
}
