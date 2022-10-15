import { onlineServers, server } from './socket';
import { Server } from 'socket.io';
import fetch from 'node-fetch';
import { UserModel } from '../models/user';
import { getServers } from '../middleware/authentication';
import c from 'ansi-colors';
import { unsign } from 'cookie-signature';

export var io;

function isCommand(plugin: string, command: string, provided: string) {
	const rawCommand = provided.split(' ')[0];
	const commandProvided = rawCommand.startsWith('/') ? rawCommand.substring(1) : rawCommand;
	return commandProvided.toLowerCase() == command.toLowerCase() || commandProvided.toLowerCase() == plugin.toLowerCase() + ':' + command.toLowerCase();
}

export function connectSocketio() {
	io = new Server(server, {
		path: '/panel',
		maxHttpBufferSize: 1e8,
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
			socket.join(socket.data.id);

			const servers = await getServers(data.id);
			servers.forEach((s) => {
				socket.join(s._id.toLowerCase());
			});

			// Check if the user is a admin
			if (user.admin == true) socket.data.admin = true;

			// Let user know they are logged in
			socket.emit('authenticated', { id: data.id });

			// Create or issue update if required
			if (user.tag != tag) {
				user.tag = tag;
				await user.save();
			}
		});

		socket.on('fetch log history', (data) => {
			if (data == null) return;
			const { server } = data;

			if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });

			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server))
				return socket.emit('CONSOLE_HISTORY', {
					logs: {
						type: 'CONSOLE',
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
				socket.emit('log history', {
					logs: (history || []).map((log) => {
						return {
							timestamp: log.timestamp,
							...log.log
						};
					})
				});
			});
		});

		socket.on('execute command', (data) => {
			if (data == null) return;
			var { server, command } = data;

			if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });
			if (!command) return socket.emit('error', { message: 'No command specified.' });
			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server)) return;

			io.to(server).emit('console', {
				log: c.bgMagenta(socket.data.tag) + ' executed command ' + c.cyan(command),
				level: 'SYSTEM',
				timestamp: Date.now()
			});

			// Command specific checks
			// say:
			if (isCommand('minecraft', 'say', command)) {
				const message = command.split(' ').slice(1).join(' ').replace(/"/g, '\\"');
				const username = socket.data.tag.split('#')[0];
				command = `minecraft:tellraw @a [{"text":"[@${username}] ","color":"#aa55aa"},{"text":"${message}","color":"white"}]`;
			}

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'EXECUTE_COMMAND',
					command: command,
					raw: data.command,
					user: socket.data.tag
				})
			);
		});

		socket.on('get files', (data) => {
			if (data == null) return;
			const { server, path } = data;

			if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });
			if (!path) return socket.emit('error', { message: 'No path specified.' });
			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server)) return;

			if (data.root && !socket.data.admin) return socket.emit('error', { message: 'You are not authorized to do that!' });

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'FETCH_FILE',
					path,
					root: data.root
				})
			);

			onlineServers.get(server)?.once('FILE_DATA', async ({ file }) => {
				socket.emit('file data', file);
			});
		});

		socket.on('download file', (data) => {
			if (data == null) return;
			const { server, path } = data;

			if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });

			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!path || typeof path !== 'string') return socket.emit('error', { message: 'No path specified.' });

			if (!onlineServers.has(server)) return;

			if (data.root && !socket.data.admin) return socket.emit('error', { message: 'You are not authorized to do that!' });

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'DOWNLOAD_FILE',
					path,
					user: socket.id,
					root: data.root
				})
			);
		});

        socket.on('upload file', (data) => {
            if (data == null) return;
            const { server, path } = data;

            if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });

            if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

            if (!path || typeof path !== 'string') return socket.emit('error', { message: 'No path specified.' });

            if (!onlineServers.has(server)) return;

            if (data.root && !socket.data.admin) return socket.emit('error', { message: 'You are not authorized to do that!' });

            onlineServers.get(server)?.send(
                JSON.stringify({
                    type: 'UPLOAD_FILE',
                    path,
                    replace: data.replace || false,
                    user: socket.id,
                    root: data.root
                })
            );
        })

        socket.on('file buffer', (data, buffer) => {
            if (data == null) return;
            const { server } = data;

            if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });

            if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

            if (!onlineServers.has(server)) return;

            if (data.root && !socket.data.admin) return socket.emit('error', { message: 'You are not authorized to do that!' });

            // Make sure buffer size is under 1MB
            if (Buffer.byteLength(buffer) > 1024 * 1024) return socket.emit('error', { message: 'Upload Buffer too large, chunk rejected.' })

            onlineServers.get(server)?.send(
                buffer
            );
        })

        socket.on('EOF', (data) => {
            if (data == null) return;
            const { server } = data;

            if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });

            if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

            if (!onlineServers.has(server)) return;

            if (data.root && !socket.data.admin) return socket.emit('error', { message: 'You are not authorized to do that!' });

            onlineServers.get(server)?.send(
                JSON.stringify({
                    type: 'EOF'
                })
            );
        })

		socket.on('get players', (data) => {
			if (data == null) return;
			const { server } = data;

			if (!server || typeof server !== 'string') return socket.emit('error', { message: 'No server specified.' });
			if (!socket.hasPermission(server)) return socket.emit('error', { message: 'You are not authorized to do that!' });

			if (!onlineServers.has(server)) return;

			onlineServers.get(server)?.send(
				JSON.stringify({
					type: 'GET_PLAYERS'
				})
			);
		});
	});
}
