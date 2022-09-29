import { onlineServers, server } from './socket';
import { Server } from 'socket.io';
import fetch from 'node-fetch';
import { UserModel } from '../models/user';
import { getServers } from '../middleware/authentication';
import c from 'ansi-colors';
import { unsign } from 'cookie-signature';

export var io;

export function connectSocketio() {
	io = new Server(server, {
		path: '/panel',
		cors: {
			origin: 'http://localhost:3000',
			credentials: true
		}
	});

	io.on('connection', (socket) => {
		socket.on('reconnect', () => socket.emit('connected'));

		socket.hasPermission = (server) => {
			return socket.rooms.has(server.toLowerCase()) || socket.data.admin;
		};

		socket.on('authenticate', async (info) => {
			const rawToken = info['token'];
			if (!rawToken) return socket.emit('error', { message: 'No token provided.' });

			const token = decodeURIComponent(rawToken);

			if (!token.includes('.')) return socket.emit('error', { message: 'Invalid token. Please log out and back in.' });

			const signed = unsign(token, process.env.COOKIE_SECRET || 'hello world');
			if (!signed) return socket.emit('error', { message: 'Failed to authenticate!' });

			const data = await fetch(`https://discordapp.com/api/users/@me`, {
				headers: {
					Authorization: `Bearer ${token.split('.')[0]}`
				}
			}).then((res) => res.json());

			if (!data || !data.id) return socket.emit('error', { message: 'Failed to authenticate!' });

			// Handle user creation
			const tag = data.username + '#' + data.discriminator;
			var user = await UserModel.findById(data.id);

			if (!user) return socket.emit('error', { message: 'Failed to fetch user profile! Are you sure you are logged in?' });
			socket.data.tag = tag;

			// Assign to rooms
			const servers = await getServers(data.id);
			servers.forEach((s) => {
				socket.join(s._id.toLowerCase());
			});

			// Notify user if admin
			if (user.admin == true) socket.data.admin = true;

			// Let user know they are logged in
			socket.emit('authenticated', { id: data.id });

			// Create or issue update if required
			if (user.tag != tag) {
				user.tag = tag;
				await user.save();
			}
		});

		socket.on('fetch log history', ({ server }) => {
			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server))
				return socket.emit('CONSOLE_HISTORY', {
					logs: {
						level: 'ERROR',
						line: '[MHWeb] Server is currently offline!',
						timestamp: Date.now()
					}
				});

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'CONSOLE_HISTORY'
				})
			);

			onlineServers.get(server)?.once('CONSOLE_HISTORY', async ({ history }) => {
				socket.emit('log history', { logs: history });
			});
		});

		socket.on('execute command', ({ server, command }) => {
			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server)) return;

			io.to(server).emit('console', {
				log: c.bgMagenta(socket.data.tag) + ' executed command ' + c.cyan(command),
				level: 'SYSTEM',
				timestamp: Date.now()
			});

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'EXECUTE_COMMAND',
					command: command
				})
			);
		});

		socket.on('get files', ({ server, path }) => {
			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server)) return;

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'FETCH_FILE',
					path
				})
			);

			onlineServers.get(server)?.once('FILE_DATA', async ({ file }) => {
				socket.emit('file data', file);
			});
		});
	});
}
