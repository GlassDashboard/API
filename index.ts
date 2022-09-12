require('dotenv').config();

import { connectSocketio } from './servers/socketio';
import { connect as connectDatabase } from './database';
import { app } from './servers/express';
import { start as startFTPServer } from './ftp/server';
import { server } from './servers/socket';

(async () => {
	await connectDatabase();

	server.on('request', app);
	await connectSocketio();
	await startFTPServer();

	server.listen(process.env.PORT || 8080, async () => {
		console.log('Server started');
	});
})();
