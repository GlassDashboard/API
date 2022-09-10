require('dotenv').config();

import { connectSocketio } from './servers/socketio';
import { connect as connectDatabase } from './database';
import { app } from './servers/express';
import { server } from './servers/socket';

(async () => {
	await connectDatabase();

	server.on('request', app);
	await connectSocketio();

	server.listen(process.env.PORT || 8080, async () => {
		console.log('Server started');
	});
})();
