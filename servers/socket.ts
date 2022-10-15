import { Server, ServerModel } from '../models/server';
import WebSocket from 'ws';
import { io } from './socketio';

export var onlineServers: Map<string, ServerSocket> = new Map();

export const server = require('http').createServer();
const WSServer = require('ws').Server;

const wss = new WSServer({
	server: server,
	maxPayload: 1024 * 1024 * 1.1
});

wss.on('connection', (ws: ServerSocket) => {
	ws.setMaxListeners(60); // We may be listening to a lot of events at once at some points, it shouldn't hit 60 though
	ws.binaryType = 'arraybuffer';

	ws.closeError = (data) => {
		ws.send(JSON.stringify({ type: 'ERROR', ok: false, ...data }));
		if (ws.server) console.log(`[${ws.server.name}] Disconnecting: ${data.message}`);
		ws.terminate();
	};

	ws.pinger = setInterval(() => {
		if (Date.now() - ws.lastPong > 5000) {
			console.log(`[${ws.server.name}] Status updated to OFFLINE`);
			onlineServers.delete(ws.server._id);

			clearInterval(ws.pinger);
			io.to(ws.server._id.toLowerCase()).emit('error', { message: 'Connection to server timed out!' });
			io.to(ws.server._id.toLowerCase()).emit('server status', { server: ws.server._id, status: 'OFFLINE' });
			return ws.closeError({ message: 'No PONG packet recieved for over 5000ms!' });
		}

		ws.send(JSON.stringify({ type: 'PING' }));
	}, 2000);

	setTimeout(() => {
		if (!ws.server) ws.closeError({ message: 'No authentication passed!' });
	}, 5000);

	ws.on('message', async (message) => {
		if (message && message.toString('utf8') === '[object ArrayBuffer]') {
			if (!ws.server) return ws.closeError({ message: 'No authentication passed!' });
			if (!ws.fileAwait) return ws.closeError({ message: 'Not waiting for file!' });

			io.to(ws.fileAwait.user).emit('download', ws.fileAwait.name, message);
			return;
		}

		var data;
		try {
			data = JSON.parse(message.toString('utf8'));
			if (!data || !data.type) return;
		} catch (_ignored) {
			ws.closeError({ message: 'Invalid JSON provided!' });
		}

		if (data == undefined) return;
		if (data.type == 'PONG') ws.lastPong = Date.now();

		if (data.type == 'LOGIN') {
			const token = data['token'];
			if (!token) return ws.closeError({ type: 'LOGIN_STATUS', message: 'Authentication failed (1)' });

			const server = await ServerModel.findOne({ token });
			if (!server) return ws.closeError({ type: 'LOGIN_STATUS', message: 'Authentication failed (2)' });

			if (server.suspended) return ws.closeError({ type: 'LOGIN_STATUS', message: 'This server is suspended from MHWeb!' });
			if (onlineServers.has(server.id)) return ws.closeError({ type: 'LOGIN_STATUS', message: 'This server is already online and managed!' });

			ws.send(JSON.stringify({ type: 'LOGIN_STATUS', ok: true, server: server.apiID }));
			ws.server = server.toJson();

			console.log(`[${server.name}] Status updated to ONLINE`);
			io.to(server._id.toLowerCase()).emit('server status', { server: server._id, status: 'ONLINE' });
			onlineServers.set(server._id, ws);

			// Mark server as setup if it is not already
			if (server.setup) {
				server.setup = undefined;
				await server.save();
			}

			return;
		}

		if (!ws.server) return ws.closeError({ message: 'Not authenticated.' });

		if (data.type == 'CONSOLE') {
			io.to(ws.server._id.toLowerCase()).emit('console', data);
		}

		if (data.type == 'CONSOLE_HISTORY') {
			if (!data.history) return ws.closeError({ message: 'Invalid data provided, outdated or modified?' });
			ws.emit('CONSOLE_HISTORY', { history: data.history });
		}

		if (data.type == 'FILE_DATA') {
			if (!data.file) return ws.closeError({ message: 'Invalid data provided, outdated or modified?' });
			ws.emit('FILE_DATA', { file: data.file });
		}

		if (data.type == 'ALL_FILES') {
			if (!data.files) return ws.closeError({ message: 'Invalid data provided, outdated or modified?' });
			ws.emit('ALL_FILES', { files: data.files });
		}

		if (data.type == 'PLAYER_LIST') {
			if (!data.players) return ws.closeError({ message: 'Invalid data provided, outdated or modified?' });
			io.to(ws.server._id.toLowerCase()).emit('players', data.players);
		}

		if (data.type == 'FILE_STREAM') {
			const started = Date.now();

			if (!data.name || !data.user) return ws.closeError({ message: 'Invalid data provided, outdated or modified?' });
			ws.fileAwait = { started, name: data.name, user: data.user, size: data.size || -1 };

			io.to(data.user).emit('download started', ws.fileAwait);

			setTimeout(() => {
				if (ws.fileAwait && ws.fileAwait.started == started) {
					ws.closeError({ message: 'File stream timed out!' });
				}
			}, 60000);
		}

        if (data.type == 'EOF') {
			if (!ws.fileAwait) return ws.closeError({ message: 'Not waiting for file!' });

			io.to(ws.fileAwait.user).emit('downloaded', ws.fileAwait.name);
			ws.fileAwait = undefined;
		}
	});
});

export interface ServerSocket extends WebSocket {
	lastPong: number;
	closeError: (data: any) => void;
	server: Server;
	authenticated: boolean;
	fileAwait: FileData | undefined;
	pinger: NodeJS.Timeout;
}

export interface FileData {
	name: string;
	user: string;
	size: number;
	started: number;
}
