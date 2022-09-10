import { Server, ServerModel } from '../models/server';
import WebSocket from 'ws';
import { io } from './socketio';

export var onlineServers: Map<string, ServerSocket> = new Map();

export const server = require('http').createServer();
const WSServer = require('ws').Server;

const wss = new WSServer({
	server: server
});

wss.on('connection', (ws: ServerSocket) => {
	ws.closeError = (data) => {
		ws.send(JSON.stringify({ type: 'ERROR', ok: false, ...data }));
		ws.terminate();
	};

	ws.pinger = setInterval(() => {
		if (Date.now() - ws.lastPong > 5000) {
			console.log(`[${ws.server.name}] Status updated to OFFLINE`);
			onlineServers.delete(ws.server._id);
			io.to(ws.server._id).emit('error', { message: 'Connection to server timed out!' });
			clearInterval(ws.pinger);
			return ws.closeError({ message: 'No PONG packet recieved for over 5000ms!' });
		}

		ws.send(JSON.stringify({ type: 'PING' }));
	}, 2000);

	setTimeout(() => {
		if (!ws.server) ws.closeError({ message: 'No authentication passed!' });
	}, 5000);

	ws.on('message', async (message) => {
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
			onlineServers.set(server._id, ws);

			// Mark server as setup if it is not already
			if (server.setup) {
				server.setup = undefined;
				await server.save();
			}
		}

		if (data.type == 'CONSOLE') {
			if (!ws.server) return ws.closeError({ message: 'Not authenticated.' });
			io.to(ws.server._id).emit('console', data);
		}

		if (data.type == 'CONSOLE_HISTORY') {
			if (!ws.server) return ws.closeError({ message: 'Not authenticated.' });
			ws.emit('CONSOLE_HISTORY', { history: data.history });
		}

		if (data.type == 'FILE_DATA') {
			if (!ws.server) return ws.closeError({ message: 'Not authenticated.' });
			ws.emit('FILE_DATA', { file: data.file });
		}
	});
});

export interface ServerSocket extends WebSocket {
	lastPong: number;
	closeError: (data: any) => void;
	server: Server;
	authenticated: boolean;
	pinger: NodeJS.Timeout;
}
